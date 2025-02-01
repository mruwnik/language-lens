import { trackTokens } from './tokenCounter.js';
import { LLM_PROVIDERS } from './constants.js';

// LLM Provider Configuration
export const DEFAULT_PROVIDER = LLM_PROVIDERS.OPENAI;

export const SYSTEM_PROMPT = `You are a specialized translation assistant that performs partial text translation with strict rules:

1. Only translate words from the provided word list, including their variations:
   - Different tenses (e.g. "eat" matches "eating", "ate", "eaten")
   - Common variations (e.g. "happy" matches "happier", "happiest")
   - Plural forms (e.g. "cat" matches "cats")

2. Core translation rules:
   - Keep ALL other words in English - never output "undefined" or leave words blank
   - Preserve ALL spaces exactly as in the original text
   - Keep all punctuation and formatting exactly as in the original
   - If unsure whether to translate a word, keep it in English

3. Word boundary rules:
   - Do not translate parts of unrelated words (e.g. don't translate "cat" in "category")
   - Do not translate parts of compound words unless the whole phrase matches
   - Do not translate words after articles like "the" or "a" unless explicitly listed

Your goal is to maintain readability while precisely replacing only the specified vocabulary.`;

/**
 * Call OpenAI API for translation
 */
async function callOpenAI(prompt, systemPrompt, apiKey, model = 'gpt-3.5-turbo', baseUrl = 'https://api.openai.com/v1/chat/completions') {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`OpenAI API error: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  const result = data.choices[0].message.content.trim();
  
  // Track token usage
  await trackTokens(model, prompt, systemPrompt, result);
  
  return result;
}

/**
 * Call Anthropic API for translation
 */
async function callAnthropic(prompt, systemPrompt, apiKey, model = 'claude-3-sonnet') {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\n${prompt}` }
      ],
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Anthropic API error: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  const result = data.content[0].text;
  
  // Track token usage using actual counts from Anthropic
  if (data.usage) {
    await trackTokens(model, prompt, systemPrompt, result, {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens
    });
  } else {
    // Fallback to estimation if usage data isn't available
    await trackTokens(model, prompt, systemPrompt, result);
  }
  
  return result;
}

/**
 * Call Google API for translation
 */
async function callGoogle(prompt, systemPrompt, apiKey, model = 'gemini-pro') {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Google API error: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  const result = data.candidates[0].content.parts[0].text;
  
  // Track token usage
  await trackTokens(model, prompt, systemPrompt, result);
  
  return result;
}

/**
 * Builds a prompt instructing the LLM to replace only the specified words
 */
export function buildPartialTranslationPrompt(text, relevantWords) {
  const wordList = relevantWords.map(word => [word.en, word.useKanji ? word.native : (word.ruby || word.native)])
                                .filter(word => word[0] && word[1])
                                .map(word => `${word[0]} -> ${word[1]}`)
                                .join('\n');

  return `Translate this text by replacing the specified source words with their target language equivalents.
Keep the XML tags intact and only translate the text inside them.  

Text: ${text}

Words to replace:
${wordList}

Example input:
<s id="s1">I am eating at school.</s>
<s id="s2">The cats are happier now.</s>

Example output:
<s id="s1">わたし am たべる at がっこう.</s>
<s id="s2">The ねこ are うれしい now.</s>
`;
}

/**
 * Main function to call the selected LLM provider
 */
export async function callLlmProvider(prompt, apiKey, provider = DEFAULT_PROVIDER, model) {
  try {
    switch (provider) {
      case LLM_PROVIDERS.OPENAI:
        return await callOpenAI(prompt, SYSTEM_PROMPT, apiKey, model);
      case LLM_PROVIDERS.OPENWEBUI:
        return await callOpenAI(prompt, SYSTEM_PROMPT, apiKey, model || 'default', 'http://localhost:5000/v1/chat/completions');
      case LLM_PROVIDERS.ANTHROPIC:
        return await callAnthropic(prompt, SYSTEM_PROMPT, apiKey, model);
      case LLM_PROVIDERS.GOOGLE:
        return await callGoogle(prompt, SYSTEM_PROMPT, apiKey, model);
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  } catch (error) {
    console.error(`${provider} translation error:`, error);
    throw error;
  }
} 