/**
 * @fileoverview Text processing utilities for Japanese-English translation
 * Provides functions for text normalization, word extraction, sentence splitting,
 * and other text manipulation tasks with special handling for Japanese text.
 * 
 * @version 1.0.0
 * @module textProcessing
 */

/** @typedef {{en: string, native?: string, ruby?: string, useKanji?: boolean}} Word */

// Constants
const KANJI = {
    COMMON: [0x4e00, 0x9faf],
    EXT_A: [0x3400, 0x4dbf],
    COMPAT: [0xf900, 0xfaff]
};

const PATTERNS = {
    SENTENCE: /([。．.!?！？]+\s*)/g,
    WORD: /\b\w+\b/gi,
    KANJI: new RegExp(
        Object.values(KANJI)
            .map(([s, e]) => `\\u{${s.toString(16)}}-\\u{${e.toString(16)}}`)
            .join(''),
        'u'
    )
};

// Cache
class LRUCache extends Map {
    constructor(maxSize = 1000) {
        super();
        this.maxSize = maxSize;
    }

    get(key) {
        const value = super.get(key);
        if (value) {
            this.delete(key);
            this.set(key, value);
        }
        return value;
    }

    set(key, value) {
        if (this.size >= this.maxSize) {
            this.delete(this.keys().next().value);
        }
        super.set(key, value);
        return this;
    }
}

const cache = new LRUCache();
const cached = (key, fn) => cache.get(key) ?? cache.set(key, fn()).get(key);

// Hashing
export const makeHash = str => {
    if (typeof str !== 'string') return '0';
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
};

// Text normalization
export const normalizeText = text =>
    typeof text === 'string'
        ? text.normalize('NFKC').toLowerCase().trim()
        : '';

// Japanese text utilities
export const isKanji = char =>
    typeof char === 'string' &&
    char.length === 1 &&
    PATTERNS.KANJI.test(char);

export const createRubyElement = (base, reading) =>
    base && reading
        ? `<ruby>${base}<rt>${reading}</rt></ruby>`
        : base || '';

// Word processing
export const extractWords = text => {
    if (!text) return [];
    
    return cached(`words:${text}`, () => {
        const normalized = normalizeText(text);
        
        if (!PATTERNS.KANJI.test(normalized)) {
            return normalized.match(PATTERNS.WORD) ?? [];
        }
        
        const words = new Set();
        let current = '';
        
        [...normalized].forEach(char => {
            if (isKanji(char)) {
                if (current) words.add(current);
                words.add(char);
                current = '';
            } else {
                current += char;
            }
        });
        
        if (current) words.add(current);
        return [...words];
    });
};

export const containsAnyWord = (text, words) => {
    if (!text || !Array.isArray(words)) return false;
    
    const normalized = normalizeText(text);
    const textWords = normalized.match(PATTERNS.WORD) ?? [];
    
    return words.some(word => 
        typeof word === 'string' &&
        textWords.includes(word.toLowerCase())
    );
};

// Sentence processing
export const splitIntoSentences = text =>
    typeof text === 'string'
        ? text.split(PATTERNS.SENTENCE)
            .map(s => s.trim())
            .filter(Boolean)
        : [];

// Translation utilities
export const makeTranslationCacheKey = (text, words) => {
    if (!text || !Array.isArray(words)) return '';
    
    return cached(`key:${text}:${words.length}`, () => {
        const wordKey = words
            .map(w => w?.en?.toLowerCase())
            .filter(Boolean)
            .sort()
            .join(',');
            
        return `${makeHash(text)}:${makeHash(wordKey)}`;
    });
};
