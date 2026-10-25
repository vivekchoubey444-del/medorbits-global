
/**
 * MedOrbits -- Vitest Configuration
 * File: vitest.config.js
 *
 * Purpose:
 * - Configure Vitest for MedOrbits server-side tests.
 * - Support Node.js API routes, Express services, and middleware.
 * - Support JavaScript, TypeScript, JSX, and TSX test files.
 * - Generate V8 coverage reports.
 * - Enforce coverage thresholds when coverage is enabled.
 * - Exclude generated output, dependencies, and test artifacts.
 * - Provide deterministic execution suitable for local development and CI.
 *
 * Requirements:
 * - Node.js >= 20
 * - Vitest
 * - @vitest/coverage-v8 (matching the installed Vitest version)
 *
 * Commands:
 *   npx vitest run
 *   npx vitest
 *   npx vitest run --coverage
 *   npx vitest run --reporter=verbose
 */

import { defineConfig } from "vitest/config";

const isCI = process.env.CI === "true";
const isCoverageRun = process.env.VITEST_COVERAGE === "true";

const testTimeout = 15_000;
const hookTimeout = 15_000;

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
];

const testFileExclusions = [
  ...excludedDirectories,
  "**/*.d.ts",
  "**/*.config.{js,mjs,cjs,ts,mts,cts}",
  "**/vitest.setup.{js,mjs,ts,mts}",
];

export default defineConfig({
  /*
   * Root-level aliases and environment variables should be centralized
   * in their respective application configuration modules.
   */
  resolve: {
    conditions: ["node"],
  },

  test: {
    // Server-side API routes, Express services, and database adapters.
    environment: "node",

    // Explicitly discover supported test file extensions.
    include: [
      "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],

    exclude: testFileExclusions,

    // Prevent accidental test success when discovery finds no tests.
    passWithNoTests: false,

    // Test isolation and mock lifecycle.
    isolate: true,
    clearMocks: true,
    mockReset: false,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,

    // Timing controls.
    testTimeout,
    hookTimeout,
    teardownTimeout: 10_000,

    // Worker strategy.
    pool: "forks",
    fileParallelism: true,

    // Keep worker count conservative in constrained CI environments.
    maxWorkers: isCI ? 2 : 4,

    // Avoid noisy output and expose failures clearly.
    reporters: ["default"],
    logHeapUsage: isCI,

    // Tests should use explicit imports from vitest.
    globals: false,

    // Do not retry flaky tests by default.
    retry: 0,

    // Prevent snapshots from being silently updated in CI.
    update: !isCI,

    /*
     * Optional setup file.
     *
     * Create tests/setup.js before enabling this setting.
     * Use it only for shared test setup, not production initialization.
     */
    // setupFiles: ["./tests/setup.js"],

    /*
     * Coverage uses the V8 provider.
     *
     * Install a compatible provider if needed:
     * npm install -D @vitest/coverage-v8
     */
    coverage: {
      enabled: isCoverageRun,
      provider: "v8",

      include: [
        "app/api/**/*.{js,mjs,ts,mts}",
        "src/**/*.{js,mjs,ts,mts}",
        "api/**/*.{js,mjs,ts,mts}",
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
        "**/index.{js,mjs,ts,mts}",
      ],

      reporter: [
        "text",
        "text-summary",
        "html",
        "lcov",
      ],

      reportsDirectory: "./coverage",
      clean: true,
      reportOnFailure: true,
      skipFull: false,

      /*
       * Thresholds apply when coverage collection runs.
       * Increase these values as measured coverage improves.
       */
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,

        // Keep coverage failures visible instead of silently ignoring them.
        perFile: false,
        autoUpdate: false,
      },
    },
  },
});
