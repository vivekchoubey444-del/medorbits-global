'use strict';
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const {
  connectTestDatabase,
  getTestDatabaseConnection,
  closeTestDatabase,
} = require('./setup');
const TABLE_NAME = 'test_transaction_records';
let connection;
let tableReady = false;
function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}
async function rollbackSafely() {
  if (!connection) return;
  try {
    await connection.rollback();
  } catch {
    // Preserve the original test failure.
  }
}
before(async () => {
  await connectTestDatabase();
  connection = getTestDatabaseConnection();
  assert.ok(
    connection,
    'The shared test database connection must be available.'
  );
  // Confirm that the expected test table exists.
  // This suite intentionally does not create or drop shared tables.
  const [tables] = await connection.execute(
    'SHOW TABLES LIKE ?',
    [TABLE_NAME]
  );
  assert.ok(
    tables.length > 0,
    `Required table "${TABLE_NAME}" is missing. ` +
      'Create it in the dedicated test database setup.'
  );
  tableReady = true;
});
after(async () => {
  // The shared setup module owns the connection lifecycle.
  // Do not call connection.end() directly here.
  await closeTestDatabase();
});
test('commits successful operations', async () => {
  assert.ok(tableReady, 'Transaction test table is not ready.');
  const id = uniqueId('commit');
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO \`${TABLE_NAME}\` (id, value) VALUES (?, ?)`,
      [id, 'committed']
    );
    await connection.commit();
  } catch (error) {
    await rollbackSafely();
    throw error;
  }
  const [rows] = await connection.execute(
    `SELECT value FROM \`${TABLE_NAME}\` WHERE id = ?`,
    [id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 'committed');
});
test('rolls back writes when a transaction fails', async () => {
  assert.ok(tableReady, 'Transaction test table is not ready.');
  const id = uniqueId('rollback');
  const expectedError = new Error('Simulated transaction failure');
  let actualError;
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO \`${TABLE_NAME}\` (id, value) VALUES (?, ?)`,
      [id, 'must-not-persist']
    );
    throw expectedError;
  } catch (error) {
    actualError = error;
    await rollbackSafely();
  }
  assert.equal(actualError, expectedError);
  const [rows] = await connection.execute(
    `SELECT id FROM \`${TABLE_NAME}\` WHERE id = ?`,
    [id]
  );
  assert.equal(
    rows.length,
    0,
    'A rolled-back transaction must not leave its inserted record behind.'
  );
});
test('keeps a committed write when a separate transaction rolls back', async () => {
  assert.ok(tableReady, 'Transaction test table is not ready.');
  const committedId = uniqueId('committed-a');
  const rolledBackId = uniqueId('rolled-back-b');
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO \`${TABLE_NAME}\` (id, value) VALUES (?, ?)`,
      [committedId, 'keep']
    );
    await connection.commit();
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO \`${TABLE_NAME}\` (id, value) VALUES (?, ?)`,
      [rolledBackId, 'discard']
    );
    await connection.rollback();
  } catch (error) {
    await rollbackSafely();
    throw error;
  }
  const [committedRows] = await connection.execute(
    `SELECT value FROM \`${TABLE_NAME}\` WHERE id = ?`,
    [committedId]
  );
  const [rolledBackRows] = await connection.execute(
    `SELECT id FROM \`${TABLE_NAME}\` WHERE id = ?`,
    [rolledBackId]
  );
  assert.equal(committedRows.length, 1);
  assert.equal(committedRows[0].value, 'keep');
  assert.equal(rolledBackRows.length, 0);
});