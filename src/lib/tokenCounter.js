import { loadLlmSettings } from "../lib/settings.js";

/**
 * Get token count for a string based on model
 * This is a rough estimate - for accurate counts you'd want to use model-specific tokenizers
 */
function estimateTokens(text, model) {
  // Rough estimation: ~4 chars per token for English/mixed text
  return Math.ceil(text.length / 4);
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getDateKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the first day of the current month in YYYY-MM-DD format
 */
export function getMonthStartKey() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

/**
 * Load token counts from storage
 */
export async function loadTokenCounts() {
  const data = await browser.storage.local.get('tokenCounts');
  return data.tokenCounts || {};
}

/**
 * Update token counts for a model
 */
export async function updateTokenCount(model, inputTokens, outputTokens) {
  const counts = await loadTokenCounts();
  const dateKey = getDateKey();
  
  // Initialize structure if needed
  counts[model] = counts[model] || { input: {}, output: {} };
  counts[model].input[dateKey] = (counts[model].input[dateKey] || 0) + inputTokens;
  counts[model].output[dateKey] = (counts[model].output[dateKey] || 0) + outputTokens;

  await browser.storage.local.set({ tokenCounts: counts });
  return counts;
}

/**
 * Get token usage for a specific date range
 */
export async function getTokenUsage(model, startDate, endDate) {
  const counts = await loadTokenCounts();
  if (!counts[model]) return { input: 0, output: 0 };

  const modelCounts = counts[model];
  let inputTotal = 0;
  let outputTotal = 0;

  Object.entries(modelCounts.input).forEach(([date, count]) => {
    if (date >= startDate && date <= endDate) {
      inputTotal += count;
    }
  });

  Object.entries(modelCounts.output).forEach(([date, count]) => {
    if (date >= startDate && date <= endDate) {
      outputTotal += count;
    }
  });

  return { input: inputTotal, output: outputTotal };
}

/**
 * Get total token usage for today
 */
export async function getTodayTokenUsage(model) {
  const today = getDateKey();
  return getTokenUsage(model, today, today);
}

/**
 * Track tokens for an API call
 * @param {string} model - The model name
 * @param {string} prompt - The user prompt
 * @param {string} systemPrompt - The system prompt
 * @param {string} response - The model's response
 * @param {Object} actualCounts - Optional actual token counts from the API
 * @param {number} actualCounts.inputTokens - Actual input token count
 * @param {number} actualCounts.outputTokens - Actual output token count
 */
export async function trackTokens(model, prompt, systemPrompt, response, actualCounts = null) {
  const inputTokens = actualCounts?.inputTokens ?? estimateTokens(prompt + systemPrompt, model);
  const outputTokens = actualCounts?.outputTokens ?? estimateTokens(response, model);
  
  await updateTokenCount(model, inputTokens, outputTokens);
  return { inputTokens, outputTokens };
}

/**
 * Check if a token operation would exceed limits
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function checkTokenLimits(model, inputTokens, outputTokens) {
  const settings = await loadLlmSettings();
  if (!settings.dailyTokenLimit && !settings.monthlyTokenLimit) {
    return { allowed: true };
  }

  const totalNewTokens = inputTokens + outputTokens;
  const today = getDateKey();
  const monthStart = getMonthStartKey();
  
  // Get current usage
  const todayUsage = await getTokenUsage(model, today, today);
  const monthUsage = await getTokenUsage(model, monthStart, today);
  
  const todayTotal = todayUsage.input + todayUsage.output;
  const monthTotal = monthUsage.input + monthUsage.output;

  // Check daily limit
  if (settings.dailyTokenLimit > 0) {
    if (todayTotal + totalNewTokens > settings.dailyTokenLimit) {
      return {
        allowed: false,
        reason: `Daily token limit of ${settings.dailyTokenLimit} would be exceeded. Current usage: ${todayTotal}`
      };
    }
  }

  // Check monthly limit
  if (settings.monthlyTokenLimit > 0) {
    if (monthTotal + totalNewTokens > settings.monthlyTokenLimit) {
      return {
        allowed: false,
        reason: `Monthly token limit of ${settings.monthlyTokenLimit} would be exceeded. Current usage: ${monthTotal}`
      };
    }
  }

  return { allowed: true };
} 