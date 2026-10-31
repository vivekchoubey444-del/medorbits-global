
/**
 * MedOrbits -- Vitest Configuration
 * File: /vitest.config.js
 * Policy version: 2.1.0
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

const excludedPaths = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.git/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.cache/**",
  "**/.turbo/**",
  "**/storage/**",
  "**/vendor/**",
  "**/generated/**",
  "**/*.d.ts",
];

const testPatterns = [
  "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
  "api/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
  "scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
  "tools/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
];

const coveragePatterns = [
  "api/**/*.{js,mjs,cjs,ts,mts,cts}",
  "scripts/**/*.{js,mjs,cjs,ts,mts,cts}",
  "tools/**/*.{js,mjs,cjs,ts,mts,cts}",
];

export default defineConfig({
  root: rootDir,

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

    environment: "node",
    globals: false,

    include: testPatterns,
    exclude: excludedPaths,

    // Test isolation and mock lifecycle.
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    // Async operations and timeouts.
    testTimeout: 10_000,
    hookTimeout: 10_000,
    teardownTimeout: 10_000,

    // Parallel execution.
    fileParallelism: true,
    maxWorkers: "50%",

    // Predictable test environment.
    env: {
      NODE_ENV: "test",
    },

    // Do not automatically retry flaky tests.
    retry: 0,

    // Default test reporting.
    reporters: ["default"],

    // Coverage is enabled explicitly with --coverage.
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
        "**/fixtures/**",
        "**/*.d.ts",
      ],

      // Introduce thresholds after establishing a measured baseline.
      thresholds: undefined,

      // Do not require untested files to be included by default.
      all: false,
    },
  },
});
