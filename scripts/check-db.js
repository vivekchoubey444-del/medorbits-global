#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- Database Health Checker
 * File: /scripts/check-db.js
 *
 * Purpose:
 *   - Verify PostgreSQL connectivity.
 *   - Check server version and connection latency.
 *   - Report database and schema information safely.
 *   - Optionally verify required tables.
 *   - Support JSON output for CI/CD and monitoring.
 *
 * Requirements:
 *   - Node.js >= 20
 *   - npm package: pg
 *   - DATABASE_URL or standard PG* environment variables
 *
 * Usage:
 *   node scripts/check-db.js
 *   node scripts/check-db.js --json
 *   node scripts/check-db.js --strict
 *   node scripts/check-db.js --schema=public
 *   node scripts/check-db.js --require-tables=users,properties
 *
 * Safety:
 *   - Read-only database checks.
 *   - Never prints DATABASE_URL, passwords, or connection strings.
 *   - Does not create, update, or delete database records.
 */
const { performance } = require('node:perf_hooks');
const process = require('node:process');
const EXIT = Object.freeze({
  OK: 0,
  HEALTH_FAILURE: 1,
  CONFIGURATION_ERROR: 2,
  INTERRUPTED: 130,
});
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_SCHEMA = 'public';
function parseArgs(argv) {
  const options = {
    json: false,
    strict: false,
    help: false,
    schema: DEFAULT_SCHEMA,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    requiredTables: [],
  };
  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--schema=')) {
      options.schema = arg.slice('--schema='.length);
    } else if (arg.startsWith('--timeout=')) {
      const value = Number(arg.slice('--timeout='.length));
      if (
        !Number.isInteger(value) ||
        value < 1_000 ||
        value > MAX_TIMEOUT_MS
      ) {
        throw new Error(
          `--timeout must be an integer between 1000 and ${MAX_TIMEOUT_MS}.`,
        );
      }
      options.timeoutMs = value;
    } else if (arg.startsWith('--require-tables=')) {
      const value = arg.slice('--require-tables='.length);
      options.requiredTables = value
        .split(',')
        .map((table) => table.trim())
        .filter(Boolean);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.schema)) {
    throw new Error(
      'Schema must contain only letters, numbers, and underscores, and must not start with a number.',
    );
  }
  for (const table of options.requiredTables) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      throw new Error(`Invalid required table name: ${table}`);
    }
  }
  options.requiredTables = [...new Set(options.requiredTables)];
  return options;
}
function printHelp() {
  console.log(`
MedOrbits PostgreSQL Health Checker
Usage:
  node scripts/check-db.js [options]
Options:
  --json                       Print machine-readable JSON
  --strict                     Fail if DATABASE_URL is missing
  --schema=public              Schema to inspect (default: public)
  --require-tables=a,b         Require comma-separated tables
  --timeout=10000              Query timeout in milliseconds
  --help, -h                   Show this help
Environment:
  DATABASE_URL                 PostgreSQL connection URL
  PGHOST, PGPORT, PGDATABASE   Standard PostgreSQL connection settings
  PGUSER, PGPASSWORD           Standard PostgreSQL credentials
  PGSSLMODE                    SSL mode where supported by the driver setup
Exit codes:
  0  Database checks passed
  1  Database health check failed
  2  Configuration or dependency error
  130 Interrupted
`);
}
function hasDatabaseConfiguration() {
  return Boolean(
    process.env.DATABASE_URL ||
      (
        process.env.PGHOST &&
        process.env.PGDATABASE &&
        process.env.PGUSER
      ),
  );
}
function safeError(error) {
  const code =
    typeof error?.code === 'string' &&
    /^[A-Z0-9_]+$/.test(error.code)
      ? error.code
      : undefined;
  const message =
    typeof error?.message === 'string'
      ? error.message
          .replace(
            /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
            '[REDACTED_CONNECTION_URL]',
          )
          .replace(
            /\b(password|passwd|pwd)\s*[:=]\s*[^,\s;]+/gi,
            '$1=[REDACTED]',
          )
          .slice(0, 500)
      : 'Unknown database error';
  return {
    ...(code ? { code } : {}),
    message,
  };
}
function makeResult() {
  return {
    application: 'MedOrbits',
    check: 'database-health',
    timestamp: new Date().toISOString(),
    status: 'failed',
    durationMs: 0,
    checks: [],
    errors: [],
  };
}
function addCheck(result, name, status, details = {}) {
  result.checks.push({
    name,
    status,
    ...details,
  });
  if (status === 'failed') {
    result.status = 'failed';
  }
}
async function run() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Configuration error: ${error.message}`);
    process.exitCode = EXIT.CONFIGURATION_ERROR;
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }
  if (!hasDatabaseConfiguration()) {
    const message =
      'Database configuration is missing. Set DATABASE_URL or PGHOST, PGDATABASE, and PGUSER.';
    if (options.strict) {
      console.error(message);
      process.exitCode = EXIT.CONFIGURATION_ERROR;
      return;
    }
    const result = makeResult();
    result.status = 'skipped';
    result.errors.push({
      message,
      hint: 'Use --strict to treat missing configuration as a failure.',
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('[SKIP] PostgreSQL health check');
      console.log(message);
    }
    return;
  }
  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch {
    console.error(
      'Missing dependency: install the pg package before running this script.',
    );
    process.exitCode = EXIT.CONFIGURATION_ERROR;
    return;
  }
  const result = makeResult();
  const startedAt = performance.now();
  let pool;
  try {
    const poolOptions = {
      max: 1,
      connectionTimeoutMillis: options.timeoutMs,
      idleTimeoutMillis: 1_000,
      allowExitOnIdle: true,
      application_name: 'medorbits-db-health-check',
    };
    if (process.env.DATABASE_URL) {
      poolOptions.connectionString = process.env.DATABASE_URL;
    }
    /*
     * Do not enable TLS by blindly setting rejectUnauthorized=false.
     * Configure certificate validation through your deployment's
     * PostgreSQL/Node TLS settings when the provider requires SSL.
     */
    pool = new Pool(poolOptions);
    const connectionStartedAt = performance.now();
    const client = await pool.connect();
    try {
      const connectionLatencyMs = Math.round(
        performance.now() - connectionStartedAt,
      );
      addCheck(result, 'connection', 'passed', {
        latencyMs: connectionLatencyMs,
      });
      const queryStartedAt = performance.now();
      const healthQuery = await client.query({
        text: `
          SELECT
            current_database() AS database_name,
            current_user AS database_user,
            current_schema() AS current_schema,
            current_setting('server_version') AS server_version,
            current_setting('transaction_read_only') AS transaction_read_only,
            pg_is_in_recovery() AS is_replica
        `,
        query_timeout: options.timeoutMs,
      });
      const queryLatencyMs = Math.round(
        performance.now() - queryStartedAt,
      );
      const row = healthQuery.rows[0];
      addCheck(result, 'health-query', 'passed', {
        latencyMs: queryLatencyMs,
      });
      addCheck(result, 'server-version', 'passed', {
        version: row.server_version,
      });
      addCheck(result, 'database-identity', 'passed', {
        database: row.database_name,
        schema: row.current_schema,
      });
      addCheck(
        result,
        'read-write-mode',
        row.transaction_read_only === 'off' ? 'passed' : 'warning',
        {
          readOnly: row.transaction_read_only === 'on',
          isReplica: row.is_replica,
        },
      );
      /*
       * Check schema visibility without exposing table contents.
       * Parameterized values prevent SQL injection.
       */
      const tableQuery = await client.query({
        text: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = $1
            AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `,
        values: [options.schema],
        query_timeout: options.timeoutMs,
      });
      const existingTables = tableQuery.rows.map(
        (table) => table.table_name,
      );
      addCheck(result, 'schema-access', 'passed', {
        schema: options.schema,
        visibleBaseTableCount: existingTables.length,
      });
      if (options.requiredTables.length > 0) {
        const missingTables = options.requiredTables.filter(
          (table) => !existingTables.includes(table),
        );
        addCheck(
          result,
          'required-tables',
          missingTables.length === 0 ? 'passed' : 'failed',
          {
            schema: options.schema,
            requiredCount: options.requiredTables.length,
            missingTables,
          },
        );
      }
      if (
        options.strict &&
        row.transaction_read_only === 'on'
      ) {
        addCheck(result, 'strict-read-write-check', 'failed', {
          message:
            'The connected database is read-only. Strict mode requires a writable primary.',
        });
      }
      if (result.status !== 'failed') {
        result.status = 'passed';
      }
    } finally {
      client.release();
    }
  } catch (error) {
    result.status = 'failed';
    result.errors.push({
      stage: 'database-check',
      ...safeError(error),
    });
    if (result.checks.length === 0) {
      addCheck(result, 'connection', 'failed');
    }
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (error) {
        result.status = 'failed';
        result.errors.push({
          stage: 'pool-shutdown',
          ...safeError(error),
        });
      }
    }
    result.durationMs = Math.round(performance.now() - startedAt);
  }
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const label =
      result.status === 'passed'
        ? 'PASS'
        : result.status === 'failed'
          ? 'FAIL'
          : 'SKIP';
    console.log(`\nMedOrbits Database Health: ${label}`);
    console.log(`Timestamp: ${result.timestamp}`);
    console.log(`Duration: ${result.durationMs} ms`);
    for (const check of result.checks) {
      const checkLabel = check.status.toUpperCase();
      console.log(`[${checkLabel}] ${check.name}`);
      if (check.latencyMs !== undefined) {
        console.log(`  Latency: ${check.latencyMs} ms`);
      }
      if (check.version) {
        console.log(`  PostgreSQL: ${check.version}`);
      }
      if (check.database) {
        console.log(`  Database: ${check.database}`);
      }
      if (check.schema) {
        console.log(`  Schema: ${check.schema}`);
      }
      if (check.missingTables?.length) {
        console.log(
          `  Missing tables: ${check.missingTables.join(', ')}`,
        );
      }
      if (check.message) {
        console.log(`  ${check.message}`);
      }
    }
    for (const error of result.errors) {
      console.error(
        `[ERROR] ${error.stage || 'configuration'}: ${error.message}`,
      );
      if (error.code) {
        console.error(`  Code: ${error.code}`);
      }
    }
  }
  process.exitCode =
    result.status === 'passed'
      ? EXIT.OK
      : EXIT.HEALTH_FAILURE;
}
process.on('SIGINT', () => {
  process.exit(EXIT.INTERRUPTED);
});
run().catch((error) => {
  console.error(`Unexpected health-check error: ${safeError(error).message}`);
  process.exitCode = EXIT.HEALTH_FAILURE;
});