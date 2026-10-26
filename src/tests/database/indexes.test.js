
'use strict';

/**
 * MedOrbits -- Database Index Tests
 * Path: tests/database/indexes.test.js
 *
 * Supported databases:
 *   PostgreSQL: TEST_DATABASE_CLIENT=postgres
 *                TEST_DATABASE_URL=postgresql://user:password@localhost:5432/medorbits_test
 *
 *   MySQL:      TEST_DATABASE_CLIENT=mysql
 *                TEST_DATABASE_HOST=127.0.0.1
 *                TEST_DATABASE_PORT=3306
 *                TEST_DATABASE_NAME=medorbits_test
 *                TEST_DATABASE_USER=root
 *                TEST_DATABASE_PASSWORD=...
 *
 * Run:
 *   node --test tests/database/indexes.test.js
 *
 * Dependencies:
 *   npm install --save-dev pg mysql2
 *
 * Safety:
 *   - Requires NODE_ENV=test.
 *   - Refuses production environments.
 *   - Requires a database name containing "test".
 *   - Creates uniquely named temporary test tables.
 *   - Drops only the tables created by this test suite.
 */

const {
  test,
  before,
  after,
} = require('node:test');

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');

const CLIENT = String(
  process.env.TEST_DATABASE_CLIENT || 'postgres'
).trim().toLowerCase();

const NODE_ENV = String(
  process.env.NODE_ENV || ''
).trim().toLowerCase();

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';

const MYSQL_CONFIG = {
  host: process.env.TEST_DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.TEST_DATABASE_PORT || 3306),
  database: process.env.TEST_DATABASE_NAME || '',
  user: process.env.TEST_DATABASE_USER || '',
  password: process.env.TEST_DATABASE_PASSWORD || '',
};

const RUN_ID = randomBytes(5).toString('hex');

const TABLES = {
  records: `mo_idx_records_${RUN_ID}`,
  unique: `mo_idx_unique_${RUN_ID}`,
  composite: `mo_idx_composite_${RUN_ID}`,
};

let connection;
let closeConnection;
let connected = false;

const createdTables = [];

function assertTestDatabaseConfiguration() {
  if (NODE_ENV !== 'test') {
    throw new Error(
      'Database index tests require NODE_ENV=test.'
    );
  }

  if (
    process.env.NODE_ENV === 'production' ||
    process.env.IS_PRODUCTION === 'true'
  ) {
    throw new Error(
      'Refusing to run database index tests in production.'
    );
  }

  if (!['postgres', 'mysql'].includes(CLIENT)) {
    throw new Error(
      'TEST_DATABASE_CLIENT must be "postgres" or "mysql".'
    );
  }

  let databaseName;

  if (CLIENT === 'postgres') {
    if (!TEST_DATABASE_URL) {
      throw new Error(
        'TEST_DATABASE_URL is required for PostgreSQL tests.'
      );
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(TEST_DATABASE_URL);
    } catch {
      throw new Error(
        'TEST_DATABASE_URL must be a valid PostgreSQL connection URL.'
      );
    }

    if (
      !['postgres:', 'postgresql:'].includes(parsedUrl.protocol)
    ) {
      throw new Error(
        'TEST_DATABASE_URL must use postgres:// or postgresql://.'
      );
    }

    databaseName = decodeURIComponent(
      parsedUrl.pathname.replace(/^\/+/, '')
    );
  } else {
    if (
      !MYSQL_CONFIG.database ||
      !MYSQL_CONFIG.user
    ) {
      throw new Error(
        'TEST_DATABASE_NAME and TEST_DATABASE_USER are required for MySQL.'
      );
    }

    if (
      !Number.isInteger(MYSQL_CONFIG.port) ||
      MYSQL_CONFIG.port < 1 ||
      MYSQL_CONFIG.port > 65535
    ) {
      throw new Error(
        'TEST_DATABASE_PORT must be a valid TCP port.'
      );
    }

    databaseName = MYSQL_CONFIG.database;
  }

  if (!/(^|[-_])test($|[-_])/i.test(databaseName)) {
    throw new Error(
      `Refusing to run tests against database "${databaseName}". ` +
      'Use a dedicated database with "test" in its name, ' +
      'for example medorbits_test.'
    );
  }
}

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(
      `Unsafe SQL identifier: ${identifier}`
    );
  }

  if (CLIENT === 'mysql') {
    return `\`${identifier}\``;
  }

  return `"${identifier}"`;
}

function placeholder(index) {
  return CLIENT === 'postgres'
    ? `$${index}`
    : '?';
}

async function connectDatabase() {
  assertTestDatabaseConfiguration();

  if (CLIENT === 'postgres') {
    let pg;

    try {
      pg = require('pg');
    } catch {
      throw new Error(
        'PostgreSQL driver missing. Install it with: npm install --save-dev pg'
      );
    }

    const pool = new pg.Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 5000,
      ssl: process.env.TEST_DATABASE_SSL === 'true'
        ? { rejectUnauthorized: true }
        : undefined,
    });

    connection = await pool.connect();

    closeConnection = async () => {
      connection.release();
      await pool.end();
    };
  } else {
    let mysql;

    try {
      mysql = require('mysql2/promise');
    } catch {
      throw new Error(
        'MySQL driver missing. Install it with: npm install --save-dev mysql2'
      );
    }

    connection = await mysql.createConnection({
      ...MYSQL_CONFIG,
      connectTimeout: 10000,
      ssl: process.env.TEST_DATABASE_SSL === 'true'
        ? { rejectUnauthorized: true }
        : undefined,
    });

    closeConnection = async () => {
      await connection.end();
    };
  }

  connected = true;

  await verifyDatabaseIdentity();
}

async function query(sql, params = []) {
  if (!connected || !connection) {
    throw new Error(
      'Database connection has not been initialized.'
    );
  }

  if (CLIENT === 'postgres') {
    return connection.query(sql, params);
  }

  const [rows] = await connection.execute(sql, params);

  return {
    rows,
    rowCount: rows.affectedRows ?? rows.length,
  };
}

async function verifyDatabaseIdentity() {
  let actualDatabase;

  if (CLIENT === 'postgres') {
    const result = await query(
      'SELECT current_database() AS database_name'
    );

    actualDatabase = result.rows[0]?.database_name;
  } else {
    const result = await query(
      'SELECT DATABASE() AS database_name'
    );

    actualDatabase = result.rows[0]?.database_name;
  }

  const expectedDatabase = CLIENT === 'postgres'
    ? decodeURIComponent(
        new URL(TEST_DATABASE_URL).pathname.replace(/^\/+/, '')
      )
    : MYSQL_CONFIG.database;

  assert.equal(
    actualDatabase,
    expectedDatabase,
    'Connected database does not match the configured test database.'
  );

  assert.match(
    actualDatabase,
    /(^|[-_])test($|[-_])/i,
    'Connected database must have "test" in its name.'
  );
}

function getErrorCode(error) {
  return error?.code || error?.sqlState || '';
}

async function expectDatabaseError(operation, expectedCodes) {
  let caughtError;

  try {
    await operation();
  } catch (error) {
    caughtError = error;
  }

  assert.ok(
    caughtError,
    'Expected the database operation to fail.'
  );

  const code = getErrorCode(caughtError);

  assert.ok(
    expectedCodes.includes(code),
    `Expected database error code ${expectedCodes.join(' or ')}, ` +
    `received "${code}": ${caughtError.message}`
  );

  return caughtError;
}

async function createTable(name, definition) {
  await query(
    `CREATE TABLE ${quoteIdentifier(name)} (${definition})`
  );

  createdTables.push(name);
}

async function createIndexes() {
  const records = quoteIdentifier(TABLES.records);
  const unique = quoteIdentifier(TABLES.unique);
  const composite = quoteIdentifier(TABLES.composite);

  await query(
    `CREATE INDEX ${quoteIdentifier(`idx_records_email_${RUN_ID}`)}
     ON ${records} (email)`
  );

  await query(
    `CREATE INDEX ${quoteIdentifier(`idx_records_status_${RUN_ID}`)}
     ON ${records} (status)`
  );

  await query(
    `CREATE UNIQUE INDEX ${quoteIdentifier(`idx_unique_email_${RUN_ID}`)}
     ON ${unique} (email)`
  );

  await query(
    `CREATE INDEX ${quoteIdentifier(`idx_composite_status_date_${RUN_ID}`)}
     ON ${composite} (status, created_at)`
  );

  await query(
    `CREATE INDEX ${quoteIdentifier(`idx_composite_date_status_${RUN_ID}`)}
     ON ${composite} (created_at, status)`
  );
}

async function cleanupTables() {
  if (!connected || !connection) {
    return;
  }

  const errors = [];

  for (const tableName of [...createdTables].reverse()) {
    try {
      await query(
        `DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`
      );

      const index = createdTables.indexOf(tableName);

      if (index !== -1) {
        createdTables.splice(index, 1);
      }
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      'Failed to clean up one or more database index test tables.'
    );
  }
}

async function closeDatabase() {
  if (!closeConnection) {
    connected = false;
    connection = undefined;
    return;
  }

  const close = closeConnection;

  try {
    await close();
  } finally {
    closeConnection = undefined;
    connection = undefined;
    connected = false;
  }
}

async function insertRecord({
  id,
  email,
  status = 'active',
  createdAt = new Date('2026-01-01T00:00:00.000Z'),
}) {
  const table = quoteIdentifier(TABLES.records);

  await query(
    `INSERT INTO ${table} (id, email, status, created_at)
     VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)})`,
    [id, email, status, createdAt]
  );
}

async function getIndexNames(tableName) {
  if (CLIENT === 'postgres') {
    const result = await query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND tablename = ${placeholder(1)}`,
      [tableName]
    );

    return result.rows.map((row) => row.indexname);
  }

  const result = await query(
    `SELECT DISTINCT INDEX_NAME AS index_name
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ${placeholder(1)}`,
    [tableName]
  );

  return result.rows.map((row) => row.index_name);
}

async function explainQuery(sql, params = []) {
  if (CLIENT === 'postgres') {
    return query(`EXPLAIN ${sql}`, params);
  }

  return query(`EXPLAIN ${sql}`, params);
}

before(async () => {
  try {
    await connectDatabase();

    const idType = CLIENT === 'postgres'
      ? 'INTEGER'
      : 'INT';

    const emailType = CLIENT === 'postgres'
      ? 'VARCHAR(255)'
      : 'VARCHAR(255)';

    const statusType = CLIENT === 'postgres'
      ? 'VARCHAR(40)'
      : 'VARCHAR(40)';

    const timestampType = CLIENT === 'postgres'
      ? 'TIMESTAMPTZ'
      : 'DATETIME(3)';

    await createTable(
      TABLES.records,
      `
        id ${idType} PRIMARY KEY,
        email ${emailType} NOT NULL,
        status ${statusType} NOT NULL,
        created_at ${timestampType} NOT NULL
      `
    );

    await createTable(
      TABLES.unique,
      `
        id ${idType} PRIMARY KEY,
        email ${emailType} NOT NULL
      `
    );

    await createTable(
      TABLES.composite,
      `
        id ${idType} PRIMARY KEY,
        status ${statusType} NOT NULL,
        created_at ${timestampType} NOT NULL
      `
    );

    await createIndexes();
  } catch (error) {
    try {
      await cleanupTables();
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }

    try {
      await closeDatabase();
    } catch (closeError) {
      error.closeError = closeError;
    }

    throw error;
  }
});

after(async () => {
  let cleanupError;

  try {
    await cleanupTables();
  } catch (error) {
    cleanupError = error;
  }

  try {
    await closeDatabase();
  } catch (error) {
    if (cleanupError) {
      throw new AggregateError(
        [cleanupError, error],
        'Database cleanup and connection shutdown both failed.'
      );
    }

    throw error;
  }

  if (cleanupError) {
    throw cleanupError;
  }
});

test('test database connection is established', () => {
  assert.equal(connected, true);
  assert.ok(connection);
});

test('required test tables are created', async () => {
  const result = await query(
    CLIENT === 'postgres'
      ? `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = current_schema()
           AND table_name = ${placeholder(1)}`
      : `SELECT TABLE_NAME AS table_name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND table_name = ${placeholder(1)}`,
    [TABLES.records]
  );

  assert.equal(result.rows.length, 1);
});

test('single-column indexes are present', async () => {
  const indexNames = await getIndexNames(TABLES.records);

  assert.ok(
    indexNames.includes(`idx_records_email_${RUN_ID}`),
    'Email index should exist.'
  );

  assert.ok(
    indexNames.includes(`idx_records_status_${RUN_ID}`),
    'Status index should exist.'
  );
});

test('unique index rejects duplicate indexed values', async () => {
  const table = quoteIdentifier(TABLES.unique);

  await query(
    `INSERT INTO ${table} (id, email)
     VALUES (${placeholder(1)}, ${placeholder(2)})`,
    [1, 'duplicate@example.com']
  );

  await expectDatabaseError(
    () => query(
      `INSERT INTO ${table} (id, email)
       VALUES (${placeholder(1)}, ${placeholder(2)})`,
      [2, 'duplicate@example.com']
    ),
    CLIENT === 'postgres'
      ? ['23505']
      : ['ER_DUP_ENTRY']
  );
});

test('unique index permits distinct values', async () => {
  const table = quoteIdentifier(TABLES.unique);

  await query(
    `INSERT INTO ${table} (id, email)
     VALUES (${placeholder(1)}, ${placeholder(2)})`,
    [3, 'different@example.com']
  );

  const result = await query(
    `SELECT id FROM ${table}
     WHERE email = ${placeholder(1)}`,
    ['different@example.com']
  );

  assert.equal(result.rows.length, 1);
});

test('composite indexes are present', async () => {
  const indexNames = await getIndexNames(TABLES.composite);

  assert.ok(
    indexNames.includes(`idx_composite_status_date_${RUN_ID}`),
    'Composite status/date index should exist.'
  );

  assert.ok(
    indexNames.includes(`idx_composite_date_status_${RUN_ID}`),
    'Composite date/status index should exist.'
  );
});

test('indexed email lookup returns the matching record', async () => {
  await insertRecord({
    id: 1,
    email: 'indexed@example.com',
    status: 'active',
  });

  const result = await query(
    `SELECT id, email, status
     FROM ${quoteIdentifier(TABLES.records)}
     WHERE email = ${placeholder(1)}`,
    ['indexed@example.com']
  );

  assert.equal(result.rows.length, 1);
  assert.equal(Number(result.rows[0].id), 1);
  assert.equal(result.rows[0].email, 'indexed@example.com');
});

test('indexed status lookup returns only matching records', async () => {
  await insertRecord({
    id: 2,
    email: 'active@example.com',
    status: 'active',
  });

  await insertRecord({
    id: 3,
    email: 'inactive@example.com',
    status: 'inactive',
  });

  const result = await query(
    `SELECT id, email
     FROM ${quoteIdentifier(TABLES.records)}
     WHERE status = ${placeholder(1)}`,
    ['inactive']
  );

  assert.ok(result.rows.length >= 1);

  assert.ok(
    result.rows.every((row) => row.email === 'inactive@example.com'),
    'The query should return only records matching the requested status.'
  );
});

test('composite index supports queries filtering by its leading column', async () => {
  const table = quoteIdentifier(TABLES.composite);

  await query(
    `INSERT INTO ${table} (id, status, created_at)
     VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)})`,
    [1, 'published', new Date('2026-01-01T00:00:00.000Z')]
  );

  const result = await query(
    `SELECT id, status
     FROM ${table}
     WHERE status = ${placeholder(1)}`,
    ['published']
  );

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].status, 'published');
});

test('indexed queries can be explained by the database', async () => {
  await insertRecord({
    id: 10,
    email: 'explain@example.com',
    status: 'active',
  });

  const result = await explainQuery(
    `SELECT id
     FROM ${quoteIdentifier(TABLES.records)}
     WHERE email = ${placeholder(1)}`,
    ['explain@example.com']
  );

  assert.ok(
    Array.isArray(result.rows),
    'EXPLAIN should return a result set.'
  );

  assert.ok(
    result.rows.length > 0,
    'EXPLAIN should return a query plan.'
  );
});

test('index names are unique within the test tables', async () => {
  const indexNames = [
    ...(await getIndexNames(TABLES.records)),
    ...(await getIndexNames(TABLES.unique)),
    ...(await getIndexNames(TABLES.composite)),
  ];

  assert.equal(
    indexNames.length,
    new Set(indexNames).size,
    'Index names should be unique across these test tables.'
  );
});
