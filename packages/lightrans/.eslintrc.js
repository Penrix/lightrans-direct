module.exports = {
    root: true,
    parser: "@babel/eslint-parser",
    parserOptions: {
        sourceType: "module",
        ecmaFeatures: {
            jsx: true,
        },
    },
    env: {
        node: true,
        browser: true,
        es6: true,
    },
    extends: ["eslint:recommended"],
    globals: {
        document: false,
        window: false,
        chrome: false,
        browser: false,
        BROWSER_ENV: false,
        BUILD_ENV: false,
    },
    plugins: ["html"],
    rules: {
        quotes: ["error", "double"],
        "no-multiple-empty-lines": [0, { max: 100 }],
    },
};
