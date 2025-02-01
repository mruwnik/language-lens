import { LLM_PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODELS, AVAILABLE_MODELS } from './constants.js';

export async function loadKey(provider) {
  const key = `${provider}ApiKey`
  const data = await browser.storage.local.get([key]);
  return data[key]
}
/**
 * Load LLM settings from storage
 */
export async function loadLlmSettings() {
  const data = await browser.storage.local.get([
    'llmProvider',
    'llmModel',
    'openaiApiKey',
    'anthropicApiKey',
    'googleApiKey',
    'dailyTokenLimit',
    'monthlyTokenLimit'
  ]);
  const provider = data.llmProvider || DEFAULT_PROVIDER;
  const model = data.llmModel || DEFAULT_MODELS[provider];
  const apiKey = data[`${provider}ApiKey`];
  const dailyTokenLimit = data.dailyTokenLimit || 0;
  const monthlyTokenLimit = data.monthlyTokenLimit || 0;
  return { provider, model, apiKey, dailyTokenLimit, monthlyTokenLimit };
}

/**
 * Save LLM settings to storage
 */
export async function saveLlmSettings({ provider, model, apiKey, dailyTokenLimit, monthlyTokenLimit }) {
  const updates = {
    llmProvider: provider,
    llmModel: model,
    dailyTokenLimit: dailyTokenLimit || 0,
    monthlyTokenLimit: monthlyTokenLimit || 0
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