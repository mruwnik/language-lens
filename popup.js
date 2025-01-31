// popup.js

import { getDisplayText, formatTooltip, speakWord } from './wordDisplay.js';
import {
    japaneseDictionary,
    chineseDictionary,
    koreanDictionary,
    spanishDictionary,
    frenchDictionary,
    germanDictionary,
    polishDictionary,
    welshDictionary
} from './defaultDictionaries.js';

console.log('Starting popup.js');
console.log('Checking dictionaries:', {
    ja: !!japaneseDictionary,
    zh: !!chineseDictionary,
    ko: !!koreanDictionary,
    es: !!spanishDictionary,
    fr: !!frenchDictionary,
    de: !!germanDictionary,
    pl: !!polishDictionary,
    cy: !!welshDictionary
});

document.addEventListener("DOMContentLoaded", async () => {
    console.log('DOM Content Loaded');
    
    const apiKeyInput = document.getElementById("apiKey");
    const saveKeyBtn = document.getElementById("saveKey");
    const wordList = document.getElementById("wordList");
    const newEnglish = document.getElementById("newEnglish");
    const newHiragana = document.getElementById("newHiragana");
    const newKanji = document.getElementById("newKanji");
    const addWordBtn = document.getElementById("addWord");
    const langSelect = document.getElementById("targetLang");

    console.log('Elements found:', {
        apiKeyInput: !!apiKeyInput,
        saveKeyBtn: !!saveKeyBtn,
        wordList: !!wordList,
        newEnglish: !!newEnglish,
        newHiragana: !!newHiragana,
        newKanji: !!newKanji,
        addWordBtn: !!addWordBtn,
        langSelect: !!langSelect
    });

    // Track deleted words for undo
    const deletedWords = [];
    const undoTimeouts = new Map(); // Map of messageId -> timeout

    // Default dictionaries map
    const defaultDictionaries = {
        ja: japaneseDictionary,
        zh: chineseDictionary,
        ko: koreanDictionary,
        es: spanishDictionary,
        fr: frenchDictionary,
        de: germanDictionary,
        pl: polishDictionary,
        cy: welshDictionary
    };
    console.log('Default dictionaries:', {
        hasJa: !!defaultDictionaries.ja?.words,
        jaWords: Object.keys(defaultDictionaries.ja?.words || {}).length,
        allLangs: Object.keys(defaultDictionaries)
    });

    // Load existing data
    const data = await browser.storage.local.get(["openaiApiKey", "lastLanguage"]);
    console.log('Loaded storage data:', {
        hasApiKey: !!data.openaiApiKey,
        lastLanguage: data.lastLanguage
    });

    if (data.openaiApiKey) {
        apiKeyInput.value = data.openaiApiKey;
    }

    // Set current language (default to Japanese if not set)
    let currentLang = data.lastLanguage || "ja";
    langSelect.value = currentLang;
    console.log('Set initial language to:', currentLang);

    // Initialize or load current language data
    let currentLangData = await loadLanguageData(currentLang);

    // Load language data
    async function loadLanguageData(lang) {
        console.log('Loading language data for:', lang);
        const storedData = await browser.storage.local.get(lang);
        console.log('Stored data:', storedData);
        
        // If no stored data or empty words, initialize with defaults
        if (!storedData[lang] || Object.keys(storedData[lang]?.words || {}).length === 0) {
            console.log('No stored data found, initializing defaults');
            const defaultDict = defaultDictionaries[lang];
            console.log('Default dictionary found:', !!defaultDict, 'with words:', Object.keys(defaultDict?.words || {}).length);
            
            if (!defaultDict) {
                console.error('No default dictionary found for', lang);
                return { words: {}, settings: {} };
            }

            // Deep clone the default dictionary
            const defaultData = JSON.parse(JSON.stringify(defaultDict));
            console.log('Cloned default data with words:', Object.keys(defaultData.words).length);
            
            // Initialize view counts and kanji counts
            Object.values(defaultData.words).forEach(word => {
                word.viewCount = 0;
                if (lang === 'ja' && word.useKanji) {
                    word.kanjiViewCounts = {};
                    [...word.native].forEach(char => {
                        if (char.match(/[\u4e00-\u9faf]/)) {
                            word.kanjiViewCounts[char] = 0;
                        }
                    });
                }
            });

            // Save to storage
            try {
                await browser.storage.local.set({ [lang]: defaultData });
                console.log('Saved default dictionary with words:', Object.keys(defaultData.words).length);
            } catch (error) {
                console.error('Error saving dictionary:', error);
            }
            return defaultData;
        }

        console.log('Returning stored data with words:', Object.keys(storedData[lang].words).length);
        return storedData[lang];
    }

    // Language change handler
    langSelect.addEventListener("change", async () => {
        const newLang = langSelect.value.trim().toLowerCase();
        console.log('Language changed to:', newLang);
        
        // Save last language first
        await browser.storage.local.set({ lastLanguage: newLang });
        
        // Load new language data
        currentLang = newLang;
        currentLangData = await loadLanguageData(currentLang);
        
        console.log('Loaded language data:', currentLangData);
        
        updateFormPlaceholders();
        renderWords();
    });

    // Update form placeholders based on language
    function updateFormPlaceholders() {
        const isJapanese = currentLang === "ja";
        newHiragana.placeholder = isJapanese ? "Hiragana" : "Pronunciation";
        newKanji.placeholder = isJapanese ? "Kanji" : "Native Script";
        
        // Show/hide kanji input based on language
        newKanji.style.display = isJapanese ? "block" : "none";
        
        // Adjust grid columns based on visible inputs
        const form = document.querySelector('.add-word-form');
        form.style.gridTemplateColumns = isJapanese ? "repeat(4, 1fr)" : "repeat(3, 1fr)";
    }

    // Save API key
    saveKeyBtn.addEventListener("click", async () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            alert("Please enter your OpenAI API key (sk-...).");
            return;
        }
        await browser.storage.local.set({ openaiApiKey: key });
        alert("API key saved!");
    });

    // Show undo message
    function showUndoMessage(wordKey, wordData, messageId) {
        const undoMsg = document.createElement('div');
        undoMsg.className = 'undo-message';
        undoMsg.dataset.messageId = messageId;
        undoMsg.innerHTML = `
            <span>"${wordKey}" deleted</span>
            <button class="undo-btn">Undo</button>
        `;
        
        // Add undo button listener
        const undoBtn = undoMsg.querySelector('.undo-btn');
        undoBtn.addEventListener('click', async () => {
            const idx = deletedWords.findIndex(dw => dw.messageId === messageId);
            if (idx !== -1) {
                const { key, data, language } = deletedWords[idx];
                currentLangData.words[key] = data;
                await browser.storage.local.set({ [language]: currentLangData });
                
                // Mark this deletion as undone
                deletedWords[idx].undone = true;
                
                // Remove just this message
                undoMsg.remove();
                clearTimeout(undoTimeouts.get(messageId));
                undoTimeouts.delete(messageId);
                
                // Remove container if empty
                const container = document.querySelector('.undo-container');
                if (container && container.children.length === 0) {
                    container.remove();
                }
                
                renderWords();
            }
        });

        // Add to DOM at the top of the undo messages
        const undoContainer = document.querySelector('.undo-container') || createUndoContainer();
        undoContainer.insertBefore(undoMsg, undoContainer.firstChild);

        // Auto-remove after 5 seconds
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
        }, 5000);
        
        undoTimeouts.set(messageId, timeout);
    }

    // Create container for undo messages if it doesn't exist
    function createUndoContainer() {
        const container = document.createElement('div');
        container.className = 'undo-container';
        wordList.parentNode.insertBefore(container, wordList);
        return container;
    }

    // Render word list
    function renderWords() {
        console.log('Rendering words for language:', currentLang);
        console.log('Current language data:', currentLangData);
        
        const sortedWords = Object.entries(currentLangData.words)
            .sort((a, b) => a[0].localeCompare(b[0]));
        
        console.log('Sorted words:', sortedWords.length);
        
        wordList.innerHTML = sortedWords.map(([key, data]) => `
            <div class="word-item">
                <div title="${key}">${key}</div>
                <div title="${data.ruby || data.native}">${getDisplayText(data)}</div>
                <div title="${formatTooltip(data)}">${data.useKanji ? '✓' : '-'}</div>
                <button class="delete-btn" data-word="${key}">×</button>
                <button class="speak-btn" data-word="${key}">🔊</button>
            </div>
        `).join('');
        
        console.log('Rendered HTML, adding event listeners');

        // Add event listeners
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
                
                delete currentLangData.words[wordKey];
                await browser.storage.local.set({ [currentLang]: currentLangData });
                renderWords();
                
                showUndoMessage(wordKey, wordData, messageId);
            });
        });

        // Add speak button listeners
        wordList.querySelectorAll('.speak-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const wordKey = btn.dataset.word;
                const wordData = currentLangData.words[wordKey];
                speakWord(wordData.native || wordData.hiragana, currentLangData.settings.voice);
            });
        });
    }

    // Add new word
    addWordBtn.addEventListener("click", async () => {
        const en = newEnglish.value.trim();
        const pronunciation = newHiragana.value.trim();
        const nativeScript = newKanji.value.trim();

        if (!en || !pronunciation) {
            alert("English and pronunciation are required!");
            return;
        }

        if (currentLangData.words[en]) {
            alert("This word already exists!");
            return;
        }

        if (currentLang === "ja") {
            // Japanese-specific structure
            const kanjiViewCounts = {};
            if (nativeScript) {
                [...nativeScript].forEach(char => {
                    if (char.match(/[\u4e00-\u9faf]/)) {
                        kanjiViewCounts[char] = 0;
                    }
                });
            }

            currentLangData.words[en] = {
                hiragana: pronunciation,
                kanji: nativeScript,
                useKanji: !!nativeScript,
                viewCount: 0,
                kanjiViewCounts
            };
        } else {
            // Generic structure for other languages
            currentLangData.words[en] = {
                pronunciation,
                native: nativeScript,
                viewCount: 0
            };
        }

        await browser.storage.local.set({ [currentLang]: currentLangData });
        newEnglish.value = '';
        newHiragana.value = '';
        newKanji.value = '';
        renderWords();
    });

    // Initial setup
    updateFormPlaceholders();
    renderWords();
});

function renderWord(english, word) {
    const div = document.createElement('div');
    div.className = 'word-item';
    
    const englishDiv = document.createElement('div');
    englishDiv.textContent = english;
    
    const hiraganaDiv = document.createElement('div');
    hiraganaDiv.textContent = word.hiragana || word.native || '';
    
    const kanjiDiv = document.createElement('div');
    kanjiDiv.textContent = word.kanji || '';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = () => deleteWord(english);
    
    const speakBtn = document.createElement('button');
    speakBtn.className = 'speak-btn';
    speakBtn.innerHTML = '🔊';
    speakBtn.onclick = () => {
        const currentLang = document.getElementById('targetLang').value;
        const dictionaries = {
            ja: japaneseDictionary,
            zh: chineseDictionary,
            ko: koreanDictionary,
            es: spanishDictionary,
            fr: frenchDictionary,
            de: germanDictionary,
            pl: polishDictionary,
            cy: welshDictionary
        };
        const dict = dictionaries[currentLang];
        speakWord(word.native || word.hiragana, dict.settings.voice);
    };
    
    div.appendChild(englishDiv);
    div.appendChild(hiraganaDiv);
    div.appendChild(kanjiDiv);
    div.appendChild(deleteBtn);
    div.appendChild(speakBtn);
    
    return div;
}

// Initialize voices when they're loaded
window.speechSynthesis.onvoiceschanged = () => {
    console.log('Voices loaded:', window.speechSynthesis.getVoices().length);
};
  