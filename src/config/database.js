
/**
 * MedOrbits -- MySQL Database Adapter
 *
 * File: src/config/database.js
 * Runtime: Node.js >=20
 * Module system: ES Modules
 *
 * Dependency:
 *   npm install mysql2
 *
 * Required environment variables:
 *   DB_HOST
 *   DB_NAME
 *   DB_USER
 *   DB_PASSWORD
 *
 * Optional environment variables:
 *   DB_PORT=3306
 *   DB_CONNECTION_LIMIT=10
 *   DB_CONNECT_TIMEOUT_MS=10000
 *
 * Features:
 * - Lazy connection-pool initialization.
 * - Validated configuration.
 * - Parameterized query and prepared-statement helpers.
 * - Transaction support with rollback and connection cleanup.
 * - Allowlisted transaction isolation levels.
 * - Idempotent graceful shutdown.
 * - BIGINT and DECIMAL precision preservation.
 * - Bounded connection waiting queue.
 * - No automatic logging of credentials, SQL parameters, or records.
 *
 * Security boundary:
 * This adapter does not provide authorization, schema validation,
 * migrations, or application-level transaction policy.
 */

import mysql from "mysql2/promise";

const DEFAULT_PORT = 3306;
const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;

const MAX_CONNECTION_LIMIT = 100;
const MIN_CONNECT_TIMEOUT_MS = 1000;
const MAX_CONNECT_TIMEOUT_MS = 120000;

const MAX_QUEUE_LIMIT = 1000;
const QUEUE_LIMIT = 100;

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
 * Create a configuration error without including credential values.
 */
function configurationError(message) {
  return new Error(`[MedOrbits Database] ${message}`);
}

function isPresent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * Parse a positive or non-negative bounded integer.
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

    throw configurationError(`${name} is required.`);
  }

  if (typeof value !== "number" && typeof value !== "string") {
    throw configurationError(`${name} must be an integer.`);
  }

  const normalized = String(value).trim();

  if (!/^\d+$/u.test(normalized)) {
    throw configurationError(`${name} must be an integer.`);
  }

  const parsed = Number(normalized);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw configurationError(
      `${name} must be between ${min} and ${max}.`,
    );
  }

  return parsed;
}

/**
 * Validate and build the database configuration.
 *
 * Passwords are preserved exactly as supplied. Never log or serialize
 * the returned configuration because it contains the database password.
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
    throw configurationError(
      `Missing required environment variables: ${missing.join(", ")}.`,
    );
  }

  const host = process.env.DB_HOST.trim();
  const database = process.env.DB_NAME.trim();
  const user = process.env.DB_USER.trim();
  const password = process.env.DB_PASSWORD;

  const controlCharacters = /[\u0000-\u001f\u007f]/u;

  for (const [name, value] of [
    ["DB_HOST", host],
    ["DB_NAME", database],
    ["DB_USER", user],
  ]) {
    if (controlCharacters.test(value)) {
      throw configurationError(
        `${name} contains invalid control characters.`,
      );
    }
  }

  if (controlCharacters.test(password)) {
    throw configurationError(
      "DB_PASSWORD contains invalid control characters.",
    );
  }

  return {
    host,

    port: parseInteger(process.env.DB_PORT, "DB_PORT", {
      fallback: DEFAULT_PORT,
      min: 1,
      max: 65535,
    }),

    database,
    user,
    password,

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
 * WARNING: This object contains DB_PASSWORD.
 * Do not log it, serialize it, or return it through an API.
 */
export function getDatabaseConfig() {
  return { ...buildDatabaseConfig() };
}

/**
 * Return the lazily initialized connection pool.
 *
 * Operations started after shutdown begins are rejected.
 */
export function getPool() {
  if (closing) {
    throw configurationError(
      "The database pool is shutting down; new operations are unavailable.",
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
    queueLimit: QUEUE_LIMIT,

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
 * Validate a SQL statement and its positional values.
 *
 * This checks argument types only. It does not prove that SQL is safe.
 * Callers must parameterize values and never concatenate untrusted input.
 */
function validateStatement(sql, values, label) {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty SQL string.`);
  }

  if (!Array.isArray(values)) {
    throw new TypeError(`${label} values must be an array.`);
  }
}

/**
 * Execute a query using mysql2's query interface.
 *
 * Use placeholders for all untrusted values:
 *   query("SELECT id FROM users WHERE id = ?", [userId])
 *
 * Returns the first item from mysql2's [rows, fields] result.
 */
export async function query(sql, values = []) {
  validateStatement(sql, values, "Query");

  const [rows] = await getPool().query(sql, values);

  return rows;
}

/**
 * Execute a prepared statement using mysql2's execute interface.
 *
 * Returns the first item from mysql2's [result, fields] result.
 */
export async function execute(sql, values = []) {
  validateStatement(sql, values, "Statement");

  const [result] = await getPool().execute(sql, values);

  return result;
}

/**
 * Check database connectivity.
 *
 * Intended for internal health/readiness checks.
 * Do not expose raw database errors through public health endpoints.
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
 * Execute work inside a transaction.
 *
 * Example:
 *   const result = await transaction(async (connection) => {
 *     await connection.execute(
 *       "UPDATE users SET status = ? WHERE id = ?",
 *       ["active", userId],
 *     );
 *
 *     return { updated: true };
 *   }, { isolationLevel: "READ COMMITTED" });
 *
 * The callback must use the supplied connection for every operation.
 * Do not call global query() or execute() inside the callback.
 * Do not retain the connection after the callback completes.
 */
export async function transaction(callback, options = {}) {
  if (typeof callback !== "function") {
    throw new TypeError("Transaction callback must be a function.");
  }

  if (!isPlainObject(options)) {
    throw new TypeError("Transaction options must be a plain object.");
  }

  const allowedOptionKeys = new Set(["isolationLevel"]);

  for (const key of Object.keys(options)) {
    if (!allowedOptionKeys.has(key)) {
      throw new TypeError(`Unsupported transaction option: ${key}.`);
    }
  }

  const isolationLevel = options.isolationLevel;

  if (
    isolationLevel !== undefined &&
    (typeof isolationLevel !== "string" ||
      !ISOLATION_LEVELS.has(isolationLevel))
  ) {
    throw new TypeError("Unsupported transaction isolation level.");
  }

  const connection = await getPool().getConnection();

  let transactionStarted = false;

  try {
    if (isolationLevel !== undefined) {
      // This value comes exclusively from the fixed allowlist above.
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
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the primary error. Do not log SQL or record data here.
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Gracefully close the connection pool.
 *
 * Concurrent close() calls share the same promise. Once shutdown begins,
 * getPool() rejects new work. After successful shutdown, the pool reference
 * is cleared and a later call can initialize a new pool if the application
 * lifecycle permits it.
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
 * Default export for consumers preferring a single adapter object.
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
