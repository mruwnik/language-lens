// popup.js

import { getDisplayText, formatTooltip, speakWord } from '../lib/wordDisplay.js';
import {
    japaneseDictionary,
    chineseDictionary,
    koreanDictionary,
    spanishDictionary,
    frenchDictionary,
    germanDictionary,
    polishDictionary,
    welshDictionary,
    defaultDictionaries
} from '../lib/defaultDictionaries.js';

console.log('Starting popup.js');

// Constants and Types
export const MESSAGES = {
    REQUIRED_FIELDS: "English and translation are required!",
    WORD_EXISTS: "This word already exists!",
    API_KEY_REQUIRED: "Please enter your OpenAI API key (sk-...)",
    API_KEY_SAVED: "API key saved!",
    API_KEY_ERROR: "Error saving API key. Please try again."
};

const KANJI_REGEX = /[\u4e00-\u9faf]/;
const UNDO_TIMEOUT_MS = 5000;

// Pure functions
export const getKanjiViewCounts = (text) => 
    !text ? {} : [...text].reduce((counts, char) => {
        if (char.match(KANJI_REGEX)) {
            counts[char] = 0;
        }
        return counts;
    }, {});

export const createWord = (currentLang, native, ruby) => ({ 
    native,
    ruby,
    viewCount: 0
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

export const clearInputs = (...inputs) => inputs.forEach(input => input.value = '');

// Storage functions
export const loadLanguageData = async (lang) => {
    const data = await browser.storage.local.get(lang);
    if (!data[lang]) {
        const defaultDict = defaultDictionaries[lang];
        if (defaultDict) {
            return {
                words: { ...defaultDict.words },
                settings: { ...defaultDict.settings }
            };
        }
        return { words: {}, settings: { voice: `${lang}-${lang.toUpperCase()}` } };
    }
    return data[lang];
};

export const addWord = async (currentLang, currentLangData, word, translation, ruby) => {
    if (!validateNewWord(word, translation, currentLangData)) {
        return false;
    }

    const updatedData = {
        ...currentLangData,
        words: {
            ...currentLangData.words,
            [word]: createWord(currentLang, translation, ruby)
        }
    };

    await browser.storage.local.set({ [currentLang]: updatedData });
    return true;
};

// DOM manipulation functions
export const updateHeader = (currentLang, currentLangData, wordList) => {
    const header = document.querySelector('.word-item.word-header');
    if (!header) return;

    const hasKanji = currentLang === 'ja';
    
    header.innerHTML = `
        <div>English</div>
        <div>${hasKanji ? 'Reading' : 'Translation'}</div>
        ${hasKanji ? '<div>Use Kanji</div>' : '<div></div>'}
        <div></div>
        <div></div>
    `;

    if (hasKanji) {
        const toggle = document.createElement('button');
        toggle.className = 'kanji-toggle';
        toggle.title = 'Toggle Global Kanji Display';
        toggle.textContent = '漢字';
        toggle.classList.toggle('active', currentLangData.settings?.showKanji ?? true);
        
        header.children[1].appendChild(toggle);

        toggle.addEventListener('click', async () => {
            const updatedData = {
                ...currentLangData,
                settings: {
                    ...currentLangData.settings,
                    showKanji: !currentLangData.settings?.showKanji
                }
            };
            toggle.classList.toggle('active', updatedData.settings.showKanji);
            await browser.storage.local.set({ [currentLang]: updatedData });
            renderWords(currentLang, updatedData);
        });
    }
};

export const wordMatchesSearch = (english, wordData, searchTerm) => {
    if (!searchTerm) return true;
    
    const searchIn = [
        english.toLowerCase(),
        (wordData.hiragana || '').toLowerCase(),
        (wordData.ruby || '').toLowerCase(),
        (wordData.native || '').toLowerCase(),
        (wordData.kanji || '').toLowerCase()
    ];
    
    return searchIn.some(text => text.includes(searchTerm.toLowerCase()));
};

export const createUndoContainer = (wordList) => {
    const container = document.createElement('div');
    container.className = 'undo-container';
    wordList.parentNode.insertBefore(container, wordList);
    return container;
};

export const showUndoMessage = (wordKey, wordData, messageId, currentLang, currentLangData, deletedWords, undoTimeouts) => {
    const wordList = document.getElementById('wordList');
    const undoMsg = document.createElement('div');
    undoMsg.className = 'undo-message';
    undoMsg.dataset.messageId = messageId;
    undoMsg.innerHTML = `
        <span>"${wordKey}" deleted</span>
        <button class="undo-btn">Undo</button>
    `;
    
    const undoBtn = undoMsg.querySelector('.undo-btn');
    undoBtn.addEventListener('click', async () => {
        const idx = deletedWords.findIndex(dw => dw.messageId === messageId);
        if (idx !== -1) {
            const { key, data, language } = deletedWords[idx];
            const updatedData = {
                ...currentLangData,
                words: {
                    ...currentLangData.words,
                    [key]: data
                }
            };
            await browser.storage.local.set({ [language]: updatedData });
            deletedWords[idx].undone = true;
            undoMsg.remove();
            clearTimeout(undoTimeouts.get(messageId));
            undoTimeouts.delete(messageId);
            
            const container = document.querySelector('.undo-container');
            if (container?.children.length === 0) {
                container.remove();
            }
            
            renderWords(currentLang, updatedData);
        }
    });

    const undoContainer = document.querySelector('.undo-container') || createUndoContainer(wordList);
    undoContainer.insertBefore(undoMsg, undoContainer.firstChild);

    const timeout = setTimeout(() => {
        undoMsg.remove();
        const idx = deletedWords.findIndex(dw => dw.messageId === messageId);
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

export const renderWords = (currentLang, currentLangData, searchTerm = '') => {
    const wordList = document.getElementById('wordList');
    if (!wordList) return;

    const sortedWords = Object.entries(currentLangData.words)
        .filter(([english, data]) => wordMatchesSearch(english, data, searchTerm))
        .sort((a, b) => a[0].localeCompare(b[0]));

    updateHeader(currentLang, currentLangData, wordList);
    
    wordList.innerHTML = sortedWords.map(([key, data]) => {
        const displayText = getDisplayText(data, currentLangData.settings);
        const useKanji = currentLang === 'ja' && data.ruby;
        const useKanjiClass = data.useKanji ? 'active' : '';
        
        return `
            <div class="word-item">
                <div title="${key}">${key}</div>
                <div title="${formatTooltip(data, currentLangData.settings)}">${displayText}</div>
                ${useKanji ? 
                    `<button class="kanji-toggle ${useKanjiClass}" data-word="${key}" title="Toggle Kanji for this word">
                        ${data.useKanji ? '✓' : '✗'}
                    </button>` : 
                    '<div></div>'
                }
                <button class="delete-btn" data-word="${key}">×</button>
                <button class="speak-btn" data-word="${key}">🔊</button>
            </div>
        `;
    }).join('');

    // Add event listeners
    const deletedWords = [];
    const undoTimeouts = new Map();

    wordList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const wordKey = e.target.dataset.word;
            const wordData = currentLangData.words[wordKey];
            const messageId = Date.now().toString();
            
            deletedWords.push({ 
                key: wordKey, 
                data: wordData, 
                language: currentLang,
                messageId, 
                undone: false 
            });
            
            const updatedData = {
                ...currentLangData,
                words: { ...currentLangData.words }
            };
            delete updatedData.words[wordKey];
            
            await browser.storage.local.set({ [currentLang]: updatedData });
            currentLangData = updatedData;  // Update in-memory data
            renderWords(currentLang, currentLangData, searchTerm);
            
            showUndoMessage(wordKey, wordData, messageId, currentLang, updatedData, deletedWords, undoTimeouts);
        });
    });

    wordList.querySelectorAll('.kanji-toggle').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const wordKey = e.target.dataset.word;
            const updatedData = {
                ...currentLangData,
                words: {
                    ...currentLangData.words,
                    [wordKey]: {
                        ...currentLangData.words[wordKey],
                        useKanji: !currentLangData.words[wordKey].useKanji
                    }
                }
            };
            await browser.storage.local.set({ [currentLang]: updatedData });
            currentLangData = updatedData;  // Update in-memory data
            renderWords(currentLang, currentLangData, searchTerm);
        });
    });

    wordList.querySelectorAll('.speak-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const wordKey = btn.dataset.word;
            const wordData = currentLangData.words[wordKey];
            speakWord(wordData.native || wordData.ruby, currentLangData.settings.voice);
        });
    });
};

// Event handlers
export const handleAddWord = async (currentLang, currentLangData, inputs) => {
    const { newEnglish, newTranslation, newFurigana } = inputs;
    const en = newEnglish.value.trim();
    const translation = newTranslation.value.trim();
    const nativeScript = newFurigana.value.trim();

    const success = await addWord(currentLang, currentLangData, en, translation, nativeScript);
    if (success) {
        clearInputs(newEnglish, newTranslation, newFurigana);
        // Update the in-memory data
        currentLangData = await loadLanguageData(currentLang);
        renderWords(currentLang, currentLangData);
    }
};

export const updateFormPlaceholders = (currentLang, newTranslation, newFurigana) => {
    const isJapanese = currentLang === "ja";
    newTranslation.placeholder = "Translation";
    newFurigana.placeholder = "Furigana";
    
    newFurigana.style.display = isJapanese ? "block" : "none";
    
    const form = document.querySelector('.add-word-form');
    form.style.gridTemplateColumns = isJapanese ? "repeat(4, 1fr)" : "repeat(3, 1fr)";
};

// Main setup
document.addEventListener("DOMContentLoaded", async () => {
    const elements = {
        apiKeyInput: document.getElementById("apiKey"),
        saveKeyBtn: document.getElementById("saveKey"),
        wordList: document.getElementById("wordList"),
        newEnglish: document.getElementById("newEnglish"),
        newTranslation: document.getElementById("newTranslation"),
        newFurigana: document.getElementById("newFurigana"),
        addWordBtn: document.getElementById("addWord"),
        langSelect: document.getElementById("targetLang"),
        wordSearch: document.getElementById("wordSearch")
    };

    // Load existing data
    const data = await browser.storage.local.get(["openaiApiKey", "lastLanguage"]);
    
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
                [currentLang]: defaultDict
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
                        settings: { ...defaultDict.settings }
                    }
                });
            }
        }

        currentLangData = await loadLanguageData(currentLang);
        updateFormPlaceholders(currentLang, elements.newTranslation, elements.newFurigana);
        renderWords(currentLang, currentLangData);
    });

    // Save API key
    elements.saveKeyBtn.addEventListener("click", async () => {
        const key = elements.apiKeyInput.value.trim();
        if (!key) {
            alert(MESSAGES.API_KEY_REQUIRED);
            return;
        }
        try {
            await browser.storage.local.set({ openaiApiKey: key });
            alert(MESSAGES.API_KEY_SAVED);
        } catch (error) {
            console.error('Error saving API key:', error);
            alert(MESSAGES.API_KEY_ERROR);
        }
    });

    // Add search functionality
    elements.wordSearch.addEventListener('input', (e) => {
        renderWords(currentLang, currentLangData, e.target.value);
    });

    // Add new word
    elements.addWordBtn.addEventListener("click", () => 
        handleAddWord(currentLang, currentLangData, elements)
    );

    // Initial setup
    updateFormPlaceholders(currentLang, elements.newTranslation, elements.newFurigana);
    renderWords(currentLang, currentLangData);
});

// Voice initialization
window.speechSynthesis.onvoiceschanged = () => {
    console.log('Voices loaded:', window.speechSynthesis.getVoices().length);
};
  