// background.js
import { callLlmProvider, buildPartialTranslationPrompt, buildNewWordsPrompt } from '../lib/llmProviders.js';
import { BEST_MODELS } from '../lib/constants.js';
import { loadLlmSettings } from '../lib/settings.js';
import { containsAnyWord } from '../lib/textProcessing.js';
import { 
  checkTokenLimits, 
  getTokenUsage,
  getDateKey,
  getMonthStartKey
} from '../lib/tokenCounter.js';
import {
  loadCache,
  getCachedTranslation,
  setCacheEntry,
  cleanupCache,
  saveCache,
  getPendingTranslation,
  setPendingTranslation,
  rejectPendingTranslation
} from '../lib/translationCache.js';

// Batch configuration
const BATCH_SIZE = 1000; // characters per batch
const BATCH_DELAY = 100; // ms between batches
const MAX_RETRIES = 3;

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

const batchSentences = (sentences) => {
  const batches = [];
  let currentBatch = [];
  let currentSize = 0;

  Object.entries(sentences).forEach(([id, text]) => {
    const size = text.length;
    if (currentSize + size > BATCH_SIZE && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }
    currentBatch.push({ id, text });
    currentSize += size;
  });

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

const translateBatch = async (batch, relevantWords, settings) => {
  const translationInput = batch
    .map(s => `<s id="${s.id}">${s.text}</s>`)
    .join('\n');

  // Estimate tokens before making the call
  const estimatedInputTokens = Math.ceil((translationInput.length + 500) / 4); // Add 500 chars for system prompt
  const estimatedOutputTokens = Math.ceil(translationInput.length / 2); // Assume output is roughly half the input

  // Check token limits
  const limitCheck = await checkTokenLimits(settings.llmModel, estimatedInputTokens, estimatedOutputTokens);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason);
  }

  const translated = await callLlmProvider(
    buildPartialTranslationPrompt(translationInput, relevantWords),
    settings.apiKey, 
    settings.llmProvider,
    settings.llmModel
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
      setCacheEntry(sentence.text, relevantWords, translation.text);
    }
  });
  await saveCache();

  return translatedSentences;
};

const getCached = (sentences, relevantWords) => {
    const wordsMap = Object.fromEntries(
        relevantWords.map(w => [w.en.toLowerCase(), w.ruby && !w.useKanji ? w.ruby : w.native])
    );

    const getWord = text => wordsMap[text.toLowerCase().trim()] || getCachedTranslation(text, relevantWords);

    const cached = Object.fromEntries(
        Object.entries(sentences)
            .map(([id, text]) => [id, getWord(text)])
            .filter(([, text]) => text)
    );
    const pending = Object.entries(sentences)
            .map(([id, text]) => [id, getPendingTranslation(text, relevantWords)])
            .filter(([, pending]) => pending)
            .map(([id, pending]) => pending.promise.then(translation => [id, translation]))

    const uncached = Object.fromEntries(
        Object.entries(sentences).filter(([id, text]) => !cached[id] && !getPendingTranslation(text, relevantWords))
    );

    return { cached, pending, uncached };
}


const getBatch = async (batch, relevantWords, settings) => {
  let retries = 0;
  let success = false;
  let translations = {};
  while (!success && retries < MAX_RETRIES) {
      try {
          const batchTranslations = await translateBatch(batch, relevantWords, settings);
          translations = {
              ...translations,
              ...Object.fromEntries(batchTranslations.map(t => [t.id, t.text]))
          };
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
              translations = {
                  ...translations,
                  ...Object.fromEntries(batch.map(s => [s.id, s.text]))
              };
          } else {
              // Exponential backoff between retries
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY * Math.pow(2, retries)));
          }
      }
  }
  return translations;
}

const handlePartialTranslate = async (sentences, knownWords) => {
    // Filter to relevant words first, using word boundaries
    const relevantWords = knownWords.filter(word => 
        word.en && word.native && // Only use words with both English and native translations
        Object.values(sentences).some(s => containsAnyWord(s, [word.en]))
    );

    if (!relevantWords.length) {
        return { translations: {} };
    }

    // Check cache and pending translations for each sentence
    const { cached, pending, uncached } = getCached(sentences, relevantWords);
    if (Object.keys(uncached).length === 0) {
        const resolved = await Promise.all(pending);
        return { translations: { ...cached, ...Object.fromEntries(resolved) } };
    }

    // Load settings including provider, model, and API key
    const settings = await loadLlmSettings();
        
    if (!settings.apiKey) {
        console.warn(`No API key found for provider: ${settings.llmProvider}`);
        return { translations: { ...cached, ...uncached } };
    }

    Object.values(uncached).forEach(text => {
        setPendingTranslation(text, relevantWords);
    });

    // Process each batch with retries and delays
    const batches = batchSentences(uncached);
    let translations = {};
    try {
        for (const batch of batches) {
            try {
                const batchTranslations = await getBatch(batch, relevantWords, settings);
                translations = { ...translations, ...batchTranslations };
            } catch (err) {
                console.error('Error in getBatch:', err);
                translations = { ...translations, ...batch };
                Object.values(batch).forEach(text => {
                    rejectPendingTranslation(text, relevantWords, err);
                });
            }
        }
    } catch (err) {
        console.error('Error in handlePartialTranslate:', err);
    }
    await cleanupCache();
    const resolved = await Promise.all(pending);
    return { translations: { ...translations, ...cached, ...Object.fromEntries(resolved) } };
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
            console.warn(`No API key found for provider: ${settings.llmProvider}`);
            return { newWords: {} };
        }

        const prompt = buildNewWordsPrompt(currentWords, language);
        
        // Estimate tokens
        const estimatedInputTokens = Math.ceil((prompt.length + 500) / 4); // Add 500 chars for system prompt
        const estimatedOutputTokens = Math.ceil(prompt.length / 2); // Assume output is roughly half the input

        // Check token limits
        const model = BEST_MODELS[settings.llmProvider] || settings.llmModel;
        const limitCheck = await checkTokenLimits(model, estimatedInputTokens, estimatedOutputTokens);
        if (!limitCheck.allowed) {
            return { newWords: {}, error: limitCheck.reason };
        }

        const result = await callLlmProvider(prompt, settings.apiKey, settings.llmProvider, model);
        const jsonMatch = result.match(/<json>(.*?)<\/json>/s);
        if (!jsonMatch) {
            throw new Error('No JSON object found in the response');
        }
        const data = jsonMatch[1];
        try {
            const newWords = JSON.parse(data);
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
