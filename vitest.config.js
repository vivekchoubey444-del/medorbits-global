// vitest.config.js
// MedOrbits -- Vitest Configuration
// Version: 2.0.0
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const rootDir = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: rootDir,
  test: {
    // Test environment
    environment: 'node',
    globals: false,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Test discovery
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.agent-backup/**',
      '**/coverage/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.wrangler/**',
      '**/vendor/**'
    ],
    // Deterministic test execution
    testTimeout: 10000,
    hookTimeout: 10000,
    sequence: {
      concurrent: false
    },
    // Avoid concurrent execution of test files by default.
    fileParallelism: false,
    // Coverage
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'api/**/*.js',
        'controllers/**/*.js',
        'services/**/*.js',
        'middleware/**/*.js',
        'models/**/*.js',
        'routes/**/*.js',
        'utils/**/*.js',
        'src/**/*.{js,ts}'
      ],
      exclude: [
        '**/*.test.js',
        '**/*.spec.js',
        '**/tests/**',
        '**/test/**',
        '**/node_modules/**',
        '**/coverage/**',
        '**/dist/**',
        '**/build/**',
        '**/*.config.js'
      ],
      thresholds: {
        // Enable thresholds after measuring the existing baseline.
        // Set realistic targets before enforcing them in CI.
      }
    },
    // Environment variables for tests only.
    env: {
      NODE_ENV: 'test'
    },
    // Avoid loading a real application .env file by default.
    // Tests should explicitly configure any required test credentials.
    envFiles: [],
    // Test output
    reporters: ['default'],
    // Prevent accidental creation of snapshot files in unrelated locations.
    snapshotFormat: {
      printBasicPrototype: false
    }
  },
  resolve: {
    alias: {
      '@': rootDir,
      '@api': `${rootDir}api`,
      '@tests': `${rootDir}tests`
    }
  }
});