
/**
 * MedOrbits Local Agent -- ESLint flat configuration
 * File: /local-agent/eslint.config.mjs
 * Version: 1.0.0
 *
 * Requires ESLint 9+.
 * Install ESLint and @eslint/js in the project that runs this configuration.
 */

import js from "@eslint/js";

const config = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.next/**",
      "**/.git/**",
      "**/.venv/**",
      "**/venv/**",
      "**/__pycache__/**",
      "**/.local-agent/**",
      "**/logs/**",
      "**/data/**",
      "**/*.min.js",
      "**/*.bundle.js",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        structuredClone: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-debugger": "error",
      "no-alert": "warn",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-extend-native": "error",
      "no-prototype-builtins": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "valid-typeof": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "curly": ["error", "all"],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "warn",
      "prefer-template": "warn",
      "no-unused-vars": [
        "error",
        {
          args: "none",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },

  {
    files: ["**/*.mjs", "**/*.config.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },

  {
    files: ["public/**/*.js", "src/**/*.browser.js"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        history: "readonly",
        HTMLElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        MutationObserver: "readonly",
        IntersectionObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
      },
    },
  },

  {
    files: ["**/*.test.js", "**/*.spec.js", "**/tests/**/*.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        before: "readonly",
        after: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
        vi: "readonly",
      },
    },
  },
];

export default config;
