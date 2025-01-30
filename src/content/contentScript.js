import { TOOLTIP_STYLES } from './styles.js';
import { throttle, isVisible } from '../lib/utils.js';
import { 
    splitIntoSentences, 
    containsAnyWord,
    makeTranslationCacheKey 
} from '../lib/textProcessing.js';
import { replaceNode, collectTextNodes, processedNodes } from './dom.js';
import { TranslationState } from './state.js';

// Constants
const BATCH_SIZE = 1000; // characters per batch
const BATCH_DELAY = 100; // ms between batches

// Local translation cache
const translationCache = new Map();

// Add styles to document
const addStyles = () => {
    const style = document.createElement('style');
    style.textContent = TOOLTIP_STYLES;
    document.head.appendChild(style);
};

const batchNodes = (nodes, maxSize = BATCH_SIZE) => {
    const batches = [];
    let sentenceId = 0;

    // Track unique sentences while preserving node mapping
    const uniqueSentences = new Map(); // text -> { id, nodes: Set(nodes) }

    for (const node of nodes) {
        const sentences = splitIntoSentences(node.text);
        
        sentences.forEach(s => {
            const text = s.trim();
            if (!text) return;

            let sentenceData = uniqueSentences.get(text);
            if (!sentenceData) {
                const id = `s${sentenceId++}`;
                sentenceData = { id, text, nodes: new Set() };
                uniqueSentences.set(text, sentenceData);
            }
            sentenceData.nodes.add(node.node);
        });
    }

    // Convert unique sentences to array format
    const sentences = Array.from(uniqueSentences.values()).map(({ id, text, nodes }) => ({
        id,
        text,
        nodes: Array.from(nodes)
    }));

    // Batch the unique sentences
    let currentBatchSize = 0;
    let currentBatchSentences = [];

    sentences.forEach(sentence => {
        const size = sentence.text.length;
        if (currentBatchSize + size > maxSize && currentBatchSentences.length > 0) {
            batches.push({ sentences: currentBatchSentences });
            currentBatchSentences = [];
            currentBatchSize = 0;
        }
        currentBatchSentences.push(sentence);
        currentBatchSize += size;
    });

    if (currentBatchSentences.length > 0) {
        batches.push({ sentences: currentBatchSentences });
    }

    return batches;
};

const translateBatch = async (state, batch) => {
    const { sentences } = batch;
    
    // Check local cache first and collect uncached sentences
    const uncachedSentences = [];
    const translations = [];
    
    sentences.forEach(sentence => {
        const cacheKey = makeTranslationCacheKey(sentence.text, [...state.knownWords.entries()]);
        const cached = translationCache.get(cacheKey);
        
        if (cached) {
            translations[sentence.id] = { id: sentence.id, text: cached };
        } else {
            uncachedSentences.push(sentence);
        }
    });

    // Only translate uncached sentences
    if (uncachedSentences.length > 0) {
        const newTranslations = await translateText(uncachedSentences, state.knownWords);
        
        // Cache new translations
        newTranslations.forEach(translation => {
            const original = uncachedSentences.find(s => s.id === translation.id);
            if (original) {
                const cacheKey = makeTranslationCacheKey(original.text, [...state.knownWords.entries()]);
                translationCache.set(cacheKey, translation.text);
            }
            translations[translation.id] = translation;
        });
    }

    // Group sentences by node, handling multiple nodes per sentence
    const nodeMap = new Map();
    sentences.forEach(s => {
        const translatedText = translations[s.id]?.text || s.text;
        s.nodes.forEach(node => {
            if (!nodeMap.has(node)) {
                nodeMap.set(node, []);
            }
            nodeMap.get(node).push({
                original: s.text,
                translated: translatedText
            });
        });
    });

    // Replace text in each node
    for (const [node, nodeTranslations] of nodeMap.entries()) {
        nodeTranslations.forEach(({ original, translated }) => {
            if (translated !== original) {
                // Find English words that were translated in this text
                const matchedWords = [...state.knownWords.entries()]
                    .filter(([en, word]) => {
                        if (!word.native || !word.ruby) return false;
                        return containsAnyWord(original, [en]);
                    })
                    .sort((a, b) => b[0].length - a[0].length); // Sort by word length to match longest words first

                // Create structured translation data
                const translationData = matchedWords
                    .filter(([_, word]) => word.native && word.ruby)
                    .map(([en, word]) => ({
                        text: en,
                        reading: word.ruby
                    }));

                replaceNode(
                    node,
                    original,
                    translated,
                    state.knownWords,
                );
            }
        });
    }
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
        addStyles();
        await state.loadFromStorage();
        
        // Wait for document to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

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

async function translateText(sentences, knownWords) {
    if (!sentences?.length || !knownWords?.size) return [];

    // Convert Map to array of serializable word objects
    const wordArray = [...knownWords.entries()].map(([en, data]) => ({
        en,
        native: data.native,
        ruby: data.ruby,
        useKanji: data.useKanji
    }));

    // Only translate sentences containing known words
    const englishWords = wordArray.map(w => w.en);
    const relevantSentences = sentences.filter(s => 
        containsAnyWord(s.text, englishWords)
    );

    if (relevantSentences.length === 0) {
        return sentences.map(s => ({ id: s.id, text: s.text }));
    }

    try {
        const response = await browser.runtime.sendMessage({
            type: "PARTIAL_TRANSLATE",
            payload: {
                sentences: relevantSentences.map(({ id, text }) => ({ id, text })),
                knownWords: wordArray
            }
        });

        // Merge translations with original sentences
        const translationMap = new Map(
            (response?.translations ?? []).map(t => [t.id, t.text])
        );

        return sentences.map(s => ({
            id: s.id,
            text: translationMap.get(s.id) ?? s.text
        }));
    } catch (err) {
        console.error("Translation failed:", err);
        return sentences.map(s => ({ id: s.id, text: s.text }));
    }
}

initialize();
