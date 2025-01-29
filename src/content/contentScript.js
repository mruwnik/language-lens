// contentScript.js

// Constants and types
const KANJI_FAMILIARITY_THRESHOLD = 40;
const DEBOUNCE_MS = 1000;
const SPEAKER_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;cursor:pointer;margin-left:4px">
    <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
</svg>`;

// Update TOOLTIP_STYLES
const TOOLTIP_STYLES = `
.jp-word {
    position: relative;
    cursor: help;
}
.jp-tooltip {
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 8px;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    z-index: 10000;
    max-width: 300px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px);
    transition: opacity 0.2s, transform 0.2s, visibility 0s linear 0.2s;
    left: 0;
    top: calc(100% + 5px);
}
.jp-word:hover .jp-tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    transition-delay: 0s;
}
.jp-tooltip::before {
    content: '';
    position: absolute;
    left: -10px;
    right: -10px;
    height: 20px;
    bottom: 100%;
}
.jp-tooltip .speak-icon {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    margin-left: 4px;
    color: #666;
    transition: color 0.2s;
}
.jp-tooltip .speak-icon:hover {
    color: #007bff;
}
`;

// Cache for processed nodes
const processedNodes = new WeakSet();

// Pure functions for text processing
const isKanji = char => /[\u4e00-\u9faf]/.test(char);
const normalizeText = text => text.toLowerCase().trim();
const extractWords = text => text.match(/\b\w+\b/g) ?? [];

// Debounced storage update
const debounce = (fn, ms) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
};

const updateStorage = debounce(async (key, value) => {
    try {
        await browser.storage.local.set({ [key]: value });
    } catch (err) {
        console.error(`Storage update failed for ${key}:`, err);
    }
}, DEBOUNCE_MS);

// State management
class TranslationState {
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
            
            // Update storage with modified word data
            const wordData = Object.fromEntries(this.knownWords);
            updateStorage(this.currentLang, { words: wordData, settings: {} });
        }
        return word.kanjiViewCounts?.[kanji] ?? 0;
    }

    getKanjiFrequency(word, kanji) {
        return word.kanjiViewCounts?.[kanji] ?? 0;
    }

    hasKnownWord(text) {
        const normalized = normalizeText(text);
        return extractWords(normalized).some(word => this.knownWords.has(word)) ||
               this.knownWords.has(normalized);
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

            console.debug('Loaded state:', {
                lang: this.currentLang,
                wordCount: this.knownWords.size
            });
        } catch (err) {
            console.error('Failed to load from storage:', err);
            this.currentLang = 'ja';
            this.knownWords.clear();
            this.seenKanjiThisPage.clear();
        }
    }
}

// DOM manipulation
const createRubyElement = (char, reading) => 
    `<ruby>${char}<rt>${reading}</rt></ruby>`;

// Add styles to document
const addStyles = () => {
    const style = document.createElement('style');
    style.textContent = TOOLTIP_STYLES;
    document.head.appendChild(style);
};

// Simplify replaceNode function
const replaceNode = (node, html, translations) => {
    if (!node?.parentNode) return;
    const span = document.createElement('span');
    span.className = 'jp-word';
    span.innerHTML = html;
    
    // Create tooltip content
    const tooltip = document.createElement('div');
    tooltip.className = 'jp-tooltip';
    
    const content = translations.map(({text, reading}) => {
        return `<div>
            ${text} (${reading})
            <span class="speak-icon" data-text="${reading}">
                ${SPEAKER_ICON}
            </span>
        </div>`;
    }).join('');
    
    tooltip.innerHTML = content;
    span.appendChild(tooltip);
    
    // Click handler for speaker icons
    span.addEventListener('click', (e) => {
        const iconParent = e.target.closest('.speak-icon');
        if (iconParent) {
            e.stopPropagation();
            const text = iconParent.dataset.text;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';
            speechSynthesis.speak(utterance);
        }
    });

    node.parentNode.replaceChild(span, node);
};

// Translation functions
const translateText = async (state, text) => {
    // Filter known words to only those that appear in the text
    const relevantWords = [...state.knownWords.entries()]
        .filter(([en, _]) => text.toLowerCase().includes(en.toLowerCase()))
        .map(([en, data]) => ({ en, ...data }));

    const message = {
        type: 'PARTIAL_TRANSLATE',
        payload: {
            originalText: text,
            knownWords: relevantWords,
            addFurigana: true
        }
    };

    try {
        const response = await browser.runtime.sendMessage(message);
        if (!response?.translatedText) return text;

        // Process each word with its proper furigana
        return relevantWords.reduce((acc, { en, ...word }) => {  // Keep the English word for hover
            if (!word.native || !word.ruby || state.currentLang !== 'ja') {
                return acc.replace(word.native, word.native ?? '');
            }

            // Check if any kanji in the word needs furigana
            const needsFurigana = [...word.native].some(char => {
                if (!isKanji(char)) return false;
                const frequency = state.getKanjiFrequency(word, char);
                return frequency < KANJI_FAMILIARITY_THRESHOLD;
            });

            if (!needsFurigana) {
                return acc.replace(word.native, word.native);
            }

            // Update frequency for any kanji characters
            [...word.native].forEach(char => {
                if (isKanji(char)) {
                    state.updateKanjiFrequency(word, char);
                }
            });

            // Create hover text with both English and Japanese readings
            const hoverText = `${en} (${word.ruby})`;

            // Apply furigana to the whole phrase with hover
            const rubyHtml = `<ruby>${word.native}<rt>${word.ruby}</rt></ruby>`;
            return acc.replace(word.native, rubyHtml);
        }, response.translatedText);
    } catch (err) {
        console.error('Translation failed:', err);
        return text;
    }
};

// Batch processing
const BATCH_SIZE = 1000; // characters per batch
const BATCH_DELAY = 100; // ms between batches

// Visibility detection
const isVisible = node => {
    if (!node?.parentElement) return false;
    const rect = node.parentElement.getBoundingClientRect();
    return (
        rect.top >= -window.innerHeight &&
        rect.bottom <= window.innerHeight * 2 &&
        rect.left >= -window.innerWidth &&
        rect.right <= window.innerWidth * 2 &&
        getComputedStyle(node.parentElement).display !== 'none' &&
        getComputedStyle(node.parentElement).visibility !== 'hidden'
    );
};

const collectTextNodes = (state, node, nodes = []) => {
    if (!node || processedNodes.has(node)) return nodes;
    
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.trim();
        if (text && state.hasKnownWord(text) && isVisible(node)) {
            nodes.push({ node, text });
            processedNodes.add(node);
        }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip hidden elements early
        const style = getComputedStyle(node);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
            [...(node.childNodes || [])].forEach(child => 
                collectTextNodes(state, child, nodes)
            );
        }
    }
    return nodes;
};

const batchNodes = (nodes, maxSize = BATCH_SIZE) => {
    const batches = [];
    let currentBatch = [];
    let currentSize = 0;
    
    for (const node of nodes) {
        if (currentSize + node.text.length > maxSize && currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [];
            currentSize = 0;
        }
        currentBatch.push(node);
        currentSize += node.text.length;
    }
    
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }
    
    return batches;
};

const translateBatch = async (state, nodes) => {
    const combinedText = nodes.map(n => n.text).join('\n');
    const translatedText = await translateText(state, combinedText);
    const translations = translatedText.split('\n');
    
    nodes.forEach((node, i) => {
        if (translations[i] && translations[i] !== node.text) {
            // Find English words that were translated in this text
            const matchedWords = [...state.knownWords.entries()]
                .filter(([en, word]) => {
                    // Only include words that have valid translations
                    if (!word.native || !word.ruby) return false;
                    const wordRegex = new RegExp(`\\b${en}\\b`, 'i');
                    return wordRegex.test(node.text);
                });
            
            // Create structured translation data
            const translationData = matchedWords
                .filter(([_, word]) => word.native && word.ruby)
                .map(([en, word]) => ({
                    text: en,
                    reading: word.ruby
                }));
            
            replaceNode(
                node.node, 
                translations[i], 
                translationData.length > 0 ? translationData : [{text: node.text, reading: node.text}]
            );
        }
    });
};

const processBatches = async (state, batches) => {
    for (const batch of batches) {
        await translateBatch(state, batch);
        if (batches.length > 1) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
    }
};

// Intersection Observer setup
const setupIntersectionObserver = (state) => {
    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                processNode(state, entry.target);
                // Stop observing this element after processing
                observer.unobserve(entry.target);
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, {
        rootMargin: '100px', // Start loading slightly before elements come into view
        threshold: 0.1
    });

    // Observe major block elements that might contain text
    document.querySelectorAll('p, div, article, section, main, header, footer').forEach(el => {
        observer.observe(el);
    });

    return observer;
};

// Throttle for scroll/resize events
const throttle = (fn, delay) => {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            fn(...args);
            lastCall = now;
        }
    };
};

// Main processing
const processNode = async (state, node) => {
    const textNodes = collectTextNodes(state, node);
    if (textNodes.length === 0) return;
    
    const batches = batchNodes(textNodes);
    await processBatches(state, batches);
};

// Initialize and run
const state = new TranslationState();

const initialize = async () => {
    try {
        addStyles();  // Add this line at the start of initialize
        await state.loadFromStorage();
        
        // Wait for document to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        console.log("LOADING STATE");
        // Initial processing of visible content
        await processNode(state, document.body);

        // Set up intersection observer for dynamic loading
        const observer = setupIntersectionObserver(state);

        // Handle dynamic content changes
        const mutationObserver = new MutationObserver(
            throttle((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            observer.observe(node);
                            if (isVisible(node)) {
                                processNode(state, node);
                            }
                        }
                    });
                });
            }, 1000)
        );

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Clean up function
        const cleanup = () => {
            observer.disconnect();
            mutationObserver.disconnect();
        };

        // Clean up on page unload
        window.addEventListener('unload', cleanup);

    } catch (err) {
        console.error('Initialization failed:', err);
    }
};

// Listen for storage changes
browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;

    try {
        let needsReprocess = false;
        
        if (changes.lastLanguage) {
            state.currentLang = changes.lastLanguage.newValue ?? 'ja';
            needsReprocess = true;
        }
        
        if (changes[state.currentLang]) {
            const data = changes[state.currentLang].newValue ?? { words: {}, settings: {} };
            state.knownWords = new Map(
                Object.entries(data.words ?? {})
                    .map(([key, val]) => [key.toLowerCase(), val])
                    .filter(([_, val]) => val && typeof val === 'object')
            );
            needsReprocess = true;
        }

        // Only clear cache and reprocess if dictionary or language changed
        if (needsReprocess) {
            processedNodes.clear(); // Clear the cache when words change
            await processNode(state, document.body);
        }
    } catch (err) {
        console.error('Failed to handle storage changes:', err);
    }
});

initialize();
  