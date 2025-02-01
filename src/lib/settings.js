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
    'monthlyTokenLimit',
    'domainMode',
    'domainList'
  ]);
  const provider = data.llmProvider || DEFAULT_PROVIDER;
  const model = data.llmModel || DEFAULT_MODELS[provider];
  const apiKey = data[`${provider}ApiKey`];
  const dailyTokenLimit = data.dailyTokenLimit || 0;
  const monthlyTokenLimit = data.monthlyTokenLimit || 0;
  const domainMode = data.domainMode || 'blacklist';
  const domainList = data.domainList || [];
  return { provider, model, apiKey, dailyTokenLimit, monthlyTokenLimit, domainMode, domainList };
}

/**
 * Save LLM settings to storage
 */
export async function saveLlmSettings({ provider, model, apiKey, dailyTokenLimit, monthlyTokenLimit, domainMode, domainList }) {
  const updates = {
    llmProvider: provider,
    llmModel: model,
    dailyTokenLimit: dailyTokenLimit || 0,
    monthlyTokenLimit: monthlyTokenLimit || 0,
    domainMode: domainMode || 'blacklist',
    domainList: domainList || []
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

/**
 * Check if a URL matches a pattern
 * Supports wildcards in both domain and path parts
 */
export function matchesUrlPattern(url, pattern) {
  // Split URL and pattern into domain and path parts
  const [patternDomain, ...patternPathParts] = pattern.split('/');
  const [urlDomain, ...urlPathParts] = url.split('/');
  
  // First check if domain matches
  const domainPattern = patternDomain
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  const domainRegex = new RegExp(`^${domainPattern}$`);
  if (!domainRegex.test(urlDomain)) {
    return false;
  }

  // If no path in pattern, match whole domain
  if (patternPathParts.length === 0) {
    return true;
  }

  // Check path match
  const patternPath = patternPathParts.join('/');
  const urlPath = urlPathParts.join('/');

  const pathPattern = patternPath
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  const pathRegex = new RegExp(`^${pathPattern}$`);
  return pathRegex.test(urlPath);
}

/**
 * Check if a URL should be processed based on current settings
 */
export async function shouldProcessDomain(url) {
  const settings = await loadLlmSettings();
  console.log('Settings:', settings);
  if (!settings.domainList || settings.domainList.length === 0) {
    return true;
  }

  const matches = settings.domainList.some(pattern => matchesUrlPattern(url, pattern));
  return settings.domainMode === 'whitelist' ? matches : !matches;
} 