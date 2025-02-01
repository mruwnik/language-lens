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


/**
 * Splits two strings into matching sentence-like chunks
 * and returns an array of [originalChunk, transformedChunk] pairs.
 * Rejoining all originalChunks will produce the original string exactly,
 * and rejoining all transformedChunks will reproduce the transformed string.
 *
 * @param {string} original    - The original text.
 * @param {string} transformed - The transformed (partially translated) text.
 * @returns {[string, string][]} - An array of pairs [originalSentence, transformedSentence].
 */
export const createSentencePairs = (original, transformed) => {
    // Regex explanation:
    //  - [^.!?]+   : match one or more characters that are not ., !, or ?
    //  - (?:[.!?]+|$) : followed by one or more punctuation chars .!? OR end-of-string
    //  - \s*       : consume trailing whitespace (if any)
    const SENTENCE_REGEX = /[^.!?]+(?:[.!?]+|$)\s*/g;
  
    // Extract chunks from both original and transformed
    const originalChunks   = original.match(SENTENCE_REGEX)   || [];
    const transformedChunks = transformed.match(SENTENCE_REGEX) || [];
  
    // Check that both splits yield the same number of chunks
    if (originalChunks.length !== transformedChunks.length) {
      throw new Error(
        "Mismatch in the number of detected sentences. " +
        "Ensure that both texts contain the same number of sentence-like segments."
      );
    }
  
    // Pair them up
    return originalChunks.map((chunk, i) => [chunk, transformedChunks[i]]);
  }
