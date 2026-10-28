
/**
 * MedOrbits -- lint-staged configuration
 * --------------------------------------
 * Runs quality checks on staged files before Git commits.
 *
 * Requirements:
 *   npm install --save-dev lint-staged prettier
 *   npm install --save-dev eslint stylelint
 *
 * Compatible with modern lint-staged and ESM repositories.
 */

export default {
  // HTML documents
  "**/*.html": [
    "prettier --write",
  ],

  // CSS stylesheets
  "**/*.{css,scss}": [
    "prettier --write",
  ],

  // JavaScript and module files
  "**/*.{js,mjs,cjs,jsx}": [
    "prettier --write",
    "eslint --fix",
  ],

  // TypeScript files
  "**/*.{ts,mts,cts,tsx}": [
    "prettier --write",
    "eslint --fix",
  ],

  // JSON, JSON Schema, and JSON data files
  "**/*.json": [
    "prettier --write",
  ],

  // Markdown documentation
  "**/*.{md,mdx}": [
    "prettier --write",
  ],

  // YAML configuration and CI workflows
  "**/*.{yml,yaml}": [
    "prettier --write",
  ],

  // Python source files
  "**/*.py": [
    "python -m py_compile",
  ],

  // Shell scripts: syntax validation only
  "**/*.sh": [
    "bash -n",
  ],

  // SQL files: consistent formatting only
  "**/*.sql": [
    "prettier --write",
  ],
};
