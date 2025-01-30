import { SPEAKER_ICON } from './styles.js';
import { isVisible } from './utils.js';
import { extractWords } from '../lib/textProcessing.js';
// Cache for processed nodes
export const processedNodes = new WeakSet();

// Simplify replaceNode function
export const replaceNode = (node, originalText, html, knownWords) => {
    if (!node?.parentNode || originalText === html) return;


    const span = document.createElement('span');
    span.className = 'jp-word';
    span.innerHTML = html;
    
    // Create tooltip content
    const tooltip = document.createElement('div');
    tooltip.className = 'jp-tooltip';
    
    // Show original text first
    const originalSection = document.createElement('div');
    originalSection.className = 'tooltip-original';
    originalSection.textContent = originalText;
    tooltip.appendChild(originalSection);

    // Add separator
    const separator = document.createElement('div');
    separator.className = 'tooltip-separator';
    tooltip.appendChild(separator);

    // Add translations list
    const translationsList = document.createElement('div');
    translationsList.className = 'tooltip-translations';
    
    // Only show translations that are different from their reading
    const words = extractWords(originalText).map(word => word.toLowerCase());
    [...knownWords.entries()].filter(([en, word]) => words.includes(en.toLowerCase()))
        .forEach(([en, {native, ruby}]) => {
            const translationItem = document.createElement('div');
            translationItem.className = 'translation-item';
            translationItem.innerHTML = `
                <span class="translation-text">${en}</span>
                <span class="translation-reading">${native}</span>
                <span class="speak-icon" data-text="${native}">
                    ${SPEAKER_ICON}
                </span>
            `;
            translationsList.appendChild(translationItem);
        });
    
    tooltip.appendChild(translationsList);
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

export const collectTextNodes = (state, node, nodes = []) => {
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