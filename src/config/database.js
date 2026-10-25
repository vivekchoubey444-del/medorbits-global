
/**
 * MedOrbits -- MySQL Database Adapter
 * File: src/config/database.js
 *
 * Node.js: >=20
 * Module system: ES Modules
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
 * Features:
 * - Lazy connection-pool initialization.
 * - Validated database configuration.
 * - Parameterized query and prepared-statement helpers.
 * - Transaction support with rollback on failure.
 * - Configurable transaction isolation.
 * - Safe connection lifecycle and idempotent shutdown.
 * - MySQL BIGINT and DECIMAL precision preservation.
 * - No automatic logging of credentials or SQL parameters.
 *
 * Security:
 * - Never concatenate untrusted values into SQL.
 * - Validate SQL identifiers separately; placeholders cannot parameterize
 *   table names, column names, or SQL keywords.
 * - Keep database credentials in environment variables or a secrets manager.
 * - Do not expose database diagnostic details through public API responses.
 */

import mysql from "mysql2/promise";

const DEFAULT_PORT = 3306;
const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;

const MAX_CONNECTION_LIMIT = 100;
const MIN_CONNECT_TIMEOUT_MS = 1000;
const MAX_CONNECT_TIMEOUT_MS = 120000;

const ISOLATION_LEVELS = new Set([
  "READ UNCOMMITTED",
  "READ COMMITTED",
  "REPEATABLE READ",
  "SERIALIZABLE",
]);

let pool;
let closing = false;
let closePromise;

/**
 * Return true when a value contains non-whitespace text.
 */
function isPresent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Parse a bounded, non-negative or positive integer setting.
 */
function parseInteger(value, name, options = {}) {
  const {
    fallback,
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
  } = options;

  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`${name} is required.`);
  }

  if (
    typeof value !== "number" &&
    typeof value !== "string"
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
      `${name} must be between ${min} and ${max}.`,
    );
  }

  return parsed;
}

/**
 * Validate database configuration before creating the pool.
 *
 * Passwords are preserved exactly as supplied. Other text settings
 * are trimmed where appropriate.
 */
function buildDatabaseConfig() {
  const required = [
    "DB_HOST",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
  ];

  const missing = required.filter(
    (name) => !isPresent(process.env[name]),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required database environment variables: ${missing.join(", ")}`,
    );
  }

  const host = process.env.DB_HOST.trim();
  const database = process.env.DB_NAME.trim();
  const user = process.env.DB_USER.trim();

  const invalidControlCharacters = /[\u0000-\u001F\u007F]/;

  for (const [name, value] of [
    ["DB_HOST", host],
    ["DB_NAME", database],
    ["DB_USER", user],
  ]) {
    if (invalidControlCharacters.test(value)) {
      throw new Error(
        `${name} contains invalid control characters.`,
      );
    }
  }

  return {
    host,

    port: parseInteger(
      process.env.DB_PORT,
      "DB_PORT",
      {
        fallback: DEFAULT_PORT,
        min: 1,
        max: 65535,
      },
    ),

    database,
    user,

    // Do not trim passwords; whitespace may be significant.
    password: process.env.DB_PASSWORD,

    connectionLimit: parseInteger(
      process.env.DB_CONNECTION_LIMIT,
      "DB_CONNECTION_LIMIT",
      {
        fallback: DEFAULT_CONNECTION_LIMIT,
        min: 1,
        max: MAX_CONNECTION_LIMIT,
      },
    ),

    connectTimeout: parseInteger(
      process.env.DB_CONNECT_TIMEOUT_MS,
      "DB_CONNECT_TIMEOUT_MS",
      {
        fallback: DEFAULT_CONNECT_TIMEOUT_MS,
        min: MIN_CONNECT_TIMEOUT_MS,
        max: MAX_CONNECT_TIMEOUT_MS,
      },
    ),
  };
}

/**
 * Return a validated configuration snapshot.
 *
 * This function includes the database password. Do not serialize,
 * log, or expose its return value through an API.
 */
export function getDatabaseConfig() {
  return { ...buildDatabaseConfig() };
}

/**
 * Create the pool only when a database operation first requires it.
 *
 * A closing pool cannot accept new operations.
 */
export function getPool() {
  if (closing) {
    throw new Error(
      "The database pool is shutting down. New database operations are unavailable.",
    );
  }

  if (pool) {
    return pool;
  }

  const config = buildDatabaseConfig();

  const newPool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,

    waitForConnections: true,
    connectionLimit: config.connectionLimit,

    // Zero means an unlimited waiting queue in mysql2.
    // Set a finite queue limit if your application needs backpressure.
    queueLimit: 0,

    connectTimeout: config.connectTimeout,

    charset: "utf8mb4",
    timezone: "Z",

    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    multipleStatements: false,

    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,

    dateStrings: false,
  });

  pool = newPool;

  return pool;
}

/**
 * Validate SQL and its positional parameter collection.
 */
function validateStatement(sql, values, label) {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    throw new TypeError(
      `${label} must be a non-empty SQL string.`,
    );
  }

  if (!Array.isArray(values)) {
    throw new TypeError(
      `${label} values must be supplied as an array.`,
    );
  }
}

/**
 * Execute a query using mysql2's query interface.
 *
 * Example:
 *   const users = await query(
 *     "SELECT id, email FROM users WHERE id = ?",
 *     [userId],
 *   );
 *
 * Use placeholders for all untrusted values.
 */
export async function query(sql, values = []) {
  validateStatement(sql, values, "Query");

  const [rows] = await getPool().query(sql, values);

  return rows;
}

/**
 * Execute a prepared statement.
 *
 * Suitable for INSERT, UPDATE, DELETE, and parameterized SELECT
 * operations supported by MySQL prepared statements.
 */
export async function execute(sql, values = []) {
  validateStatement(sql, values, "Statement");

  const [result] = await getPool().execute(sql, values);

  return result;
}

/**
 * Check database connectivity.
 *
 * Returns minimal status information for internal readiness checks.
 * Do not expose the database name or raw database errors publicly
 * unless your operational policy explicitly permits it.
 */
export async function checkConnection() {
  const [rows] = await getPool().query(
    "SELECT 1 AS database_ok",
  );

  return {
    ok: Number(rows[0]?.database_ok) === 1,
  };
}

/**
 * Execute operations within a transaction.
 *
 * Example:
 *
 * await transaction(async (connection) => {
 *   await connection.execute(
 *     "UPDATE users SET status = ? WHERE id = ?",
 *     ["active", userId],
 *   );
 *
 *   await connection.execute(
 *     "INSERT INTO audit_logs (action) VALUES (?)",
 *     ["user_activated"],
 *   );
 * });
 *
 * Options:
 *   { isolationLevel: "READ COMMITTED" }
 *
 * Rules:
 * - Use the supplied connection for every transaction operation.
 * - Do not call the global query() or execute() helpers inside the
 *   transaction callback.
 * - Do not retain the connection after the callback completes.
 * - Avoid network requests or long-running external operations while
 *   holding a transaction open.
 */
export async function transaction(callback, options = {}) {
  if (typeof callback !== "function") {
    throw new TypeError(
      "Transaction callback must be a function.",
    );
  }

  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new TypeError(
      "Transaction options must be an object.",
    );
  }

  const isolationLevel = options.isolationLevel;

  if (
    isolationLevel !== undefined &&
    !ISOLATION_LEVELS.has(isolationLevel)
  ) {
    throw new Error(
      "Unsupported transaction isolation level.",
    );
  }

  const connection = await getPool().getConnection();

  let transactionStarted = false;
  let primaryError;

  try {
    if (isolationLevel !== undefined) {
      /*
       * This value is selected from a fixed allowlist.
       * Never interpolate a user-supplied isolation level here.
       */
      await connection.query(
        `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
      );
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const result = await callback(connection);

    await connection.commit();
    transactionStarted = false;

    return result;
  } catch (error) {
    primaryError = error;

    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        /*
         * Preserve the original transaction error while retaining
         * rollback failure information for internal diagnostics.
         *
         * Do not log SQL parameters, credentials, or record contents.
         */
        if (primaryError instanceof Error) {
          try {
            Object.defineProperty(primaryError, "rollbackError", {
              value: rollbackError,
              enumerable: false,
              configurable: true,
            });
          } catch {
            // Preserve the original transaction failure.
          }
        }
      }
    }

    throw primaryError;
  } finally {
    connection.release();
  }
}

/**
 * Close the pool gracefully.
 *
 * Repeated calls share one shutdown operation. Once shutdown starts,
 * new calls to getPool() fail until shutdown finishes.
 */
export function close() {
  if (closePromise) {
    return closePromise;
  }

  if (!pool) {
    return Promise.resolve();
  }

  closing = true;

  const currentPool = pool;

  closePromise = Promise.resolve()
    .then(() => currentPool.end())
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

/**
 * Default export for consumers that prefer a single adapter object.
 */
const database = Object.freeze({
  getPool,
  getDatabaseConfig,
  query,
  execute,
  checkConnection,
  transaction,
  close,
});

export default database;
