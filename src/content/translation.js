import { containsAnyWord, splitIntoSentences } from '../lib/textProcessing.js';

// Constants
const SENTENCE_REGEX = /([.!?。！？\n]+\s*)/g;

// Check if text contains any of the known words
export const containsKnownWord = (text, knownWords) => {
    const normalized = text.toLowerCase();
    return knownWords.some(([en, _]) => normalized.includes(en.toLowerCase()));
};

// Split text into sentences while preserving the separators
export const splitIntoSentences = (text) => {
    const sentences = [];
    let lastIndex = 0;
    let match;

    while ((match = SENTENCE_REGEX.exec(text)) !== null) {
        const sentence = text.slice(lastIndex, match.index + match[0].length).trim();
        if (sentence) sentences.push(sentence);
        lastIndex = match.index + match[0].length;
    }

    // Add remaining text if any
    const remaining = text.slice(lastIndex).trim();
    if (remaining) sentences.push(remaining);

    return sentences;
};

// Translation functions
export const translateText = async (state, sentences) => {
    // Get all known words first
    const knownWordEntries = [...state.knownWords.entries()];
    
    // Filter sentences to only those containing known words
    const relevantSentences = sentences.filter(s => 
        containsAnyWord(s.text, knownWordEntries.map(([en]) => en))
    );

    // If no sentences contain known words, return original texts
    if (relevantSentences.length === 0) {
        return sentences.map(s => s.text);
    }

    // Filter known words to only those that appear in the relevant sentences
    const relevantWords = knownWordEntries
        .filter(([en, _]) => 
            relevantSentences.some(s => 
                containsAnyWord(s.text, [en])
            )
        )
        .map(([en, data]) => ({ en, ...data }));

    // Create message-safe sentence objects (without DOM nodes)
    const messageSafeSentences = relevantSentences.map(({ id, text }) => ({ id, text }));

    const message = {
        type: 'PARTIAL_TRANSLATE',
        payload: {
            sentences: messageSafeSentences,
            knownWords: relevantWords,
            addFurigana: true
        }
    };

    try {
        const response = await browser.runtime.sendMessage(message);
        if (!response?.translations) return sentences.map(s => s.text);

        // Create a map of translations for easy lookup
        const translationMap = new Map(
            response.translations.map(t => [t.id, t.text])
        );

        // Return original text for sentences without translations
        return sentences.map(s => translationMap.get(s.id) || s.text);
    } catch (err) {
        console.error('Translation failed:', err);
        return sentences.map(s => s.text);
    }
}; 