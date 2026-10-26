
'use strict';

/**
 * MedOrbits -- Shared MySQL Integration-Test Connection
 *
 * File: tests/database/setup.js
 * Requires: Node.js >= 20, mysql2
 *
 * Required environment:
 *   NODE_ENV=test
 *   TEST_DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/medorbits_test
 *
 * Optional:
 *   TEST_DATABASE_SSL=true
 *
 * Safety:
 * - Requires NODE_ENV=test.
 * - Requires a dedicated database name containing "test".
 * - Verifies the actual connected database.
 * - Never creates, migrates, truncates, or drops tables.
 * - Shares concurrent connection attempts.
 * - Coordinates initialization and shutdown.
 * - Verifies TLS certificates when TLS is enabled.
 */

const DATABASE_NAME_PATTERN = /(^|[-_])test($|[-_])/i;

let mysqlDriver;
let connection;
let connectionPromise;
let closingPromise;
let hooksRegistered = false;

function getMysqlDriver() {
  if (mysqlDriver) {
    return mysqlDriver;
  }

  try {
    mysqlDriver = require('mysql2/promise');
    return mysqlDriver;
  } catch {
    throw new Error(
      'MySQL driver is missing. Install it with: npm install mysql2',
    );
  }
}

function getTestDatabaseConfig() {
  if (
    String(process.env.NODE_ENV || '').trim().toLowerCase() !== 'test'
  ) {
    throw new Error(
      'MedOrbits database tests require NODE_ENV=test.',
    );
  }

  if (
    String(process.env.IS_PRODUCTION || '').trim().toLowerCase() === 'true'
  ) {
    throw new Error(
      'Refusing to run database tests in a production environment.',
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

  if (parsed.search || parsed.hash) {
    throw new Error(
      'TEST_DATABASE_URL must not contain query parameters or a URL fragment. ' +
        'Configure optional connection settings using environment variables.',
    );
  }

  let databaseName;
  let user;
  let password;

  try {
    databaseName = decodeURIComponent(
      parsed.pathname.replace(/^\/+/, ''),
    );

    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    throw new Error(
      'TEST_DATABASE_URL contains invalid percent-encoded data.',
    );
  }

  if (!databaseName || databaseName.includes('/')) {
    throw new Error(
      'TEST_DATABASE_URL must specify exactly one database name.',
    );
  }

  if (!DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      'Refusing database tests: use a dedicated database whose name ' +
        'clearly identifies it as a test database, such as medorbits_test.',
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

  if (!user) {
    throw new Error(
      'TEST_DATABASE_URL must specify a MySQL test user.',
    );
  }

  const config = {
    host: parsed.hostname,
    port,
    user,
    password,
    database: databaseName,
    charset: 'utf8mb4',
    multipleStatements: false,
    connectTimeout: 10000,
    decimalNumbers: true,
    dateStrings: false,
  };

  if (process.env.TEST_DATABASE_SSL === 'true') {
    config.ssl = {
      rejectUnauthorized: true,
    };
  }

  return config;
}

/**
 * Opens or returns the shared MySQL connection.
 *
 * Concurrent callers share one initialization promise.
 * Calls made during shutdown wait for shutdown to finish.
 */
async function connectTestDatabase() {
  while (closingPromise) {
    const pendingClose = closingPromise;

    try {
      await pendingClose;
    } catch {
      // A failed close must not silently permit connection reuse.
      if (closingPromise === pendingClose) {
        throw new Error(
          'The previous database shutdown failed. ' +
            'Resolve the connection shutdown before reconnecting.',
        );
      }
    }
  }

  if (connection) {
    return connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const attempt = (async () => {
    const config = getTestDatabaseConfig();
    const mysql = getMysqlDriver();

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

      if (!DATABASE_NAME_PATTERN.test(connectedDatabase || '')) {
        throw new Error(
          'Connected database does not meet the test database naming requirement.',
        );
      }

      connection = candidate;

      return candidate;
    } catch (error) {
      try {
        await candidate.end();
      } catch (closeError) {
        throw new AggregateError(
          [error, closeError],
          'Database verification failed and the connection could not be closed.',
        );
      }

      throw error;
    }
  })();

  connectionPromise = attempt;

  try {
    return await attempt;
  } finally {
    if (connectionPromise === attempt) {
      connectionPromise = undefined;
    }
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

  if (closingPromise) {
    throw new Error(
      'Test database is shutting down. Wait until shutdown finishes.',
    );
  }

  return connection;
}

/**
 * Closes the shared connection.
 *
 * Concurrent shutdown calls share the same promise.
 * Initialization already in progress is allowed to settle first.
 */
async function closeTestDatabase() {
  if (closingPromise) {
    return closingPromise;
  }

  const closeAttempt = (async () => {
    const pendingConnection = connectionPromise;

    if (pendingConnection) {
      try {
        await pendingConnection;
      } catch {
        // Initialization failed; check whether a connection exists below.
      }
    }

    const current = connection;

    if (!current) {
      return;
    }

    // Prevent new callers from reusing the connection while it closes.
    connection = undefined;

    await current.end();
  })();

  closingPromise = closeAttempt;

  try {
    await closeAttempt;
  } finally {
    if (closingPromise === closeAttempt) {
      closingPromise = undefined;
    }
  }
}

/**
 * Registers Jest lifecycle hooks once per loaded module.
 *
 * Jest:
 *   const { registerDatabaseHooks } = require('./setup');
 *   registerDatabaseHooks();
 *
 * node:test:
 *   Use node:test's before() and after() directly.
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

  global.beforeAll(async () => {
    await connectTestDatabase();
  });

  global.afterAll(async () => {
    await closeTestDatabase();
  });

  hooksRegistered = true;
}

module.exports = {
  connectTestDatabase,
  getTestDatabaseConnection,
  closeTestDatabase,
  getTestDatabaseConfig,
  registerDatabaseHooks,
};
