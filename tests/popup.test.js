import { jest } from '@jest/globals';

// Mock browser API
global.browser = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn().mockResolvedValue()
        }
    }
};

// Mock the imported modules
const mockWordDisplay = {
    getDisplayText: jest.fn(data => data.native),
    formatTooltip: jest.fn(data => data.native),
    speakWord: jest.fn()
};

jest.mock('../lib/wordDisplay.js', () => mockWordDisplay);

// Mock window.speechSynthesis
global.speechSynthesis = {
    getVoices: jest.fn().mockReturnValue([]),
    speak: jest.fn(),
    cancel: jest.fn()
};

global.SpeechSynthesisUtterance = jest.fn().mockImplementation(() => ({
    voice: null,
    lang: '',
    rate: 1,
    pitch: 1,
    volume: 1
}));

// Mock alert
global.alert = jest.fn();

const mockDictionaries = {
    japaneseDictionary: {
        words: {
            hello: {
                native: 'こんにちは',
                ruby: 'こんにちは',
                useKanji: false,
                viewCount: 0,
                kanjiViewCounts: {}
            }
        },
        settings: {
            voice: 'ja-JP',
            minKanjiViews: 100
        }
    },
    chineseDictionary: { words: {}, settings: {} },
    koreanDictionary: { words: {}, settings: {} },
    spanishDictionary: { words: {}, settings: {} },
    frenchDictionary: { words: {}, settings: {} },
    germanDictionary: { words: {}, settings: {} },
    polishDictionary: { words: {}, settings: {} },
    welshDictionary: { words: {}, settings: {} },
    defaultDictionaries: {
        ja: {
            words: {
                hello: {
                    native: 'こんにちは',
                    ruby: 'こんにちは',
                    useKanji: false,
                    viewCount: 0,
                    kanjiViewCounts: {}
                }
            },
            settings: {
                voice: 'ja-JP',
                minKanjiViews: 100
            }
        }
    }
};

mockDictionaries.defaultDictionaries = {
    ja: mockDictionaries.japaneseDictionary,
    zh: mockDictionaries.chineseDictionary,
    ko: mockDictionaries.koreanDictionary,
    es: mockDictionaries.spanishDictionary,
    fr: mockDictionaries.frenchDictionary,
    de: mockDictionaries.germanDictionary,
    pl: mockDictionaries.polishDictionary,
    cy: mockDictionaries.welshDictionary
};

jest.mock('../lib/defaultDictionaries.js', () => mockDictionaries);

// Import all functions to test
const {
    getKanjiViewCounts,
    createWord,
    validateNewWord,
    addWord,
    clearInputs,
    loadLanguageData,
    MESSAGES,
    wordMatchesSearch,
    updateFormPlaceholders,
    handleAddWord,
    renderWords
} = require('../src/popup/popup.js');

describe('Pure Functions', () => {
    describe('getKanjiViewCounts', () => {
        test.each([
            [null, {}],
            [undefined, {}],
            ['', {}],
            ['ひらがな', {}],
            ['漢字', { '漢': 0, '字': 0 }],
            ['漢字とひらがな', { '漢': 0, '字': 0 }]
        ])('getKanjiViewCounts(%p) => %p', (input, expected) =>
            expect(getKanjiViewCounts(input)).toEqual(expected));
    });

    describe('createWord', () => {
        test.each([
            ['ja', 'こんにちは', 'こんにちは', { native: 'こんにちは', ruby: 'こんにちは', viewCount: 0 }],
            ['ja', 'こんにちは', undefined, { native: 'こんにちは', ruby: undefined, viewCount: 0 }],
            ['en', 'hello', undefined, { native: 'hello', ruby: undefined, viewCount: 0 }]
        ])('createWord(%p, %p, %p) => %p', (lang, native, ruby, expected) =>
            expect(createWord(lang, native, ruby)).toEqual(expected));
    });

    describe('validateNewWord', () => {
        const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});
        const currentLangData = { words: { existing: {} } };

        afterAll(() => mockAlert.mockRestore());

        test.each([
            ['', 'test', false, MESSAGES.REQUIRED_FIELDS],
            ['test', '', false, MESSAGES.REQUIRED_FIELDS],
            ['', '', false, MESSAGES.REQUIRED_FIELDS],
            ['existing', 'test', false, MESSAGES.WORD_EXISTS],
            ['new', 'test', true, null]
        ])('validateNewWord(%p, %p) => %p with alert: %p', (en, translation, expected, alertMessage) => {
            expect(validateNewWord(en, translation, currentLangData)).toBe(expected);
            alertMessage 
                ? expect(mockAlert).toHaveBeenCalledWith(alertMessage)
                : expect(mockAlert).not.toHaveBeenCalled();
            mockAlert.mockClear();
        });
    });

    describe('clearInputs', () => {
        test.each([
            [[]],
            [[{ value: 'test1' }]],
            [[{ value: 'test1' }, { value: 'test2' }]],
            [[{ value: 'test1' }, { value: 'test2' }, { value: 'test3' }]]
        ])('clearInputs(...%p) clears all values', (inputs) => {
            clearInputs(...inputs);
            inputs.forEach(input => expect(input.value).toBe(''));
        });
    });
});

describe('Storage Functions', () => {
    beforeEach(() => {
        browser.storage.local.get.mockClear();
        browser.storage.local.set.mockClear();
    });

    describe('loadLanguageData', () => {
        test.each([
            ['ja', { ja: { words: { test: {} }, settings: {} } }, { words: { test: {} }, settings: {} }],
            ['ja', {}, mockDictionaries.defaultDictionaries.ja],
            ['xx', {}, { words: {}, settings: {} }]
        ])('loadLanguageData(%p) with storage %p => %p', async (lang, storage, expected) => {
            browser.storage.local.get.mockResolvedValue(storage);
            expect(await loadLanguageData(lang)).toEqual(expected);
            expect(browser.storage.local.get).toHaveBeenCalledWith(lang);
        });
    });

    describe('addWord', () => {
        const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});
        
        beforeEach(() => {
            browser.storage.local.set.mockResolvedValue();
            mockAlert.mockClear();
        });

        afterAll(() => mockAlert.mockRestore());

        test.each([
            [
                'ja',
                { words: {} },
                'test',
                'テスト',
                'てすと',
                true,
                {
                    words: {
                        test: {
                            native: 'テスト',
                            ruby: 'てすと',
                            viewCount: 0
                        }
                    }
                }
            ],
            [
                'ja',
                {
                    words: { existing: { native: 'existing', viewCount: 0 } },
                    settings: { someOption: true }
                },
                'test',
                'テスト',
                'てすと',
                true,
                {
                    words: {
                        existing: { native: 'existing', viewCount: 0 },
                        test: {
                            native: 'テスト',
                            ruby: 'てすと',
                            viewCount: 0
                        }
                    },
                    settings: { someOption: true }
                }
            ],
            [
                'ja',
                { words: { test: { native: 'テスト', ruby: 'てすと' } } },
                'test',
                'テスト2',
                'てすと2',
                false,
                null
            ]
        ])('addWord(%p, %p, %p, %p, %p) => %p with expected data %p', 
            async (lang, currentData, word, translation, ruby, expectedSuccess, expectedData) => {
                const success = await addWord(lang, currentData, word, translation, ruby);
                expect(success).toBe(expectedSuccess);
                
                if (expectedData) {
                    expect(browser.storage.local.set).toHaveBeenCalledWith({
                        [lang]: expectedData
                    });
                }
            });
    });
});

describe('Search Functions', () => {
    describe('wordMatchesSearch', () => {
        const wordData = {
            native: '漢字',
            ruby: 'かんじ',
            hiragana: 'かんじ',
            kanji: '漢字'
        };

        test.each([
            ['', true],
            ['kan', true],
            ['かん', true],
            ['漢', true],
            ['xyz', false],
            ['かな', false]
        ])('wordMatchesSearch with search term %p returns %p', (searchTerm, expected) => {
            expect(wordMatchesSearch('kanji', wordData, searchTerm)).toBe(expected);
        });

        test('handles missing word data fields', () => {
            expect(wordMatchesSearch('test', {}, 'test')).toBe(true);
        });
    });
});

describe('DOM Functions', () => {
    let container;
    let speakWord;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'wordList';
        document.body.appendChild(container);
        speakWord = jest.fn();
        global.speakWord = speakWord;
    });

    afterEach(() => {
        document.body.removeChild(container);
        delete global.speakWord;
    });

    describe('updateFormPlaceholders', () => {
        test('configures form for Japanese', () => {
            // Setup
            container.innerHTML = `
                <div class="add-word-form">
                    <input id="newTranslation" />
                    <input id="newFurigana" />
                </div>
            `;
            const newTranslation = container.querySelector('#newTranslation');
            const newFurigana = container.querySelector('#newFurigana');

            // Test
            updateFormPlaceholders('ja', newTranslation, newFurigana);

            // Assert
            expect(newFurigana.style.display).toBe('block');
            expect(container.querySelector('.add-word-form').style.gridTemplateColumns)
                .toBe('repeat(4, 1fr)');
        });

        test('configures form for non-Japanese', () => {
            // Setup
            container.innerHTML = `
                <div class="add-word-form">
                    <input id="newTranslation" />
                    <input id="newFurigana" />
                </div>
            `;
            const newTranslation = container.querySelector('#newTranslation');
            const newFurigana = container.querySelector('#newFurigana');

            // Test
            updateFormPlaceholders('es', newTranslation, newFurigana);

            // Assert
            expect(newFurigana.style.display).toBe('none');
            expect(container.querySelector('.add-word-form').style.gridTemplateColumns)
                .toBe('repeat(3, 1fr)');
        });
    });

    describe('handleAddWord', () => {
        beforeEach(() => {
            browser.storage.local.set.mockResolvedValue();
            jest.spyOn(window, 'alert').mockImplementation(() => {});
        });

        afterEach(() => {
            window.alert.mockRestore();
        });

        test('successfully adds word and clears inputs', async () => {
            // Setup
            const inputs = {
                newEnglish: { value: 'test' },
                newTranslation: { value: 'テスト' },
                newFurigana: { value: 'てすと' }
            };
            const currentLangData = { words: {} };

            // Test
            await handleAddWord('ja', currentLangData, inputs);

            // Assert
            expect(inputs.newEnglish.value).toBe('');
            expect(inputs.newTranslation.value).toBe('');
            expect(inputs.newFurigana.value).toBe('');
            expect(browser.storage.local.set).toHaveBeenCalled();
        });

        test('handles failed word addition', async () => {
            // Setup
            const inputs = {
                newEnglish: { value: '' },
                newTranslation: { value: 'テスト' },
                newFurigana: { value: 'てすと' }
            };
            const currentLangData = { words: {} };

            // Test
            await handleAddWord('ja', currentLangData, inputs);

            // Assert
            expect(inputs.newEnglish.value).toBe('');
            expect(browser.storage.local.set).not.toHaveBeenCalled();
            expect(window.alert).toHaveBeenCalledWith(MESSAGES.REQUIRED_FIELDS);
        });
    });

    describe('renderWords', () => {
        let container;
        let wordList;
        let header;
        let getElementByIdSpy;

        beforeEach(() => {
            container = document.createElement('div');
            container.className = 'container word-list';
            
            header = document.createElement('div');
            header.className = 'word-item word-header';
            header.innerHTML = `
                <div>English</div>
                <div>Reading</div>
                <div>Use Kanji</div>
                <div></div>
                <div></div>
            `;
            
            wordList = document.createElement('div');
            wordList.id = 'wordList';
            
            container.appendChild(header);
            container.appendChild(wordList);
            document.body.appendChild(container);
            
            // Mock getElementById to return our test element
            getElementByIdSpy = jest.spyOn(document, 'getElementById').mockImplementation((id) => {
                if (id === 'wordList') return wordList;
                return null;
            });
            
            // Reset mock implementations
            mockWordDisplay.getDisplayText.mockImplementation(data => data.native);
            mockWordDisplay.formatTooltip.mockImplementation(data => data.native);
            mockWordDisplay.speakWord.mockClear();
            browser.storage.local.set.mockClear();
            browser.storage.local.get.mockClear();
        });

        afterEach(() => {
            document.body.removeChild(container);
            getElementByIdSpy.mockRestore();
            jest.clearAllMocks();
        });

        test('renders words correctly', () => {
            const currentLang = 'ja';
            const currentLangData = {
                words: {
                    'test': {
                        native: '漢字',
                        ruby: 'かんじ',
                        useKanji: true
                    }
                },
                settings: { showKanji: true }
            };

            renderWords(currentLang, currentLangData);

            // Wait for any async operations to complete
            jest.runAllTimers();

            const wordItems = Array.from(wordList.children);
            expect(wordItems.length).toBe(1);
            
            const wordItem = wordItems[0];
            expect(wordItem.children[0].textContent.trim()).toBe('test');
            expect(wordItem.children[1].textContent.trim()).toBe('漢字');
            expect(wordItem.querySelector('.kanji-toggle')).toBeTruthy();
            expect(wordItem.querySelector('.delete-btn')).toBeTruthy();
            expect(wordItem.querySelector('.speak-btn')).toBeTruthy();
        });

        test('handles empty word list', () => {
            const currentLang = 'ja';
            const currentLangData = {
                words: {},
                settings: { showKanji: true }
            };

            renderWords(currentLang, currentLangData);

            // Wait for any async operations to complete
            jest.runAllTimers();

            const wordItems = Array.from(wordList.children);
            expect(wordItems.length).toBe(0);
        });

        test('filters words by search term', () => {
            const currentLang = 'ja';
            const currentLangData = {
                words: {
                    'test': {
                        native: '漢字',
                        ruby: 'かんじ',
                        useKanji: true
                    },
                    'hello': {
                        native: 'こんにちは',
                        ruby: 'こんにちは',
                        useKanji: true
                    }
                },
                settings: { showKanji: true }
            };

            renderWords(currentLang, currentLangData, 'test');

            // Wait for any async operations to complete
            jest.runAllTimers();

            const wordItems = Array.from(wordList.children);
            expect(wordItems.length).toBe(1);
            expect(wordItems[0].children[0].textContent.trim()).toBe('test');
            expect(wordItems[0].children[1].textContent.trim()).toBe('漢字');
        });

        test('adds event listeners', () => {
            const currentLang = 'ja';
            const currentLangData = {
                words: {
                    'test': {
                        native: '漢字',
                        ruby: 'かんじ',
                        useKanji: true
                    }
                },
                settings: { 
                    showKanji: true,
                    voice: 'ja-JP'
                }
            };

            renderWords(currentLang, currentLangData);

            // Wait for any async operations to complete
            jest.runAllTimers();

            const wordItems = Array.from(wordList.children);
            const speakBtn = wordItems[0].querySelector('.speak-btn');
            expect(speakBtn).toBeTruthy();

            speakBtn.click();
            expect(mockWordDisplay.speakWord).toHaveBeenCalledWith('漢字', currentLangData.settings.voice);
        });
    });
}); 