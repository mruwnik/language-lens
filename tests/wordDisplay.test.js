import { getDisplayText, formatTooltip } from '../src/lib/wordDisplay.js';

describe('getDisplayText', () => {
    test.each([
        [
            { native: '漢字', ruby: 'かんじ', useKanji: true },
            undefined,
            '漢字'
        ],
        [
            { native: '漢字', ruby: 'かんじ', useKanji: false },
            undefined,
            '<ruby>漢字<rt>かんじ</rt></ruby>'
        ],
        [
            { native: '漢字', useKanji: false },
            undefined,
            '漢字'
        ],
        [
            { native: '漢字', ruby: 'かんじ', useKanji: false },
            { showKanji: false },
            'かんじ'
        ],
        [
            { native: 'hello', ruby: undefined, useKanji: false },
            undefined,
            'hello'
        ]
    ])('getDisplayText(%p, %p) => %p', (wordData, settings, expected) =>
        expect(getDisplayText(wordData, settings)).toBe(expected));
});

describe('formatTooltip', () => {
    test.each([
        [
            { 
                native: '漢字',
                useKanji: true,
                kanjiViewCounts: { '漢': 5, '字': 3 }
            },
            'ja',
            '漢: seen 5 times\n字: seen 3 times'
        ],
        [
            { native: 'hola' },
            'es',
            'hola'
        ],
        [
            { 
                native: '漢字',
                useKanji: true,
                kanjiViewCounts: {}
            },
            'ja',
            '漢字'
        ]
    ])('formatTooltip(%p, %p) => %p', (wordData, lang, expected) =>
        expect(formatTooltip(wordData, lang)).toBe(expected));
}); 