// background.js

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

browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.type === "PARTIAL_TRANSLATE") {
    const { originalText, knownWords } = request.payload;

    // Filter to relevant words first, using word boundaries
    const relevantWords = knownWords.filter(word => {
      const wordRegex = new RegExp(`\\b${word.en}\\b`, 'i');
      return wordRegex.test(originalText);
    });

    // Create cache key using only relevant words
    const cacheKey = makeHash(
      originalText + 
      relevantWords
        .map(w => `${w.en}:${w.useKanji ? w.native : w.ruby}`)
        .sort()
        .join(',')
    );

    // Check cache and expiry
    const cached = translationCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      return Promise.resolve({ translatedText: cached.text });
    }

    try {
      // 2) Retrieve user's stored API key
      const storageData = await browser.storage.local.get("openaiApiKey");
      const apiKey = storageData.openaiApiKey;
      if (!apiKey) {
        // No key => return original text (fallback)
        console.warn("No OpenAI API key found in storage.");
        return { translatedText: originalText };
      }

      // 3) Call LLM with already filtered words
      const translated = await callOpenAiPartialTranslate(
        originalText,
        relevantWords,
        apiKey
      );

      // 4) Save to cache with timestamp
      const now = Date.now();
      translationCache[cacheKey] = {
        text: translated,
        timestamp: now
      };

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

      // 5) Return to content script
      return { translatedText: translated };
    } catch (err) {
      console.error("Error in PARTIAL_TRANSLATE:", err);
      return { translatedText: originalText };
    }
  }
});

// Initialize cache on extension load
loadCache();

/**
 * Call OpenAI's GPT-3.5 to do partial translation:
 * - only replace words found in `knownWords`.
 * - preserve all other text as-is.
 */
async function callOpenAiPartialTranslate(originalText, relevantWords, apiKey) {
  const prompt = buildPartialTranslationPrompt(originalText, relevantWords);
  return prompt;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful translator that only partially translates specific words."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2
    })
  });

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("No completion from OpenAI");
  }

  return data.choices[0].message.content.trim();
}

/**
 * Builds a prompt instructing the LLM to replace only the specified words,
 * preserving everything else exactly.
 */
function buildPartialTranslationPrompt(text, relevantWords) {
  // Create word list with word boundaries marked
  const wordList = relevantWords.map(word => 
    `${word.en} -> ${word.useKanji ? word.native : word.ruby}`
  ).join('\n');

  return `Translate this text by replacing the specified source words with their target language equivalents: "${text}"

Words to replace (including their common variations):
${wordList}

Rules:
1. Replace words from the list above, including:
   - Different tenses (e.g. "eat" matches "eating", "ate", "eaten")
   - Common variations (e.g. "happy" matches "happier", "happiest")
   - Plural forms (e.g. "cat" matches "cats")
2. Keep ALL other words in English - never output "undefined" or leave words blank
3. Preserve ALL spaces exactly as they appear in the original text:
   - Keep a space before and after each translated word
   - Example: "at school" -> "at がっこう" (not "atがっこう" or "at　がっこう")
4. Do not translate a word if it's:
   - Part of an unrelated word (e.g. don't translate "cat" in "category")
   - Part of a compound word unless the whole phrase matches
   - After articles like "the" or "a" unless explicitly listed
5. Keep all punctuation and formatting exactly as in the original
6. If unsure whether to translate a word, keep it in English

Examples:
Text: "I am eating at school. Schools are big. The time is 2pm."
Words:
I -> わたし
eat -> たべる
school -> がっこう

Should output: "わたし am たべる at がっこう. がっこう are big. The time is 2pm."
(Note: translated variations like "eating" and "schools", but kept "time" in English)

Text: "The cats are happier now"
Words:
cat -> ねこ
happy -> うれしい

Should output: "The ねこ are うれしい now"
(Note: matched plural "cats" and comparative "happier")`;
}

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
