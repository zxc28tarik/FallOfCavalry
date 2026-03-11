import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Window / DOM
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        prompt: 'readonly',
        // Timers / Animation
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Network
        fetch: 'readonly',
        XMLHttpRequest: 'readonly',
        // Storage
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        // JS builtins
        console: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        Promise: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        String: 'readonly',
        Uint8Array: 'readonly',
        globalThis: 'readonly',
        structuredClone: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        Error: 'readonly',
        JSON: 'readonly',
        parseInt: 'readonly',
        parseFloat: 'readonly',
        isFinite: 'readonly',
        isNaN: 'readonly',
        Symbol: 'readonly',
        WeakMap: 'readonly',
        WeakSet: 'readonly',
        RegExp: 'readonly',
        Float32Array: 'readonly',
        Int32Array: 'readonly',
      },
    },
    rules: {
      // Hata önleme
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-duplicate-imports': 'warn',

      // Kalite
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-console': 'off',

      // Stil (Prettier ile çakışmayanlar)
      'no-trailing-spaces': 'off',
      'semi': 'off',
      'quotes': 'off',
    },
  },
  {
    // Test dosyaları için ek globals
    files: ['tests/**/*.js', 'tests/**/*.mjs', '**/*.test.js', '**/*.test.mjs'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        assert: 'readonly',
      },
    },
    languageOptions: {
      globals: {
        global: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    // Tools ve config dosyalarını yoksay
    ignores: [
      'dist/**',
      'node_modules/**',
      'tools/**',
      '.vite/**',
      'docs/**',
    ],
  },
];
