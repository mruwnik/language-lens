import { jest } from '@jest/globals';

// Mock browser API with proper storage implementation
const browserStore = {};

global.browser = {
    storage: {
        local: {
            get: jest.fn((key) => {
                if (typeof key === 'string') {
                    return Promise.resolve({ [key]: browserStore[key] });
                }
                if (Array.isArray(key)) {
                    const result = {};
                    key.forEach(k => {
                        result[k] = browserStore[k];
                    });
                    return Promise.resolve(result);
                }
                return Promise.resolve(browserStore);
            }),
            set: jest.fn((data) => {
                Object.assign(browserStore, data);
                return Promise.resolve();
            })
        }
    },
    runtime: {
        onMessage: {
            addListener: jest.fn()
        }
    }
};

// Mock chrome API as fallback
global.chrome = global.browser;

// Mock window.speechSynthesis
Object.defineProperty(window, 'speechSynthesis', {
    value: {
        getVoices: jest.fn().mockReturnValue([]),
        speak: jest.fn(),
        cancel: jest.fn(),
        onvoiceschanged: null
    },
    writable: true
});

// Mock SpeechSynthesisUtterance
global.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
    voice: null,
    rate: 1,
    pitch: 1,
    volume: 1,
    text,
    lang: ''
}));

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => store[key]),
        setItem: jest.fn((key, value) => {
            store[key] = value.toString();
        }),
        clear: jest.fn(() => {
            store = {};
        }),
        removeItem: jest.fn(key => {
            delete store[key];
        })
    };
})();
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

// Mock alert and confirm
global.alert = jest.fn();
global.confirm = jest.fn();

// Reset mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    Object.keys(browserStore).forEach(key => delete browserStore[key]);
}); 