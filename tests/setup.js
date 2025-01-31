import { jest } from '@jest/globals';
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.NodeList = dom.window.NodeList;

// Mock browser API
global.browser = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

// Mock speech synthesis
global.speechSynthesis = {
    speak: jest.fn(),
    cancel: jest.fn(),
    getVoices: jest.fn().mockReturnValue([]),
    onvoiceschanged: null
};

global.SpeechSynthesisUtterance = class {
    constructor(text) {
        this.text = text;
    }
};

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
    document.body.innerHTML = '';
}); 