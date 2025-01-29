// contentScript.js

// Will be populated from storage
let knownWords = [];
let knownWordSet = new Set();

// Threshold for when to stop showing furigana
const KANJI_FAMILIARITY_THRESHOLD = 100;

// Initialize or load data from storage
let kanjiFrequencyMap = new Map();

async function initializeFromStorage() {
    const data = await browser.storage.local.get(["knownWords", "kanjiFrequencyMap"]);
    
    // Load known words
    knownWords = data.knownWords || [];
    knownWordSet = new Set(knownWords.map(w => w.en.toLowerCase()));
    
    // Load kanji frequency
    if (data.kanjiFrequencyMap) {
        kanjiFrequencyMap = new Map(Object.entries(data.kanjiFrequencyMap));
    }

    console.log("[Partial Translator] Loaded from storage:", {
        wordCount: knownWords.length,
        words: knownWords.map(w => w.en),
        kanjiCount: kanjiFrequencyMap.size
    });

    // Start processing the page
    initializeTranslation();
}

// Listen for storage changes
browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
        if (changes.knownWords) {
            knownWords = changes.knownWords.newValue || [];
            knownWordSet = new Set(knownWords.map(w => w.en.toLowerCase()));
            console.log("[Partial Translator] Words updated:", knownWords.map(w => w.en));
            // Reprocess the page with new words
            initializeTranslation();
        }
        if (changes.kanjiFrequencyMap) {
            kanjiFrequencyMap = new Map(Object.entries(changes.kanjiFrequencyMap.newValue || {}));
        }
    }
});

function initializeTranslation() {
    console.log("[Partial Translator] Starting translation");
    replaceTextNodes(document.body);
}

/**
 * Check if text contains any known words/phrases
 */
function hasKnownWords(text) {
    // Split on word boundaries and check each word
    // This handles both single words and multi-word phrases
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    return words.some(word => knownWordSet.has(word)) ||
           knownWordSet.has(text.toLowerCase()); // Check for exact phrase matches
}

/**
 * Update kanji frequency and save to storage
 */
function updateKanjiFrequency(kanji) {
    const currentCount = kanjiFrequencyMap.get(kanji) || 0;
    kanjiFrequencyMap.set(kanji, currentCount + 1);
    
    // Save to storage (debounced to avoid too many writes)
    if (!updateKanjiFrequency.timeout) {
        updateKanjiFrequency.timeout = setTimeout(() => {
            const mapObj = Object.fromEntries(kanjiFrequencyMap);
            browser.storage.local.set({ kanjiFrequencyMap: mapObj });
            updateKanjiFrequency.timeout = null;
        }, 1000);
    }
}

/**
 * Create HTML with furigana for unfamiliar kanji
 */
function addFurigana(word) {
    if (!word.jpKanji || !word.jpHiragana || !word.useKanji) {
        return word.useKanji ? word.jpKanji : word.jpHiragana;
    }

    // Check if any kanji in the word needs furigana
    const needsFurigana = [...word.jpKanji].some(char => {
        const isKanji = char.match(/[\u4e00-\u9faf]/); // Unicode range for kanji
        if (!isKanji) return false;
        const frequency = kanjiFrequencyMap.get(char) || 0;
        return frequency < KANJI_FAMILIARITY_THRESHOLD;
    });

    if (!needsFurigana) {
        return word.jpKanji;
    }

    // Update frequency for each kanji
    [...word.jpKanji].forEach(char => {
        if (char.match(/[\u4e00-\u9faf]/)) {
            updateKanjiFrequency(char);
        }
    });

    // Return ruby markup
    return `<ruby>${word.jpKanji}<rt>${word.jpHiragana}</rt></ruby>`;
}

/**
 * Recursively walk the DOM, find text nodes containing known words,
 * request partial translation, and replace them with the translated text.
 */
function replaceTextNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.trim();
        if (text.length > 0 && hasKnownWords(text)) {
            console.log("[Partial Translator] Found text node with known words:", text);
            partialTranslate(text).then((translatedText) => {
                console.log("[Partial Translator] Translated:", { original: text, translated: translatedText });
                if (translatedText !== text) {
                    // Replace the text node with a new span
                    const newSpan = document.createElement("span");
                    newSpan.innerHTML = translatedText; // Using innerHTML to support ruby tags
                    node.parentNode.replaceChild(newSpan, node);
                }
            }).catch(err => {
                console.error("[Partial Translator] Translation error:", err);
            });
        }
    } else {
        // Recurse into child nodes
        node.childNodes.forEach(replaceTextNodes);
    }
}

/**
 * Asks the background script for a partial translation of `text`.
 */
async function partialTranslate(text) {
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage(
            {
                type: "PARTIAL_TRANSLATE",
                payload: {
                    originalText: text,
                    knownWords: knownWords,
                    addFurigana: true // Signal to background script that we want furigana
                }
            },
            (response) => {
                if (browser.runtime.lastError) {
                    console.error("[Partial Translator] Runtime error:", browser.runtime.lastError);
                    reject(browser.runtime.lastError);
                    return;
                }
                if (response && response.translatedText) {
                    // Process each known word in the response for furigana
                    let processedText = response.translatedText;
                    knownWords.forEach(word => {
                        if (word.useKanji) {
                            const withFurigana = addFurigana(word);
                            processedText = processedText.replace(word.jpKanji, withFurigana);
                        }
                    });
                    resolve(processedText);
                } else {
                    console.warn("[Partial Translator] No translation received, using original text");
                    resolve(text);
                }
            }
        );
    });
}

// Start initialization
initializeFromStorage().catch(err => {
    console.error("[Partial Translator] Initialization error:", err);
});
  