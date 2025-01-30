import { TOOLTIP_STYLES } from './styles.js';
import { throttle, isVisible } from '../lib/utils.js';
import { 
    splitIntoSentences, 
    containsAnyWord
} from '../lib/textProcessing.js';
import { replaceNode, collectTextNodes, processedNodes } from './dom.js';
import { TranslationState } from './state.js';

// Add styles to document
const addStyles = () => {
    const style = document.createElement('style');
    style.textContent = TOOLTIP_STYLES;
    document.head.appendChild(style);
};

const processTextNodes = (nodes) => {
    let sentenceId = 0;
    const uniqueSentences = new Map(); // text -> { id, nodes: Set(nodes) }

    // Collect unique sentences while preserving node mapping
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

    return Array.from(uniqueSentences.values()).map(({ id, text, nodes }) => ({
        id,
        text,
        nodes: Array.from(nodes)
    }));
};

const translateAndReplace = async (state, sentences) => {
    if (!sentences.length) return;
    
    const translations = await translateText(sentences, state.knownWords);
    
    // Group sentences by node, handling multiple nodes per sentence
    const nodeMap = new Map();
    sentences.forEach(s => {
        const translatedText = translations.find(t => t.id === s.id)?.text || s.text;
        
        // Find English words that were translated in this text
        [...state.knownWords.entries()]
            .filter(([en, word]) => word.native && containsAnyWord(s.text, [en]))
            .forEach(([en, word]) => {
                state.updateWordView(word, en);
            });

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

    // Save updated word counts to storage
    await state.saveToStorage();

    // Replace text in each node
    for (const [node, nodeTranslations] of nodeMap.entries()) {
        nodeTranslations.forEach(({ original, translated }) => {
            if (translated !== original) {
                replaceNode(node, original, translated, state.knownWords);
            }
        });
    }
};

// Main processing
const processNode = async (state, node) => {
    const textNodes = collectTextNodes(state, node);
    if (textNodes.length === 0) return;
    
    const sentences = processTextNodes(textNodes);
    await translateAndReplace(state, sentences);
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
    
    console.log(knownWords);
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
