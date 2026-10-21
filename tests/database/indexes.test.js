'use strict';
/**
 * MedOrbits -- Database Index Tests
 *
 * File: tests/database/indexes.test.js
 * Framework: Node.js built-in node:test
 *
 * Run:
 *   node --test tests/database/indexes.test.js
 *
 * Required:
 *   NODE_ENV=test
 *   TEST_DATABASE_CLIENT=postgres|mysql
 *
 * PostgreSQL:
 *   TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/medorbits_test
 *
 * MySQL:
 *   TEST_DATABASE_HOST=127.0.0.1
 *   TEST_DATABASE_PORT=3306
 *   TEST_DATABASE_NAME=medorbits_test
 *   TEST_DATABASE_USER=...
 *   TEST_DATABASE_PASSWORD=...
 *
 * Optional:
 *   TEST_DATABASE_SSL=true
 *
 * These tests validate indexes on temporary test tables only.
 * They do not verify the indexes in the actual MedOrbits schema.
 *
 * Use a dedicated test database and a restricted test account.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const CLIENT = (
  process.env.TEST_DATABASE_CLIENT || ''
).trim().toLowerCase();
const IS_PRODUCTION =
  (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const DATABASE_URL = process.env.TEST_DATABASE_URL || '';
function configuredDatabaseName() {
  if (CLIENT === 'postgres') {
    try {
      return decodeURIComponent(
        new URL(DATABASE_URL).pathname.replace(/^\/+/, ''),
      );
    } catch {
      return '';
    }
  }
  if (CLIENT === 'mysql') {
    return (process.env.TEST_DATABASE_NAME || '').trim();
  }
  return '';
}
const DATABASE_NAME = configuredDatabaseName();
const HAS_POSTGRES_CONFIG =
  /^postgres(?:ql)?:\/\//i.test(DATABASE_URL);
const HAS_MYSQL_CONFIG = Boolean(
  process.env.TEST_DATABASE_HOST &&
  process.env.TEST_DATABASE_NAME &&
  process.env.TEST_DATABASE_USER,
);
const CONFIG_ERROR = IS_PRODUCTION
  ? 'Database index tests cannot run in production.'
  : !['postgres', 'mysql'].includes(CLIENT)
    ? 'Set TEST_DATABASE_CLIENT to postgres or mysql.'
    : CLIENT === 'postgres' && !HAS_POSTGRES_CONFIG
      ? 'Set TEST_DATABASE_URL to a PostgreSQL test database.'
      : CLIENT === 'mysql' && !HAS_MYSQL_CONFIG
        ? 'Set TEST_DATABASE_HOST, TEST_DATABASE_NAME, and TEST_DATABASE_USER.'
        : !DATABASE_NAME
          ? 'Could not determine the configured database name.'
          : !/test/i.test(DATABASE_NAME)
            ? 'Database name must contain "test". Use a dedicated test database.'
            : null;
const SUFFIX = randomBytes(6).toString('hex');
const TABLES = Object.freeze({
  users: `mo_idx_users_${SUFFIX}`,
  applications: `mo_idx_apps_${SUFFIX}`,
  payments: `mo_idx_payments_${SUFFIX}`,
});
const INDEXES = Object.freeze({
  userEmail: `mo_idx_user_email_${SUFFIX}`,
  applicationStatus: `mo_idx_app_status_${SUFFIX}`,
  applicationOwnerStatus: `mo_idx_app_owner_status_${SUFFIX}`,
  paymentReference: `mo_idx_payment_ref_${SUFFIX}`,
});
let driver;
let connection = null;
let closeConnection = async () => {};
let setupError = null;
let connected = false;
let createdTables = [];
function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error('Unsafe SQL identifier.');
  }
  return CLIENT === 'mysql'
    ? `\`${identifier}\``
    : `"${identifier}"`;
}
function table(name) {
  if (!Object.prototype.hasOwnProperty.call(TABLES, name)) {
    throw new Error(`Unknown test table: ${name}`);
  }
  return quoteIdentifier(TABLES[name]);
}
function index(name) {
  if (!Object.prototype.hasOwnProperty.call(INDEXES, name)) {
    throw new Error(`Unknown test index: ${name}`);
  }
  return quoteIdentifier(INDEXES[name]);
}
function placeholders(count) {
  return Array.from(
    { length: count },
    (_, index) => CLIENT === 'postgres' ? `$${index + 1}` : '?',
  ).join(', ');
}
async function query(sql, params = []) {
  if (!connection) {
    throw new Error('Database test connection is unavailable.');
  }
  if (CLIENT === 'postgres') {
    return connection.query(sql, params);
  }
  const [rows, fields] = await connection.execute(sql, params);
  return { rows, fields };
}
async function ddl(sql) {
  if (!connection) {
    throw new Error('Database test connection is unavailable.');
  }
  return connection.query(sql);
}
async function acquireConnection() {
  if (CLIENT === 'postgres') {
    const pool = new driver.Pool({
      connectionString: DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
      application_name: 'medorbits-index-tests',
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
        connection: client,
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
  const mysqlConnection = await driver.createConnection({
    host: process.env.TEST_DATABASE_HOST,
    port: Number(process.env.TEST_DATABASE_PORT || 3306),
    database: process.env.TEST_DATABASE_NAME,
    user: process.env.TEST_DATABASE_USER,
    password: process.env.TEST_DATABASE_PASSWORD || '',
    connectTimeout: 5000,
    multipleStatements: false,
  });
  return {
    connection: mysqlConnection,
    close: async () => mysqlConnection.end(),
  };
}
async function verifyDatabaseIdentity() {
  const result = CLIENT === 'postgres'
    ? await query('SELECT current_database() AS database_name')
    : await query('SELECT DATABASE() AS database_name');
  assert.equal(result.rows.length, 1);
  const actualName = result.rows[0].database_name;
  assert.equal(
    actualName,
    DATABASE_NAME,
    'Connected database does not match the configured test database.',
  );
  assert.match(
    actualName,
    /test/i,
    'Refusing to create test tables outside a database whose name contains "test".',
  );
}
async function createTable(name, sql) {
  await ddl(sql);
  createdTables.push(TABLES[name]);
}
async function createTables() {
  const users = table('users');
  const applications = table('applications');
  const payments = table('payments');
  await createTable('users', `
    CREATE TABLE ${users} (
      id INTEGER PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      display_name VARCHAR(120) NOT NULL
    )
  `);
  await createTable('applications', `
    CREATE TABLE ${applications} (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      status VARCHAR(40) NOT NULL,
      created_at TIMESTAMP NOT NULL
    )
  `);
  await createTable('payments', `
    CREATE TABLE ${payments} (
      id INTEGER PRIMARY KEY,
      reference VARCHAR(100) NOT NULL,
      amount_minor INTEGER NOT NULL,
      status VARCHAR(40) NOT NULL
    )
  `);
  await ddl(`
    CREATE UNIQUE INDEX ${index('userEmail')}
    ON ${users} (email)
  `);
  await ddl(`
    CREATE INDEX ${index('applicationStatus')}
    ON ${applications} (status)
  `);
  await ddl(`
    CREATE INDEX ${index('applicationOwnerStatus')}
    ON ${applications} (user_id, status)
  `);
  await ddl(`
    CREATE UNIQUE INDEX ${index('paymentReference')}
    ON ${payments} (reference)
  `);
}
async function cleanup() {
  const errors = [];
  for (const name of [...createdTables].reverse()) {
    try {
      await ddl(`DROP TABLE IF EXISTS ${quoteIdentifier(name)}`);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }
  if (errors.length) {
    throw new Error(`Index test cleanup failed: ${errors.join('; ')}`);
  }
  createdTables = [];
}
function requireReadyConnection() {
  if (CONFIG_ERROR) {
    throw new Error(CONFIG_ERROR);
  }
  if (setupError) {
    throw setupError;
  }
  if (!connected || !connection) {
    throw new Error('Database test connection was not initialized.');
  }
}
async function getIndexes(tableName) {
  if (CLIENT === 'postgres') {
    const result = await query(
      `
        SELECT
          indexname AS index_name,
          indexdef AS index_definition
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = $1
      `,
      [tableName],
    );
    return result.rows.map((row) => ({
      name: row.index_name,
      definition: row.index_definition,
    }));
  }
  const [rows] = await connection.query(
    `SHOW INDEX FROM ${quoteIdentifier(tableName)}`,
  );
  return rows.map((row) => ({
    name: row.Key_name,
    column: row.Column_name,
    nonUnique: Number(row.Non_unique),
    sequence: Number(row.Seq_in_index),
  }));
}
function hasIndex(indexes, name) {
  return indexes.some((item) => item.name === name);
}
function assertUniqueIndex(indexes, name) {
  assert.ok(
    hasIndex(indexes, name),
    `Expected index "${name}" to exist.`,
  );
  if (CLIENT === 'postgres') {
    const found = indexes.find((item) => item.name === name);
    assert.match(
      found.definition,
      /\bUNIQUE INDEX\b/i,
      `Expected "${name}" to be a unique PostgreSQL index.`,
    );
  } else {
    const found = indexes.filter((item) => item.name === name);
    assert.ok(found.length > 0);
    assert.ok(
      found.every((item) => item.nonUnique === 0),
      `Expected "${name}" to be unique.`,
    );
  }
}
async function insertUser(id, email, displayName) {
  return query(
    `INSERT INTO ${table('users')} (id, email, display_name)
     VALUES (${placeholders(3)})`,
    [id, email, displayName],
  );
}
async function insertApplication(id, userId, status, createdAt) {
  return query(
    `INSERT INTO ${table('applications')}
       (id, user_id, status, created_at)
     VALUES (${placeholders(4)})`,
    [id, userId, status, createdAt],
  );
}
async function insertPayment(id, reference, amountMinor, status) {
  return query(
    `INSERT INTO ${table('payments')}
       (id, reference, amount_minor, status)
     VALUES (${placeholders(4)})`,
    [id, reference, amountMinor, status],
  );
}
async function selectByEmail(email) {
  return query(
    `SELECT id, email
     FROM ${table('users')}
     WHERE email = ${CLIENT === 'postgres' ? '$1' : '?'}`,
    [email],
  );
}
async function selectApplicationsByStatus(status) {
  return query(
    `SELECT id
     FROM ${table('applications')}
     WHERE status = ${CLIENT === 'postgres' ? '$1' : '?'}
     ORDER BY id`,
    [status],
  );
}
async function selectApplicationsByOwnerAndStatus(userId, status) {
  return query(
    `SELECT id
     FROM ${table('applications')}
     WHERE user_id = ${CLIENT === 'postgres' ? '$1' : '?'}
       AND status = ${CLIENT === 'postgres' ? '$2' : '?'}
     ORDER BY id`,
    [userId, status],
  );
}
before(async () => {
  if (CONFIG_ERROR) {
    return;
  }
  try {
    driver = CLIENT === 'postgres'
      ? require('pg')
      : require('mysql2/promise');
    const acquired = await acquireConnection();
    connection = acquired.connection;
    closeConnection = acquired.close;
    connected = true;
    await verifyDatabaseIdentity();
    await createTables();
  } catch (error) {
    setupError = error;
    if (connected && connection) {
      try {
        await cleanup();
      } catch (cleanupError) {
        setupError = new AggregateError(
          [error, cleanupError],
          'Database setup failed and temporary-table cleanup also failed.',
        );
      }
    }
    try {
      await closeConnection();
    } catch (closeError) {
      setupError = new AggregateError(
        [setupError, closeError],
        'Database setup failed and connection cleanup also failed.',
      );
    }
    connection = null;
    connected = false;
  }
});
after(async () => {
  if (!connected) {
    return;
  }
  let cleanupError = null;
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }
  try {
    await closeConnection();
  } catch (error) {
    cleanupError = cleanupError
      ? new AggregateError(
          [cleanupError, error],
          'Table cleanup and connection shutdown both failed.',
        )
      : error;
  } finally {
    connection = null;
    connected = false;
  }
  if (cleanupError) {
    throw cleanupError;
  }
});
test(
  'database index test environment initializes',
  { skip: CONFIG_ERROR || false },
  () => {
    requireReadyConnection();
    assert.equal(createdTables.length, 3);
  },
);
test(
  'unique user-email index exists',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const indexes = await getIndexes(TABLES.users);
    assertUniqueIndex(indexes, INDEXES.userEmail);
  },
);
test(
  'application status index exists',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const indexes = await getIndexes(TABLES.applications);
    assert.ok(
      hasIndex(indexes, INDEXES.applicationStatus),
      'Expected the application status index to exist.',
    );
    if (CLIENT === 'mysql') {
      const found = indexes.filter(
        (item) => item.name === INDEXES.applicationStatus,
      );
      assert.deepEqual(
        found.map((item) => item.column),
        ['status'],
      );
    }
  },
);
test(
  'composite application owner-status index has the correct column order',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const indexes = await getIndexes(TABLES.applications);
    assert.ok(
      hasIndex(indexes, INDEXES.applicationOwnerStatus),
      'Expected the composite user_id/status index to exist.',
    );
    if (CLIENT === 'mysql') {
      const composite = indexes
        .filter((item) => item.name === INDEXES.applicationOwnerStatus)
        .sort((a, b) => a.sequence - b.sequence);
      assert.deepEqual(
        composite.map((item) => item.column),
        ['user_id', 'status'],
      );
    } else {
      const found = indexes.find(
        (item) => item.name === INDEXES.applicationOwnerStatus,
      );
      assert.match(
        found.definition,
        /\(user_id,\s*status\)/i,
        'Expected the composite index to begin with user_id and then status.',
      );
    }
  },
);
test(
  'unique payment-reference index exists',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const indexes = await getIndexes(TABLES.payments);
    assertUniqueIndex(indexes, INDEXES.paymentReference);
  },
);
test(
  'email index supports correct parameterized lookup results',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    await insertUser(1, 'indexed.user@example.test', 'Indexed User');
    await insertUser(2, 'other.user@example.test', 'Other User');
    const result = await selectByEmail('indexed.user@example.test');
    assert.equal(result.rows.length, 1);
    assert.equal(Number(result.rows[0].id), 1);
    assert.equal(result.rows[0].email, 'indexed.user@example.test');
  },
);
test(
  'unique email index rejects duplicate email values',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    await insertUser(10, 'unique.user@example.test', 'First User');
    await assert.rejects(
      insertUser(11, 'unique.user@example.test', 'Duplicate User'),
      (error) => CLIENT === 'postgres'
        ? error.code === '23505'
        : error.code === 'ER_DUP_ENTRY',
    );
  },
);
test(
  'unique payment-reference index rejects duplicates',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    await insertPayment(
      1,
      'payment-reference-001',
      15000,
      'pending',
    );
    await assert.rejects(
      insertPayment(
        2,
        'payment-reference-001',
        15000,
        'pending',
      ),
      (error) => CLIENT === 'postgres'
        ? error.code === '23505'
        : error.code === 'ER_DUP_ENTRY',
    );
  },
);
test(
  'application status lookup returns only matching records',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const timestamp = '2026-01-01 10:00:00';
    await insertApplication(1, 101, 'pending', timestamp);
    await insertApplication(2, 102, 'approved', timestamp);
    await insertApplication(3, 103, 'pending', timestamp);
    const result = await selectApplicationsByStatus('pending');
    assert.deepEqual(
      result.rows.map((row) => Number(row.id)),
      [1, 3],
    );
  },
);
test(
  'composite index lookup filters by both owner and status',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const timestamp = '2026-01-01 10:00:00';
    await insertApplication(11, 501, 'pending', timestamp);
    await insertApplication(12, 501, 'approved', timestamp);
    await insertApplication(13, 502, 'pending', timestamp);
    const result = await selectApplicationsByOwnerAndStatus(
      501,
      'pending',
    );
    assert.deepEqual(
      result.rows.map((row) => Number(row.id)),
      [11],
    );
  },
);
test(
  'parameterized email lookup treats SQL-like input as a value',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const email = "test' OR '1'='1";
    await insertUser(20, email, 'Parameterized Query Test');
    const result = await selectByEmail(email);
    assert.equal(result.rows.length, 1);
    assert.equal(Number(result.rows[0].id), 20);
    assert.equal(result.rows[0].email, email);
  },
);