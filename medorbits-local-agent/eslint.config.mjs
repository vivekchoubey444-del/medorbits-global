import globals from "globals";

const commonRules = {
"no-unused-vars": [
"warn",
{
argsIgnorePattern: "^",
varsIgnorePattern: "^",
caughtErrorsIgnorePattern: "^_",
},
],
"no-undef": "error",
"no-unreachable": "error",
"no-constant-condition": "error",
"no-dupe-keys": "error",
"no-duplicate-imports": "error",
"no-empty": ["error", { allowEmptyCatch: false }],
"no-eval": "error",
"no-implied-eval": "error",
"no-new-func": "error",
"no-debugger": "warn",
"eqeqeq": ["error", "always"],
"curly": ["error", "all"],
"prefer-const": "error",
"no-var": "error",
"object-shorthand": ["error", "always"],
"prefer-template": "warn",
};

export default [
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
"/storage/",
"/uploads/**",
],
},

// Shared JavaScript quality and correctness rules.
{
files: ["/*.js", "/.mjs", "**/.cjs"],
languageOptions: {
ecmaVersion: "latest",
sourceType: "module",
},
rules: commonRules,
},

// Browser-side agent interface.
{
files: ["public/**/*.js"],
languageOptions: {
sourceType: "module",
globals: {
…globals.browser,
},
},
rules: {
"no-console": "off",
},
},

// Node.js backend and CommonJS-compatible server files.
{
files: ["server.js", "src//*.js", "scripts//*.js"],
languageOptions: {
sourceType: "commonjs",
globals: {
…globals.node,
},
},
rules: {
"no-console": "off",
},
},

// Explicit CommonJS files.
{
files: ["**/*.cjs"],
languageOptions: {
sourceType: "commonjs",
globals: {
…globals.node,
},
},
},

// ES module server files.
{
files: ["**/*.mjs"],
languageOptions: {
sourceType: "module",
globals: {
…globals.node,
},
},
},

// Test files. Add the relevant test framework globals if used.
{
files: [
"/*.test.js",
"/.spec.js",
"**/.test.mjs",
"/*.spec.mjs",
"test//.js",
"tests/**/.js",
],
languageOptions: {
globals: {
…globals.node,
},
},
rules: {
"no-unused-expressions": "off",
},
},
];