import { SPEAKER_ICON } from './styles.js';
import { isVisible } from './utils.js';
import { speakWord } from '../lib/wordDisplay.js';
import { splitIntoSentences, createSentencePairs, extractWords } from '../lib/textProcessing.js';
// Keep track of which nodes we've already processed
export const processedNodes = new Set();


export const translationPopup = (state, text, translations) => {
    // Create tooltip content
    const tooltip = document.createElement('div');
    tooltip.className = 'language-lens-tooltip';
    
    // Show original text first
    const originalSection = document.createElement('div');
    originalSection.className = 'language-lens-tooltip-original';
    originalSection.textContent = text;
    tooltip.appendChild(originalSection);

    // Add separator
    const separator = document.createElement('div');
    separator.className = 'language-lens-tooltip-separator';
    tooltip.appendChild(separator);

    // Add translations list
    const translationsList = document.createElement('div');
    translationsList.className = 'language-lens-tooltip-translations';
    
    // Only show translations that are different from their reading
    translations.forEach(({original, native, ruby}) => {
        const translationItem = document.createElement('div');
        translationItem.className = 'language-lens-translation-item';
        const item = ruby ? `<ruby>${native}<rt>${ruby}</rt></ruby>` : native;
        translationItem.innerHTML = `
            <span class="language-lens-translation-text">${original}</span>
            <span class="language-lens-translation-reading">${item}</span>
            <span class="language-lens-speak-icon" data-text="${native}">
            ${SPEAKER_ICON}
            </span>
        `;
        translationsList.appendChild(translationItem);
    });
    
    tooltip.appendChild(translationsList);
    
    // Click handler for speaker icons
    tooltip.addEventListener('click', (e) => {
        const iconParent = e.target.closest('.speak-icon');
        if (iconParent) {
            e.stopPropagation();
            const text = iconParent.dataset.text;
            speakWord(text, state.currentLang);
        }
    });

    return tooltip;
}

const translatedNode = (state, nodeType, originalText, translated, knownWords) => {
    const span = document.createElement(nodeType || 'span');
    span.className = 'language-lens-word';
    span.innerHTML = translated;
   
    const translatedWords = extractWords(originalText)
        .map(word => word.toLowerCase().trim())
        .filter(word => knownWords.has(word))
        .map(word => ({...knownWords.get(word), original: word}));

    span.appendChild(translationPopup(state, originalText, translatedWords));
    return span;
}

// Simplify replaceNode function
export const replaceNode = (state, node, html, knownWords) => {
    const originalText = node.textContent;

    if (!node?.parentNode || originalText === html) return;

    const container = document.createElement(node.tagName || 'span');
    container.className = 'language-lens-container';

    createSentencePairs(originalText, html).forEach(([text, translated], index) => {
        if (text === translated) {
            container.appendChild(document.createTextNode(text))
        } else {
            const node = translatedNode(state, 'span', text, translated, knownWords);
            container.appendChild(node);
        }
    });
    
    node.parentNode.replaceChild(container, node);
};

export const collectTextNodes = (state, node, nodes = []) => {
    if (!node || processedNodes.has(node)) return nodes;
    
    if (node.classList?.contains('language-lens-container')) return nodes;

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.trim();
        if (text && state.hasKnownWord(text) && isVisible(node)) {
            nodes.push({ node, text });
            processedNodes.add(node);
        }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip hidden elements and translation items
        const style = getComputedStyle(node);
        if (style.display !== 'none' && 
            style.visibility !== 'hidden' && 
            !node.closest('.language-lens-tooltip')) {
            [...(node.childNodes || [])].forEach(child => 
                collectTextNodes(state, child, nodes)
            );
        }
    }
    return nodes;
}; 

export const processTextNodes = (nodes) => {
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