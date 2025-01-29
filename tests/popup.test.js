import { jest } from '@jest/globals';
import '../src/popup/popup.js';

describe('Popup Functionality', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="section api-section">
                <div>
                    <h2>OpenAI API Key</h2>
                    <input type="password" id="apiKey" placeholder="sk-..." />
                </div>
                <button id="saveKey">Save Key</button>
            </div>

            <div class="section lang-section">
                <h2>Target Language</h2>
                <select id="targetLang" class="lang-select">
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                </select>
            </div>

            <div class="section">
                <h2>Known Words</h2>
                <div class="search-container">
                    <input type="text" id="wordSearch" placeholder="Search words..." />
                </div>
                <div class="word-list">
                    <div class="word-item word-header">
                        <div>English</div>
                        <div>Reading</div>
                        <div>Use Kanji</div>
                        <div></div>
                        <div></div>
                    </div>
                    <div id="wordList"></div>
                </div>
            </div>

            <div class="section">
                <h2>Add New Word</h2>
                <div class="add-word-form">
                    <input type="text" id="newEnglish" placeholder="English" />
                    <input type="text" id="newHiragana" placeholder="Hiragana" />
                    <input type="text" id="newKanji" placeholder="Kanji" />
                    <button id="addWord">Add</button>
                </div>
            </div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('loads default Japanese dictionary when no stored data exists', async () => {
        // Trigger DOMContentLoaded
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 0));

        // Verify browser.storage.local.get was called
        expect(browser.storage.local.get).toHaveBeenCalledWith(['openaiApiKey', 'lastLanguage']);
        
        // Verify browser.storage.local.get was called with 'ja'
        expect(browser.storage.local.get).toHaveBeenCalledWith('ja');

        // Verify browser.storage.local.set was called to save default dictionary
        expect(browser.storage.local.set).toHaveBeenCalled();
    });

    describe('API Key Management', () => {
        test('loads API key from storage on startup', async () => {
            const mockApiKey = 'test-api-key';
            browser.storage.local.get
                .mockResolvedValueOnce({ openaiApiKey: mockApiKey })
                .mockResolvedValueOnce({ lastLanguage: 'ja' })
                .mockResolvedValueOnce({ ja: { words: {}, settings: {} } });
            
            // Trigger DOMContentLoaded
            document.dispatchEvent(new Event('DOMContentLoaded'));
            
            await new Promise(process.nextTick);
            
            expect(document.getElementById('apiKey').value).toBe(mockApiKey);
        });

        test('saves API key when save button is clicked', async () => {
            // Mock initial load
            browser.storage.local.get
                .mockResolvedValueOnce({ openaiApiKey: '' })
                .mockResolvedValueOnce({ lastLanguage: 'ja' })
                .mockResolvedValueOnce({ ja: { words: {}, settings: {} } });

            // Trigger DOMContentLoaded first
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);

            // Clear previous mock calls
            browser.storage.local.set.mockClear();

            const mockApiKey = 'new-api-key';
            const apiKeyInput = document.getElementById('apiKey');
            const saveButton = document.getElementById('saveKey');

            apiKeyInput.value = mockApiKey;
            saveButton.click();

            await new Promise(process.nextTick);

            expect(browser.storage.local.set).toHaveBeenCalledWith({
                openaiApiKey: mockApiKey
            });
        });

        test('shows alert when trying to save empty API key', async () => {
            // Mock window.alert
            const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

            // Mock initial load
            browser.storage.local.get
                .mockResolvedValueOnce({ openaiApiKey: '' })
                .mockResolvedValueOnce({ lastLanguage: 'ja' })
                .mockResolvedValueOnce({ ja: { words: {}, settings: {} } });

            // Trigger DOMContentLoaded first
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);

            // Clear previous mock calls
            browser.storage.local.set.mockClear();

            const apiKeyInput = document.getElementById('apiKey');
            const saveButton = document.getElementById('saveKey');

            apiKeyInput.value = '';
            saveButton.click();

            expect(alertMock).toHaveBeenCalledWith("Please enter your OpenAI API key (sk-...).");
            expect(browser.storage.local.set).not.toHaveBeenCalled();

            alertMock.mockRestore();
        });
    });

    describe('Language Selection', () => {
        test('loads last selected language from storage', async () => {
            browser.storage.local.get.mockResolvedValueOnce({ 
                lastLanguage: 'zh',
                zh: { words: {}, settings: {} }
            });

            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);

            expect(document.getElementById('targetLang').value).toBe('zh');
        });

        test('defaults to Japanese if no language is stored', async () => {
            browser.storage.local.get.mockResolvedValueOnce({});

            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);

            expect(document.getElementById('targetLang').value).toBe('ja');
        });

        test('updates form placeholders when language changes', async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({}) // Initial load
                .mockResolvedValueOnce({ zh: { words: {}, settings: {} } }); // Language data load

            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);

            const langSelect = document.getElementById('targetLang');
            langSelect.value = 'zh';
            langSelect.dispatchEvent(new Event('change'));

            await new Promise(process.nextTick);

            const newHiragana = document.getElementById('newHiragana');
            const newKanji = document.getElementById('newKanji');
            expect(newHiragana.placeholder).toBe('Pronunciation');
            expect(newKanji.style.display).toBe('none');
        });
    });

    describe('Word Search', () => {
        const mockWords = {
            "hello": {
                hiragana: "こんにちは",
                kanji: "今日は",
                useKanji: true
            },
            "world": {
                hiragana: "せかい",
                kanji: "世界",
                useKanji: true
            }
        };

        beforeEach(async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({ lastLanguage: 'ja' })
                .mockResolvedValueOnce({ ja: { words: mockWords, settings: {} } });

            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);
        });

        test('filters words based on English search', async () => {
            const searchInput = document.getElementById('wordSearch');
            searchInput.value = 'hel';
            searchInput.dispatchEvent(new Event('input'));

            await new Promise(process.nextTick);

            const wordList = document.getElementById('wordList');
            expect(wordList.innerHTML).toContain('hello');
            expect(wordList.innerHTML).not.toContain('world');
        });

        test('filters words based on Japanese search', async () => {
            const searchInput = document.getElementById('wordSearch');
            searchInput.value = 'せか';
            searchInput.dispatchEvent(new Event('input'));

            await new Promise(process.nextTick);

            const wordList = document.getElementById('wordList');
            expect(wordList.innerHTML).not.toContain('hello');
            expect(wordList.innerHTML).toContain('world');
        });
    });

    describe('Word Management', () => {
        beforeEach(async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({ lastLanguage: 'ja' })
                .mockResolvedValueOnce({ ja: { words: {}, settings: {} } });

            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);
        });

        test('adds new word with correct structure', async () => {
            const newEnglish = document.getElementById('newEnglish');
            const newHiragana = document.getElementById('newHiragana');
            const newKanji = document.getElementById('newKanji');
            const addButton = document.getElementById('addWord');

            newEnglish.value = 'test';
            newHiragana.value = 'てすと';
            newKanji.value = 'テスト';

            addButton.click();
            await new Promise(process.nextTick);

            expect(browser.storage.local.set).toHaveBeenCalledWith({
                ja: expect.objectContaining({
                    words: expect.objectContaining({
                        test: {
                            hiragana: 'てすと',
                            kanji: 'テスト',
                            useKanji: true,
                            viewCount: 0,
                            kanjiViewCounts: {}
                        }
                    })
                })
            });
        });

        test('prevents adding duplicate words', async () => {
            // Mock window.alert
            const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

            // Set up initial state with existing word
            browser.storage.local.get
                .mockResolvedValueOnce({ lastLanguage: 'ja' })
                .mockResolvedValueOnce({ 
                    ja: { 
                        words: { 
                            'test': { 
                                hiragana: 'てすと',
                                kanji: 'テスト',
                                useKanji: true,
                                viewCount: 0,
                                kanjiViewCounts: {}
                            } 
                        },
                        settings: {}
                    }
                });

            // Load the page
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);

            // Get initial state
            const initialState = await browser.storage.local.get('ja');

            // Clear previous mock calls
            browser.storage.local.set.mockClear();

            const newEnglish = document.getElementById('newEnglish');
            const newHiragana = document.getElementById('newHiragana');
            const addButton = document.getElementById('addWord');

            newEnglish.value = 'test';
            newHiragana.value = 'てすと';

            addButton.click();
            await new Promise(process.nextTick);

            expect(alertMock).toHaveBeenCalledWith('This word already exists!');
            
            // Verify state hasn't changed
            const currentState = await browser.storage.local.get('ja');
            expect(currentState).toEqual(initialState);

            alertMock.mockRestore();
        });
    });

    describe('Kanji Toggle', () => {
        const mockWords = {
            "test": {
                native: "テスト",
                ruby: "てすと",
                useKanji: true,
                viewCount: 0,
                kanjiViewCounts: {}
            }
        };

        beforeEach(async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({ lastLanguage: 'ja' })
                .mockResolvedValueOnce({ 
                    ja: { 
                        words: mockWords, 
                        settings: { 
                            showKanji: true,
                            minKanjiViews: 100,
                            voice: "ja-JP"
                        } 
                    } 
                });

            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(process.nextTick);
        });

        test('toggles kanji for individual word', async () => {
            // Wait for the word list to be rendered
            await new Promise(process.nextTick);

            const wordList = document.getElementById('wordList');
            const kanjiToggle = wordList.querySelector('.kanji-toggle');
            
            expect(kanjiToggle).toBeTruthy();
            kanjiToggle.click();
            await new Promise(process.nextTick);

            // Verify the storage was updated with useKanji set to false
            expect(browser.storage.local.set).toHaveBeenCalledWith({
                ja: {
                    words: {
                        test: {
                            native: "テスト",
                            ruby: "てすと",
                            useKanji: false,
                            viewCount: 0,
                            kanjiViewCounts: {}
                        }
                    },
                    settings: { 
                        showKanji: true,
                        minKanjiViews: 100,
                        voice: "ja-JP"
                    }
                }
            });
        });
    });
}); 