#!/usr/bin/env node
"use strict";

/**
 * MedOrbits -- Database Integrity Test
 * File: scripts/test-database.js
 *
 * Requirements:
 *   npm install mysql2 dotenv
 *
 * Environment:
 *   DB_HOST
 *   DB_PORT=3306
 *   DB_USER
 *   DB_PASSWORD
 *   DB_NAME
 *
 * Usage:
 *   node scripts/test-database.js
 *   node scripts/test-database.js --json
 *   node scripts/test-database.js --strict
 *
 * Safety:
 * - Read-only SQL queries.
 * - No schema changes or migrations.
 * - No data modification.
 */

const mysql = require("mysql2/promise");

try {
  require("dotenv").config({ quiet: true });
} catch {
  // Environment variables may be supplied by the deployment platform.
}

const REQUIRED_TABLES = [
  "users",
  "roles",
  "permissions",
  "courses",
  "colleges",
  "universities",
  "applications",
  "documents",
  "jobs",
  "employers",
  "payments",
  "subscriptions",
  "notifications",
  "audit_logs",
  "schema_migrations",
];

const REQUIRED_MIGRATION_COLUMNS = [
  "migration",
  "checksum",
];

function requiredEnv(name) {
  const value = process.env[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getConfig() {
  const rawPort = process.env.DB_PORT || "3306";

  if (!/^\d+$/.test(rawPort)) {
    throw new Error("DB_PORT must be a valid integer.");
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be between 1 and 65535.");
  }

  return {
    host: requiredEnv("DB_HOST"),
    port,
    user: requiredEnv("DB_USER"),
    password: process.env.DB_PASSWORD || "",
    database: requiredEnv("DB_NAME"),
    connectTimeout: 10000,
    charset: "utf8mb4",
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
}

async function checkConnection(connection, expectedDatabase) {
  const [rows] = await connection.query(`
    SELECT
      1 AS healthy,
      DATABASE() AS database_name,
      VERSION() AS server_version
  `);

  if (!rows[0] || Number(rows[0].healthy) !== 1) {
    throw new Error("Database connectivity check failed.");
  }

  if (rows[0].database_name !== expectedDatabase) {
    throw new Error(
      "Connected database does not match DB_NAME."
    );
  }

  return {
    database: rows[0].database_name,
    serverVersion: rows[0].server_version,
  };
}

async function getTables(connection) {
  const [rows] = await connection.execute(`
    SELECT TABLE_NAME AS table_name, ENGINE AS engine
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  return new Map(
    rows.map((row) => [
      row.table_name,
      {
        name: row.table_name,
        engine: row.engine,
      },
    ])
  );
}

async function getColumns(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT
       COLUMN_NAME AS column_name,
       DATA_TYPE AS data_type,
       IS_NULLABLE AS is_nullable,
       COLUMN_KEY AS column_key
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [tableName]
  );

  return rows;
}

async function getIndexes(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT
       INDEX_NAME AS index_name,
       NON_UNIQUE AS non_unique,
       COLUMN_NAME AS column_name,
       SEQ_IN_INDEX AS seq_in_index
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [tableName]
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
  const [rows] = await connection.query(`
    SELECT
      kcu.TABLE_NAME AS table_name,
      kcu.COLUMN_NAME AS column_name,
      kcu.CONSTRAINT_NAME AS constraint_name,
      kcu.REFERENCED_TABLE_NAME AS referenced_table_name,
      kcu.REFERENCED_COLUMN_NAME AS referenced_column_name
    FROM information_schema.KEY_COLUMN_USAGE AS kcu
    WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY
      kcu.TABLE_NAME,
      kcu.CONSTRAINT_NAME,
      kcu.ORDINAL_POSITION
  `);

  return rows;
}

async function checkMigrationHistory(connection, tables) {
  if (!tables.has("schema_migrations")) {
    return {
      available: false,
      appliedCount: 0,
      message: "Migration tracking table is missing.",
    };
  }

  const columns = await getColumns(
    connection,
    "schema_migrations"
  );

  const columnNames = new Set(
    columns.map((column) => column.column_name)
  );

  const missingColumns = REQUIRED_MIGRATION_COLUMNS.filter(
    (name) => !columnNames.has(name)
  );

  if (missingColumns.length) {
    return {
      available: false,
      appliedCount: 0,
      message:
        "Migration tracking table is missing columns: " +
        missingColumns.join(", "),
    };
  }

  const [rows] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM schema_migrations
  `);

  return {
    available: true,
    appliedCount: Number(rows[0].total),
    message: "Migration tracking table is accessible.",
  };
}

async function main() {
  const jsonOutput = process.argv.includes("--json");
  const strict = process.argv.includes("--strict");

  const failures = [];
  const warnings = [];

  let connection;

  try {
    connection = await mysql.createConnection(getConfig());

    const database = await checkConnection(
      connection,
      process.env.DB_NAME.trim()
    );

    const tables = await getTables(connection);

    const missingTables = REQUIRED_TABLES.filter(
      (name) => !tables.has(name)
    );

    for (const table of missingTables) {
      failures.push(`Missing required table: ${table}`);
    }

    const indexesByTable = {};
    const columnsByTable = {};

    for (const tableName of tables.keys()) {
      indexesByTable[tableName] = await getIndexes(
        connection,
        tableName
      );

      columnsByTable[tableName] = await getColumns(
        connection,
        tableName
      );

      const table = tables.get(tableName);

      if (
        table.engine &&
        table.engine.toLowerCase() !== "innodb"
      ) {
        warnings.push(
          `Table ${tableName} uses ${table.engine}; ` +
          "InnoDB is recommended where transactional and " +
          "foreign-key support is required."
        );
      }
    }

    const foreignKeys = await getForeignKeys(connection);

    const migrationHistory = await checkMigrationHistory(
      connection,
      tables
    );

    if (!migrationHistory.available) {
      failures.push(migrationHistory.message);
    }

    const report = {
      ok: failures.length === 0 && (!strict || warnings.length === 0),
      database: database.database,
      serverVersion: database.serverVersion,
      tablesFound: tables.size,
      requiredTables: REQUIRED_TABLES.length,
      missingTables,
      indexesChecked: Object.values(indexesByTable).reduce(
        (total, indexes) => total + indexes.length,
        0
      ),
      columnsChecked: Object.values(columnsByTable).reduce(
        (total, columns) => total + columns.length,
        0
      ),
      foreignKeysFound: foreignKeys.length,
      migrationHistory,
      warnings,
      failures,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log("MedOrbits Database Verification");
      console.log(`Database: ${report.database}`);
      console.log(`MySQL version: ${report.serverVersion}`);
      console.log(`Tables found: ${report.tablesFound}`);
      console.log(`Columns checked: ${report.columnsChecked}`);
      console.log(`Indexes found: ${report.indexesChecked}`);
      console.log(`Foreign keys found: ${report.foreignKeysFound}`);
      console.log(
        `Applied migrations: ${migrationHistory.appliedCount}`
      );

      for (const warning of warnings) {
        console.warn(`WARNING: ${warning}`);
      }

      for (const failure of failures) {
        console.error(`FAIL: ${failure}`);
      }

      console.log(
        report.ok
          ? "Database verification passed."
          : "Database verification failed."
      );
    }

    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
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
  getColumns,
  getForeignKeys,
  getIndexes,
  getTables,
  checkMigrationHistory,
};
