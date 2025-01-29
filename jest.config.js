module.exports = {
    testEnvironment: 'jsdom',
    moduleNameMapper: {
        '^@lib/(.*)$': '<rootDir>/src/lib/$1',
        '^@popup/(.*)$': '<rootDir>/src/popup/$1',
        '^@background/(.*)$': '<rootDir>/src/background/$1',
        '^@content/(.*)$': '<rootDir>/src/content/$1'
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    transform: {
        '^.+\\.js$': ['babel-jest', { configFile: './.babelrc' }]
    },
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/lib/defaultDictionaries.js'
    ],
    verbose: true,
    testTimeout: 10000,
    moduleFileExtensions: ['js', 'json', 'node'],
    transformIgnorePatterns: [
        'node_modules/(?!(@testing-library|@babel|regenerator-runtime)/)'
    ]
}; 