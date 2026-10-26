/**

* MedOrbits Local Agent
* File: eslint.config.js
* ESLint 9+ flat configuration.
* Coverage:
* ●	Node.js backend and API
* ●	ES modules and CommonJS
* ●	Browser-side application
* ●	Agent, planner, provider and service modules
* ●	Safety and path-guard utilities
* ●	Scripts, tests and configuration files
* ●	Code quality, correctness and security-oriented rules
* Requirements:
* npm install –save-dev eslint globals
    */

import globals from "globals";

const commonRules = {
// Variable and parameter hygiene.
"no-unused-vars": [
"warn",
{
args: "after-used",
argsIgnorePattern: "^",
varsIgnorePattern: "^",
caughtErrors: "all",
caughtErrorsIgnorePattern: "^",
destructuredArrayIgnorePattern: "^",
ignoreRestSiblings: true,
},
],

// Correctness.
"no-undef": "error",
"no-unreachable": "error",
"no-constant-condition": ["error", { checkLoops: false }],
"no-dupe-keys": "error",
"no-duplicate-imports": "error",
"no-func-assign": "error",
"no-import-assign": "error",
"no-irregular-whitespace": "error",
"no-obj-calls": "error",
"no-promise-executor-return": "error",
"no-self-assign": "error",
"no-self-compare": "error",
"no-sparse-arrays": "error",
"no-template-curly-in-string": "error",
"no-unexpected-multiline": "error",
"no-unmodified-loop-condition": "error",
"valid-typeof": "error",
"use-isnan": "error",

// Safer control flow.
"no-empty": ["error", { allowEmptyCatch: false }],
"no-fallthrough": "error",
"no-implicit-coercion": "warn",
"no-lone-blocks": "error",
"no-loop-func": "error",
"no-return-await": "error",
"no-sequences": "error",
"no-throw-literal": "error",
"no-unneeded-ternary": "error",
"require-atomic-updates": "error",

// Security-oriented JavaScript rules.
"no-eval": "error",
"no-implied-eval": "error",
"no-new-func": "error",
"no-script-url": "error",

// Modern JavaScript and maintainability.
"constructor-super": "error",
"curly": ["error", "all"],
"default-case": "warn",
"default-case-last": "error",
"eqeqeq": ["error", "always"],
"no-alert": "warn",
"no-caller": "error",
"no-console": "warn",
"no-debugger": "warn",
"no-else-return": "warn",
"no-extend-native": "error",
"no-extra-bind": "error",
"no-extra-boolean-cast": "error",
"no-global-assign": "error",
"no-invalid-regexp": "error",
"no-new": "warn",
"no-new-wrappers": "error",
"no-proto": "error",
"no-redeclare": "error",
"no-restricted-globals": [
"error",
{
name: "event",
message: "Use an explicitly named event parameter.",
},
{
name: "fdescribe",
message: "Do not commit focused test suites.",
},
{
name: "fit",
message: "Do not commit focused tests.",
},
],
"no-return-assign": ["error", "always"],
"no-shadow": "warn",
"no-undef-init": "error",
"no-undefined": "off",
"no-use-before-define": [
"error",
{
functions: false,
classes: true,
variables: true,
},
],
"object-shorthand": ["error", "always"],
"one-var": ["error", "never"],
"operator-assignment": ["error", "always"],
"prefer-const": "error",
"prefer-exponentiation-operator": "error",
"prefer-numeric-literals": "error",
"prefer-object-has-own": "error",
"prefer-promise-reject-errors": "error",
"prefer-regex-literals": ["error", { disallowRedundantWrapping: true }],
"prefer-rest-params": "error",
"prefer-spread": "error",
"prefer-template": "warn",
"radix": ["error", "always"],
"require-yield": "error",
"yoda": "error",

// Imports and modules.
"no-duplicate-case": "error",
"no-useless-rename": "error",
"symbol-description": "error",

// Optional cleanup.
"no-useless-call": "error",
"no-useless-computed-key": "error",
"no-useless-concat": "warn",
"no-useless-constructor": "error",
"no-useless-escape": "error",
"no-useless-rename": "error",
"no-useless-return": "warn",
};

const nodeGlobals = {
…globals.node,
};

const browserGlobals = {
…globals.browser,
};

const testGlobals = {
…globals.node,
…globals.mocha,
…globals.jest,
…globals.vitest,
};

const testFiles = [
"/*.test.js",
"/.spec.js",
"**/.test.mjs",
"/*.spec.mjs",
"/.test.cjs",
"**/.spec.cjs",
"test//*.js",
"tests//.js",
"tests/**/.js",
];

export default [
// Globally excluded generated and dependency directories.
{
ignores: [
"/node_modules/",
"/coverage/",
"/dist/",
"/build/",
"/vendor/",
"/*.min.js",
"/playwright-report/",
"/test-results/",
"/.cache/",
"/.next/",
"/.nuxt/",
"/storage/",
"/uploads/",
"/reports/",
"/tmp/",
"/temp/",
"/.git/",
"/.idea/",
"/.vscode/",
"/artifacts/",
"/backups/**",
],
},

// Shared rules for JavaScript files.
{
files: ["/*.js", "/.mjs", "**/.cjs"],
languageOptions: {
ecmaVersion: "latest",
sourceType: "module",
},
linterOptions: {
reportUnusedDisableDirectives: "warn",
reportUnusedInlineConfigs: "warn",
},
rules: commonRules,
},

// Browser interface and frontend modules.
{
files: [
"public//*.js",
"public//.mjs",
"client/**/.js",
"client//*.mjs",
"frontend//.js",
"frontend/**/.mjs",
],
languageOptions: {
sourceType: "module",
globals: browserGlobals,
},
rules: {
"no-console": "off",
"no-alert": "warn",
},
},

// Node.js backend, services, agent and safety modules.
{
files: [
"server.js",
"src//*.js",
"scripts//.js",
"config/**/.js",
],
languageOptions: {
sourceType: "module",
globals: nodeGlobals,
},
rules: {
"no-console": "off",
"no-alert": "error",
},
},

// Node.js command-line scripts.
{
files: [
"scripts//*.js",
"src/commands//*.js",
],
languageOptions: {
globals: nodeGlobals,
},
rules: {
"no-console": "off",
},
},

// CommonJS files.
{
files: ["**/*.cjs"],
languageOptions: {
sourceType: "commonjs",
globals: nodeGlobals,
},
},

// Explicit ES modules.
{
files: ["**/*.mjs"],
languageOptions: {
sourceType: "module",
globals: nodeGlobals,
},
},

// Test files.
{
files: testFiles,
languageOptions: {
globals: testGlobals,
},
rules: {
"no-unused-expressions": "off",
"no-console": "off",
"no-alert": "off",
"no-debugger": "error",
},
},

// Keep test-only globals out of production source.
{
files: [
"src//*.js",
"server.js",
"public//*.js",
],
rules: {
"no-restricted-globals": [
"error",
{
name: "event",
message: "Use an explicitly named event parameter.",
},
],
},
},
];