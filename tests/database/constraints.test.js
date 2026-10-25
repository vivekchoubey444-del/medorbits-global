
'use strict';

/**
 * MedOrbits -- Database Constraint Tests
 *
 * File: tests/database/constraints.test.js
 * Requires: Node.js >= 20
 * Runner: node:test
 *
 * PostgreSQL:
 *   NODE_ENV=test \
 *   TEST_DATABASE_CLIENT=postgres \
 *   TEST_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/medorbits_test' \
 *   node --test tests/database/constraints.test.js
 *
 * MySQL:
 *   NODE_ENV=test \
 *   TEST_DATABASE_CLIENT=mysql \
 *   TEST_DATABASE_HOST=127.0.0.1 \
 *   TEST_DATABASE_PORT=3306 \
 *   TEST_DATABASE_NAME=medorbits_test \
 *   TEST_DATABASE_USER=test_user \
 *   TEST_DATABASE_PASSWORD='test_password' \
 *   node --test tests/database/constraints.test.js
 *
 * Optional:
 *   TEST_DATABASE_SSL=true
 *
 * Safety:
 * - Refuses production execution.
 * - Requires a dedicated test-named database.
 * - Verifies the actual connected database.
 * - Creates only uniquely named test tables.
 * - Attempts cleanup after setup and test failures.
 *
 * Use a dedicated test database and a restricted database account.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');

const CLIENT = String(
  process.env.TEST_DATABASE_CLIENT || '',
).trim().toLowerCase();

const DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const SSL_ENABLED = process.env.TEST_DATABASE_SSL === 'true';

const MYSQL_CONFIG = {
  host: process.env.TEST_DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.TEST_DATABASE_PORT || 3306),
  database: process.env.TEST_DATABASE_NAME || '',
  user: process.env.TEST_DATABASE_USER || '',
  password: process.env.TEST_DATABASE_PASSWORD || '',
  connectTimeout: 5000,
  multipleStatements: false,
  ...(SSL_ENABLED
    ? {
        ssl: {
          rejectUnauthorized: true,
        },
      }
    : {}),
};

const DATABASE_NAME_PATTERN = /(^|[-_])test($|[-_])/i;
const SUFFIX = randomBytes(6).toString('hex');

const TABLES = Object.freeze({
  parent: `mo_constraint_parent_${SUFFIX}`,
  child: `mo_constraint_child_${SUFFIX}`,
  unique: `mo_constraint_unique_${SUFFIX}`,
  checks: `mo_constraint_checks_${SUFFIX}`,
  notNull: `mo_constraint_not_null_${SUFFIX}`,
});

let driver = null;
let connection = null;
let closeConnection = async () => {};
let createdTables = [];
let setupError = null;
let connected = false;

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
  assert.notEqual(
    String(process.env.NODE_ENV || '').trim().toLowerCase(),
    'production',
    'Database constraint tests cannot run in production.',
  );

  assert.ok(
    ['postgres', 'mysql'].includes(CLIENT),
    'Set TEST_DATABASE_CLIENT to postgres or mysql.',
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
    DATABASE_NAME_PATTERN,
    'Use a dedicated test database such as medorbits_test.',
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

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
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

function parameter(index) {
  return CLIENT === 'postgres' ? `$${index}` : '?';
}

async function acquireConnection() {
  if (CLIENT === 'postgres') {
    try {
      driver = require('pg');
    } catch {
      throw new Error(
        'PostgreSQL driver missing. Run: npm install pg',
      );
    }

    const pool = new driver.Pool({
      connectionString: DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
      application_name: 'medorbits-constraint-tests',
      ...(SSL_ENABLED
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

  try {
    driver = require('mysql2/promise');
  } catch {
    throw new Error(
      'MySQL driver missing. Run: npm install mysql2',
    );
  }

  const mysqlConnection = await driver.createConnection(
    MYSQL_CONFIG,
  );

  return {
    connection: mysqlConnection,
    close: () => mysqlConnection.end(),
  };
}

async function execute(sql, params = []) {
  if (!connection) {
    throw new Error(
      'Database constraint test connection is unavailable.',
    );
  }

  if (CLIENT === 'postgres') {
    return connection.query(sql, params);
  }

  const [rows, fields] = await connection.execute(sql, params);

  return { rows, fields };
}

async function executeDDL(sql) {
  if (!connection) {
    throw new Error(
      'Database constraint test connection is unavailable.',
    );
  }

  // DDL can implicitly commit in MySQL. This suite uses only
  // uniquely named test tables, never existing application tables.
  return connection.query(sql);
}

async function verifyDatabaseIdentity() {
  const result = CLIENT === 'postgres'
    ? await execute(
        'SELECT current_database() AS database_name',
      )
    : await execute(
        'SELECT DATABASE() AS database_name',
      );

  const actualName = result.rows[0]?.database_name;

  assert.equal(
    actualName,
    configuredDatabaseName(),
    'Connected database does not match the configured test database.',
  );

  assert.match(
    actualName || '',
    DATABASE_NAME_PATTERN,
    'Connected database must be explicitly identifiable as a test database.',
  );
}

async function createTable(name, sql) {
  await executeDDL(sql);

  // Record successful creation immediately so later setup failures
  // can clean up previously created tables.
  createdTables.push(TABLES[name]);
}

async function createTables() {
  const parent = tableName('parent');
  const child = tableName('child');
  const unique = tableName('unique');
  const checks = tableName('checks');
  const notNull = tableName('notNull');

  await createTable(
    'parent',
    `
      CREATE TABLE ${parent} (
        id INTEGER PRIMARY KEY
      )
    `,
  );

  await createTable(
    'child',
    `
      CREATE TABLE ${child} (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER NOT NULL,
        CONSTRAINT mo_fk_${SUFFIX}
          FOREIGN KEY (parent_id)
          REFERENCES ${parent}(id)
      )
    `,
  );

  await createTable(
    'unique',
    `
      CREATE TABLE ${unique} (
        id INTEGER PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        CONSTRAINT mo_unique_${SUFFIX}
          UNIQUE (email)
      )
    `,
  );

  await createTable(
    'checks',
    `
      CREATE TABLE ${checks} (
        id INTEGER PRIMARY KEY,
        amount DECIMAL(12, 2) NOT NULL,
        CONSTRAINT mo_check_${SUFFIX}
          CHECK (amount >= 0)
      )
    `,
  );

  await createTable(
    'notNull',
    `
      CREATE TABLE ${notNull} (
        id INTEGER PRIMARY KEY,
        required_value VARCHAR(100) NOT NULL
      )
    `,
  );
}

async function cleanupTables() {
  const errors = [];

  for (const name of [...createdTables].reverse()) {
    try {
      await executeDDL(
        `DROP TABLE IF EXISTS ${quoteIdentifier(name)}`,
      );

      createdTables = createdTables.filter(
        (createdName) => createdName !== name,
      );
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Failed to clean up test tables: ${errors.join('; ')}`,
    );
  }
}

async function closeDatabase() {
  const close = closeConnection;
  closeConnection = async () => {};
  await close();
}

function requireReadyConnection() {
  if (setupError) {
    throw setupError;
  }

  if (!connected || !connection) {
    throw new Error(
      'Database constraint test connection was not initialized.',
    );
  }

  assert.equal(
    createdTables.length,
    Object.keys(TABLES).length,
    'Not all temporary constraint tables were created.',
  );
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
  assert.equal(
    error.code,
    CLIENT === 'postgres' ? '23505' : 'ER_DUP_ENTRY',
  );
}

function assertUniqueViolation(error) {
  assert.equal(
    error.code,
    CLIENT === 'postgres' ? '23505' : 'ER_DUP_ENTRY',
  );
}

function assertForeignKeyViolation(error) {
  if (CLIENT === 'postgres') {
    assert.equal(error.code, '23503');
    return;
  }

  assert.ok(
    [
      'ER_NO_REFERENCED_ROW_2',
      'ER_NO_REFERENCED_ROW',
    ].includes(error.code),
    `Expected a MySQL foreign-key violation; received ${error.code}.`,
  );
}

function assertNotNullViolation(error) {
  assert.equal(
    error.code,
    CLIENT === 'postgres' ? '23502' : 'ER_BAD_NULL_ERROR',
  );
}

function assertCheckViolation(error) {
  if (CLIENT === 'postgres') {
    assert.equal(error.code, '23514');
    return;
  }

  assert.ok(
    error.code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
      error.errno === 3819,
    `Expected a MySQL CHECK constraint violation; received ${error.code}.`,
  );
}

before(async () => {
  try {
    assertTestDatabaseConfiguration();

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
        await cleanupTables();
      } catch (cleanupError) {
        setupError = new AggregateError(
          [setupError, cleanupError],
          'Database setup and temporary-table cleanup failed.',
        );
      }
    }

    try {
      await closeDatabase();
    } catch (closeError) {
      setupError = new AggregateError(
        [setupError, closeError],
        'Database setup and connection cleanup failed.',
      );
    } finally {
      connection = null;
      connected = false;
    }

    throw setupError;
  }
});

after(async () => {
  let cleanupError = null;

  try {
    if (connected && connection) {
      await cleanupTables();
    }
  } catch (error) {
    cleanupError = error;
  }

  try {
    await closeDatabase();
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

test('test database connection and temporary tables initialize', () => {
  requireReadyConnection();

  assert.equal(connected, true);
  assert.equal(createdTables.length, 5);
});

test('primary key constraint rejects duplicate identifiers', async () => {
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
});

test('unique constraint rejects duplicate email values', async () => {
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
});

test('foreign key constraint rejects a missing parent', async () => {
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
});

test('foreign key constraint accepts an existing parent', async () => {
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
    `SELECT id FROM ${child} WHERE id = ${parameter(1)}`,
    [202],
  );

  assert.equal(result.rows.length, 1);
  assert.equal(Number(result.rows[0].id), 202);
});

test('NOT NULL constraint rejects null values', async () => {
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
});

test('CHECK constraint rejects negative amounts', async () => {
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
});

test('CHECK constraint accepts a zero amount', async () => {
  requireReadyConnection();

  const table = tableName('checks');

  await execute(
    `INSERT INTO ${table} (id, amount) VALUES (${placeholders(2)})`,
    [2, 0],
  );

  const result = await execute(
    `SELECT amount FROM ${table} WHERE id = ${parameter(1)}`,
    [2],
  );

  assert.equal(result.rows.length, 1);
  assert.equal(Number(result.rows[0].amount), 0);
});
