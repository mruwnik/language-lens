// Text processing utilities
export const isKanji = char => /[\u4e00-\u9faf]/.test(char);
export const normalizeText = text => text.toLowerCase().trim();
export const extractWords = text => text.match(/\b\w+\b/g) ?? [];

// DOM utilities
export const isVisible = node => {
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

export const createRubyElement = (char, reading) => 
    `<ruby>${char}<rt>${reading}</rt></ruby>`;

// Async utilities
export const debounce = (fn, ms) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
};

export const throttle = (fn, delay) => {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            fn(...args);
            lastCall = now;
        }
    };
}; 