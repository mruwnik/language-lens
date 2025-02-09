// defaultDictionaries.js

export const japaneseDictionary = {
    words: {
        // Pronouns
        "I": { native: "私", ruby: "わたし" },
        "you": { native: "あなた" },
        "he": { native: "彼", ruby: "かれ" },
        "she": { native: "彼女", ruby: "かのじょ" },
        "we": { native: "私達", ruby: "わたしたち" },
        "they": { native: "彼ら", ruby: "かれら" },

        // Basic verbs
        "eat": { native: "食べる", ruby: "たべる" },
        "drink": { native: "飲む", ruby: "のむ" },
        "sleep": { native: "寝る", ruby: "ねる" },
        "go": { native: "行く", ruby: "いく" },
        "come": { native: "来る", ruby: "くる" },
        "speak": { native: "話す", ruby: "はなす" },
        "read": { native: "読む", ruby: "よむ" },
        "write": { native: "書く", ruby: "かく" },
        "see": { native: "見る", ruby: "みる" },
        "hear": { native: "聞く", ruby: "きく" },

        // Time-related
        "today": { native: "今日", ruby: "きょう" },
        "tomorrow": { native: "明日", ruby: "あした" },
        "yesterday": { native: "昨日", ruby: "きのう" },
        "now": { native: "今", ruby: "いま" },
        "morning": { native: "朝", ruby: "あさ" },
        "afternoon": { native: "午後", ruby: "ごご" },
        "evening": { native: "夜", ruby: "よる" },

        // Numbers
        "one": { native: "一", ruby: "いち" },
        "two": { native: "二", ruby: "に" },
        "three": { native: "三", ruby: "さん" },
        "four": { native: "四", ruby: "よん" },
        "five": { native: "五", ruby: "ご" },

        // Adjectives
        "good": { native: "良い", ruby: "よい" },
        "bad": { native: "悪い", ruby: "わるい" },
        "hot": { native: "暑い", ruby: "あつい" },
        "cold": { native: "寒い", ruby: "さむい" },
        "big": { native: "大きい", ruby: "おおきい" },
        "small": { native: "小さい", ruby: "ちいさい" },
        "new": { native: "新しい", ruby: "あたらしい" },
        "old": { native: "古い", ruby: "ふるい" },

        // Question words
        "what": { native: "何", ruby: "なに" },
        "when": { native: "いつ" },
        "where": { native: "どこ" },
        "who": { native: "誰", ruby: "だれ" },
        "why": { native: "なぜ" },
        "how": { native: "どう" },

        // Common nouns
        "person": { native: "人", ruby: "ひと" },
        "water": { native: "水", ruby: "みず" },
        "food": { native: "食べ物", ruby: "たべもの" },
        "house": { native: "家", ruby: "いえ" },
        "car": { native: "車", ruby: "くるま" },
        "book": { native: "本", ruby: "ほん" },
        "school": { native: "学校", ruby: "がっこう" },
        "work": { native: "仕事", ruby: "しごと" },
        "money": { native: "お金", ruby: "おかね" },
        "time": { native: "時間", ruby: "じかん" },

        // Basic expressions
        "hello": { native: "こんにちは" },
        "goodbye": { native: "さようなら" },
        "thank you": { native: "ありがとう" },
        "please": { native: "お願い", ruby: "おねがい" },
        "sorry": { native: "ごめんなさい" },
        "yes": { native: "はい" },
        "no": { native: "いいえ" }
    },
    settings: {
        voice: "ja-JP",
        minKanjiViews: 100
    }
};

export const chineseDictionary = {
    words: {
        // Pronouns
        "I": { native: "我" },
        "you": { native: "你" },
        "he": { native: "他" },
        "she": { native: "她" },
        "we": { native: "我们" },
        "they": { native: "他们" },

        // Basic verbs
        "eat": { native: "吃" },
        "drink": { native: "喝" },
        "sleep": { native: "睡觉" },
        "go": { native: "去" },
        "come": { native: "来" },
        "speak": { native: "说" },
        "read": { native: "读" },
        "write": { native: "写" },
        "see": { native: "看" },
        "hear": { native: "听" },

        // Time-related
        "today": { native: "今天" },
        "tomorrow": { native: "明天" },
        "yesterday": { native: "昨天" },
        "now": { native: "现在" },
        "morning": { native: "早上" },
        "afternoon": { native: "下午" },
        "evening": { native: "晚上" },

        // Numbers
        "one": { native: "一" },
        "two": { native: "二" },
        "three": { native: "三" },
        "four": { native: "四" },
        "five": { native: "五" },

        // Common words
        "hello": { native: "你好" },
        "goodbye": { native: "再见" },
        "thank you": { native: "谢谢" },
        "please": { native: "请" },
        "sorry": { native: "对不起" },
        "yes": { native: "是" },
        "no": { native: "不" }
    },
    settings: {
        voice: "zh-CN"  // BCP 47 language tag for speech synthesis
    }
};

export const koreanDictionary = {
    words: {
        // Pronouns
        "I": { native: "나" },
        "you": { native: "너" },
        "he": { native: "그" },
        "she": { native: "그녀" },
        "we": { native: "우리" },
        "they": { native: "그들" },

        // Basic verbs
        "eat": { native: "먹다" },
        "drink": { native: "마시다" },
        "sleep": { native: "자다" },
        "go": { native: "가다" },
        "come": { native: "오다" },
        "speak": { native: "말하다" },
        "read": { native: "읽다" },
        "write": { native: "쓰다" },
        "see": { native: "보다" },
        "hear": { native: "듣다" },

        // Common expressions
        "hello": { native: "안녕하세요" },
        "goodbye": { native: "안녕히 가세요" },
        "thank you": { native: "감사합니다" },
        "please": { native: "주세요" },
        "sorry": { native: "죄송합니다" },
        "yes": { native: "네" },
        "no": { native: "아니요" }
    },
    settings: {
        voice: "ko-KR"
    }
};

export const spanishDictionary = {
    words: {
        // Pronouns
        "I": { native: "yo" },
        "you": { native: "tú" },
        "he": { native: "él" },
        "she": { native: "ella" },
        "we": { native: "nosotros" },
        "they": { native: "ellos" },

        // Basic verbs (infinitive)
        "eat": { native: "comer" },
        "drink": { native: "beber" },
        "sleep": { native: "dormir" },
        "go": { native: "ir" },
        "come": { native: "venir" },
        "speak": { native: "hablar" },
        "read": { native: "leer" },
        "write": { native: "escribir" },
        "see": { native: "ver" },
        "hear": { native: "escuchar" }
    },
    settings: {
        voice: "es-ES"
    }
};

export const frenchDictionary = {
    words: {
        // Pronouns
        "I": { native: "je" },
        "you": { native: "tu" },
        "he": { native: "il" },
        "she": { native: "elle" },
        "we": { native: "nous" },
        "they": { native: "ils" },

        // Basic verbs (infinitive)
        "eat": { native: "manger" },
        "drink": { native: "boire" },
        "sleep": { native: "dormir" },
        "go": { native: "aller" },
        "come": { native: "venir" },
        "speak": { native: "parler" },
        "read": { native: "lire" },
        "write": { native: "écrire" },
        "see": { native: "voir" },
        "hear": { native: "entendre" }
    },
    settings: {
        voice: "fr-FR"
    }
};

export const germanDictionary = {
    words: {
        // Pronouns
        "I": { native: "ich" },
        "you": { native: "du" },
        "he": { native: "er" },
        "she": { native: "sie" },
        "we": { native: "wir" },
        "they": { native: "sie" },

        // Basic verbs (infinitive)
        "eat": { native: "essen" },
        "drink": { native: "trinken" },
        "sleep": { native: "schlafen" },
        "go": { native: "gehen" },
        "come": { native: "kommen" },
        "speak": { native: "sprechen" },
        "read": { native: "lesen" },
        "write": { native: "schreiben" },
        "see": { native: "sehen" },
        "hear": { native: "hören" }
    },
    settings: {
        voice: "de-DE"
    }
};

export const polishDictionary = {
    words: {
        // Pronouns
        "I": { native: "ja" },
        "you": { native: "ty" },
        "he": { native: "on" },
        "she": { native: "ona" },
        "we": { native: "my" },
        "they": { native: "oni" },

        // Basic verbs (infinitive)
        "eat": { native: "jeść" },
        "drink": { native: "pić" },
        "sleep": { native: "spać" },
        "go": { native: "iść" },
        "come": { native: "przyjść" },
        "speak": { native: "mówić" },
        "read": { native: "czytać" },
        "write": { native: "pisać" },
        "see": { native: "widzieć" },
        "hear": { native: "słyszeć" }
    },
    settings: {
        voice: "pl-PL"
    }
};

export const welshDictionary = {
    words: {
        // Pronouns
        "I": { native: "fi" },
        "you": { native: "ti" },
        "he": { native: "fo" },
        "she": { native: "hi" },
        "we": { native: "ni" },
        "they": { native: "nhw" },

        // Basic verbs (infinitive)
        "eat": { native: "bwyta" },
        "drink": { native: "yfed" },
        "sleep": { native: "cysgu" },
        "go": { native: "mynd" },
        "come": { native: "dod" },
        "speak": { native: "siarad" },
        "read": { native: "darllen" },
        "write": { native: "ysgrifennu" },
        "see": { native: "gweld" },
        "hear": { native: "clywed" }
    },
    settings: {
        voice: "cy"  // Using ISO 639-1 code instead of BCP 47
    }
};

export const latinDictionary = {
    words: {
        // Pronouns
        "I": { native: "ego" },
        "you": { native: "tu" },
        "he": { native: "is" },
        "she": { native: "ea" },
        "we": { native: "nos" },
        "they": { native: "ei" },

        // Basic verbs (infinitive)
        "eat": { native: "edere" },
        "drink": { native: "bibere" },
        "sleep": { native: "dormire" },
        "go": { native: "ire" },
        "come": { native: "venire" },
        "speak": { native: "loqui" },
        "read": { native: "legere" },
        "write": { native: "scribere" },
        "see": { native: "videre" },
        "hear": { native: "audire" },

        // Common nouns
        "man": { native: "vir" },
        "woman": { native: "femina" },
        "boy": { native: "puer" },
        "girl": { native: "puella" },
        "water": { native: "aqua" },
        "food": { native: "cibus" },
        "house": { native: "domus" },
        "book": { native: "liber" },
        "friend": { native: "amicus" },
        "enemy": { native: "hostis" },

        // Basic expressions
        "hello": { native: "salve" },
        "goodbye": { native: "vale" },
        "please": { native: "quaeso" },
        "thank you": { native: "gratias" },
        "yes": { native: "ita" },
        "no": { native: "non" }
    },
    settings: {
        voice: "la"  // ISO 639-1 code for Latin
    }
};

// Initialize Japanese dictionary with kanji counts
Object.values(japaneseDictionary.words).forEach(word => {
    word.viewCount = 0;
    word.kanjiViewCounts = {};
    if (word.native && word.useKanji) {
        [...word.native].forEach(char => {
            if (char.match(/[\u4e00-\u9faf]/)) {
                word.kanjiViewCounts[char] = 0;
            }
        });
    }
});

// Initialize view counts for all other dictionaries
[chineseDictionary, koreanDictionary, spanishDictionary, 
 frenchDictionary, germanDictionary, polishDictionary, 
 welshDictionary, latinDictionary].forEach(dict => {
    Object.values(dict.words).forEach(word => {
        word.viewCount = 0;
    });
}); 

export const defaultDictionaries = {
    ja: japaneseDictionary,
    zh: chineseDictionary,
    ko: koreanDictionary,
    es: spanishDictionary,
    fr: frenchDictionary,
    de: germanDictionary,
    pl: polishDictionary,
    cy: welshDictionary,
    la: latinDictionary
};