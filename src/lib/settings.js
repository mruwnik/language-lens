import { LLM_PROVIDERS, DEFAULT_PROVIDER } from './llmProviders.js';

// Default model configurations per provider
export const DEFAULT_MODELS = {
  [LLM_PROVIDERS.OPENAI]: 'gpt-4o-mini',
  [LLM_PROVIDERS.ANTHROPIC]: 'claude-3-haiku-20240307',
  [LLM_PROVIDERS.OPENWEBUI]: 'default',
  [LLM_PROVIDERS.GOOGLE]: 'gemini-pro'
};

// Available models per provider
export const AVAILABLE_MODELS = {
  [LLM_PROVIDERS.OPENAI]: [
    'gpt-4o-mini',
    'gpt-3.5-turbo',
  ],
  [LLM_PROVIDERS.ANTHROPIC]: [
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ],
  [LLM_PROVIDERS.OPENWEBUI]: [
    'default'  // This will be populated dynamically from the server
  ],
  [LLM_PROVIDERS.GOOGLE]: [
    'gemini-pro'
  ]
};


/**
 * Load LLM settings from storage
 */
export async function loadLlmSettings() {
  const data = await browser.storage.local.get([
    'llmProvider',
    'llmModel',
    'openaiApiKey',
    'anthropicApiKey',
    'googleApiKey'
  ]);

  return {
    provider: data.llmProvider || DEFAULT_PROVIDER,
    model: data.llmModel || DEFAULT_MODELS[data.llmProvider || DEFAULT_PROVIDER],
    apiKey: data[`${data.llmProvider || DEFAULT_PROVIDER}ApiKey`]
  };
}

/**
 * Save LLM settings to storage
 */
export async function saveLlmSettings({ provider, model, apiKey }) {
  const updates = {
    llmProvider: provider,
    llmModel: model
  };

  // Only update the API key if one is provided
  if (apiKey) {
    updates[`${provider}ApiKey`] = apiKey;
  }

  await browser.storage.local.set(updates);
}

/**
 * Get available models for a provider
 * For OpenWebUI, this will fetch from the server
 */
export async function getAvailableModels(provider) {
  if (provider === LLM_PROVIDERS.OPENWEBUI) {
    try {
      const response = await fetch('http://localhost:5000/v1/models');
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      return data.data.map(model => model.id);
    } catch (error) {
      console.error('Failed to fetch OpenWebUI models:', error);
      return ['default'];
    }
  }
  
  return AVAILABLE_MODELS[provider] || [];
} 