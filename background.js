// background.js

// Simple in-memory cache: { "<hash_of_input>": "<translated_text>" }
const translationCache = {};

browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.type === "PARTIAL_TRANSLATE") {
    const { originalText, knownWords } = request.payload;

    // 1) Build a cache key (hash of text + knownWords)
    const cacheKey = makeHash(`${originalText}_${JSON.stringify(knownWords)}`);
    if (translationCache[cacheKey]) {
      return Promise.resolve({ translatedText: translationCache[cacheKey] });
    }

    try {
      // 2) Retrieve user’s stored API key
      const storageData = await browser.storage.local.get("openAiApiKey");
      const apiKey = storageData.openAiApiKey;
      if (!apiKey) {
        // No key => return original text (fallback)
        console.warn("No OpenAI API key found in storage.");
        return { translatedText: originalText };
      }

      // 3) Call LLM
      const translated = await callOpenAiPartialTranslate(
        originalText,
        knownWords,
        apiKey
      );

      // 4) Save to cache
      translationCache[cacheKey] = translated;

      // 5) Return to content script
      return { translatedText: translated };
    } catch (err) {
      console.error("Error in PARTIAL_TRANSLATE:", err);
      return { translatedText: originalText };
    }
  }
});

/**
 * Call OpenAI's GPT-3.5 to do partial translation:
 * - only replace words found in `knownWords`.
 * - preserve all other text as-is.
 */
async function callOpenAiPartialTranslate(originalText, knownWords, apiKey) {
  const prompt = buildPartialTranslationPrompt(originalText, knownWords);

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
function buildPartialTranslationPrompt(text, knownWords) {
  // knownWords example:
  // [
  //   { en: "I", jpHiragana: "わたし", jpKanji: "私", useKanji: false },
  //   ...
  // ]
  return `
The user wants to partially translate the following English text to Japanese:
"${text}"

Known words (in JSON) that should be replaced:
${JSON.stringify(knownWords)}

Rules:
1. Only replace the exact English words listed in 'knownWords'.
2. If "useKanji" is true, use 'jpKanji'. Otherwise, use 'jpHiragana'.
3. Preserve all other English words exactly.
4. Output only the final partially translated text, no additional explanation.
`;
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
