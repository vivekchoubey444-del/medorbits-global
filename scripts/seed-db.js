
#!/usr/bin/env node
'use strict';

require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '..');
const SEEDS_DIR = path.join(ROOT, 'db', 'seeds');
const SEED_TABLE = 'seed_history';

const ALLOWED_TABLES = new Set([
  'roles',
  'permissions',
  'courses',
  'colleges',
  'universities',
]);

function getConfig() {
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
    charset: 'utf8mb4',
    multipleStatements: false,
  };
}

function checksum(content) {
  return crypto
    .createHash('sha256')
    .update(content, 'utf8')
    .digest('hex');
}

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `\`${identifier}\``;
}

async function readSeedFiles() {
  let entries;

  try {
    entries = await fs.readdir(SEEDS_DIR, {
      withFileTypes: true,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Seed directory not found: ${SEEDS_DIR}`);
    }

    throw error;
  }

  const files = entries
    .filter((entry) => entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const seeds = [];

  for (const entry of files) {
    if (!entry.isFile()) {
      throw new Error(`Seed must be a regular file: ${entry.name}`);
    }

    const filename = entry.name;
    const content = await fs.readFile(
      path.join(SEEDS_DIR, filename),
      'utf8',
    );

    if (content.charCodeAt(0) === 0xfeff) {
      throw new Error(`${filename} contains a UTF-8 BOM.`);
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Invalid JSON in ${filename}: ${error.message}`,
      );
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      typeof parsed.table !== 'string' ||
      !Array.isArray(parsed.records)
    ) {
      throw new Error(
        `${filename} must contain { "table": "...", "records": [...] }.`,
      );
    }

    if (!ALLOWED_TABLES.has(parsed.table)) {
      throw new Error(
        `${filename} targets a table that is not allowed: ${parsed.table}`,
      );
    }

    if (!parsed.records.every(
      (record) =>
        record &&
        typeof record === 'object' &&
        !Array.isArray(record),
    )) {
      throw new Error(`${filename} contains an invalid record.`);
    }

    seeds.push({
      filename,
      table: parsed.table,
      records: parsed.records,
      checksum: checksum(content),
    });
  }

  if (seeds.length === 0) {
    throw new Error(`No JSON seed files found in ${SEEDS_DIR}.`);
  }

  return seeds;
}

async function ensureSeedHistory(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${SEED_TABLE}\` (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      seed_file VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_seed_history_file (seed_file)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function loadAppliedSeeds(connection) {
  const [rows] = await connection.query(
    `SELECT seed_file, checksum FROM \`${SEED_TABLE}\``,
  );

  return new Map(rows.map((row) => [row.seed_file, row.checksum]));
}

function validateRecords(seed) {
  for (const record of seed.records) {
    const keys = Object.keys(record);

    if (keys.length === 0) {
      throw new Error(
        `${seed.filename} contains an empty record.`,
      );
    }

    for (const key of keys) {
      quoteIdentifier(key);
    }
  }
}

async function insertRecords(connection, seed) {
  let inserted = 0;

  for (const record of seed.records) {
    const columns = Object.keys(record);

    if (columns.length === 0) continue;

    const columnSql = columns
      .map(quoteIdentifier)
      .join(', ');

    const placeholders = columns.map(() => '?').join(', ');

    const values = columns.map((column) => {
      const value = record[column];

      if (value !== null && typeof value === 'object') {
        return JSON.stringify(value);
      }

      return value;
    });

    const sql =
      `INSERT INTO ${quoteIdentifier(seed.table)} ` +
      `(${columnSql}) VALUES (${placeholders})`;

    await connection.execute(sql, values);
    inserted += 1;
  }

  return inserted;
}

async function seedDatabase({
  dryRun = false,
  connectionFactory = mysql.createConnection,
} = {}) {
  const seeds = await readSeedFiles();

  for (const seed of seeds) {
    validateRecords(seed);
  }

  if (dryRun) {
    return {
      dryRun: true,
      files: seeds.length,
      records: seeds.reduce(
        (total, seed) => total + seed.records.length,
        0,
      ),
      seeds: seeds.map((seed) => ({
        file: seed.filename,
        table: seed.table,
        records: seed.records.length,
      })),
    };
  }

  const connection = await connectionFactory(getConfig());
  const results = [];

  try {
    await ensureSeedHistory(connection);

    const applied = await loadAppliedSeeds(connection);

    for (const seed of seeds) {
      const previousChecksum = applied.get(seed.filename);

      if (previousChecksum) {
        if (previousChecksum !== seed.checksum) {
          throw new Error(
            `Seed ${seed.filename} has changed after being applied. ` +
            'Create a new seed file for additional data.',
          );
        }

        results.push({
          file: seed.filename,
          status: 'already-applied',
          records: seed.records.length,
        });

        continue;
      }

      await connection.beginTransaction();

      try {
        const inserted = await insertRecords(connection, seed);

        await connection.execute(
          `INSERT INTO \`${SEED_TABLE}\` (seed_file, checksum) VALUES (?, ?)`,
          [seed.filename, seed.checksum],
        );

        await connection.commit();

        results.push({
          file: seed.filename,
          status: 'applied',
          records: inserted,
        });
      } catch (error) {
        await connection.rollback();
        throw new Error(
          `Failed to apply ${seed.filename}: ${error.message}`,
        );
      }
    }

    return {
      dryRun: false,
      files: seeds.length,
      results,
    };
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const allowedArgs = new Set(['--dry-run', '--json']);

  for (const arg of args) {
    if (!allowedArgs.has(arg)) {
      console.error('Unsupported argument.');
      process.exitCode = 2;
    }
  }

  if (process.exitCode !== 2) {
    seedDatabase({
      dryRun: args.includes('--dry-run'),
    })
      .then((result) => {
        console.log(JSON.stringify(result, null, 2));
      })
      .catch((error) => {
        console.error(`[seed-db] ${error.message}`);
        process.exitCode = 1;
      });
  }
}

module.exports = {
  checksum,
  readSeedFiles,
  seedDatabase,
  validateRecords,
};
