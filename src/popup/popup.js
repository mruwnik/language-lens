// popup.js

import { defaultDictionaries } from "../lib/defaultDictionaries.js";
import {
    getAvailableModels,
    loadLlmSettings,
    saveLlmSettings,
    loadKey
} from "../lib/settings.js";
import { DEFAULT_MODELS } from '../lib/constants.js';
import { loadTokenCounts } from "../lib/tokenCounter.js";
import { formatTooltip, getDisplayText, speakWord } from "../lib/wordDisplay.js";

console.log("Starting popup.js");

// Constants and Types
export const MESSAGES = {
  REQUIRED_FIELDS: "English and translation are required!",
  WORD_EXISTS: "This word already exists!",
  API_KEY_REQUIRED: "Please enter your OpenAI API key (sk-...)",
  API_KEY_SAVED: "API key saved!",
  API_KEY_ERROR: "Error saving API key. Please try again.",
  NO_WORD_TO_SUGGEST: "Please enter an English word first!",
  SUGGESTION_ERROR: "Error getting suggestions. Please try again.",
  TOKEN_LIMIT_ERROR: "Token limit exceeded. Please try again later or adjust your limits.",
};

const KANJI_REGEX = /[\u4e00-\u9faf]/;
const UNDO_TIMEOUT_MS = 5000;

// Pure functions
export const getKanjiViewCounts = (text) =>
  !text
    ? {}
    : [...text].reduce((counts, char) => {
        if (char.match(KANJI_REGEX)) {
          counts[char] = 0;
        }
        return counts;
      }, {});

export const createWord = (currentLang, native, ruby) => ({
  native,
  ruby,
  viewCount: 0,
});

export const validateNewWord = (en, translation, currentLangData) => {
  if (!en || !translation) {
    alert(MESSAGES.REQUIRED_FIELDS);
    return false;
  }

  if (currentLangData.words[en]) {
    alert(MESSAGES.WORD_EXISTS);
    return false;
  }

  return true;
};

export const clearInputs = (...inputs) =>
  inputs.forEach((input) => (input.value = ""));

// Storage functions
export const loadLanguageData = async (lang) => {
  const data = await browser.storage.local.get(lang);
  if (!data[lang]) {
    const defaultDict = defaultDictionaries[lang];
    if (defaultDict) {
      return {
        words: { ...defaultDict.words },
        settings: { ...defaultDict.settings },
      };
    }
    return { words: {}, settings: { voice: `${lang}-${lang.toUpperCase()}` } };
  }
  return data[lang];
};

export const addWord = async (
  currentLang,
  currentLangData,
  word,
  translation,
  ruby
) => {
  if (!validateNewWord(word, translation, currentLangData)) {
    return false;
  }

  const updatedData = {
    ...currentLangData,
    words: {
      ...currentLangData.words,
      [word]: createWord(currentLang, translation, ruby),
    },
  };

  await browser.storage.local.set({ [currentLang]: updatedData });
  return true;
};

// DOM manipulation functions
export const updateHeader = (currentLang, currentLangData, wordList) => {
  const header = document.querySelector(".word-item.word-header");
  if (!header) return;

  const hasKanji = currentLang === "ja";

  header.innerHTML = `
        <div>English</div>
        <div>${hasKanji ? "Reading" : "Translation"}</div>
        ${hasKanji ? "<div>Use Kanji</div>" : "<div></div>"}
        <div></div>
        <div></div>
    `;

  if (hasKanji) {
    const toggle = document.createElement("button");
    toggle.className = "kanji-toggle";
    toggle.title = "Toggle Global Kanji Display";
    toggle.textContent = "漢字";
    toggle.classList.toggle(
      "active",
      currentLangData.settings?.showKanji ?? true
    );

    header.children[1].appendChild(toggle);

    toggle.addEventListener("click", async () => {
      const updatedData = {
        ...currentLangData,
        settings: {
          ...currentLangData.settings,
          showKanji: !currentLangData.settings?.showKanji,
        },
      };
      toggle.classList.toggle("active", updatedData.settings.showKanji);
      await browser.storage.local.set({ [currentLang]: updatedData });
      renderWords(currentLang, updatedData);
    });
  }
};

export const wordMatchesSearch = (english, wordData, searchTerm) => {
  if (!searchTerm) return true;

  const searchIn = [
    english.toLowerCase(),
    (wordData.hiragana || "").toLowerCase(),
    (wordData.ruby || "").toLowerCase(),
    (wordData.native || "").toLowerCase(),
    (wordData.kanji || "").toLowerCase(),
  ];

  return searchIn.some((text) => text.includes(searchTerm.toLowerCase()));
};

export const createUndoContainer = (wordList) => {
  const container = document.createElement("div");
  container.className = "undo-container";
  wordList.parentNode.insertBefore(container, wordList);
  return container;
};

export const showUndoMessage = (
  wordKey,
  wordData,
  messageId,
  currentLang,
  currentLangData,
  deletedWords,
  undoTimeouts
) => {
  const wordList = document.getElementById("wordList");
  const undoMsg = document.createElement("div");
  undoMsg.className = "undo-message";
  undoMsg.dataset.messageId = messageId;
  undoMsg.innerHTML = `
        <span>"${wordKey}" deleted</span>
        <button class="undo-btn">Undo</button>
    `;

  const undoBtn = undoMsg.querySelector(".undo-btn");
  undoBtn.addEventListener("click", async () => {
    const idx = deletedWords.findIndex((dw) => dw.messageId === messageId);
    if (idx !== -1) {
      const { key, data, language } = deletedWords[idx];
      const updatedData = {
        ...currentLangData,
        words: {
          ...currentLangData.words,
          [key]: data,
        },
      };
      await browser.storage.local.set({ [language]: updatedData });
      deletedWords[idx].undone = true;
      undoMsg.remove();
      clearTimeout(undoTimeouts.get(messageId));
      undoTimeouts.delete(messageId);

      const container = document.querySelector(".undo-container");
      if (container?.children.length === 0) {
        container.remove();
      }

      renderWords(currentLang, updatedData);
    }
  });

  const undoContainer =
    document.querySelector(".undo-container") || createUndoContainer(wordList);
  undoContainer.insertBefore(undoMsg, undoContainer.firstChild);

  const timeout = setTimeout(() => {
    undoMsg.remove();
    const idx = deletedWords.findIndex((dw) => dw.messageId === messageId);
    if (idx !== -1 && !deletedWords[idx].undone) {
      deletedWords.splice(idx, 1);
    }
    undoTimeouts.delete(messageId);
    if (undoContainer.children.length === 0) {
      undoContainer.remove();
    }
  }, UNDO_TIMEOUT_MS);

  undoTimeouts.set(messageId, timeout);
};

export const renderWords = (currentLang, currentLangData, searchTerm = "") => {
  const wordList = document.getElementById("wordList");
  if (!wordList) return;

  const sortedWords = Object.entries(currentLangData.words)
    .filter(([english, data]) => wordMatchesSearch(english, data, searchTerm))
    .sort((a, b) => a[0].localeCompare(b[0]));

  updateHeader(currentLang, currentLangData, wordList);

  wordList.innerHTML = sortedWords
    .map(([key, data]) => {
      const displayText = getDisplayText(data, currentLangData.settings);
      const useKanji = currentLang === "ja" && data.ruby;
      const useKanjiClass = data.useKanji ? "active" : "";

      return `
            <div class="word-item">
                <div title="${key}">${key}</div>
                <div title="${formatTooltip(data, currentLangData.settings)}">${displayText}</div>
                ${
                  useKanji
                    ? `<button class="kanji-toggle ${useKanjiClass}" data-word="${key}" title="Toggle Kanji for this word">
                        ${data.useKanji ? "✓" : "✗"}
                    </button>`
                    : "<div></div>"
                }
                <button class="delete-btn" data-word="${key}">×</button>
                <button class="speak-btn" data-word="${key}">🔊</button>
            </div>
        `;
    })
    .join("");

  // Add event listeners
  const deletedWords = [];
  const undoTimeouts = new Map();

  wordList.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const wordKey = e.target.dataset.word;
      const wordData = currentLangData.words[wordKey];
      const messageId = Date.now().toString();

      deletedWords.push({
        key: wordKey,
        data: wordData,
        language: currentLang,
        messageId,
        undone: false,
      });

      const updatedData = {
        ...currentLangData,
        words: { ...currentLangData.words },
      };
      delete updatedData.words[wordKey];

      await browser.storage.local.set({ [currentLang]: updatedData });
      currentLangData = updatedData; // Update in-memory data
      renderWords(currentLang, currentLangData, searchTerm);

      showUndoMessage(
        wordKey,
        wordData,
        messageId,
        currentLang,
        updatedData,
        deletedWords,
        undoTimeouts
      );
    });
  });

  wordList.querySelectorAll(".kanji-toggle").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const wordKey = e.target.dataset.word;
      const updatedData = {
        ...currentLangData,
        words: {
          ...currentLangData.words,
          [wordKey]: {
            ...currentLangData.words[wordKey],
            useKanji: !currentLangData.words[wordKey].useKanji,
          },
        },
      };
      await browser.storage.local.set({ [currentLang]: updatedData });
      currentLangData = updatedData; // Update in-memory data
      renderWords(currentLang, currentLangData, searchTerm);
    });
  });

  wordList.querySelectorAll(".speak-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wordKey = btn.dataset.word;
      const wordData = currentLangData.words[wordKey];
      speakWord(
        wordData.native || wordData.ruby,
        currentLangData.settings.voice
      );
    });
  });
};

// Event handlers
export const handleAddWord = async (currentLang, currentLangData, inputs) => {
  const { newEnglish, newTranslation, newFurigana } = inputs;
  const en = newEnglish.value.trim();
  const translation = newTranslation.value.trim();
  const nativeScript = newFurigana.value.trim();

  const success = await addWord(
    currentLang,
    currentLangData,
    en,
    translation,
    nativeScript
  );
  if (success) {
    clearInputs(newEnglish, newTranslation, newFurigana);
    // Update the in-memory data
    currentLangData = await loadLanguageData(currentLang);
    renderWords(currentLang, currentLangData);
  }
};

export const updateFormPlaceholders = (
  currentLang,
  newTranslation,
  newFurigana
) => {
  const isJapanese = currentLang === "ja";
  newTranslation.placeholder = "Translation";
  newFurigana.placeholder = "Furigana";

  newFurigana.style.display = isJapanese ? "block" : "none";

  const form = document.querySelector(".add-word-form");
  form.style.gridTemplateColumns = isJapanese
    ? "repeat(4, 1fr)"
    : "repeat(3, 1fr)";
};

// Update model options based on selected provider
async function updateModelOptions(provider) {
  const llmModel = document.getElementById("llmModel");
  const apiKey = document.getElementById("apiKey")
  llmModel.innerHTML = ""; // Clear existing options

  apiKey.value = await loadKey(provider) || "";

  const models = await getAvailableModels(provider);
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    llmModel.appendChild(option);
  });

  // Select default model for provider
  llmModel.value = DEFAULT_MODELS[provider];
}

// Load and save LLM settings
async function initializeLlmSettings(settings, { llmProvider, LLMDetails }) {
  llmProvider.value = settings.provider;

  await updateModelOptions(settings.provider);

  if (!settings.apiKey) {
    LLMDetails.setAttribute('open', '');
  }
  if (settings.model) {
    llmModel.value = settings.model;
  }
  if (settings.dailyTokenLimit) {
    document.getElementById("dailyTokenLimit").value = (settings.dailyTokenLimit / 1_000_000).toFixed(4);
  }
  if (settings.monthlyTokenLimit) {
    document.getElementById("monthlyTokenLimit").value = (settings.monthlyTokenLimit / 1_000_000).toFixed(4);
  }
}

async function saveLlmSettingsHandler() {
  const provider = document.getElementById("llmProvider").value;
  const model = document.getElementById("llmModel").value;
  const apiKey = document.getElementById("apiKey").value.trim();
  const dailyTokenLimit = parseFloat(document.getElementById("dailyTokenLimit").value) * 1_000_000 || 0;
  const monthlyTokenLimit = parseFloat(document.getElementById("monthlyTokenLimit").value) * 1_000_000 || 0;

  if (!apiKey) {
    alert(MESSAGES.API_KEY_REQUIRED);
    return;
  }

  try {
    await saveLlmSettings({ provider, model, apiKey, dailyTokenLimit, monthlyTokenLimit });
    // Notify background script that settings have changed
    await browser.runtime.sendMessage({ type: "SETTINGS_UPDATED" });
    alert("Settings saved successfully!");
  } catch (error) {
    console.error("Error saving settings:", error);
    alert("Error saving settings. Please try again.");
  }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format token limit for display (in millions)
 */
function formatTokenLimit(num) {
  if (!num) return "0";
  return (num / 1_000_000).toFixed(4) + "M";
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getDateKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the first day of the current month in YYYY-MM-DD format
 */
function getMonthStartKey() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

/**
 * Get dates for the last n days
 */
function getLastNDays(n) {
  const dates = [];
  const today = new Date();

  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }

  return dates;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Update token limit indicators
 */
async function updateLimitIndicators(model, todayTotal, monthTotal) {
  const settings = await loadLlmSettings();
  const limitAlerts = document.getElementById("limitAlerts");
  const alerts = [];

  // Check daily limit
  if (settings.dailyTokenLimit > 0) {
    const dailyPercentage = (todayTotal / settings.dailyTokenLimit) * 100;
    if (dailyPercentage >= 80) {
      alerts.push({
        type: dailyPercentage >= 100 ? 'danger' : 'warning',
        text: `Daily token usage: ${Math.round(dailyPercentage)}% of ${formatTokenLimit(settings.dailyTokenLimit)}`,
        icon: dailyPercentage >= 100 ? '⚠️' : '⚡'
      });
    }
  }

  // Check monthly limit
  if (settings.monthlyTokenLimit > 0) {
    const monthlyPercentage = (monthTotal / settings.monthlyTokenLimit) * 100;
    if (monthlyPercentage >= 80) {
      alerts.push({
        type: monthlyPercentage >= 100 ? 'danger' : 'warning',
        text: `Monthly token usage: ${Math.round(monthlyPercentage)}% of ${formatTokenLimit(settings.monthlyTokenLimit)}`,
        icon: monthlyPercentage >= 100 ? '⚠️' : '⚡'
      });
    }
  }

  // Update alerts display
  limitAlerts.outerHTML = alerts.length == 0 ? '' : alerts
    .map(alert => `
      <div class="limit-alert ${alert.type}">
        <span class="limit-alert-icon">${alert.icon}</span>
        ${alert.text}
      </div>
    `)
    .join('');

  // Also update the indicators in the token usage section
  const dailyIndicator = document.getElementById("dailyLimitIndicator");
  const monthlyIndicator = document.getElementById("monthlyLimitIndicator");

  if (settings.dailyTokenLimit > 0) {
    const dailyPercentage = (todayTotal / settings.dailyTokenLimit) * 100;
    dailyIndicator.textContent = `Daily: ${Math.round(dailyPercentage)}%`;
    dailyIndicator.className = "limit-indicator " + getLimitClass(dailyPercentage);
  } else {
    dailyIndicator.textContent = "";
  }

  if (settings.monthlyTokenLimit > 0) {
    const monthlyPercentage = (monthTotal / settings.monthlyTokenLimit) * 100;
    monthlyIndicator.textContent = `Monthly: ${Math.round(monthlyPercentage)}%`;
    monthlyIndicator.className = "limit-indicator " + getLimitClass(monthlyPercentage);
  } else {
    monthlyIndicator.textContent = "";
  }
}

/**
 * Get the appropriate CSS class based on usage percentage
 */
function getLimitClass(percentage) {
  if (percentage >= 100) return "danger";
  if (percentage >= 80) return "warning";
  return "ok";
}

/**
 * Update token usage histogram
 */
async function updateTokenHistogram(model, days = 7) {
  const histogram = document.querySelector(".token-histogram");
  if (!histogram) return;

  // Clear existing content
  histogram.innerHTML = "";

  // Create tooltip
  const tooltip = document.createElement("div");
  tooltip.className = "histogram-tooltip";
  histogram.appendChild(tooltip);

  // Get dates and usage data
  const dates = getLastNDays(days);
  const counts = await loadTokenCounts();
  const modelData = counts[model] || { input: {}, output: {} };

  // Calculate max value for scaling
  let maxTokens = 0;
  dates.forEach((date) => {
    const inputTokens = modelData.input[date] || 0;
    const outputTokens = modelData.output[date] || 0;
    maxTokens = Math.max(maxTokens, inputTokens, outputTokens);
  });

  // Calculate totals
  let totalInput = 0;
  let totalOutput = 0;
  let todayTotal = 0;
  let monthTotal = 0;
  const today = getDateKey();
  const monthStart = getMonthStartKey();

  dates.forEach((date) => {
    const inputTokens = modelData.input[date] || 0;
    const outputTokens = modelData.output[date] || 0;
    totalInput += inputTokens;
    totalOutput += outputTokens;

    // Calculate today's total
    if (date === today) {
      todayTotal = inputTokens + outputTokens;
    }

    // Calculate month's total
    if (date >= monthStart) {
      monthTotal += inputTokens + outputTokens;
    }

    // Create bars
    const dayDiv = document.createElement("div");
    dayDiv.className = "histogram-day";

    // Input bar
    const inputBar = document.createElement("div");
    inputBar.className = "histogram-bar input";
    inputBar.style.height = maxTokens
      ? `${(inputTokens / maxTokens) * 150}px`
      : "0";

    // Output bar
    const outputBar = document.createElement("div");
    outputBar.className = "histogram-bar output";
    outputBar.style.height = maxTokens
      ? `${(outputTokens / maxTokens) * 150}px`
      : "0";

    // Date label
    const label = document.createElement("div");
    label.className = "histogram-label";
    label.textContent = formatDate(date);

    // Add hover effect
    [inputBar, outputBar].forEach((bar) => {
      bar.addEventListener("mouseover", (e) => {
        tooltip.style.display = "block";
        tooltip.style.left = `${e.pageX - histogram.getBoundingClientRect().left}px`;
        tooltip.style.top = `${e.pageY - histogram.getBoundingClientRect().top - 30}px`;
        tooltip.textContent = `${formatDate(date)}
Input: ${formatTokenLimit(inputTokens)}
Output: ${formatTokenLimit(outputTokens)}`;
      });

      bar.addEventListener("mouseout", () => {
        tooltip.style.display = "none";
      });
    });

    dayDiv.appendChild(outputBar);
    dayDiv.appendChild(inputBar);
    dayDiv.appendChild(label);
    histogram.appendChild(dayDiv);
  });

  // Update totals
  document.getElementById("totalInput").textContent = formatTokenLimit(totalInput);
  document.getElementById("totalOutput").textContent = formatTokenLimit(totalOutput);

  // Update limit indicators
  await updateLimitIndicators(model, todayTotal, monthTotal);
}

async function suggestRelatedWords(currentLang, currentLangData) {
  const currentWords = Object.entries(currentLangData.words).map(([en, data]) => ({
    en,
    native: data.native,
    ruby: data.ruby,
    viewCount: data.viewCount || 0
  }));

  if (currentWords.length === 0) {
    throw new Error("Please add some words first to get suggestions based on your vocabulary.");
  }

  const message = {
    type: "REQUEST_NEW_WORDS",
    payload: {
      currentWords,
      language: currentLang
    }
  };

  try {
    const response = await browser.runtime.sendMessage(message);
    const suggestions = Object.entries(response.newWords)
      .filter(([en]) => !currentLangData.words[en]) // Filter out existing words
      .map(([en, data]) => ({
        en,
        ...data
      }));

    if (suggestions.length === 0) {
      throw new Error("No new words to suggest. Try adding more words to your vocabulary first.");
    }

    return suggestions;
  } catch (error) {
    console.error('Error getting suggestions:', error);
    throw new Error(error.message || MESSAGES.SUGGESTION_ERROR);
  }
}

async function handleSuggestWords(currentLang, currentLangData) {
  const suggestBtn = document.getElementById('suggestWords');
  suggestBtn.disabled = true;
  suggestBtn.textContent = 'Getting suggestions...';

  try {
    let suggestions = await suggestRelatedWords(currentLang, currentLangData);
    
    if (suggestions.error) {
      if (suggestions.error.includes('token limit')) {
        alert(MESSAGES.TOKEN_LIMIT_ERROR);
      } else {
        alert(suggestions.error || MESSAGES.SUGGESTION_ERROR);
      }
      return;
    }
    
    // Create a modal to display suggestions
    const modal = document.createElement('div');
    modal.className = 'suggestion-modal';
    
    function renderSuggestions() {
      modal.innerHTML = `
        <div class="suggestion-content">
          <h3>Suggested words to learn next:</h3>
          ${suggestions.length > 0 ? `
            <div class="suggestion-list">
              ${suggestions.map(s => `
                <div class="suggestion-item">
                  <div class="suggestion-word">${s.en}</div>
                  <div class="suggestion-translation">${s.native}${s.ruby ? ` (${s.ruby})` : ''}</div>
                  <button class="use-suggestion">Add</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="no-suggestions">
              No more suggestions available
            </div>
          `}
          <button class="close-modal">Close</button>
        </div>
      `;

      // Re-add event listeners
      modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.remove();
      });

      modal.querySelectorAll('.use-suggestion').forEach((btn, i) => {
        btn.addEventListener('click', async () => {
          const suggestion = suggestions[i];
          
          // Add the word
          if (validateNewWord(suggestion.en, suggestion.native, currentLangData)) {
            await addWord(
              currentLang,
              currentLangData,
              suggestion.en,
              suggestion.native,
              suggestion.ruby || ''
            );
            // Update the in-memory data and re-render word list
            currentLangData = await loadLanguageData(currentLang);
            renderWords(currentLang, currentLangData);

            // Remove this suggestion from the list and re-render modal
            suggestions = suggestions.filter((_, index) => index !== i);
            renderSuggestions();
          }
        });
      });
    }

    document.body.appendChild(modal);
    renderSuggestions();

  } catch (error) {
    alert(error.message || MESSAGES.SUGGESTION_ERROR);
  } finally {
    suggestBtn.disabled = false;
    suggestBtn.textContent = 'Suggest Related Words';
  }
}

// Main setup
document.addEventListener("DOMContentLoaded", async () => {
  const elements = {
    wordList: document.getElementById("wordList"),
    newEnglish: document.getElementById("newEnglish"),
    newTranslation: document.getElementById("newTranslation"),
    newFurigana: document.getElementById("newFurigana"),
    addWordBtn: document.getElementById("addWord"),
    suggestWordsBtn: document.getElementById("suggestWords"),
    langSelect: document.getElementById("targetLang"),
    wordSearch: document.getElementById("wordSearch"),
    llmProvider: document.getElementById("llmProvider"),
    llmModel: document.getElementById("llmModel"),
    saveSettingsBtn: document.getElementById("saveSettings"),
    timeRange: document.getElementById("timeRange"),
    LLMDetails: document.getElementById("LLMDetails"),
    apiKey: document.getElementById("apiKey"),
    tokenUsageDetails: document.getElementById("tokenUsageDetails"),
  };

  // Initialize LLM settings
  const settings = await loadLlmSettings();
  await initializeLlmSettings(settings, elements);

  // Provider change handler
  elements.llmProvider.addEventListener("change", async () => {
    await updateModelOptions(elements.llmProvider.value);
    const model = elements.llmModel.value;
    if (model) {
      updateTokenHistogram(model, parseInt(elements.timeRange?.value || 7));
    }
  });

  // Save settings handler
  elements.saveSettingsBtn.addEventListener("click", saveLlmSettingsHandler);

  // Load existing data
  const data = await browser.storage.local.get([
    "openaiApiKey",
    "lastLanguage",
  ]);

  if (data.openaiApiKey && elements.apiKeyInput) {
    elements.apiKeyInput.value = data.openaiApiKey;
  }

  // Set current language (default to Japanese if not set)
  let currentLang = data.lastLanguage || "ja";
  elements.langSelect.value = currentLang;

  // Initialize dictionary if needed
  const langData = await browser.storage.local.get(currentLang);
  if (!langData[currentLang]) {
    // Initialize with default dictionary for the current language
    const defaultDict = defaultDictionaries[currentLang];
    if (defaultDict) {
      await browser.storage.local.set({
        lastLanguage: currentLang,
        [currentLang]: defaultDict,
      });
    }
  }

  // Initialize or load current language data
  let currentLangData = await loadLanguageData(currentLang);

  // Language change handler
  elements.langSelect.addEventListener("change", async () => {
    const newLang = elements.langSelect.value.trim().toLowerCase();
    await browser.storage.local.set({ lastLanguage: newLang });
    currentLang = newLang;

    // Check and initialize dictionary if needed
    const langData = await browser.storage.local.get(currentLang);
    if (!langData[currentLang]) {
      const defaultDict = defaultDictionaries[currentLang];
      if (defaultDict) {
        await browser.storage.local.set({
          [currentLang]: {
            words: { ...defaultDict.words },
            settings: { ...defaultDict.settings },
          },
        });
      }
    }

    currentLangData = await loadLanguageData(currentLang);
    updateFormPlaceholders(
      currentLang,
      elements.newTranslation,
      elements.newFurigana
    );
    renderWords(currentLang, currentLangData);
  });

  // Add search functionality
  elements.wordSearch.addEventListener("input", (e) => {
    renderWords(currentLang, currentLangData, e.target.value);
  });

  // Add new word
  elements.addWordBtn.addEventListener("click", () =>
    handleAddWord(currentLang, currentLangData, elements)
  );

  // Add suggest words handler
  elements.suggestWordsBtn.addEventListener("click", () => 
    handleSuggestWords(currentLang, currentLangData)
  );

  // Time range change handler
  if (elements.timeRange) {
    elements.timeRange.addEventListener("change", () => {
      const model = elements.llmModel.value;
      if (model) {
        updateTokenHistogram(model, parseInt(elements.timeRange.value));
      }
    });
  }

  // Model change handler
  if (elements.llmModel) {
    elements.llmModel.addEventListener("change", () => {
      const model = elements.llmModel.value;
      if (model) {
        updateTokenHistogram(model, parseInt(elements.timeRange?.value || 7));
      }
    });
  }

  // Initial histogram update - wait for settings to be loaded
  if (settings?.model) {
    await updateTokenHistogram(settings.model, 7);
  }

  // Initial setup
  updateFormPlaceholders(
    currentLang,
    elements.newTranslation,
    elements.newFurigana
  );
  renderWords(currentLang, currentLangData);
});

// Voice initialization
window.speechSynthesis.onvoiceschanged = () => {
  console.log("Voices loaded:", window.speechSynthesis.getVoices().length);
};
