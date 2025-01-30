import { debounce } from '../lib/utils.js';
import { containsAnyWord } from '../lib/textProcessing.js';

const DEBOUNCE_MS = 1000;

// Debounced storage update
const updateStorage = debounce(async (key, value) => {
    try {
        await browser.storage.local.set({ [key]: value });
    } catch (err) {
        console.error(`Storage update failed for ${key}:`, err);
    }
}, DEBOUNCE_MS);

export class TranslationState {
    constructor() {
        this.currentLang = 'ja';
        this.knownWords = new Map();
        this.seenKanjiThisPage = new Set();
    }

    updateKanjiFrequency(word, kanji) {
        if (!this.seenKanjiThisPage.has(kanji)) {
            if (!word.kanjiViewCounts) {
                word.kanjiViewCounts = {};
            }
            word.kanjiViewCounts[kanji] = (word.kanjiViewCounts[kanji] ?? 0) + 1;
            this.seenKanjiThisPage.add(kanji);
            
            // Get current data first to preserve settings
            browser.storage.local.get(this.currentLang).then(data => {
                const currentData = data[this.currentLang] || {};
                const wordData = Object.fromEntries(this.knownWords);
                updateStorage(this.currentLang, {
                    ...currentData,
                    words: wordData
                });
            }).catch(err => {
                console.error('Failed to update kanji frequency:', err);
            });
        }
        return word.kanjiViewCounts?.[kanji] ?? 0;
    }

    getKanjiFrequency(word, kanji) {
        return word.kanjiViewCounts?.[kanji] ?? 0;
    }

    hasKnownWord(text) {
        const words = [...this.knownWords.keys()];
        return containsAnyWord(text, words);
    }

    async loadFromStorage() {
        try {
            const { lastLanguage, ...langData } = 
                await browser.storage.local.get(['lastLanguage', this.currentLang]);
            
            this.currentLang = lastLanguage ?? 'ja';
            this.seenKanjiThisPage.clear();
            
            const data = langData[this.currentLang] ?? { words: {}, settings: {} };
            this.knownWords = new Map(
                Object.entries(data.words ?? {})
                    .map(([key, val]) => [key.toLowerCase(), val])
                    .filter(([_, val]) => val && typeof val === 'object')
            );
        } catch (err) {
            console.error('Failed to load from storage:', err);
            this.currentLang = 'ja';
            this.knownWords.clear();
            this.seenKanjiThisPage.clear();
        }
    }
} 