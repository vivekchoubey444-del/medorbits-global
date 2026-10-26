
'use strict';

/**
 * MedOrbits -- Database Migration Tests
 *
 * File: tests/database/migrations.test.js
 * Framework: Node.js built-in node:test
 * Requires: Node.js >= 20
 *
 * Run without a database:
 *   node --test tests/database/migrations.test.js
 *
 * PostgreSQL:
 *   NODE_ENV=test \
 *   TEST_DATABASE_CLIENT=postgres \
 *   TEST_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/medorbits_test' \
 *   node --test tests/database/migrations.test.js
 *
 * MySQL:
 *   NODE_ENV=test \
 *   TEST_DATABASE_CLIENT=mysql \
 *   TEST_DATABASE_HOST=127.0.0.1 \
 *   TEST_DATABASE_PORT=3306 \
 *   TEST_DATABASE_NAME=medorbits_test \
 *   TEST_DATABASE_USER=test_user \
 *   TEST_DATABASE_PASSWORD='test_password' \
 *   node --test tests/database/migrations.test.js
 *
 * Optional:
 *   MIGRATIONS_DIR=./database/migrations
 *   MIGRATIONS_TABLE=migrations
 *   TEST_DATABASE_SSL=true
 *
 * This suite inspects migration files and existing migration history.
 * It does not execute migrations or modify application tables.
 * Migration history column names must match the configured conventions.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CLIENT = String(
  process.env.TEST_DATABASE_CLIENT || '',
).trim().toLowerCase();

const DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const MIGRATIONS_TABLE = (
  process.env.MIGRATIONS_TABLE || 'migrations'
).trim();

const MIGRATIONS_DIR = path.resolve(
  process.env.MIGRATIONS_DIR ||
    path.join(process.cwd(), 'database', 'migrations'),
);

const MYSQL_CONFIG = {
  host: process.env.TEST_DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.TEST_DATABASE_PORT || 3306),
  database: process.env.TEST_DATABASE_NAME || '',
  user: process.env.TEST_DATABASE_USER || '',
  password: process.env.TEST_DATABASE_PASSWORD || '',
  connectTimeout: 5000,
  multipleStatements: false,
  ...(process.env.TEST_DATABASE_SSL === 'true'
    ? {
        ssl: {
          rejectUnauthorized: true,
        },
      }
    : {}),
};

let db = null;
let migrationsTableExists = false;
let setupError = null;

function isProductionEnvironment() {
  return (
    String(process.env.NODE_ENV || '').trim().toLowerCase() ===
    'production'
  );
}

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return CLIENT === 'mysql'
    ? `\`${identifier}\``
    : `"${identifier}"`;
}

function configuredDatabaseName() {
  if (CLIENT === 'postgres') {
    try {
      const url = new URL(DATABASE_URL);

      if (!/^postgres(?:ql)?:$/i.test(url.protocol)) {
        return '';
      }

      return decodeURIComponent(
        url.pathname.replace(/^\/+/, ''),
      );
    } catch {
      return '';
    }
  }

  if (CLIENT === 'mysql') {
    return MYSQL_CONFIG.database.trim();
  }

  return '';
}

function assertTestDatabaseConfiguration() {
  assert.equal(
    isProductionEnvironment(),
    false,
    'Refusing to run migration tests with NODE_ENV=production.',
  );

  assert.ok(
    ['postgres', 'mysql'].includes(CLIENT),
    'Set TEST_DATABASE_CLIENT to "postgres" or "mysql".',
  );

  assert.match(
    MIGRATIONS_TABLE,
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    'MIGRATIONS_TABLE must be a valid SQL identifier.',
  );

  const databaseName = configuredDatabaseName();

  assert.ok(
    databaseName,
    CLIENT === 'postgres'
      ? 'TEST_DATABASE_URL must include a PostgreSQL database name.'
      : 'TEST_DATABASE_NAME is required for MySQL.',
  );

  assert.match(
    databaseName,
    /test/i,
    'Use a dedicated test database whose name contains "test".',
  );

  if (CLIENT === 'postgres') {
    assert.match(
      DATABASE_URL,
      /^postgres(?:ql)?:\/\//i,
      'TEST_DATABASE_URL must be a PostgreSQL URL.',
    );
  } else {
    assert.ok(
      MYSQL_CONFIG.host && MYSQL_CONFIG.user,
      'TEST_DATABASE_HOST and TEST_DATABASE_USER are required.',
    );

    assert.ok(
      Number.isInteger(MYSQL_CONFIG.port) &&
        MYSQL_CONFIG.port >= 1 &&
        MYSQL_CONFIG.port <= 65535,
      'TEST_DATABASE_PORT must be a valid TCP port.',
    );
  }
}

async function connectDatabase() {
  if (CLIENT === 'postgres') {
    let pg;

    try {
      pg = require('pg');
    } catch {
      throw new Error(
        'PostgreSQL driver not installed. Run: npm install pg',
      );
    }

    const pool = new pg.Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 1,
      application_name: 'medorbits-migration-tests',
      ...(process.env.TEST_DATABASE_SSL === 'true'
        ? {
            ssl: {
              rejectUnauthorized: true,
            },
          }
        : {}),
    });

    try {
      const client = await pool.connect();

      return {
        query: (sql, params = []) => client.query(sql, params),

        close: async () => {
          try {
            client.release();
          } finally {
            await pool.end();
          }
        },
      };
    } catch (error) {
      await pool.end().catch(() => {});
      throw error;
    }
  }

  if (CLIENT === 'mysql') {
    let mysql;

    try {
      mysql = require('mysql2/promise');
    } catch {
      throw new Error(
        'MySQL driver not installed. Run: npm install mysql2',
      );
    }

    const connection = await mysql.createConnection(MYSQL_CONFIG);

    return {
      query: (sql, params = []) =>
        connection.execute(sql, params),

      close: () => connection.end(),
    };
  }

  throw new Error(`Unsupported database client: ${CLIENT}`);
}

async function queryRows(sql, params = []) {
  if (!db) {
    throw new Error(
      'Migration test database connection is unavailable.',
    );
  }

  const result = await db.query(sql, params);

  return CLIENT === 'postgres'
    ? result.rows
    : result[0];
}

async function verifyDatabaseIdentity() {
  const rows = CLIENT === 'postgres'
    ? await queryRows(
        'SELECT current_database() AS database_name',
      )
    : await queryRows(
        'SELECT DATABASE() AS database_name',
      );

  assert.equal(rows.length, 1);

  const actualName = rows[0].database_name;
  const expectedName = configuredDatabaseName();

  assert.equal(
    actualName,
    expectedName,
    'Connected database does not match the configured test database.',
  );

  assert.match(
    actualName,
    /test/i,
    'Refusing to inspect migration history outside a test-named database.',
  );
}

async function tableExists(name) {
  if (CLIENT === 'postgres') {
    const rows = await queryRows(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = $1
      `,
      [name],
    );

    return rows.length > 0;
  }

  const rows = await queryRows(
    `
      SELECT TABLE_NAME AS table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [name],
  );

  return rows.length > 0;
}

async function getColumnNames(name) {
  if (CLIENT === 'postgres') {
    const rows = await queryRows(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
        ORDER BY ordinal_position
      `,
      [name],
    );

    return rows.map((row) => row.column_name);
  }

  const rows = await queryRows(
    `
      SELECT COLUMN_NAME AS column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
      ORDER BY ORDINAL_POSITION
    `,
    [name],
  );

  return rows.map((row) => row.column_name);
}

function discoverMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(?:js|cjs|mjs|sql)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

function validateMigrationFileNames(files) {
  const versions = new Set();

  for (const file of files) {
    const match = file.match(/^(\d{3,})[_-]/);

    assert.ok(
      match,
      `Migration "${file}" must begin with a numeric version ` +
        'followed by "_" or "-". Example: 001_create_users.sql.',
    );

    const version = match[1];

    assert.equal(
      versions.has(version),
      false,
      `Duplicate migration version "${version}".`,
    );

    versions.add(version);
  }
}

async function getMigrationHistory() {
  const table = quoteIdentifier(MIGRATIONS_TABLE);

  return queryRows(`SELECT * FROM ${table}`);
}

function getMigrationVersion(row) {
  return (
    row.version ??
    row.migration ??
    row.name ??
    row.filename ??
    row.file_name ??
    null
  );
}

function getFileVersion(filename) {
  return filename.match(/^(\d{3,})[_-]/)?.[1] || null;
}

function assertUniqueRecordedVersions(rows) {
  const versions = rows
    .map(getMigrationVersion)
    .filter((version) => version !== null && version !== undefined)
    .map(String);

  assert.equal(
    versions.length,
    new Set(versions).size,
    'Migration history contains duplicate recorded versions.',
  );
}

function assertRecordedFilesExist(rows, files) {
  const fileNames = new Set(files);
  const fileVersions = new Set(
    files.map(getFileVersion).filter(Boolean),
  );

  for (const row of rows) {
    const recorded = getMigrationVersion(row);

    if (recorded === null || recorded === undefined) {
      continue;
    }

    const value = String(recorded);
    const basename = path.basename(value);
    const exactFileExists = fileNames.has(basename);
    const version = getFileVersion(basename);
    const versionExists = Boolean(
      version && fileVersions.has(version),
    );

    assert.ok(
      exactFileExists || versionExists,
      `Recorded migration "${value}" has no matching migration file.`,
    );
  }
}

describe('Database migrations', () => {
  before(async () => {
    try {
      assertTestDatabaseConfiguration();

      db = await connectDatabase();

      await verifyDatabaseIdentity();

      migrationsTableExists = await tableExists(MIGRATIONS_TABLE);
    } catch (error) {
      setupError = error;

      if (db) {
        const current = db;
        db = null;

        try {
          await current.close();
        } catch (closeError) {
          setupError = new AggregateError(
            [error, closeError],
            'Migration test setup and connection cleanup failed.',
          );
        }
      }
    }
  });

  after(async () => {
    if (!db) {
      return;
    }

    const current = db;
    db = null;

    await current.close();
  });

  test('test database configuration and connection are valid', () => {
    if (setupError) {
      throw setupError;
    }

    assert.ok(db, 'Database connection should be initialized.');
  });

  test('migration directory exists', () => {
    assert.ok(
      fs.existsSync(MIGRATIONS_DIR),
      `Migration directory not found: ${MIGRATIONS_DIR}. ` +
        'Set MIGRATIONS_DIR to the actual project migration directory.',
    );

    assert.ok(
      fs.statSync(MIGRATIONS_DIR).isDirectory(),
      `MIGRATIONS_DIR is not a directory: ${MIGRATIONS_DIR}`,
    );
  });

  test('migration directory contains migration files', () => {
    const files = discoverMigrationFiles();

    assert.ok(
      files.length > 0,
      `No .js, .cjs, .mjs, or .sql migration files found in ${MIGRATIONS_DIR}.`,
    );
  });

  test('migration filenames use unique numeric versions', () => {
    const files = discoverMigrationFiles();

    assert.ok(
      files.length > 0,
      'Cannot validate migration filenames because no migration files were found.',
    );

    validateMigrationFileNames(files);
  });

  test('migration files are returned in deterministic order', () => {
    const files = discoverMigrationFiles();

    assert.deepEqual(
      files,
      [...files].sort((a, b) => a.localeCompare(b, 'en')),
    );
  });

  test('migration history table exists when initialized', async (t) => {
    if (setupError) {
      throw setupError;
    }

    if (!migrationsTableExists) {
      t.skip(
        `The "${MIGRATIONS_TABLE}" table does not exist yet. ` +
          'Initialize the migration history table to test its contents.',
      );
      return;
    }

    assert.equal(await tableExists(MIGRATIONS_TABLE), true);
  });

  test('migration history can be queried', async (t) => {
    if (setupError) {
      throw setupError;
    }

    if (!migrationsTableExists) {
      t.skip('Migration history table is not initialized.');
      return;
    }

    const rows = await getMigrationHistory();

    assert.ok(Array.isArray(rows));
  });

  test('migration history contains no duplicate recorded versions', async (t) => {
    if (setupError) {
      throw setupError;
    }

    if (!migrationsTableExists) {
      t.skip('Migration history table is not initialized.');
      return;
    }

    const rows = await getMigrationHistory();

    assertUniqueRecordedVersions(rows);
  });

  test('recorded migrations correspond to available files', async (t) => {
    if (setupError) {
      throw setupError;
    }

    if (!migrationsTableExists) {
      t.skip('Migration history table is not initialized.');
      return;
    }

    const files = discoverMigrationFiles();
    const rows = await getMigrationHistory();

    assertRecordedFilesExist(rows, files);
  });

  test('migration history has a recognizable version column', async (t) => {
    if (setupError) {
      throw setupError;
    }

    if (!migrationsTableExists) {
      t.skip('Migration history table is not initialized.');
      return;
    }

    const columns = await getColumnNames(MIGRATIONS_TABLE);

    const recognizedColumns = [
      'version',
      'migration',
      'name',
      'filename',
      'file_name',
    ];

    assert.ok(
      recognizedColumns.some((column) => columns.includes(column)),
      'Migration history table must have a recognized version column. ' +
        `Found: ${columns.join(', ') || '(none)'}.`,
    );

    const rows = await getMigrationHistory();

    for (const row of rows) {
      assert.notEqual(
        getMigrationVersion(row),
        null,
        'A migration history row is missing its version identifier.',
      );

      assert.notEqual(
        getMigrationVersion(row),
        undefined,
        'A migration history row is missing its version identifier.',
      );
    }
  });
});
