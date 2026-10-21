'use strict';
/**
 * File: tests/database/setup.js
 *
 * MedOrbits shared MySQL integration-test connection.
 *
 * Requirements:
 *   Node.js >= 20
 *   mysql2 installed
 *   NODE_ENV=test
 *   TEST_DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/medorbits_test
 *
 * Safety:
 * - Requires NODE_ENV=test.
 * - Requires a database name with an explicit test marker.
 * - Verifies the actual connected database.
 * - Does not create, migrate, truncate, or drop application tables.
 * - Shares concurrent connection attempts.
 * - Coordinates connection initialization and shutdown.
 *
 * Supports Jest lifecycle hooks through registerDatabaseHooks().
 * For node:test, use the exported connection functions with before()/after().
 */
const mysql = require('mysql2/promise');
let connection;
let connectionPromise;
let closingPromise;
let hooksRegistered = false;
function getTestDatabaseConfig() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'MedOrbits database tests require NODE_ENV=test.',
    );
  }
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL is required for database integration tests.',
    );
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      'TEST_DATABASE_URL must be a valid MySQL connection URL.',
    );
  }
  if (!['mysql:', 'mysql2:'].includes(parsed.protocol)) {
    throw new Error(
      'TEST_DATABASE_URL must use mysql:// or mysql2://.',
    );
  }
  if (!parsed.hostname) {
    throw new Error(
      'TEST_DATABASE_URL must specify a MySQL hostname.',
    );
  }
  const databaseName = decodeURIComponent(
    parsed.pathname.replace(/^\/+/, ''),
  );
  if (!databaseName || databaseName.includes('/')) {
    throw new Error(
      'TEST_DATABASE_URL must specify exactly one database name.',
    );
  }
  if (!/(^|[-_])test($|[-_])/i.test(databaseName)) {
    throw new Error(
      'Refusing database tests: the database name must clearly identify ' +
        'a dedicated test database, such as medorbits_test.',
    );
  }
  const port = parsed.port ? Number(parsed.port) : 3306;
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'TEST_DATABASE_URL contains an invalid MySQL port.',
    );
  }
  let user;
  let password;
  try {
    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    throw new Error(
      'TEST_DATABASE_URL contains invalid encoded credentials.',
    );
  }
  if (!user) {
    throw new Error(
      'TEST_DATABASE_URL must specify a MySQL test user.',
    );
  }
  return {
    host: parsed.hostname,
    port,
    user,
    password,
    database: databaseName,
    charset: 'utf8mb4',
    multipleStatements: false,
    connectTimeout: 5000,
    decimalNumbers: true,
    dateStrings: false,
  };
}
/**
 * Returns the shared MySQL connection.
 *
 * Concurrent callers share the same connection attempt. Calls made while
 * teardown is in progress wait for teardown before creating a new connection.
 */
async function connectTestDatabase() {
  if (closingPromise) {
    await closingPromise;
  }
  if (connection) {
    return connection;
  }
  if (connectionPromise) {
    return connectionPromise;
  }
  connectionPromise = (async () => {
    const config = getTestDatabaseConfig();
    const candidate = await mysql.createConnection(config);
    try {
      const [rows] = await candidate.execute(
        'SELECT DATABASE() AS databaseName',
      );
      const connectedDatabase = rows[0]?.databaseName;
      if (connectedDatabase !== config.database) {
        throw new Error(
          'Connected MySQL database does not match the configured test database.',
        );
      }
      if (!/(^|[-_])test($|[-_])/i.test(connectedDatabase || '')) {
        throw new Error(
          'Connected database does not meet the test database naming requirement.',
        );
      }
      connection = candidate;
      return candidate;
    } catch (error) {
      await candidate.end().catch(() => {});
      throw error;
    }
  })();
  try {
    return await connectionPromise;
  } finally {
    connectionPromise = undefined;
  }
}
/**
 * Returns the active connection without opening a new one.
 */
function getTestDatabaseConnection() {
  if (!connection) {
    throw new Error(
      'Test database is not connected. Call connectTestDatabase() first.',
    );
  }
  return connection;
}
/**
 * Closes the shared connection.
 *
 * Waits for any connection attempt already in progress. New connection
 * attempts wait for teardown to finish.
 */
async function closeTestDatabase() {
  if (closingPromise) {
    return closingPromise;
  }
  closingPromise = (async () => {
    if (connectionPromise) {
      try {
        await connectionPromise;
      } catch {
        // Initialization failed; there may be no connection to close.
      }
    }
    const current = connection;
    connection = undefined;
    if (current) {
      await current.end();
    }
  })();
  try {
    await closingPromise;
  } finally {
    closingPromise = undefined;
  }
}
/**
 * Registers Jest lifecycle hooks once per loaded module.
 *
 * For Jest, call this from a test file or Jest setup module.
 * For node:test, use before(async () => connectTestDatabase()) and
 * after(async () => closeTestDatabase()) instead.
 */
function registerDatabaseHooks() {
  if (
    typeof global.beforeAll !== 'function' ||
    typeof global.afterAll !== 'function'
  ) {
    throw new Error(
      'registerDatabaseHooks() requires Jest globals. ' +
        'For node:test, use before() and after() directly.',
    );
  }
  if (hooksRegistered) {
    return;
  }
  hooksRegistered = true;
  global.beforeAll(async () => {
    await connectTestDatabase();
  });
  global.afterAll(async () => {
    await closeTestDatabase();
  });
}
module.exports = {
  connectTestDatabase,
  getTestDatabaseConnection,
  closeTestDatabase,
  getTestDatabaseConfig,
  registerDatabaseHooks,
};