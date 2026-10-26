'use strict';
/**
 * MedOrbits -- ESLint Flat Configuration
 * File: /eslint-config.js
 *
 * Purpose:
 *   Consistent linting for backend, frontend, scripts, and tests.
 *
 * Requirements:
 *   npm install --save-dev eslint @eslint/js globals eslint-config-prettier
 *
 * Notes:
 *   - This file uses CommonJS exports.
 *   - Keep configuration aligned with package.json "type".
 *   - Browser globals are limited to browser-targeted files.
 *   - Test globals are scoped to test files.
 *   - No files are modified or deleted by this configuration.
 */
const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');
/**
 * Shared paths excluded from linting.
 *
 * ESLint flat config ignores are intentionally centralized here.
 * Avoid excluding source directories merely to suppress errors.
 */
const ignoredFiles = {
  ignores: [
    '**/node_modules/**',
    '**/coverage/**',
    '**/dist/**',
    '**/build/**',
    '**/vendor/**',
    '**/.git/**',
    '**/.cache/**',
    '**/tmp/**',
    '**/temp/**',
    '**/storage/logs/**',
    '**/*.min.js',
  ],
};
/**
 * CommonJS configuration for server-side JavaScript.
 *
 * This includes the root server and Node.js scripts.
 */
const nodeCommonJS = {
  files: [
    '**/*.cjs',
    'server.js',
    'api/**/*.js',
    'controllers/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    'middlewares/**/*.js',
    'services/**/*.js',
    'config/**/*.js',
    'scripts/**/*.js',
    'tools/**/*.js',
    'workers/**/*.js',
    'jobs/**/*.js',
    'tests/**/*.js',
    '**/*.test.js',
    '**/*.spec.js',
  ],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs',
    globals: {
      ...globals.node,
    },
  },
  rules: {
    // Correctness
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': [
      'error',
      {
        checkLoops: false,
      },
    ],
    'valid-typeof': 'error',
    'use-isnan': 'error',
    'constructor-super': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-func-assign': 'error',
    'no-import-assign': 'error',
    'no-irregular-whitespace': 'error',
    'no-sparse-arrays': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    // Maintainability
    'eqeqeq': [
      'error',
      'always',
      {
        null: 'ignore',
      },
    ],
    'curly': [
      'error',
      'all',
    ],
    'default-case-last': 'error',
    'dot-notation': 'warn',
    'no-alert': 'warn',
    'no-caller': 'error',
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-octal': 'error',
    'no-proto': 'error',
    'no-return-await': 'error',
    'no-script-url': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'warn',
    'object-shorthand': 'warn',
    'yoda': 'error',
    // Avoid silently suppressing unused-variable warnings globally.
    'no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^_',
      },
    ],
    // Backend logging is permitted.
    'no-console': 'off',
    // Allow intentional low-level regular expressions.
    'no-control-regex': 'off',
  },
};
/**
 * ES module configuration.
 *
 * Add or remove directories to match the actual module format
 * used in this repository. These patterns should not overlap
 * with CommonJS files unintentionally.
 */
const nodeESModules = {
  files: [
    '**/*.mjs',
    'assets/js/modules/**/*.js',
    'src/**/*.js',
    'frontend/**/*.js',
  ],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.node,
    },
  },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^_',
      },
    ],
    'no-console': 'off',
    'no-control-regex': 'off',
  },
};
/**
 * Browser-specific JavaScript.
 *
 * Keep this limited to files that actually execute in a browser.
 * Do not apply browser globals to API or server modules.
 */
const browserJavaScript = {
  files: [
    'assets/js/**/*.js',
    'public/**/*.js',
  ],
  ignores: [
    'assets/js/modules/**/*.js',
    'assets/js/**/*.test.js',
    'assets/js/**/*.spec.js',
  ],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.browser,
    },
  },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^_',
      },
    ],
    // Browser code should not log sensitive user information.
    'no-console': 'warn',
    'no-alert': 'warn',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
  },
};
/**
 * Jest-specific globals.
 *
 * Test files retain Node.js globals while gaining Jest globals.
 */
const jestTests = {
  files: [
    '**/*.test.js',
    '**/*.spec.js',
    'tests/**/*.js',
    '__tests__/**/*.js',
  ],
  languageOptions: {
    globals: {
      ...globals.node,
      ...globals.jest,
    },
  },
  rules: {
    'no-unused-expressions': 'off',
    'no-console': 'off',
  },
};
/**
 * ESLint configuration export.
 *
 * Order matters:
 *   1. Ignore generated and dependency files.
 *   2. Apply recommended correctness rules.
 *   3. Configure runtime-specific environments.
 *   4. Apply test-specific settings.
 *   5. Disable formatting conflicts with Prettier.
 */
module.exports = [
  ignoredFiles,
  js.configs.recommended,
  nodeCommonJS,
  nodeESModules,
  browserJavaScript,
  jestTests,
  prettier,
];