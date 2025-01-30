// background.js
import { callLlmProvider } from '../lib/llmProviders.js';
import { loadLlmSettings } from '../lib/settings.js';

// Cache configuration
const CACHE_MAX_SIZE = 1000; // Maximum number of translations to store
const CACHE_EXPIRY_DAYS = 5;
const CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

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

// Debounce helper
function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

// Update the message listener to use the new settings
browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.type === "PARTIAL_TRANSLATE") {
    const { sentences, knownWords } = request.payload;

    // Filter to relevant words first, using word boundaries
    const relevantWords = knownWords.filter(word => {
      const wordRegex = new RegExp(`\\b${word.en}\\b`, 'i');
      return sentences.some(s => wordRegex.test(s.text));
    });

    // Sort words for consistent cache keys
    const sortedWords = relevantWords
      .map(w => w.en)
      .sort()
      .join(',');

    // Check cache for each sentence
    const now = Date.now();
    const uncachedSentences = [];
    const translations = [];

    for (const sentence of sentences) {
      const cacheKey = makeHash(sentence.text + sortedWords);
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

      // Call selected provider with model for uncached sentences
      const translated = await callLlmProvider(
        uncachedSentences.map(s => s.text).join('\n'), 
        relevantWords, 
        settings.apiKey, 
        settings.provider,
        settings.model
      );

      // Split translated text back into sentences
      const translatedParts = translated.split(/\n/).filter(Boolean);
      
      // Cache each newly translated sentence
      uncachedSentences.forEach((sentence, i) => {
        const translatedText = translatedParts[i]?.trim() || sentence.text;
        const cacheKey = makeHash(sentence.text + sortedWords);
        
        translationCache[cacheKey] = {
          text: translatedText,
          timestamp: now
        };

        translations.push({
          id: sentence.id,
          text: translatedText
        });
      });

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

/**
 * A simple non-cryptographic hash to create a cache key from a string.
 */
function makeHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit int
  }
  return hash.toString();
}
