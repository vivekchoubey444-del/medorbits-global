// ============================================================
// MedOrbits -- Commitlint Configuration
// File: commitlint.config.js
// Release target: 3.0.0
//
// Purpose:
//   Enforce consistent, readable, and machine-checkable Git commit
//   messages using Conventional Commits.
//
// Requirements:
//   npm install --save-dev @commitlint/cli @commitlint/config-conventional
//
// Compatible with:
//   ES modules ("type": "module" in package.json)
// ============================================================

export default {
  extends: ["@commitlint/config-conventional"],

  /*
   * Conventional Commit format:
   *
   * type(scope): description
   *
   * Examples:
   * feat(admissions): add college eligibility filters
   * fix(api): handle missing database configuration
   * docs(repository): update release instructions
   * test(validation): cover malformed JSON files
   * refactor(tools): simplify repository scanning
   * chore(deps): update Express dependencies
   * ci(github): validate Python and Node.js checks
   */

  rules: {
    // Allowed commit types.
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
        "security"
      ]
    ],

    // Require a type and description.
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],

    // Keep subjects concise and imperative where practical.
    "subject-case": [0],
    "subject-full-stop": [2, "never"],
    "subject-min-length": [2, "always", 8],
    "subject-max-length": [2, "always", 100],

    // Keep commit headers readable.
    "header-max-length": [2, "always", 120],

    // Scopes should be lowercase.
    "scope-case": [2, "always", "lower-case"],
    "scope-empty": [0],
    "scope-min-length": [2, "always", 2],
    "scope-max-length": [2, "always", 30],

    // Allow breaking-change markers using ! and BREAKING CHANGE
    // footers according to Conventional Commits.
    "breaking-change-exclamation-mark": [2, "always"],
    "footer-leading-blank": [2, "always"],

    // Body and footer formatting.
    "body-leading-blank": [2, "always"],
    "body-max-line-length": [2, "always", 120],
    "footer-max-line-length": [2, "always", 120]
  },

  /*
   * Example valid commits:
   *
   * feat(careers): add internship search
   * fix(database): validate PostgreSQL connection settings
   * docs(api): document application endpoints
   * test(security): cover authorization failures
   * chore(repository): update validation scripts
   *
   * Breaking change:
   * feat(api)!: replace legacy application response format
   *
   * Or include a footer:
   *
   * feat(api): replace legacy application response format
   *
   * BREAKING CHANGE: clients must use the new response envelope.
   */
};