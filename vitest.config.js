/**
 * MedOrbits -- Vitest Configuration
 * File: /vitest.config.js
 * Policy version: 2.0.0
 *
 * Requirements:
 *   Node.js >= 20
 *   vitest
 *   @vitest/coverage-v8 (for coverage reports)
 *
 * Commands:
 *   npx vitest run
 *   npx vitest
 *   npx vitest run --coverage
 *   npx vitest run --reporter=verbose
 *   npx vitest run tests/
 *
 * Design goals:
 *   - Deterministic Node.js testing
 *   - Explicit test discovery
 *   - Isolated mocks and predictable cleanup
 *   - Coverage for API and repository tooling
 *   - Stable CI execution
 *   - No implicit developer-specific setup files
 */

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

const sourceExtensions = "{js,mjs,cjs,ts,mts,cts}";

const excludedPaths = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.git/**",
  "**/.next/**",
  "**/.cache/**",
  "**/storage/**",
  "**/vendor/**",
  "**/fixtures/**",
  "**/*.d.ts",
];

const testPatterns = [
  `tests/**/*.{test,spec}.${sourceExtensions}`,
  `api/**/*.{test,spec}.${sourceExtensions}`,
  `scripts/**/*.{test,spec}.${sourceExtensions}`,
  `tools/**/*.{test,spec}.${sourceExtensions}`,
];

const coveragePatterns = [
  `api/**/*.${sourceExtensions}`,
  `scripts/**/*.${sourceExtensions}`,
  `tools/**/*.${sourceExtensions}`,
];

export default defineConfig({
  root: rootDir,

  // Keep aliases consistent between tests and application modules.
  resolve: {
    alias: {
      "@": resolve(rootDir, "api"),
      "@api": resolve(rootDir, "api"),
      "@scripts": resolve(rootDir, "scripts"),
      "@tools": resolve(rootDir, "tools"),
    },
  },

  test: {
    name: "medorbits",

    // Repository tools and backend modules run in Node.js.
    environment: "node",

    // Tests must import Vitest APIs explicitly.
    globals: false,

    include: testPatterns,
    exclude: excludedPaths,

    // Isolation and mock lifecycle.
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    // Async operations and timeouts.
    testTimeout: 10_000,
    hookTimeout: 10_000,
    teardownTimeout: 10_000,

    // Parallel execution. Set fileParallelism=false if tests share
    // mutable files, databases, ports, or other process-wide resources.
    fileParallelism: true,
    maxWorkers: "50%",

    // Stable default test environment.
    env: {
      NODE_ENV: "test",
    },

    // Do not automatically retry flaky tests.
    retry: 0,

    // Keep output concise while preserving failure details.
    reporters: ["default"],

    // Coverage is enabled explicitly with `--coverage`.
    coverage: {
      provider: "v8",
      enabled: false,

      reportsDirectory: resolve(rootDir, "coverage"),

      reporter: [
        "text",
        "html",
        "lcov",
        "json-summary",
      ],

      include: coveragePatterns,

      exclude: [
        ...excludedPaths,
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.config.*",
        "**/index.{js,mjs,cjs,ts,mts,cts}",
        "**/types/**",
        "**/*.d.ts",
      ],

      // Establish a trustworthy baseline before adding thresholds.
      // When ready, configure lines/functions/branches/statements thresholds.
      thresholds: undefined,

      // Fail coverage runs if a source file is not exercised only when
      // explicitly enabled after the project has a stable coverage baseline.
      all: false,
    },
  },
});