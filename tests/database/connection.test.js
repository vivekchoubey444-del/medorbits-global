‘use strict’;

/**

* MedOrbits -- Database Connection Tests
* File: tests/database/connection.test.js
* Framework: Node.js built-in node:test
* Node.js: >= 20
* Run:
* node –test tests/database/connection.test.js
* PostgreSQL:
* TEST_DATABASE_CLIENT=postgres
* TEST_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/medorbits_test
* MySQL:
* TEST_DATABASE_CLIENT=mysql
* TEST_DATABASE_HOST=127.0.0.1
* TEST_DATABASE_PORT=3306
* TEST_DATABASE_NAME=medorbits_test
* TEST_DATABASE_USER=…
* TEST_DATABASE_PASSWORD=…
* Safety:
* ●	Requires explicit TEST_DATABASE_* configuration.
* ●	Refuses NODE_ENV=production.
* ●	Requires the database name to contain "test".
* ●	Uses read-only SELECT statements.
* ●	Does not create, modify, or delete records.
        */

const test = require(‘node:test’);
const assert = require(‘node:assert/strict’);

const CLIENT = String(
process.env.TEST_DATABASE_CLIENT || ‘’,
).trim().toLowerCase();

const IS_PRODUCTION =
String(process.env.NODE_ENV || ‘’).trim().toLowerCase() ===
‘production’;

const DATABASE_URL = String(
process.env.TEST_DATABASE_URL || ‘’,
).trim();

const MYSQL_HOST = String(
process.env.TEST_DATABASE_HOST || ‘’,
).trim();

const MYSQL_NAME = String(
process.env.TEST_DATABASE_NAME || ‘’,
).trim();

const MYSQL_USER = String(
process.env.TEST_DATABASE_USER || ‘’,
).trim();

function postgresDatabaseName() {
if (!DATABASE_URL) {
return ‘’;
}

try {
return decodeURIComponent(
new URL(DATABASE_URL).pathname.replace(/^/+/, ‘’),
);
} catch {
return ‘’;
}
}

const POSTGRES_NAME = postgresDatabaseName();

const HAS_POSTGRES_CONFIG =
/^postgres(?:ql)?:///i.test(DATABASE_URL) &&
Boolean(POSTGRES_NAME);

const HAS_MYSQL_CONFIG =
Boolean(MYSQL_HOST && MYSQL_NAME && MYSQL_USER);

const CONFIGURED_CLIENT =
CLIENT === ‘postgres’ && HAS_POSTGRES_CONFIG
? ‘postgres’
: CLIENT === ‘mysql’ && HAS_MYSQL_CONFIG
? ‘mysql’
: null;

const SELECTED_DATABASE =
CONFIGURED_CLIENT === ‘postgres’
? POSTGRES_NAME
: CONFIGURED_CLIENT === ‘mysql’
? MYSQL_NAME
: ‘’;

const CONFIG_ERROR = IS_PRODUCTION
? ‘Database tests are disabled when NODE_ENV=production.’
: ![‘postgres’, ‘mysql’].includes(CLIENT)
? ‘Set TEST_DATABASE_CLIENT to postgres or mysql.’
: !CONFIGURED_CLIENT
? CLIENT === ‘postgres’
? ‘Set TEST_DATABASE_URL to a valid PostgreSQL test database URL.’
: ‘Set TEST_DATABASE_HOST, TEST_DATABASE_NAME, and TEST_DATABASE_USER.’
: !/test/i.test(SELECTED_DATABASE)
? ‘The configured database name must contain "test".’
: null;

let driver = null;
let pool = null;
let setupError = null;

function loadDriver() {
if (CONFIG_ERROR) {
return;
}

try {
if (CONFIGURED_CLIENT === ‘postgres’) {
driver = require(‘pg’);
return;
}

if (CONFIGURED_CLIENT === 'mysql') {
  driver = require('mysql2/promise');
}

} catch (error) {
setupError = error;
}
}

function createPool() {
if (!driver) {
throw new Error(
The ${CONFIGURED_CLIENT} driver is unavailable. Install the corresponding package.,
{ cause: setupError || undefined },
);
}

if (CONFIGURED_CLIENT === ‘postgres’) {
return new driver.Pool({
connectionString: DATABASE_URL,
max: 5,
connectionTimeoutMillis: 5000,
idleTimeoutMillis: 10000,
application_name: ‘medorbits-database-tests’,
…(process.env.TEST_DATABASE_SSL === ‘true’
? {
ssl: {
rejectUnauthorized: true,
},
}
: {}),
});
}

if (CONFIGURED_CLIENT === ‘mysql’) {
return driver.createPool({
host: MYSQL_HOST,
port: Number(process.env.TEST_DATABASE_PORT || 3306),
database: MYSQL_NAME,
user: MYSQL_USER,
password: process.env.TEST_DATABASE_PASSWORD || ‘’,
connectionLimit: 5,
waitForConnections: true,
queueLimit: 10,
connectTimeout: 5000,
enableKeepAlive: true,
multipleStatements: false,
});
}

throw new Error(‘Unsupported database client.’);
}

function ensureTestDatabase() {
if (IS_PRODUCTION) {
throw new Error(
‘Refusing to run database tests in production.’,
);
}

if (CONFIG_ERROR) {
throw new Error(CONFIG_ERROR);
}

if (!driver) {
throw new Error(
Database driver unavailable: ${ setupError ? setupError.message : 'driver not loaded' },
);
}

if (!pool) {
throw new Error(‘Database connection pool is not initialized.’);
}
}

async function queryReadOnly(sql = ‘SELECT 1 AS result’) {
ensureTestDatabase();

if (CONFIGURED_CLIENT === ‘postgres’) {
return pool.query(sql);
}

const [rows] = await pool.query(sql);
return { rows };
}

function resultValue(result) {
assert.ok(result, ‘Expected a query result.’);
assert.ok(Array.isArray(result.rows), ‘Expected result.rows.’);
assert.equal(result.rows.length, 1);
return Number(result.rows[0].result);
}

async function verifyConnectedDatabase() {
const sql =
CONFIGURED_CLIENT === ‘postgres’
? ‘SELECT current_database() AS database_name’
: ‘SELECT DATABASE() AS database_name’;

const result = await queryReadOnly(sql);
const actualName = String(result.rows[0]?.database_name || ‘’);

assert.ok(actualName, ‘Database server did not return a database name.’);

assert.equal(
actualName,
SELECTED_DATABASE,
‘Connected database does not match the explicitly configured test database.’,
);

assert.match(
actualName,
/test/i,
‘Refusing to use a database whose name does not contain "test".’,
);
}

loadDriver();

const SKIP_REASON = CONFIG_ERROR || false;

test.before(async () => {
if (SKIP_REASON) {
return;
}

if (!driver) {
throw new Error(
Cannot load the configured database driver: ${ setupError ? setupError.message : 'unknown error' },
);
}

pool = createPool();

try {
await verifyConnectedDatabase();
} catch (error) {
await pool.end();
pool = null;
throw error;
}
});

test.after(async () => {
if (pool) {
const currentPool = pool;
pool = null;
await currentPool.end();
}
});

test(
‘database test configuration is explicit and safe’,
{ skip: SKIP_REASON },
() => {
assert.ok(CONFIGURED_CLIENT);
assert.ok(SELECTED_DATABASE);
assert.match(SELECTED_DATABASE, /test/i);
assert.ok(driver, ‘Expected the configured driver to load.’);
},
);

test(
‘database driver and connection pool initialize’,
{ skip: SKIP_REASON },
() => {
ensureTestDatabase();
assert.ok(pool);
},
);

test(
‘connection targets the configured test database’,
{ skip: SKIP_REASON },
async () => {
await verifyConnectedDatabase();
},
);

test(
‘database connection executes a basic read-only query’,
{ skip: SKIP_REASON },
async () => {
const result = await queryReadOnly();
assert.equal(resultValue(result), 1);
},
);

test(
‘database connection executes repeated queries’,
{ skip: SKIP_REASON },
async () => {
for (let index = 0; index < 3; index += 1) {
const result = await queryReadOnly();

  assert.equal(
    resultValue(result),
    1,
    `Read-only probe ${index + 1} failed.`,
  );
}

},
);

test(
‘database connection supports concurrent read-only queries’,
{ skip: SKIP_REASON },
async () => {
const results = await Promise.all(
Array.from({ length: 3 }, () => queryReadOnly()),
);

assert.equal(results.length, 3);
for (const result of results) {
  assert.equal(resultValue(result), 1);
}

},
);

test(
‘a failed query does not permanently break the connection pool’,
{ skip: SKIP_REASON },
async () => {
const missingTable =
‘medorbits_test_table_that_does_not_exist’;

let queryError;
try {
  await queryReadOnly(
    `SELECT * FROM ${missingTable}`,
  );
} catch (error) {
  queryError = error;
}
assert.ok(
  queryError,
  'The deliberately invalid query should fail.',
);
assert.equal(typeof queryError.message, 'string');
assert.ok(queryError.message.length > 0);
const recoveryResult = await queryReadOnly();
assert.equal(resultValue(recoveryResult), 1);

},
);

test(
‘database pool can acquire and release a connection’,
{ skip: SKIP_REASON },
async () => {
ensureTestDatabase();

if (CONFIGURED_CLIENT === 'postgres') {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT 1 AS result');
    assert.equal(resultValue(result), 1);
  } finally {
    client.release();
  }
  return;
}
const connection = await pool.getConnection();
try {
  const [rows] = await connection.query(
    'SELECT 1 AS result',
  );
  assert.equal(Number(rows[0].result), 1);
} finally {
  connection.release();
}

},
);

test(
‘connection probes do not require schema mutations’,
{ skip: SKIP_REASON },
async () => {
const result = await queryReadOnly();
assert.equal(resultValue(result), 1);
},
);