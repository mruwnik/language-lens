// background.js
import { callLlmProvider, buildPartialTranslationPrompt } from '../lib/llmProviders.js';
import { loadLlmSettings } from '../lib/settings.js';
import { 
  makeTranslationCacheKey, 
  containsAnyWord, 
  splitIntoSentences,
} from '../lib/textProcessing.js';
import { debounce } from '../lib/utils.js';
import { 
  checkTokenLimits, 
  getTokenUsage,
  getDateKey,
  getMonthStartKey
} from '../lib/tokenCounter.js';
import { LLM_PROVIDERS } from '../lib/constants.js';

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

// Constants for icon paths
const ICONS = {
  normal: {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  warning: {
    "16": "icons/icon16-warning.png",
    "32": "icons/icon32-warning.png",
    "48": "icons/icon48-warning.png",
    "128": "icons/icon128-warning.png"
  },
  danger: {
    "16": "icons/icon16-danger.png",
    "32": "icons/icon32-danger.png",
    "48": "icons/icon48-danger.png",
    "128": "icons/icon128-danger.png"
  }
};

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

  // Estimate tokens before making the call
  const estimatedInputTokens = Math.ceil((translationInput.length + 500) / 4); // Add 500 chars for system prompt
  const estimatedOutputTokens = Math.ceil(translationInput.length / 2); // Assume output is roughly half the input

  // Check token limits
  const limitCheck = await checkTokenLimits(settings.model, estimatedInputTokens, estimatedOutputTokens);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason);
  }

  const translated = await callLlmProvider(
    buildPartialTranslationPrompt(translationInput, relevantWords),
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

const handlePartialTranslate = async (sentences, knownWords) => {
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

        await cleanupCache();
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
};

const buildNewWordsPrompt = (currentWords, language) => {
    const ruby = language === 'ja' ? ', "ruby": "reading"' : '';
    const format = `{ "native": "translation"${ruby} }`;
    const example = language === 'ja' ? '{"girl": {"native": "彼女", "ruby": "かのじょ"}}' : `{"${currentWords[0].en}": {"native": "${currentWords[0].native}"}}`;

    return `Based on the following list of known words and their usage frequency, suggest 10 new words that would be useful to learn next. The words should be related to the existing vocabulary but gradually increase in complexity.

Current vocabulary:
${currentWords.map(w => `${w.en} (seen ${w.viewCount} times)`).join('\n')}

Please respond with ONLY a JSON object mapping English words to their translations, in this format:
{ "word": ${format} }
  
Example:
${example}

Please respond with ONLY a JSON object.`;
};

const initializeNewWord = (word) => {
    word.viewCount = 0;
    if (word.ruby) {
        word.kanjiViewCounts = {};
        if (word.native) {
            [...word.native].forEach(char => {
                if (char.match(/[\u4e00-\u9faf]/)) {
                    word.kanjiViewCounts[char] = 0;
                }
            });
        }
    }
    return word;
};

const handleRequestNewWords = async ({ currentWords, language }) => {
    try {
        const settings = await loadLlmSettings();
        
        if (!settings.apiKey) {
            console.warn(`No API key found for provider: ${settings.provider}`);
            return { newWords: {} };
        }

        const prompt = buildNewWordsPrompt(currentWords, language);
        
        // Estimate tokens
        const estimatedInputTokens = Math.ceil((prompt.length + 500) / 4); // Add 500 chars for system prompt
        const estimatedOutputTokens = Math.ceil(prompt.length / 2); // Assume output is roughly half the input

        // Check token limits
        const limitCheck = await checkTokenLimits(settings.model, estimatedInputTokens, estimatedOutputTokens);
        if (!limitCheck.allowed) {
            return { newWords: {}, error: limitCheck.reason };
        }

        const result = await callLlmProvider(prompt, settings.apiKey, settings.provider, settings.model);
        
        try {
            const newWords = JSON.parse(result);
            if (typeof newWords !== 'object') throw new Error('Invalid response format');
            
            // Initialize view counts and other metadata
            Object.values(newWords).forEach(initializeNewWord);
            return { newWords };
        } catch (err) {
            console.error('Failed to parse LLM response:', err);
            return { newWords: {} };
        }
    } catch (err) {
        console.error("Error in REQUEST_NEW_WORDS:", err);
    }
};

const cleanupCache = async () => {
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
};

// Update extension icon based on API key and token limits
async function updateExtensionIcon() {
  const settings = await loadLlmSettings();
  if (!settings.apiKey) {
    await browser.action.setIcon({ path: ICONS.warning });
    await browser.action.setTitle({ title: 'Language Lens - API key required' });
    return;
  }

  // Check token limits if they're set
  if (settings.dailyTokenLimit || settings.monthlyTokenLimit) {
    const today = getDateKey();
    const monthStart = getMonthStartKey();
    const todayUsage = await getTokenUsage(settings.model, today, today);
    const monthUsage = await getTokenUsage(settings.model, monthStart, today);

    const todayTotal = todayUsage.input + todayUsage.output;
    const monthTotal = monthUsage.input + monthUsage.output;

    let iconState = 'normal';
    let title = 'Language Lens';

    // Check daily limit
    if (settings.dailyTokenLimit > 0) {
      const dailyPercentage = (todayTotal / settings.dailyTokenLimit) * 100;
      if (dailyPercentage >= 100) {
        iconState = 'danger';
        title = `Daily token limit exceeded (${Math.round(dailyPercentage)}%)`;
      } else if (dailyPercentage >= 80) {
        iconState = 'warning';
        title = `Approaching daily token limit (${Math.round(dailyPercentage)}%)`;
      }
    }

    // Check monthly limit - only update if more severe than daily
    if (settings.monthlyTokenLimit > 0) {
      const monthlyPercentage = (monthTotal / settings.monthlyTokenLimit) * 100;
      if (monthlyPercentage >= 100 && iconState !== 'danger') {
        iconState = 'danger';
        title = `Monthly token limit exceeded (${Math.round(monthlyPercentage)}%)`;
      } else if (monthlyPercentage >= 80 && iconState === 'normal') {
        iconState = 'warning';
        title = `Approaching monthly token limit (${Math.round(monthlyPercentage)}%)`;
      }
    }

    await browser.action.setIcon({ path: ICONS[iconState] });
    await browser.action.setTitle({ title });
  } else {
    await browser.action.setIcon({ path: ICONS.normal });
    await browser.action.setTitle({ title: 'Language Lens' });
  }
}

// Initialize cache and icon on startup
async function initialize() {
  await loadCache();
  await updateExtensionIcon();
}

// Update the message listener to handle settings changes
browser.runtime.onMessage.addListener((request, sender) => {
  let result = {};
  switch (request.type) {
    case "PARTIAL_TRANSLATE":
      result = handlePartialTranslate(request.payload.sentences, request.payload.knownWords);
      break;
    case "REQUEST_NEW_WORDS":
      result = handleRequestNewWords(request.payload);
      break;
    case "SETTINGS_UPDATED":
    case "TOKEN_COUNT_UPDATED":
      result = updateExtensionIcon().then(() => ({}));
      break;
    default:
      console.warn(`Unknown message type: ${request.type}`);
      return Promise.resolve({});
  }
  updateExtensionIcon().then(() => ({}));
  return result;
});

// Initialize on extension load
initialize();
