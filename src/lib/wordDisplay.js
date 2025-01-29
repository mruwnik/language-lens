// Functions for displaying and speaking words

/**
 * Get the display text for a word based on the display rules
 * @param {Object} wordData - The word data object
 * @param {Object} settings - Language settings (e.g., minKanjiViews, showKanji)
 * @returns {string} HTML string with proper formatting
 */
export function getDisplayText(wordData, settings = {}) {
    // If there are no ruby, or the word should just be shown as native (i.e. kanji),
    // then just show the native word.
    if (wordData.useKanji || !wordData.ruby) {
        return wordData.native;
    }

    // If kanji display is disabled, show only ruby
    if (settings.showKanji === false) {
        return wordData.ruby;
    }

    // If the word should be shown as kanji, check if the user has seen all the kanji in the word.
    const minViews = settings.minKanjiViews || 100;
    const allKanjiSeen = [...wordData.native]
        .filter(char => char.match(/[\u4e00-\u9faf]/))
        .every(kanji => (wordData.kanjiViewCounts?.[kanji] || 0) >= minViews);

    if (allKanjiSeen) {
        return wordData.native;
    }

    return `<ruby>${wordData.native}<rt>${wordData.ruby}</rt></ruby>`;
}

/**
 * Format tooltip text for a word
 * @param {Object} wordData - The word data object
 * @param {string} lang - Current language code
 * @returns {string} Tooltip text
 */
export function formatTooltip(wordData, lang) {
    if (lang !== "ja" || !wordData.useKanji) {
        return wordData.native || '';
    }
    
    const frequencies = Object.entries(wordData.kanjiViewCounts || {})
        .map(([kanji, count]) => `${kanji}: seen ${count} times`);
    
    return frequencies.length ? frequencies.join('\n') : wordData.native;
}

/**
 * Speak a word using the browser's speech synthesis
 * @param {string} text - Text to speak
 * @param {string} lang - Language code for speech
 */
export function speakWord(text, lang) {
    if (!window.speechSynthesis) {
        console.error('Speech synthesis not supported');
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get available voices
    const voices = window.speechSynthesis.getVoices();
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
    
    // Try to find the best matching voice
    let voice = voices.find(v => v.lang === lang) ||                  // Exact match
               voices.find(v => v.lang.startsWith(lang)) ||           // Language match
               voices.find(v => v.lang.startsWith(lang.split('-')[0])); // Base language match
               
    if (voice) {
        console.log('Selected voice:', voice.name, voice.lang);
        utterance.voice = voice;
        utterance.lang = voice.lang;
    } else {
        console.log('No matching voice found for', lang, 'using default');
        utterance.lang = lang;
    }

    // Adjust speech parameters for better clarity
    utterance.rate = 0.9;  // Slightly slower
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
}

// Initialize voices when they're loaded
window.speechSynthesis.onvoiceschanged = () => {
    console.log('Voices loaded:', window.speechSynthesis.getVoices().length);
}; 