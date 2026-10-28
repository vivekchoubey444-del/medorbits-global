#!/usr/bin/env node
'use strict';

/**
 * MedOrbits -- Database Seed Runner
 *
 * Purpose:
 *   Safely prepare approved development, test, or staging seed operations.
 *
 * Safety:
 *   - Seeding is disabled unless ALLOW_SEEDING=true.
 *   - Production seeding is always blocked.
 *   - Unknown environments are rejected.
 *   - Conflicting or incomplete database configuration is rejected.
 *   - No database writes occur until the approved runner is implemented.
 *
 * Status:
 *   Safety scaffold only. Not an operational seed implementation.
 */

const process = require('node:process');

const ALLOWED_ENVIRONMENTS = new Set([
  'development',
  'test',
  'staging',
]);

const ENABLE_FLAG = 'ALLOW_SEEDING';

const DATABASE_URL_VARIABLE = 'DATABASE_URL';

const MYSQL_VARIABLES = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];

class SeedRunnerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SeedRunnerError';
  }
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateEnvironment() {
  const environment = process.env.NODE_ENV?.trim();

  if (!environment) {
    throw new SeedRunnerError(
      'NODE_ENV is missing. Set it explicitly before running the seed command.'
    );
  }

  if (environment.toLowerCase() === 'production') {
    throw new SeedRunnerError(
      'Production seeding is blocked. Use an approved, separately reviewed production data procedure.'
    );
  }

  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new SeedRunnerError(
      `Unsupported NODE_ENV="${environment}". Allowed environments: ${[
        ...ALLOWED_ENVIRONMENTS,
      ].join(', ')}.`
    );
  }

  return environment;
}

function validatePermission() {
  if (process.env[ENABLE_FLAG] !== 'true') {
    throw new SeedRunnerError(
      `Seeding is disabled. Set ${ENABLE_FLAG}=true only when intentionally preparing approved seed operations.`
    );
  }
}

function validateDatabaseConfiguration() {
  const hasDatabaseUrl = hasValue(
    process.env[DATABASE_URL_VARIABLE]
  );

  const configuredMysqlVariables = MYSQL_VARIABLES.filter(
    (name) => hasValue(process.env[name])
  );

  const hasAnyMysqlVariable = configuredMysqlVariables.length > 0;

  const hasAllMysqlVariables =
    configuredMysqlVariables.length === MYSQL_VARIABLES.length;

  if (hasDatabaseUrl && hasAnyMysqlVariable) {
    throw new SeedRunnerError(
      'Both DATABASE_URL and individual DB_* settings are configured. Resolve the database configuration conflict before proceeding.'
    );
  }

  if (hasAnyMysqlVariable && !hasAllMysqlVariables) {
    const missing = MYSQL_VARIABLES.filter(
      (name) => !hasValue(process.env[name])
    );

    throw new SeedRunnerError(
      `Incomplete database configuration. Missing: ${missing.join(', ')}.`
    );
  }

  if (!hasDatabaseUrl && !hasAllMysqlVariables) {
    throw new SeedRunnerError(
      'Database configuration is missing. Configure DATABASE_URL or all required DB_* variables for the project adapter.'
    );
  }
}

function validateProductionGuards() {
  // This scaffold deliberately has no production override.
  if (process.env.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new SeedRunnerError(
      'Production seeding cannot be enabled through environment flags.'
    );
  }
}

async function runApprovedSeeds() {
  /**
   * TODO -- Implement only after reviewing the actual MedOrbits
   * database adapter and approved seed data.
   *
   * Required before implementation:
   * 1. Import the real database adapter from its verified path.
   * 2. Use an explicit allowlist of reviewed seed files.
   * 3. Confirm the selected target is a non-production database.
   * 4. Use transactions where supported.
   * 5. Make operations idempotent where practical.
   * 6. Never load real user data or production records.
   * 7. Record a concise result without exposing sensitive information.
   * 8. Close database connections in a finally block.
   * 9. Test duplicate execution and partial failures.
   *
   * Never dynamically execute arbitrary files from a directory.
   */

  throw new SeedRunnerError(
    'Seed runner is not configured. Connect the approved seed files and verified project database adapter before use. No seed data was written.'
  );
}

async function main() {
  // Validate the target environment before any future database work.
  const environment = validateEnvironment();

  validateProductionGuards();
  validatePermission();
  validateDatabaseConfiguration();

  console.log('[MedOrbits Seed] Safety checks passed.');
  console.log(`[MedOrbits Seed] Environment: ${environment}`);
  console.log('[MedOrbits Seed] Database writes are not enabled by this scaffold.');

  await runApprovedSeeds();
}

main().catch((error) => {
  const message =
    error instanceof SeedRunnerError
      ? error.message
      : 'An unexpected error stopped the seed operation.';

  console.error(`[MedOrbits Seed] STOPPED: ${message}`);

  if (!(error instanceof SeedRunnerError)) {
    console.error(
      '[MedOrbits Seed] Review server-side logs securely for diagnostic details.'
    );
  }

  process.exitCode = 1;
});
