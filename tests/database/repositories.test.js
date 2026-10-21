'use strict';
/**
 * File: tests/database/repositories.test.js
 *
 * Tests repository-style CRUD behavior using an isolated temporary table.
 *
 * Requires:
 *   Node.js >= 20
 *   PostgreSQL driver: pg
 *   MySQL driver: mysql2
 *
 * Environment:
 *   NODE_ENV=test
 *   TEST_DATABASE_CLIENT=postgres|mysql
 *   TEST_DATABASE_URL=postgresql://... (PostgreSQL)
 *   TEST_DATABASE_HOST=127.0.0.1 (MySQL)
 *   TEST_DATABASE_PORT=3306 (MySQL)
 *   TEST_DATABASE_NAME=medorbits_test (MySQL)
 *   TEST_DATABASE_USER=...
 *   TEST_DATABASE_PASSWORD=...
 *
 * These are example repository functions. They do not exercise the actual
 * MedOrbits repository classes unless explicitly integrated with those exports.
 *
 * Safety:
 * - Refuses production execution.
 * - Requires the configured database name to contain "test".
 * - Creates and drops one uniquely named temporary table.
 * - Does not alter existing application tables.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const CLIENT = String(
  process.env.TEST_DATABASE_CLIENT || '',
).trim().toLowerCase();
const DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const MYSQL_CONFIG = {
  host: process.env.TEST_DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.TEST_DATABASE_PORT || 3306),
  database: process.env.TEST_DATABASE_NAME || '',
  user: process.env.TEST_DATABASE_USER || '',
  password: process.env.TEST_DATABASE_PASSWORD || '',
  connectTimeout: 5000,
  multipleStatements: false,
};
const TABLE_SUFFIX = randomUUID().replace(/-/g, '').slice(0, 16);
const TABLE_NAME = `test_repository_${TABLE_SUFFIX}`;
let db = null;
let tableCreated = false;
let setupError = null;
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
      return decodeURIComponent(
        new URL(DATABASE_URL).pathname.replace(/^\/+/, ''),
      );
    } catch {
      return '';
    }
  }
  if (CLIENT === 'mysql') {
    return MYSQL_CONFIG.database;
  }
  return '';
}
function assertTestDatabaseConfiguration() {
  assert.notEqual(
    String(process.env.NODE_ENV || '').trim().toLowerCase(),
    'production',
    'Refusing to run repository tests with NODE_ENV=production.',
  );
  assert.ok(
    ['postgres', 'mysql'].includes(CLIENT),
    'Set TEST_DATABASE_CLIENT to "postgres" or "mysql".',
  );
  const databaseName = configuredDatabaseName();
  assert.ok(
    databaseName,
    CLIENT === 'postgres'
      ? 'TEST_DATABASE_URL must contain a database name.'
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
        'PostgreSQL driver missing. Run: npm install pg',
      );
    }
    const pool = new pg.Pool({
      connectionString: DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
      application_name: 'medorbits-repository-tests',
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
        'MySQL driver missing. Run: npm install mysql2',
      );
    }
    const connection = await mysql.createConnection(MYSQL_CONFIG);
    return {
      query: (sql, params = []) => connection.execute(sql, params),
      close: () => connection.end(),
    };
  }
  throw new Error(`Unsupported database client: ${CLIENT}`);
}
async function execute(sql, params = []) {
  if (!db) {
    throw new Error('Repository test database connection is unavailable.');
  }
  return db.query(sql, params);
}
async function rows(sql, params = []) {
  const result = await execute(sql, params);
  return CLIENT === 'postgres' ? result.rows : result[0];
}
async function verifyDatabaseIdentity() {
  const result = CLIENT === 'postgres'
    ? await rows('SELECT current_database() AS database_name')
    : await rows('SELECT DATABASE() AS database_name');
  assert.equal(result.length, 1);
  assert.equal(
    result[0].database_name,
    configuredDatabaseName(),
    'Connected database does not match the configured test database.',
  );
  assert.match(
    result[0].database_name,
    /test/i,
    'Refusing to create test tables outside a test-named database.',
  );
}
async function createTestTable() {
  const table = quoteIdentifier(TABLE_NAME);
  if (CLIENT === 'postgres') {
    await execute(`
      CREATE TABLE ${table} (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email VARCHAR(254) NOT NULL UNIQUE,
        display_name VARCHAR(120) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    await execute(`
      CREATE TABLE ${table} (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(254) NOT NULL UNIQUE,
        display_name VARCHAR(120) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }
  tableCreated = true;
}
function placeholders(count) {
  return Array.from(
    { length: count },
    (_, index) => CLIENT === 'postgres' ? `$${index + 1}` : '?',
  ).join(', ');
}
function parameter(index) {
  return CLIENT === 'postgres' ? `$${index}` : '?';
}
/**
 * Example repository functions.
 *
 * Replace these with imports from the real MedOrbits repositories when
 * testing application-level repository implementations.
 */
const repository = {
  async create({
    email,
    displayName,
    status = 'active',
  }) {
    const table = quoteIdentifier(TABLE_NAME);
    if (CLIENT === 'postgres') {
      const result = await execute(
        `INSERT INTO ${table} (email, display_name, status)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name, status, created_at, updated_at`,
        [email, displayName, status],
      );
      return result.rows[0];
    }
    const result = await execute(
      `INSERT INTO ${table} (email, display_name, status)
       VALUES (?, ?, ?)`,
      [email, displayName, status],
    );
    return this.findById(result[0].insertId);
  },
  async findById(id) {
    const table = quoteIdentifier(TABLE_NAME);
    const result = await rows(
      `SELECT id, email, display_name, status, created_at, updated_at
       FROM ${table}
       WHERE id = ${parameter(1)}`,
      [id],
    );
    return result[0] || null;
  },
  async findByEmail(email) {
    const table = quoteIdentifier(TABLE_NAME);
    const result = await rows(
      `SELECT id, email, display_name, status, created_at, updated_at
       FROM ${table}
       WHERE email = ${parameter(1)}`,
      [email],
    );
    return result[0] || null;
  },
  async list({ limit = 20, offset = 0 } = {}) {
    assert.ok(
      Number.isInteger(limit) && limit >= 1 && limit <= 100,
      'limit must be an integer between 1 and 100.',
    );
    assert.ok(
      Number.isInteger(offset) && offset >= 0,
      'offset must be a nonnegative integer.',
    );
    const table = quoteIdentifier(TABLE_NAME);
    return rows(
      `SELECT id, email, display_name, status, created_at, updated_at
       FROM ${table}
       ORDER BY id ASC
       LIMIT ${parameter(1)} OFFSET ${parameter(2)}`,
      [limit, offset],
    );
  },
  async update(id, { displayName, status }) {
    assert.equal(typeof displayName, 'string');
    assert.equal(typeof status, 'string');
    const table = quoteIdentifier(TABLE_NAME);
    if (CLIENT === 'postgres') {
      const result = await execute(
        `UPDATE ${table}
         SET display_name = $1,
             status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, email, display_name, status, created_at, updated_at`,
        [displayName, status, id],
      );
      return result.rows[0] || null;
    }
    const result = await execute(
      `UPDATE ${table}
       SET display_name = ?, status = ?
       WHERE id = ?`,
      [displayName, status, id],
    );
    if (result[0].affectedRows === 0) {
      return null;
    }
    return this.findById(id);
  },
  async delete(id) {
    const table = quoteIdentifier(TABLE_NAME);
    const result = await execute(
      `DELETE FROM ${table} WHERE id = ${parameter(1)}`,
      [id],
    );
    return CLIENT === 'postgres'
      ? result.rowCount === 1
      : result[0].affectedRows === 1;
  },
};
async function tableExistsForTest() {
  if (CLIENT === 'postgres') {
    const result = await rows(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = $1`,
      [TABLE_NAME],
    );
    return result.length === 1;
  }
  const result = await rows(
    `SELECT TABLE_NAME AS table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [TABLE_NAME],
  );
  return result.length === 1;
}
function requireReadyConnection() {
  if (setupError) {
    throw setupError;
  }
  if (!db || !tableCreated) {
    throw new Error('Repository test database is not initialized.');
  }
}
describe('Database repository behavior', () => {
  before(async () => {
    try {
      assertTestDatabaseConfiguration();
      db = await connectDatabase();
      await verifyDatabaseIdentity();
      await createTestTable();
    } catch (error) {
      setupError = error;
      if (db) {
        try {
          await db.close();
        } catch (closeError) {
          setupError = new AggregateError(
            [error, closeError],
            'Repository test setup and connection cleanup failed.',
          );
        } finally {
          db = null;
        }
      }
    }
  });
  after(async () => {
    if (!db) {
      return;
    }
    const current = db;
    let cleanupError = null;
    try {
      if (tableCreated) {
        await current.query(
          `DROP TABLE IF EXISTS ${quoteIdentifier(TABLE_NAME)}`,
        );
        tableCreated = false;
      }
    } catch (error) {
      cleanupError = error;
    }
    try {
      await current.close();
    } catch (error) {
      cleanupError = cleanupError
        ? new AggregateError(
            [cleanupError, error],
            'Temporary-table cleanup and connection shutdown failed.',
          )
        : error;
    } finally {
      db = null;
    }
    if (cleanupError) {
      throw cleanupError;
    }
  });
  test('test database and isolated table initialize', () => {
    requireReadyConnection();
    assert.equal(tableCreated, true);
  });
  test('creates and returns a record', async () => {
    requireReadyConnection();
    const email = `create-${randomUUID()}@example.test`;
    const created = await repository.create({
      email,
      displayName: 'Test Candidate',
    });
    assert.ok(created.id !== null && created.id !== undefined);
    assert.equal(created.email, email);
    assert.equal(created.display_name, 'Test Candidate');
    assert.equal(created.status, 'active');
    assert.ok(created.created_at);
  });
  test('finds a record by ID', async () => {
    requireReadyConnection();
    const email = `find-id-${randomUUID()}@example.test`;
    const created = await repository.create({
      email,
      displayName: 'Find By ID',
    });
    const found = await repository.findById(created.id);
    assert.ok(found);
    assert.equal(String(found.id), String(created.id));
    assert.equal(found.email, email);
  });
  test('finds a record by a unique field', async () => {
    requireReadyConnection();
    const email = `find-email-${randomUUID()}@example.test`;
    await repository.create({
      email,
      displayName: 'Find By Email',
    });
    const found = await repository.findByEmail(email);
    assert.ok(found);
    assert.equal(found.email, email);
  });
  test('returns null for a missing record', async () => {
    requireReadyConnection();
    const found = await repository.findByEmail(
      `missing-${randomUUID()}@example.test`,
    );
    assert.equal(found, null);
  });
  test('lists only records belonging to the requested page', async () => {
    requireReadyConnection();
    const marker = randomUUID();
    const first = await repository.create({
      email: `page-a-${marker}@example.test`,
      displayName: 'Page A',
    });
    const second = await repository.create({
      email: `page-b-${marker}@example.test`,
      displayName: 'Page B',
    });
    const third = await repository.create({
      email: `page-c-${marker}@example.test`,
      displayName: 'Page C',
    });
    const ids = [first.id, second.id, third.id].map(String);
    const result = await rows(
      `SELECT id
       FROM ${quoteIdentifier(TABLE_NAME)}
       WHERE email IN (${placeholders(3)})
       ORDER BY id ASC`,
      [
        `page-a-${marker}@example.test`,
        `page-b-${marker}@example.test`,
        `page-c-${marker}@example.test`,
      ],
    );
    assert.deepEqual(result.map((row) => String(row.id)), ids);
    // The isolated table has other test records, so use a separate,
    // uniquely identifiable subset to validate page boundaries.
    const firstPage = await rows(
      `SELECT id
       FROM ${quoteIdentifier(TABLE_NAME)}
       WHERE email LIKE ${parameter(1)}
       ORDER BY id ASC
       LIMIT ${parameter(2)} OFFSET ${parameter(3)}`,
      [`page-%-${marker}@example.test`, 2, 0],
    );
    const secondPage = await rows(
      `SELECT id
       FROM ${quoteIdentifier(TABLE_NAME)}
       WHERE email LIKE ${parameter(1)}
       ORDER BY id ASC
       LIMIT ${parameter(2)} OFFSET ${parameter(3)}`,
      [`page-%-${marker}@example.test`, 2, 2],
    );
    assert.deepEqual(
      firstPage.map((row) => String(row.id)),
      [String(first.id), String(second.id)],
    );
    assert.deepEqual(
      secondPage.map((row) => String(row.id)),
      [String(third.id)],
    );
  });
  test('list validates pagination parameters', async () => {
    requireReadyConnection();
    await assert.rejects(
      () => repository.list({ limit: 0 }),
      /limit must be an integer/,
    );
    await assert.rejects(
      () => repository.list({ limit: 101 }),
      /limit must be an integer/,
    );
    await assert.rejects(
      () => repository.list({ offset: -1 }),
      /offset must be a nonnegative integer/,
    );
  });
  test('updates an existing record', async () => {
    requireReadyConnection();
    const created = await repository.create({
      email: `update-${randomUUID()}@example.test`,
      displayName: 'Before Update',
    });
    const updated = await repository.update(created.id, {
      displayName: 'After Update',
      status: 'inactive',
    });
    assert.ok(updated);
    assert.equal(updated.display_name, 'After Update');
    assert.equal(updated.status, 'inactive');
  });
  test('returns null when updating a nonexistent record', async () => {
    requireReadyConnection();
    const updated = await repository.update(-999999, {
      displayName: 'Missing Record',
      status: 'inactive',
    });
    assert.equal(updated, null);
  });
  test('deletes an existing record', async () => {
    requireReadyConnection();
    const created = await repository.create({
      email: `delete-${randomUUID()}@example.test`,
      displayName: 'Delete Me',
    });
    assert.equal(await repository.delete(created.id), true);
    assert.equal(await repository.findById(created.id), null);
  });
  test('returns false when deleting a nonexistent record', async () => {
    requireReadyConnection();
    assert.equal(await repository.delete(-999999), false);
  });
  test('rejects duplicate unique email values', async () => {
    requireReadyConnection();
    const email = `duplicate-${randomUUID()}@example.test`;
    await repository.create({
      email,
      displayName: 'Original',
    });
    await assert.rejects(
      () => repository.create({
        email,
        displayName: 'Duplicate',
      }),
      (error) => {
        if (CLIENT === 'postgres') {
          return error.code === '23505';
        }
        return error.code === 'ER_DUP_ENTRY';
      },
    );
  });
  test('treats SQL-like user input as data', async () => {
    requireReadyConnection();
    const payload =
      `candidate-${randomUUID()}'; DROP TABLE ${TABLE_NAME}; --`;
    const email = `injection-${randomUUID()}@example.test`;
    const created = await repository.create({
      email,
      displayName: payload,
    });
    const found = await repository.findById(created.id);
    assert.equal(found.display_name, payload);
    assert.equal(await tableExistsForTest(), true);
  });
});