
/**
 * MedOrbits -- Vitest Configuration
 * File: vitest.config.js
 *
 * Requirements:
 *   Node.js >= 20
 *   vitest
 *
 * Run:
 *   npx vitest run
 *   npx vitest
 *   npx vitest run --coverage
 */

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,

  test: {
    name: "medorbits",

    // Backend and repository utility tests.
    environment: "node",

    globals: false,

    include: [
      "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
      "api/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
      "scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
      "tools/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    ],

    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.git/**",
      "**/storage/**",
      "**/vendor/**",
      "**/*.d.ts",
    ],

    // Prevent accidental interference between tests.
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    // Avoid hiding useful failures behind excessive parallelism.
    fileParallelism: true,
    maxWorkers: "50%",
    testTimeout: 10_000,
    hookTimeout: 10_000,

    // Keep tests deterministic and avoid silently loading developer-specific
    // environment variables from an implicit setup file.
    env: {
      NODE_ENV: "test",
    },

    // Coverage is opt-in through --coverage.
    coverage: {
      provider: "v8",

      reportsDirectory: resolve(rootDir, "coverage"),

      reporter: [
        "text",
        "html",
        "lcov",
        "json-summary",
      ],

      include: [
        "api/**/*.{js,mjs,cjs,ts,mts,cts}",
        "scripts/**/*.{js,mjs,cjs,ts,mts,cts}",
        "tools/**/*.{js,mjs,cjs,ts,mts,cts}",
      ],

      exclude: [
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.config.*",
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/coverage/**",
        "**/vendor/**",
        "**/*.d.ts",
      ],

      // Start without imposing arbitrary thresholds on an unmeasured project.
      // Introduce thresholds after establishing a reliable baseline.
      thresholds: undefined,
    },

    reporters: ["default"],

    // Do not silently retry flaky tests.
    retry: 0,
  },

  resolve: {
    alias: {
      "@": resolve(rootDir, "api"),
      "@api": resolve(rootDir, "api"),
      "@scripts": resolve(rootDir, "scripts"),
      "@tools": resolve(rootDir, "tools"),
    },
  },
});
