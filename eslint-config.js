'use strict';
const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');
module.exports = [
  // Files and directories excluded from linting.
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'assets/**',
      'vendor/**',
    ],
  },
  // Recommended ESLint rules.
  js.configs.recommended,
  // CommonJS JavaScript configuration.
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-control-regex': 'off',
      'no-console': 'off',
    },
  },
  // Jest globals for test files.
  {
    files: [
      '**/*.test.js',
      '**/*.spec.js',
      'tests/**/*.js',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
  // Disable rules that conflict with Prettier.
  prettier,
];