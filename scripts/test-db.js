
#!/usr/bin/env node
'use strict';

require('dotenv').config();

const mysql = require('mysql2/promise');

const REQUIRED_TABLES = [
  'users',
  'roles',
  'permissions',
  'courses',
  'colleges',
  'universities',
  'applications',
  'documents',
  'jobs',
  'employers',
  'payments',
  'subscriptions',
  'notifications',
  'audit_logs',
  'schema_migrations',
];

function requiredEnv(name) {
  const value = process.env[name];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getConfig() {
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
    host: requiredEnv('DB_HOST'),
    port,
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: requiredEnv('DB_NAME'),
    connectTimeout: 10000,
    charset: 'utf8mb4',
    multipleStatements: false,
  };
}

async function checkConnection(connection) {
  const [rows] = await connection.query(
    'SELECT 1 AS healthy, DATABASE() AS database_name, VERSION() AS server_version',
  );

  if (
    !rows[0] ||
    Number(rows[0].healthy) !== 1 ||
    rows[0].database_name !== process.env.DB_NAME
  ) {
    throw new Error('Database connectivity check failed.');
  }

  return {
    database: rows[0].database_name,
    serverVersion: rows[0].server_version,
  };
}

async function getTables(connection) {
  const [rows] = await connection.execute(
    `SELECT table_name, engine
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_type = 'BASE TABLE'`,
  );

  return new Map(
    rows.map((row) => [
      row.table_name,
      {
        name: row.table_name,
        engine: row.engine,
      },
    ]),
  );
}

async function getIndexes(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT index_name, non_unique, column_name, seq_in_index
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
     ORDER BY index_name, seq_in_index`,
    [tableName],
  );

  const indexes = new Map();

  for (const row of rows) {
    if (!indexes.has(row.index_name)) {
      indexes.set(row.index_name, {
        name: row.index_name,
        unique: Number(row.non_unique) === 0,
        columns: [],
      });
    }

    indexes.get(row.index_name).columns.push(row.column_name);
  }

  return [...indexes.values()];
}

async function getForeignKeys(connection) {
  const [rows] = await connection.query(
    `SELECT
       kcu.table_name,
       kcu.column_name,
       kcu.constraint_name,
       kcu.referenced_table_name,
       kcu.referenced_column_name
     FROM information_schema.key_column_usage AS kcu
     WHERE kcu.constraint_schema = DATABASE()
       AND kcu.referenced_table_name IS NOT NULL
     ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position`,
  );

  return rows;
}

async function checkMigrationHistory(connection, tables) {
  if (!tables.has('schema_migrations')) {
    return {
      available: false,
      appliedCount: 0,
      message: 'Migration tracking table is missing.',
    };
  }

  const [columns] = await connection.execute(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'schema_migrations'`,
  );

  const columnNames = new Set(
    columns.map((column) => column.column_name),
  );

  if (!columnNames.has('migration')) {
    return {
      available: false,
      appliedCount: 0,
      message: 'schema_migrations has no migration column.',
    };
  }

  const [rows] = await connection.query(
    'SELECT COUNT(*) AS total FROM schema_migrations',
  );

  return {
    available: true,
    appliedCount: Number(rows[0].total),
    message: 'Migration tracking table is accessible.',
  };
}

async function main() {
  const connection = await mysql.createConnection(getConfig());
  const failures = [];
  const warnings = [];

  try {
    const database = await checkConnection(connection);
    const tables = await getTables(connection);

    const missingTables = REQUIRED_TABLES.filter(
      (name) => !tables.has(name),
    );

    for (const table of missingTables) {
      failures.push(`Missing required table: ${table}`);
    }

    const indexesByTable = {};

    for (const tableName of tables.keys()) {
      indexesByTable[tableName] = await getIndexes(
        connection,
        tableName,
      );
    }

    const foreignKeys = await getForeignKeys(connection);

    for (const [tableName, table] of tables) {
      if (table.engine && table.engine.toLowerCase() !== 'innodb') {
        warnings.push(
          `Table ${tableName} uses ${table.engine}; InnoDB is recommended for foreign-key enforcement and transactional data.`,
        );
      }
    }

    const migrationHistory = await checkMigrationHistory(
      connection,
      tables,
    );

    if (!migrationHistory.available) {
      failures.push(migrationHistory.message);
    }

    const report = {
      ok: failures.length === 0,
      database: database.database,
      serverVersion: database.serverVersion,
      tablesFound: tables.size,
      requiredTables: REQUIRED_TABLES.length,
      missingTables,
      indexesChecked: Object.values(indexesByTable).reduce(
        (total, indexes) => total + indexes.length,
        0,
      ),
      foreignKeysFound: foreignKeys.length,
      migrationHistory,
      warnings,
      failures,
    };

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('MedOrbits database verification');
      console.log(`Database: ${report.database}`);
      console.log(`MySQL version: ${report.serverVersion}`);
      console.log(`Tables found: ${report.tablesFound}`);
      console.log(`Indexes found: ${report.indexesChecked}`);
      console.log(`Foreign keys found: ${report.foreignKeysFound}`);
      console.log(
        `Applied migrations: ${migrationHistory.appliedCount}`,
      );

      for (const warning of warnings) {
        console.warn(`WARNING: ${warning}`);
      }

      for (const failure of failures) {
        console.error(`FAIL: ${failure}`);
      }

      console.log(
        report.ok
          ? 'Database verification passed.'
          : 'Database verification failed.',
      );
    }

    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[database-test] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  REQUIRED_TABLES,
  checkConnection,
  getForeignKeys,
  getIndexes,
  getTables,
};
