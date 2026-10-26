
#!/usr/bin/env node
'use strict';

require('dotenv').config();

const mysql = require('mysql2/promise');

const TIMEOUT_MS = 8000;
const REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_NAME'];

function getConfig() {
  for (const name of REQUIRED_ENV) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }

  const rawPort = process.env.DB_PORT || '3306';
  const port = Number(rawPort);

  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('DB_PORT must be between 1 and 65535.');
  }

  return {
    host: process.env.DB_HOST.trim(),
    port,
    user: process.env.DB_USER.trim(),
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME.trim(),
    connectTimeout: TIMEOUT_MS,
    charset: 'utf8mb4',
    multipleStatements: false,
  };
}

async function checkDatabase() {
  const startedAt = Date.now();
  let connection;

  try {
    connection = await mysql.createConnection(getConfig());

    const [rows] = await connection.query(
      'SELECT 1 AS healthy, DATABASE() AS database_name',
    );

    if (
      !rows[0] ||
      Number(rows[0].healthy) !== 1 ||
      rows[0].database_name !== process.env.DB_NAME.trim()
    ) {
      throw new Error('Database query returned an unexpected result.');
    }

    const [tables] = await connection.execute(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_type = 'BASE TABLE'`,
    );

    const [migrationTable] = await connection.execute(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'schema_migrations'
         AND table_type = 'BASE TABLE'`,
    );

    const migrationTableExists =
      Number(migrationTable[0]?.table_count || 0) > 0;

    let appliedMigrations = null;

    if (migrationTableExists) {
      const [columns] = await connection.execute(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'schema_migrations'`,
      );

      if (columns.some((column) => column.column_name === 'migration')) {
        const [migrationRows] = await connection.query(
          'SELECT COUNT(*) AS total FROM schema_migrations',
        );

        appliedMigrations = Number(migrationRows[0].total);
      }
    }

    return {
      ok: true,
      status: 'healthy',
      database: rows[0].database_name,
      tables: Number(tables[0].table_count),
      migrationTrackingTable: migrationTableExists,
      appliedMigrations,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  if (args.some((arg) => arg !== '--json')) {
    throw new Error('Unsupported argument. Only --json is supported.');
  }

  let result;

  try {
    result = await checkDatabase();
  } catch (error) {
    result = {
      ok: false,
      status: 'unhealthy',
      error: error.message,
      checkedAt: new Date().toISOString(),
    };
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log('MedOrbits database: HEALTHY');
    console.log(`Database: ${result.database}`);
    console.log(`Tables: ${result.tables}`);
    console.log(
      `Migration tracking: ${
        result.migrationTrackingTable ? 'available' : 'not initialized'
      }`,
    );
    console.log(`Applied migrations: ${result.appliedMigrations ?? 'unknown'}`);
    console.log(`Latency: ${result.latencyMs} ms`);
  } else {
    console.error('MedOrbits database: UNHEALTHY');
    console.error(result.error);
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[db-health-check] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  checkDatabase,
  getConfig,
};
