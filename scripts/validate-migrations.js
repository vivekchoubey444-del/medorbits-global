
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
const FILE_PATTERN = /^(\d{3,})_([a-z0-9][a-z0-9_-]*)\.sql$/;
const MAX_MIGRATION_BYTES = 5 * 1024 * 1024;

function sha256(content) {
  return crypto
    .createHash('sha256')
    .update(content, 'utf8')
    .digest('hex');
}

async function listMigrationFiles() {
  let entries;

  try {
    entries = await fs.readdir(MIGRATIONS_DIR, {
      withFileTypes: true,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Migration directory not found: ${MIGRATIONS_DIR}`);
    }

    throw new Error(`Cannot read migration directory: ${error.message}`);
  }

  const files = [];
  const sequences = new Map();

  for (const entry of entries) {
    if (!entry.name.endsWith('.sql')) continue;

    if (!entry.isFile()) {
      throw new Error(
        `Migration must be a regular file: ${entry.name}`,
      );
    }

    const match = entry.name.match(FILE_PATTERN);

    if (!match) {
      throw new Error(
        `Invalid filename "${entry.name}". Expected 001_create_users.sql.`,
      );
    }

    const sequence = match[1];

    if (sequences.has(sequence)) {
      throw new Error(
        `Duplicate migration sequence ${sequence}: ` +
        `${sequences.get(sequence)} and ${entry.name}`,
      );
    }

    sequences.set(sequence, entry.name);
    files.push(entry.name);
  }

  files.sort((a, b) => a.localeCompare(b, 'en'));

  if (files.length === 0) {
    throw new Error('No SQL migration files were found.');
  }

  return files;
}

async function validateMigrationFile(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const stat = await fs.stat(filePath);

  if (!stat.isFile()) {
    throw new Error(`${filename} is not a regular file.`);
  }

  if (stat.size === 0) {
    throw new Error(`${filename} is empty.`);
  }

  if (stat.size > MAX_MIGRATION_BYTES) {
    throw new Error(
      `${filename} exceeds the ${MAX_MIGRATION_BYTES} byte limit.`,
    );
  }

  const content = await fs.readFile(filePath, 'utf8');

  if (content.charCodeAt(0) === 0xfeff) {
    throw new Error(`${filename} contains a UTF-8 BOM.`);
  }

  if (!content.trim()) {
    throw new Error(`${filename} contains no SQL content.`);
  }

  if (content.includes('\u0000')) {
    throw new Error(`${filename} contains a null byte.`);
  }

  return {
    filename,
    bytes: stat.size,
    checksum: sha256(content),
  };
}

function getDatabaseConfig() {
  const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];

  for (const name of required) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Missing environment variable: ${name}`);
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
    connectTimeout: 10000,
    multipleStatements: false,
    charset: 'utf8mb4',
  };
}

async function validateDatabaseHistory(migrations) {
  const connection = await mysql.createConnection(getDatabaseConfig());

  try {
    const [tables] = await connection.execute(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = ?`,
      [MIGRATION_TABLE],
    );

    if (Number(tables[0].table_count) === 0) {
      console.log(
        'INFO: schema_migrations does not exist yet; ' +
        'database history checks skipped.',
      );

      return {
        trackingTableExists: false,
        applied: 0,
      };
    }

    const [columns] = await connection.execute(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = ?`,
      [MIGRATION_TABLE],
    );

    const columnNames = new Set(columns.map((column) => column.column_name));

    for (const column of ['migration', 'checksum']) {
      if (!columnNames.has(column)) {
        throw new Error(
          `schema_migrations is missing required column "${column}".`,
        );
      }
    }

    const [rows] = await connection.query(
      `SELECT migration, checksum
       FROM \`${MIGRATION_TABLE}\`
       ORDER BY migration`,
    );

    const appliedByName = new Map();

    for (const row of rows) {
      if (appliedByName.has(row.migration)) {
        throw new Error(
          `Duplicate migration history entry: ${row.migration}`,
        );
      }

      appliedByName.set(row.migration, row.checksum);
    }

    const currentByName = new Map(
      migrations.map((migration) => [
        migration.filename,
        migration.checksum,
      ]),
    );

    for (const [filename, appliedChecksum] of appliedByName) {
      const currentChecksum = currentByName.get(filename);

      if (currentChecksum === undefined) {
        console.warn(
          `WARNING: Applied migration is missing from source: ${filename}`,
        );
        continue;
      }

      if (currentChecksum !== appliedChecksum) {
        throw new Error(
          `Checksum mismatch for applied migration "${filename}". ` +
          'Do not edit an applied migration; create a new migration.',
        );
      }
    }

    return {
      trackingTableExists: true,
      applied: appliedByName.size,
    };
  } finally {
    await connection.end();
  }
}

async function main() {
  const files = await listMigrationFiles();
  const migrations = [];

  for (const filename of files) {
    migrations.push(await validateMigrationFile(filename));
  }

  console.log(`Validated ${migrations.length} SQL migration files.`);

  for (const migration of migrations) {
    console.log(
      `OK ${migration.filename} (${migration.bytes} bytes)`,
    );
  }

  if (process.argv.includes('--db')) {
    const history = await validateDatabaseHistory(migrations);

    console.log(
      history.trackingTableExists
        ? `Database history checked: ${history.applied} applied migrations.`
        : 'Database history has not been initialized.',
    );
  } else {
    console.log(
      'Database history check skipped. Use --db when database access is configured.',
    );
  }

  console.log('Migration validation passed.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[migration-validator] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  listMigrationFiles,
  sha256,
  validateDatabaseHistory,
  validateMigrationFile,
};
