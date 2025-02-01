import { debounce } from './utils.js';

// Cache configuration
export const CACHE_MAX_SIZE = 1000; // Maximum number of translations to store
export const CACHE_EXPIRY_DAYS = 5;
export const CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;


// Hashing
export const makeHash = str => {
    if (typeof str !== 'string') return '0';
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
};

export const makeTranslationCacheKey = (text, words) => {
    if (!text || !Array.isArray(words)) return '';
    
    const wordKey = words.map(w => w?.en?.toLowerCase()).filter(Boolean).sort().join(',');
    return `${makeHash(text)}:${makeHash(wordKey)}`;
};

let translationCache = {};

export async function loadCache() {
  try {
    const data = await browser.storage.local.get('translationCache');
    if (!data.translationCache) {
      translationCache = {};
      return;
    }

    translationCache = data.translationCache;
    await cleanupCache();
  } catch (err) {
    console.error('Failed to load translation cache:', err);
    translationCache = {};
  }
}

// Save cache to storage (debounced)
export const saveCache = debounce(async () => {
  try {
    await browser.storage.local.set({ translationCache });
  } catch (err) {
    console.error('Failed to save translation cache:', err);
  }
}, 1000);

export const cleanupCache = async () => {
  const now = Date.now();
  
  // First filter out expired entries
  const validEntries = Object.entries(translationCache)
    .filter(([_, entry]) => now - entry.timestamp < CACHE_EXPIRY_MS)
    .sort((a, b) => b[1].timestamp - a[1].timestamp);

  // Then trim to max size if needed
  const finalEntries = validEntries.slice(0, CACHE_MAX_SIZE);
  
  // Only update and save if we removed any entries
  if (finalEntries.length < Object.keys(translationCache).length) {
    translationCache = Object.fromEntries(finalEntries);
    await saveCache();
  }
} 

export const getCachedTranslation = (text, relevantWords) => {
    const cacheKey = makeTranslationCacheKey(text, relevantWords)
    const now = Date.now();
    const cached = translationCache[cacheKey];
    return cached && now - cached.timestamp < CACHE_EXPIRY_MS ? cached.text : null;
}

export const setCacheEntry = (text, relevantWords, translation) => {
  const timestamp = Date.now();
  const cacheKey = makeTranslationCacheKey(text, relevantWords)
  translationCache[cacheKey] = { text: translation, timestamp };
}