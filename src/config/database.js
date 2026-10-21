
'use strict';

/**
 * MedOrbits -- MySQL Database Adapter
 * File: src/config/database.js
 *
 * Requirements:
 * - mysql2/promise
 * - MySQL-compatible database
 *
 * Required environment variables:
 * - DB_HOST
 * - DB_NAME
 * - DB_USER
 * - DB_PASSWORD
 *
 * Optional environment variables:
 * - DB_PORT=3306
 * - DB_CONNECTION_LIMIT=10
 * - DB_CONNECT_TIMEOUT_MS=10000
 *
 * Security:
 * - Supports parameterized query interfaces.
 * - Disables multiple SQL statements.
 * - Does not log credentials or SQL parameter values.
 * - Provides transaction support with rollback on failure.
 */

const mysql = require('mysql2/promise');

let pool;
let closing = false;
let closePromise;

const DEFAULT_PORT = 3306;
const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;

const MAX_CONNECTION_LIMIT = 100;
const MIN_CONNECT_TIMEOUT_MS = 1000;
const MAX_CONNECT_TIMEOUT_MS = 120000;

const ISOLATION_LEVELS = new Set([
  'READ UNCOMMITTED',
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE',
]);

function isPresent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseInteger(value, name, options = {}) {
  const {
    fallback,
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
  } = options;

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {
    throw new Error(`${name} must be a valid integer.`);
  }

  const normalized = String(value).trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${name} must be a valid integer.`);
  }

  const parsed = Number(normalized);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(
      `${name} must be between ${min} and ${max}.`
    );
  }

  return parsed;
}

function getDatabaseConfig() {
  const required = [
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ];

  const missing = required.filter(
    (name) => !isPresent(process.env[name])
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required database environment variables: ${missing.join(', ')}`
    );
  }

  const host = process.env.DB_HOST.trim();
  const database = process.env.DB_NAME.trim();
  const user = process.env.DB_USER.trim();

  if (/[\u0000-\u001F\u007F]/.test(host)) {
    throw new Error('DB_HOST contains invalid control characters.');
  }

  if (/[\u0000-\u001F\u007F]/.test(database)) {
    throw new Error('DB_NAME contains invalid control characters.');
  }

  if (/[\u0000-\u001F\u007F]/.test(user)) {
    throw new Error('DB_USER contains invalid control characters.');
  }

  return {
    host,
    port: parseInteger(
      process.env.DB_PORT,
      'DB_PORT',
      {
        fallback: DEFAULT_PORT,
        min: 1,
        max: 65535,
      }
    ),
    database,
    user,

    // Preserve the password exactly as configured.
    password: process.env.DB_PASSWORD,

    connectionLimit: parseInteger(
      process.env.DB_CONNECTION_LIMIT,
      'DB_CONNECTION_LIMIT',
      {
        fallback: DEFAULT_CONNECTION_LIMIT,
        min: 1,
        max: MAX_CONNECTION_LIMIT,
      }
    ),

    connectTimeout: parseInteger(
      process.env.DB_CONNECT_TIMEOUT_MS,
      'DB_CONNECT_TIMEOUT_MS',
      {
        fallback: DEFAULT_CONNECT_TIMEOUT_MS,
        min: MIN_CONNECT_TIMEOUT_MS,
        max: MAX_CONNECT_TIMEOUT_MS,
      }
    ),
  };
}

function getPool() {
  if (closing) {
    throw new Error(
      'Database pool is closing. Wait for shutdown to complete before creating new queries.'
    );
  }

  if (pool) {
    return pool;
  }

  const config = getDatabaseConfig();

  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,

    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    queueLimit: 0,
    connectTimeout: config.connectTimeout,

    charset: 'utf8mb4',
    timezone: 'Z',

    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    multipleStatements: false,

    decimalNumbers: false,
    supportBigNumbers: true,
    bigNumberStrings: true,

    // Keep MySQL date values in their native returned representation.
    dateStrings: false,
  });

  return pool;
}

function validateStatement(sql, values, label) {
  if (typeof sql !== 'string' || !sql.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  if (!Array.isArray(values)) {
    throw new TypeError(
      `${label === 'SQL query' ? 'Query' : 'Statement'} values must be an array.`
    );
  }
}

/**
 * Execute a SQL query using the mysql2 query interface.
 *
 * Use placeholders for values:
 *   await query('SELECT * FROM users WHERE id = ?', [userId]);
 *
 * Do not concatenate untrusted input into SQL strings.
 * Identifiers such as table and column names require separate validation.
 */
async function query(sql, values = []) {
  validateStatement(sql, values, 'SQL query');

  const [rows] = await getPool().query(sql, values);

  return rows;
}

/**
 * Execute a prepared SQL statement.
 *
 * Use placeholders for all user-controlled values.
 */
async function execute(sql, values = []) {
  validateStatement(sql, values, 'SQL statement');

  const [result] = await getPool().execute(sql, values);

  return result;
}

/**
 * Verify connectivity and return basic database status.
 *
 * Avoid exposing this result publicly without appropriate authorization.
 */
async function checkConnection() {
  const [rows] = await getPool().query(
    'SELECT 1 AS database_ok, DATABASE() AS database_name'
  );

  const row = rows[0];

  return {
    ok: Number(row?.database_ok) === 1,
    database: row?.database_name || null,
  };
}

/**
 * Execute database operations inside a transaction.
 *
 * Example:
 *
 * await transaction(async (connection) => {
 *   await connection.execute(
 *     'UPDATE users SET status = ? WHERE id = ?',
 *     ['active', userId]
 *   );
 * });
 *
 * Use the supplied connection for every database operation in the
 * transaction. Do not use the global query() or execute() helpers.
 *
 * The callback must not retain or use the connection after returning.
 */
async function transaction(callback, options = {}) {
  if (typeof callback !== 'function') {
    throw new TypeError(
      'Transaction callback must be a function.'
    );
  }

  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError(
      'Transaction options must be an object.'
    );
  }

  const isolationLevel = options.isolationLevel;

  if (
    isolationLevel !== undefined &&
    !ISOLATION_LEVELS.has(isolationLevel)
  ) {
    throw new Error(
      'Unsupported transaction isolation level.'
    );
  }

  const connection = await getPool().getConnection();

  let transactionStarted = false;

  try {
    if (isolationLevel) {
      // Only allow values from the fixed allowlist above.
      await connection.query(
        `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
      );
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const result = await callback(connection);

    await connection.commit();
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // Preserve the original error. The connection is released below.
        // Production monitoring should capture rollback failures without
        // logging SQL parameters, credentials, or sensitive record contents.
        if (error && typeof error === 'object') {
          try {
            Object.defineProperty(error, 'rollbackFailed', {
              value: true,
              enumerable: false,
              configurable: true,
            });
          } catch {
            // Some error objects may be non-extensible.
          }
        }
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Close the connection pool gracefully.
 *
 * Repeated close() calls share the same shutdown operation.
 */
async function close() {
  if (closePromise) {
    return closePromise;
  }

  if (!pool) {
    return;
  }

  closing = true;

  const currentPool = pool;

  closePromise = currentPool.end()
    .then(() => {
      if (pool === currentPool) {
        pool = undefined;
      }
    })
    .finally(() => {
      closing = false;
      closePromise = undefined;
    });

  return closePromise;
}

module.exports = {
  getPool,
  getDatabaseConfig,
  query,
  execute,
  checkConnection,
  transaction,
  close,
};
