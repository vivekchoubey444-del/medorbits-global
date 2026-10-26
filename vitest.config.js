
/**
 * MedOrbits -- Vitest Configuration
 * File: vitest.config.js
 *
 * Purpose:
 * - Configure deterministic Node.js tests for MedOrbits.
 * - Support JavaScript and TypeScript test files.
 * - Generate V8 coverage reports.
 * - Enforce explicit coverage thresholds.
 * - Exclude generated files and third-party dependencies.
 *
 * Requirements:
 * - Node.js >= 20.19.0
 * - Vitest
 * - @vitest/coverage-v8 matching the installed Vitest version
 *
 * Commands:
 *   npm exec vitest -- run
 *   npm exec vitest
 *   npm exec vitest -- run --coverage
 *   npm exec vitest -- run --reporter=verbose
 */

import { defineConfig } from "vitest/config";

const isCI = process.env.CI === "true";

const excludedDirectories = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/.output/**",
  "**/out/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.vercel/**",
  "**/.turbo/**",
  "**/.cache/**",
  "**/playwright-report/**",
  "**/test-results/**",
  "**/vendor/**",
  "**/tmp/**",
  "**/temp/**",
  "**/storage/uploads/**",
  "**/duplicate-quarantine/**",
  "**/tools/repository-reports/**"
];

const testFileExclusions = [
  ...excludedDirectories,
  "**/*.d.ts",
  "**/*.config.{js,mjs,cjs,ts,mts,cts}",
  "**/vitest.setup.{js,mjs,cjs,ts,mts,cts}"
];

export default defineConfig({
  test: {
    name: "medorbits",
    environment: "node",

    include: [
      "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"
    ],

    exclude: testFileExclusions,
    passWithNoTests: false,

    // Isolation and mock cleanup.
    isolate: true,
    clearMocks: true,
    mockReset: false,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,

    // Timeouts.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    teardownTimeout: 10_000,

    // Execution.
    pool: "forks",
    fileParallelism: true,
    maxWorkers: isCI ? 2 : 4,
    retry: 0,

    // Reproducible test behavior.
    globals: false,
    update: false,

    reporters: ["default"],
    logHeapUsage: isCI,

    // Add this only after creating the file:
    // setupFiles: ["./tests/setup.js"],

    coverage: {
      provider: "v8",
      enabled: false,

      include: [
        "app/api/**/*.{js,mjs,ts,mts}",
        "src/**/*.{js,mjs,ts,mts}",
        "api/**/*.{js,mjs,ts,mts}"
      ],

      exclude: [
        ...excludedDirectories,
        "**/*.d.ts",
        "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
        "**/test/**",
        "**/tests/**",
        "**/__tests__/**",
        "**/__mocks__/**",
        "**/fixtures/**",
        "**/migrations/**",
        "**/scripts/**",
        "**/*.config.{js,mjs,cjs,ts,mts,cts}",
        "**/index.{js,mjs,ts,mts}"
      ],

      reporter: [
        "text",
        "text-summary",
        "html",
        "lcov"
      ],

      reportsDirectory: "./coverage",
      clean: true,
      reportOnFailure: true,
      skipFull: false,

      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
        perFile: false,
        autoUpdate: false
      }
    }
  }
});
