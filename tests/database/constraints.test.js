'use strict';
/**
 * MedOrbits -- Database Constraint Tests
 *
 * File: tests/database/constraints.test.js
 * Framework: Node.js built-in node:test
 *
 * Run:
 *   node --test tests/database/constraints.test.js
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
 * Safety:
 * - Refuses production execution.
 * - Requires explicit test-database configuration.
 * - Requires the configured database name to contain "test".
 * - Creates uniquely named temporary tables only.
 * - Attempts cleanup after setup or test failures.
 *
 * IMPORTANT:
 * Use a dedicated test database and a restricted database account.
 * The database-name check is only a guard, not proof of isolation.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const CLIENT = (
  process.env.TEST_DATABASE_CLIENT || ''
).trim().toLowerCase();
const IS_PRODUCTION =
  (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const VALID_CLIENTS = ['postgres', 'mysql'];
const DATABASE_URL = process.env.TEST_DATABASE_URL || '';
function getDatabaseName() {
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
const DATABASE_NAME = getDatabaseName();
const HAS_POSTGRES_CONFIG =
  /^postgres(?:ql)?:\/\//i.test(DATABASE_URL);
const HAS_MYSQL_CONFIG = Boolean(
  process.env.TEST_DATABASE_HOST &&
  process.env.TEST_DATABASE_NAME &&
  process.env.TEST_DATABASE_USER,
);
const CONFIG_ERROR = IS_PRODUCTION
  ? 'Database constraint tests cannot run in production.'
  : !VALID_CLIENTS.includes(CLIENT)
    ? 'Set TEST_DATABASE_CLIENT to postgres or mysql.'
    : CLIENT === 'postgres' && !HAS_POSTGRES_CONFIG
      ? 'Set TEST_DATABASE_URL to a PostgreSQL test database.'
      : CLIENT === 'mysql' && !HAS_MYSQL_CONFIG
        ? 'Set TEST_DATABASE_HOST, TEST_DATABASE_NAME, and TEST_DATABASE_USER.'
        : !DATABASE_NAME
          ? 'Could not determine the configured test database name.'
          : !/test/i.test(DATABASE_NAME)
            ? 'The database name must contain "test". Use a dedicated test database.'
            : null;
const SUFFIX = randomBytes(6).toString('hex');
const TABLES = Object.freeze({
  parent: `mo_constraint_parent_${SUFFIX}`,
  child: `mo_constraint_child_${SUFFIX}`,
  unique: `mo_constraint_unique_${SUFFIX}`,
  checks: `mo_constraint_checks_${SUFFIX}`,
  notNull: `mo_constraint_not_null_${SUFFIX}`,
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
function tableName(name) {
  if (!Object.prototype.hasOwnProperty.call(TABLES, name)) {
    throw new Error(`Unknown constraint test table: ${name}`);
  }
  return quoteIdentifier(TABLES[name]);
}
function placeholders(count) {
  return Array.from(
    { length: count },
    (_, index) => CLIENT === 'postgres'
      ? `$${index + 1}`
      : '?',
  ).join(', ');
}
async function execute(sql, params = []) {
  if (!connection) {
    throw new Error('Database test connection is unavailable.');
  }
  if (CLIENT === 'postgres') {
    return connection.query(sql, params);
  }
  const [rows, fields] = await connection.execute(sql, params);
  return { rows, fields };
}
async function executeDDL(sql) {
  if (!connection) {
    throw new Error('Database test connection is unavailable.');
  }
  if (CLIENT === 'postgres') {
    return connection.query(sql);
  }
  return connection.query(sql);
}
async function acquireConnection() {
  if (CLIENT === 'postgres') {
    const pool = new driver.Pool({
      connectionString: DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
      application_name: 'medorbits-constraint-tests',
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
async function createTable(name, sql) {
  await executeDDL(sql);
  createdTables.push(TABLES[name]);
}
async function createTables() {
  const parent = tableName('parent');
  const child = tableName('child');
  const unique = tableName('unique');
  const checks = tableName('checks');
  const notNull = tableName('notNull');
  await createTable('parent', `
    CREATE TABLE ${parent} (
      id INTEGER PRIMARY KEY
    )
  `);
  await createTable('child', `
    CREATE TABLE ${child} (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER NOT NULL,
      CONSTRAINT mo_fk_${SUFFIX}
        FOREIGN KEY (parent_id)
        REFERENCES ${parent}(id)
    )
  `);
  await createTable('unique', `
    CREATE TABLE ${unique} (
      id INTEGER PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      CONSTRAINT mo_unique_${SUFFIX} UNIQUE (email)
    )
  `);
  await createTable('checks', `
    CREATE TABLE ${checks} (
      id INTEGER PRIMARY KEY,
      amount DECIMAL(12, 2) NOT NULL,
      CONSTRAINT mo_check_${SUFFIX} CHECK (amount >= 0)
    )
  `);
  await createTable('notNull', `
    CREATE TABLE ${notNull} (
      id INTEGER PRIMARY KEY,
      required_value VARCHAR(100) NOT NULL
    )
  `);
}
async function cleanupTables() {
  const cleanupErrors = [];
  for (const name of [...createdTables].reverse()) {
    try {
      await executeDDL(
        `DROP TABLE IF EXISTS ${quoteIdentifier(name)}`,
      );
    } catch (error) {
      cleanupErrors.push({
        table: name,
        message: error.message,
      });
    }
  }
  if (cleanupErrors.length > 0) {
    throw new Error(
      `Failed to clean up constraint test tables: ${
        cleanupErrors
          .map((item) => `${item.table}: ${item.message}`)
          .join('; ')
      }`,
    );
  }
  createdTables = [];
}
async function assertConstraintRejects(operation, label) {
  let caughtError;
  try {
    await operation();
  } catch (error) {
    caughtError = error;
  }
  assert.ok(
    caughtError,
    `${label}: expected the database to reject invalid data.`,
  );
  return caughtError;
}
function assertPrimaryKeyViolation(error) {
  if (CLIENT === 'postgres') {
    assert.equal(error.code, '23505');
  } else {
    assert.equal(error.code, 'ER_DUP_ENTRY');
  }
}
function assertForeignKeyViolation(error) {
  if (CLIENT === 'postgres') {
    assert.equal(error.code, '23503');
  } else {
    assert.ok(
      error.code === 'ER_NO_REFERENCED_ROW_2' ||
      error.code === 'ER_NO_REFERENCED_ROW',
      `Expected a MySQL foreign-key violation; received ${error.code}.`,
    );
  }
}
function assertNotNullViolation(error) {
  if (CLIENT === 'postgres') {
    assert.equal(error.code, '23502');
  } else {
    assert.equal(error.code, 'ER_BAD_NULL_ERROR');
  }
}
function assertCheckViolation(error) {
  if (CLIENT === 'postgres') {
    assert.equal(error.code, '23514');
  } else {
    assert.ok(
      error.code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
      error.errno === 3819,
      `Expected a MySQL CHECK constraint violation; received ${error.code}.`,
    );
  }
}
function assertUniqueViolation(error) {
  if (CLIENT === 'postgres') {
    assert.equal(error.code, '23505');
  } else {
    assert.equal(error.code, 'ER_DUP_ENTRY');
  }
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
before(async () => {
  if (CONFIG_ERROR) {
    return;
  }
  try {
    if (CLIENT === 'postgres') {
      driver = require('pg');
    } else {
      driver = require('mysql2/promise');
    }
    const acquired = await acquireConnection();
    connection = acquired.connection;
    closeConnection = acquired.close;
    connected = true;
    await createTables();
  } catch (error) {
    setupError = error;
    if (connected && connection) {
      try {
        await cleanupTables();
      } catch (cleanupError) {
        setupError = new AggregateError(
          [error, cleanupError],
          'Database setup failed and temporary-table cleanup also failed.',
        );
      }
    }
    if (closeConnection) {
      try {
        await closeConnection();
      } catch (closeError) {
        setupError = new AggregateError(
          [setupError, closeError],
          'Database setup failed and connection cleanup also failed.',
        );
      }
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
    await cleanupTables();
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
  'test database connection and temporary tables are initialized',
  { skip: CONFIG_ERROR || false },
  () => {
    if (setupError) {
      throw setupError;
    }
    assert.equal(connected, true);
    assert.ok(connection);
    assert.equal(createdTables.length, 5);
  },
);
test(
  'primary key constraint rejects duplicate identifiers',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const table = tableName('parent');
    const values = placeholders(1);
    await execute(
      `INSERT INTO ${table} (id) VALUES (${values})`,
      [101],
    );
    const error = await assertConstraintRejects(
      () => execute(
        `INSERT INTO ${table} (id) VALUES (${values})`,
        [101],
      ),
      'Duplicate primary key',
    );
    assertPrimaryKeyViolation(error);
  },
);
test(
  'unique constraint rejects duplicate email values',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const table = tableName('unique');
    const values = placeholders(2);
    await execute(
      `INSERT INTO ${table} (id, email) VALUES (${values})`,
      [1, 'duplicate@example.test'],
    );
    const error = await assertConstraintRejects(
      () => execute(
        `INSERT INTO ${table} (id, email) VALUES (${values})`,
        [2, 'duplicate@example.test'],
      ),
      'Duplicate unique value',
    );
    assertUniqueViolation(error);
  },
);
test(
  'foreign key constraint rejects a missing parent',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const child = tableName('child');
    const error = await assertConstraintRejects(
      () => execute(
        `INSERT INTO ${child} (id, parent_id) VALUES (${placeholders(2)})`,
        [1, 999999],
      ),
      'Foreign key referencing nonexistent parent',
    );
    assertForeignKeyViolation(error);
  },
);
test(
  'foreign key constraint accepts an existing parent',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const parent = tableName('parent');
    const child = tableName('child');
    await execute(
      `INSERT INTO ${parent} (id) VALUES (${placeholders(1)})`,
      [202],
    );
    await execute(
      `INSERT INTO ${child} (id, parent_id) VALUES (${placeholders(2)})`,
      [202, 202],
    );
    const result = await execute(
      `SELECT id FROM ${child} WHERE id = ${
        CLIENT === 'postgres' ? '$1' : '?'
      }`,
      [202],
    );
    assert.equal(result.rows.length, 1);
    assert.equal(Number(result.rows[0].id), 202);
  },
);
test(
  'NOT NULL constraint rejects null values',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const table = tableName('notNull');
    const error = await assertConstraintRejects(
      () => execute(
        `INSERT INTO ${table} (id, required_value) VALUES (${placeholders(2)})`,
        [1, null],
      ),
      'NULL in required field',
    );
    assertNotNullViolation(error);
  },
);
test(
  'CHECK constraint rejects negative amounts',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const table = tableName('checks');
    const error = await assertConstraintRejects(
      () => execute(
        `INSERT INTO ${table} (id, amount) VALUES (${placeholders(2)})`,
        [1, -1],
      ),
      'Negative amount',
    );
    assertCheckViolation(error);
  },
);
test(
  'CHECK constraint accepts a zero amount',
  { skip: CONFIG_ERROR || false },
  async () => {
    requireReadyConnection();
    const table = tableName('checks');
    await execute(
      `INSERT INTO ${table} (id, amount) VALUES (${placeholders(2)})`,
      [2, 0],
    );
    const result = await execute(
      `SELECT amount FROM ${table} WHERE id = ${
        CLIENT === 'postgres' ? '$1' : '?'
      }`,
      [2],
    );
    assert.equal(result.rows.length, 1);
    assert.equal(Number(result.rows[0].amount), 0);
  },
);