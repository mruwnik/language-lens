// background.js
import { callLlmProvider } from '../lib/llmProviders.js';
import { loadLlmSettings } from '../lib/settings.js';
import { 
  makeTranslationCacheKey, 
  containsAnyWord, 
  splitIntoSentences,
} from '../lib/textProcessing.js';
import { debounce } from '../lib/utils.js';

// Cache configuration
const CACHE_MAX_SIZE = 1000; // Maximum number of translations to store
const CACHE_EXPIRY_DAYS = 5;
const CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Batch configuration
const BATCH_SIZE = 1000; // characters per batch
const BATCH_DELAY = 100; // ms between batches
const MAX_RETRIES = 3;

// Load cache from storage on startup
let translationCache = {};

async function loadCache() {
  try {
    const data = await browser.storage.local.get('translationCache');
    if (!data.translationCache) {
      translationCache = {};
      return;
    }

    // Filter out expired entries and convert to array for sorting
    const now = Date.now();
    const entries = Object.entries(data.translationCache)
      .filter(([_, entry]) => now - entry.timestamp < CACHE_EXPIRY_MS)
      .sort((a, b) => b[1].timestamp - a[1].timestamp); // Sort by newest first

    // Keep only the newest MAX_SIZE entries
    translationCache = entries
      .slice(0, CACHE_MAX_SIZE)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    // If we filtered anything out, save the cleaned cache
    if (Object.keys(translationCache).length < Object.keys(data.translationCache).length) {
      saveCache();
    }
  } catch (err) {
    console.error('Failed to load translation cache:', err);
    translationCache = {};
  }
}

// Save cache to storage (debounced)
const saveCache = debounce(async () => {
  try {
    await browser.storage.local.set({ translationCache });
  } catch (err) {
    console.error('Failed to save translation cache:', err);
  }
}, 1000);

const batchSentences = (sentences) => {
  const batches = [];
  let currentBatch = [];
  let currentSize = 0;

  sentences.forEach(sentence => {
    const size = sentence.text.length;
    if (currentSize + size > BATCH_SIZE && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }
    currentBatch.push(sentence);
    currentSize += size;
  });

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

const translateBatch = async (batch, relevantWords, settings, now) => {
  const translationInput = batch
    .map(s => `<s id="${s.id}">${s.text}</s>`)
    .join('\n');

  const translated = await callLlmProvider(
    translationInput,
    relevantWords, 
    settings.apiKey, 
    settings.provider,
    settings.model
  );

  // Parse translated text back into sentences with IDs
  const translatedSentences = translated
    .match(/<s id="([^"]+)">([^<]+)<\/s>/g)
    ?.map(s => {
      const match = s.match(/<s id="([^"]+)">([^<]+)<\/s>/);
      return match ? {
        id: match[1],
        text: match[2].trim()
      } : null;
    })
    .filter(Boolean) ?? [];

  // Cache translations
  translatedSentences.forEach(translation => {
    const sentence = batch.find(s => s.id === translation.id);
    if (sentence) {
      const cacheKey = makeTranslationCacheKey(sentence.text, relevantWords);
      translationCache[cacheKey] = {
        text: translation.text,
        timestamp: now
      };
    }
  });

  return translatedSentences;
};

// Update the message listener to use batching
browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.type === "PARTIAL_TRANSLATE") {
    const { sentences, knownWords } = request.payload;

    // Filter to relevant words first, using word boundaries
    const relevantWords = knownWords.filter(word => 
      word.en && word.native && // Only use words with both English and native translations
      sentences.some(s => containsAnyWord(s.text, [word.en]))
    );

    if (!relevantWords.length) {
      return { translations: sentences.map(s => ({ id: s.id, text: s.text })) };
    }

    // Check cache for each sentence
    const now = Date.now();
    const uncachedSentences = [];
    const translations = [];

    for (const sentence of sentences) {
      const cacheKey = makeTranslationCacheKey(sentence.text, relevantWords);
      const cached = translationCache[cacheKey];

      if (cached && now - cached.timestamp < CACHE_EXPIRY_MS) {
        translations.push({
          id: sentence.id,
          text: cached.text
        });
      } else {
        uncachedSentences.push(sentence);
      }
    }

    // If all sentences were cached, return immediately
    if (uncachedSentences.length === 0) {
      return Promise.resolve({ translations });
    }

    try {
      // Load settings including provider, model, and API key
      const settings = await loadLlmSettings();
      
      if (!settings.apiKey) {
        console.warn(`No API key found for provider: ${settings.provider}`);
        return { 
          translations: [
            ...translations,
            ...uncachedSentences.map(s => ({ id: s.id, text: s.text }))
          ]
        };
      }

      // Split uncached sentences into batches
      const batches = batchSentences(uncachedSentences);
      
      // Process each batch with retries and delays
      for (const batch of batches) {
        let retries = 0;
        let success = false;
        
        while (!success && retries < MAX_RETRIES) {
          try {
            const batchTranslations = await translateBatch(batch, relevantWords, settings, now);
            translations.push(...batchTranslations);
            success = true;
            
            // Add delay between batches if there are more
            if (batches.length > 1) {
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
          } catch (err) {
            retries++;
            if (retries === MAX_RETRIES) {
              console.error(`Failed to translate batch after ${MAX_RETRIES} retries:`, err);
              // On final retry failure, add untranslated sentences
              translations.push(...batch.map(s => ({ id: s.id, text: s.text })));
            } else {
              // Exponential backoff between retries
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY * Math.pow(2, retries)));
            }
          }
        }
      }

      // If cache is too large, remove oldest entries
      const entries = Object.entries(translationCache);
      if (entries.length > CACHE_MAX_SIZE) {
        const sortedEntries = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        translationCache = sortedEntries
          .slice(0, CACHE_MAX_SIZE)
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {});
      }

      saveCache();
      return { translations };
    } catch (err) {
      console.error("Error in PARTIAL_TRANSLATE:", err);
      return { 
        translations: [
          ...translations,
          ...uncachedSentences.map(s => ({ id: s.id, text: s.text }))
        ]
      };
    }
  }
});

// Initialize cache on extension load
loadCache();
