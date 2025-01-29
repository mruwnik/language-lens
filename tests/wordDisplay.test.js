import { getDisplayText, formatTooltip } from '../src/lib/wordDisplay';

describe('getDisplayText', () => {
    test('returns native text when useKanji is true', () => {
        const wordData = {
            native: '漢字',
            ruby: 'かんじ',
            useKanji: true
        };
        expect(getDisplayText(wordData)).toBe('漢字');
    });

    test('returns ruby when no kanji should be shown', () => {
        const wordData = {
            native: '漢字',
            ruby: 'かんじ',
            useKanji: false
        };
        expect(getDisplayText(wordData)).toBe('<ruby>漢字<rt>かんじ</rt></ruby>');
    });

    test('returns native text when no ruby exists', () => {
        const wordData = {
            native: '漢字',
            useKanji: false
        };
        expect(getDisplayText(wordData)).toBe('漢字');
    });

    test('returns ruby text when kanji display is disabled globally and useKanji is false', () => {
        const wordData = {
            native: '漢字',
            ruby: 'かんじ',
            useKanji: false
        };
        const settings = {
            showKanji: false
        };
        expect(getDisplayText(wordData, settings)).toBe('かんじ');
    });
});

describe('formatTooltip', () => {
    test('returns kanji frequency for Japanese words', () => {
        const wordData = {
            native: '漢字',
            useKanji: true,
            kanjiViewCounts: {
                '漢': 5,
                '字': 3
            }
        };
        const expected = '漢: seen 5 times\n字: seen 3 times';
        expect(formatTooltip(wordData, 'ja')).toBe(expected);
    });

    test('returns native text for non-Japanese words', () => {
        const wordData = {
            native: 'hola'
        };
        expect(formatTooltip(wordData, 'es')).toBe('hola');
    });
}); 