
#!/usr/bin/env node
'use strict';

require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
const MIGRATION_TABLE = 'schema_migrations';
const LOCK_NAME = 'medorbits_schema_migrations';
const LOCK_TIMEOUT_SECONDS = 30;

function requiredEnv(name) {
  const value = process.env[name];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function databaseConfig() {
  const rawPort = process.env.DB_PORT || '3306';
  const port = Number(rawPort);

  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('DB_PORT must be a valid port between 1 and 65535.');
  }

  return {
    host: requiredEnv('DB_HOST'),
    port,
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: requiredEnv('DB_NAME'),
    connectTimeout: 10000,
    multipleStatements: false,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
}

async function listMigrations() {
  let entries;

  try {
    entries = await fs.readdir(MIGRATIONS_DIR, {
      withFileTypes: true,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw new Error(`Cannot read db/migrations: ${error.message}`);
  }

  const files = [];

  for (const entry of entries) {
    if (!entry.name.endsWith('.sql')) continue;

    if (!entry.isFile()) {
      throw new Error(
        `Migration must be a regular file: ${entry.name}`,
      );
    }

    if (!/^\d{3,}_[a-z0-9][a-z0-9_-]*\.sql$/.test(entry.name)) {
      throw new Error(
        `Invalid migration filename "${entry.name}". Expected, for example, 001_create_users.sql.`,
      );
    }

    files.push(entry.name);
  }

  files.sort((a, b) => a.localeCompare(b, 'en'));

  const prefixes = new Set();

  for (const filename of files) {
    const prefix = filename.split('_', 1)[0];

    if (prefixes.has(prefix)) {
      throw new Error(
        `Duplicate migration sequence number "${prefix}".`,
      );
    }

    prefixes.add(prefix);
  }

  return files;
}

async function readMigration(filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf8');

  if (content.charCodeAt(0) === 0xfeff) {
    throw new Error(`${filename} contains a UTF-8 BOM.`);
  }

  if (!content.trim()) {
    throw new Error(`${filename} is empty.`);
  }

  return content;
}

function sha256(content) {
  return crypto
    .createHash('sha256')
    .update(content, 'utf8')
    .digest('hex');
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${MIGRATION_TABLE}\` (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      migration VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_migration (migration)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function acquireLock(connection) {
  const [rows] = await connection.execute(
    'SELECT GET_LOCK(?, ?) AS acquired',
    [LOCK_NAME, LOCK_TIMEOUT_SECONDS],
  );

  if (!rows[0] || Number(rows[0].acquired) !== 1) {
    throw new Error(
      `Could not acquire database migration lock within ${LOCK_TIMEOUT_SECONDS} seconds.`,
    );
  }
}

async function releaseLock(connection) {
  const [rows] = await connection.execute(
    'SELECT RELEASE_LOCK(?) AS released',
    [LOCK_NAME],
  );

  if (!rows[0] || Number(rows[0].released) !== 1) {
    throw new Error('Could not release database migration lock.');
  }
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query(
    `SELECT migration, checksum FROM \`${MIGRATION_TABLE}\` ORDER BY migration`,
  );

  return new Map(
    rows.map((row) => [row.migration, row.checksum]),
  );
}

async function runMigrations(connection, files) {
  const applied = await getAppliedMigrations(connection);
  const pending = [];

  for (const filename of files) {
    const content = await readMigration(filename);
    const currentChecksum = sha256(content);
    const existingChecksum = applied.get(filename);

    if (existingChecksum !== undefined) {
      if (existingChecksum !== currentChecksum) {
        throw new Error(
          `Applied migration "${filename}" has been modified. Create a new migration instead.`,
        );
      }

      continue;
    }

    pending.push({
      filename,
      content,
      checksum: currentChecksum,
    });
  }

  for (const migration of pending) {
    console.log(`Applying ${migration.filename}...`);

    // SQL migration files must contain a single migration's SQL.
    // MySQL DDL may implicitly commit, so this is not fully transactional.
    await connection.query(migration.content);

    await connection.execute(
      `INSERT INTO \`${MIGRATION_TABLE}\` (migration, checksum) VALUES (?, ?)`,
      [migration.filename, migration.checksum],
    );

    console.log(`Applied ${migration.filename}`);
  }

  return {
    total: files.length,
    applied: pending.length,
    alreadyApplied: files.length - pending.length,
  };
}

async function main() {
  const files = await listMigrations();

  if (files.length === 0) {
    console.log('No SQL migration files found; nothing to do.');
    return;
  }

  const connection = await mysql.createConnection(databaseConfig());
  let locked = false;
  let failure = null;

  try {
    await acquireLock(connection);
    locked = true;

    await ensureMigrationTable(connection);

    const result = await runMigrations(connection, files);

    console.log(
      `Migration complete: ${result.applied} applied, ` +
      `${result.alreadyApplied} already applied, ` +
      `${result.total} total.`,
    );
  } catch (error) {
    failure = error;
  } finally {
    if (locked) {
      try {
        await releaseLock(connection);
      } catch (error) {
        if (!failure) failure = error;
        else console.error(`Lock cleanup failed: ${error.message}`);
      }
    }

    try {
      await connection.end();
    } catch (error) {
      if (!failure) failure = error;
      else console.error(`Connection cleanup failed: ${error.message}`);
    }
  }

  if (failure) throw failure;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[migrate] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  databaseConfig,
  listMigrations,
  readMigration,
  runMigrations,
  sha256,
};
