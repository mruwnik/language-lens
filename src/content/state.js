import { debounce } from '../lib/utils.js';
import { containsAnyWord, isKanji } from '../lib/textProcessing.js';

const DEBOUNCE_MS = 1000;
const MIN_KANJI_VIEW_COUNT = 35;

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
        this.seenWordsThisPage = new Set();
    }

    updateWordView(word, en) {
        if (!this.seenWordsThisPage.has(en)) {
            word.viewCount = (word.viewCount || 0) + 1;
            if (word.ruby && word.viewCount > MIN_KANJI_VIEW_COUNT && word.useKanji === undefined) {
                word.useKanji = true;
            }
            this.seenWordsThisPage.add(en);

            // Update kanji counts if word has kanji
            if (word.native) {
                [...word.native].forEach(char => {
                    if (isKanji(char)) {
                        this.updateKanjiFrequency(word, char);
                    }
                });
            }
        }
        return word.viewCount;
    }

    updateKanjiFrequency(word, kanji) {
        if (!this.seenKanjiThisPage.has(kanji)) {
            if (!word.kanjiViewCounts) {
                word.kanjiViewCounts = {};
            }
            word.kanjiViewCounts[kanji] = (word.kanjiViewCounts[kanji] ?? 0) + 1;
            this.seenKanjiThisPage.add(kanji);
            
            this.saveToStorage().catch(err => {
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

    async saveToStorage() {
        try {
            const { [this.currentLang]: langData } = await browser.storage.local.get(this.currentLang);
            const storageUpdate = {
                [this.currentLang]: {
                    ...langData,
                    words: Object.fromEntries(this.knownWords)
                }
            };
            await updateStorage(this.currentLang, storageUpdate[this.currentLang]);
        } catch (err) {
            console.error('Failed to save to storage:', err);
        }
    }

    async loadFromStorage() {
        try {
            const { lastLanguage, ...langData } = 
                await browser.storage.local.get(['lastLanguage', this.currentLang]);
            
            this.currentLang = lastLanguage ?? 'ja';
            this.seenKanjiThisPage.clear();
            this.seenWordsThisPage.clear();
            
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
            this.seenWordsThisPage.clear();
        }
    }
} 