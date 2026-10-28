#!/usr/bin/env node
'use strict';

require('dotenv').config();

const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const REQUIRED_TABLES = [
  'users',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
];

const REQUIRED_USER_COLUMNS = [
  'id',
  'public_id',
  'name',
  'email',
  'password_hash',
  'role',
  'status',
  'email_verified',
  'email_verified_at',
  'created_at',
  'updated_at',
  'deleted_at',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getConfig() {
  for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
    if (!process.env[key]?.trim()) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const rawPort = process.env.DB_PORT || '3306';
  const port = Number(rawPort);

  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('DB_PORT must be between 1 and 65535.');
  }

  return {
    host: process.env.DB_HOST.trim(),
    port,
    user: process.env.DB_USER.trim(),
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME.trim(),
    connectTimeout: 10000,
    charset: 'utf8mb4',
    multipleStatements: false,
  };
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND table_type = 'BASE TABLE'`,
    [tableName],
  );

  return Number(rows[0].total) === 1;
}

async function getColumns(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT column_name, is_nullable, column_default, extra
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName],
  );

  return new Map(rows.map((row) => [row.column_name, row]));
}

async function getConstraints(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT
       tc.constraint_name,
       tc.constraint_type,
       kcu.column_name,
       kcu.referenced_table_name,
       kcu.referenced_column_name
     FROM information_schema.table_constraints AS tc
     LEFT JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_schema = kcu.constraint_schema
      AND tc.table_name = kcu.table_name
      AND tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_schema = DATABASE()
       AND tc.table_name = ?
     ORDER BY tc.constraint_name, kcu.ordinal_position`,
    [tableName],
  );

  return rows;
}

async function getForeignKeys(connection, tableNames) {
  const result = [];

  for (const tableName of tableNames) {
    const constraints = await getConstraints(connection, tableName);

    for (const constraint of constraints) {
      if (
        constraint.constraint_type === 'FOREIGN KEY' &&
        constraint.referenced_table_name
      ) {
        result.push({
          table: tableName,
          column: constraint.column_name,
          constraint: constraint.constraint_name,
          referencedTable: constraint.referenced_table_name,
          referencedColumn: constraint.referenced_column_name,
        });
      }
    }
  }

  return result;
}

function hasForeignKey(foreignKeys, table, referencedTable) {
  return foreignKeys.some(
    (key) =>
      key.table === table &&
      key.referencedTable === referencedTable,
  );
}

async function checkUserConstraints(connection) {
  const constraints = await getConstraints(connection, 'users');

  const uniqueColumns = new Set(
    constraints
      .filter((item) => item.constraint_type === 'UNIQUE')
      .map((item) => item.column_name),
  );

  assert(
    uniqueColumns.has('email'),
    'users.email is missing a UNIQUE constraint.',
  );

  assert(
    uniqueColumns.has('public_id'),
    'users.public_id is missing a UNIQUE constraint.',
  );

  const checks = new Set(
    constraints
      .filter((item) => item.constraint_type === 'CHECK')
      .map((item) => item.constraint_name),
  );

  const expectedChecks = [
    'chk_users_role',
    'chk_users_status',
    'chk_users_name_not_blank',
    'chk_users_email_not_blank',
    'chk_users_password_hash_not_blank',
    'chk_users_email_verified_consistency',
    'chk_users_phone_verified_consistency',
    'chk_users_phone_required_when_verified',
    'chk_users_deleted_consistency',
  ];

  const missingChecks = expectedChecks.filter(
    (name) => !checks.has(name),
  );

  assert(
    missingChecks.length === 0,
    `Missing users CHECK constraints: ${missingChecks.join(', ')}`,
  );
}

async function checkMigrationHistory(connection, tables) {
  if (!tables.has('schema_migrations')) {
    return {
      available: false,
      appliedMigrations: null,
      message: 'schema_migrations table is not present.',
    };
  }

  const columns = await getColumns(connection, 'schema_migrations');

  if (!columns.has('migration')) {
    return {
      available: false,
      appliedMigrations: null,
      message: 'schema_migrations is missing its migration column.',
    };
  }

  const [rows] = await connection.query(
    'SELECT COUNT(*) AS total FROM schema_migrations',
  );

  return {
    available: true,
    appliedMigrations: Number(rows[0].total),
    message: 'Migration history is available.',
  };
}

async function testUserInsertion(connection) {
  const suffix = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const email = `auth-test-${suffix}@example.invalid`;

  const [insertResult] = await connection.execute(
    `INSERT INTO users
      (public_id, name, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      publicId,
      'MedOrbits Integration Test',
      email,
      '$2b$12$integration_test_placeholder_hash',
      'user',
      'pending',
    ],
  );

  assert(
    Number(insertResult.affectedRows) === 1,
    'Test user was not inserted.',
  );

  const [rows] = await connection.execute(
    `SELECT
       id,
       public_id,
       name,
       email,
       password_hash,
       status,
       email_verified,
       email_verified_at,
       phone_verified,
       phone_verified_at,
       deleted_at
     FROM users
     WHERE id = ?`,
    [insertResult.insertId],
  );

  assert(rows.length === 1, 'Inserted user could not be retrieved.');

  const user = rows[0];

  assert(user.public_id === publicId, 'Public ID does not match.');
  assert(user.email === email, 'Email does not match.');
  assert(user.status === 'pending', 'Unexpected initial user status.');

  assert(
    Number(user.email_verified) === 0,
    'Email verification should default to false.',
  );

  assert(
    user.email_verified_at === null,
    'Unverified email must have a NULL verification timestamp.',
  );

  assert(
    Number(user.phone_verified) === 0,
    'Phone verification should default to false.',
  );

  assert(
    user.phone_verified_at === null,
    'Unverified phone must have a NULL verification timestamp.',
  );

  assert(user.deleted_at === null, 'New user must not be deleted.');

  return { userId: insertResult.insertId, email };
}

async function testDuplicateEmail(connection, email) {
  let rejected = false;

  try {
    await connection.execute(
      `INSERT INTO users
        (public_id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        'Duplicate Email Test',
        email,
        '$2b$12$integration_test_placeholder_hash',
        'user',
        'pending',
      ],
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      rejected = true;
    } else {
      throw error;
    }
  }

  assert(rejected, 'Duplicate email was not rejected by the database.');
}

async function testInvalidRole(connection) {
  let rejected = false;

  try {
    await connection.execute(
      `INSERT INTO users
        (public_id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        'Invalid Role Test',
        `invalid-role-${crypto.randomUUID()}@example.invalid`,
        '$2b$12$integration_test_placeholder_hash',
        'superuser',
        'pending',
      ],
    );
  } catch (error) {
    if (
      error.code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
      error.errno === 3819
    ) {
      rejected = true;
    } else {
      throw error;
    }
  }

  assert(
    rejected,
    'Invalid legacy role was not rejected by chk_users_role.',
  );
}

async function run() {
  const connection = await mysql.createConnection(getConfig());
  const passed = [];
  const warnings = [];

  try {
    const [health] = await connection.query(
      'SELECT 1 AS healthy, DATABASE() AS database_name',
    );

    assert(
      Number(health[0].healthy) === 1,
      'Database health query failed.',
    );

    passed.push('Database connection');

    const tableMap = new Map();

    for (const tableName of REQUIRED_TABLES) {
      tableMap.set(
        tableName,
        await tableExists(connection, tableName),
      );
    }

    const missingTables = REQUIRED_TABLES.filter(
      (tableName) => !tableMap.get(tableName),
    );

    assert(
      missingTables.length === 0,
      `Missing required authentication/RBAC tables: ${missingTables.join(', ')}`,
    );

    passed.push('Required authentication and RBAC tables exist');

    const userColumns = await getColumns(connection, 'users');

    const missingColumns = REQUIRED_USER_COLUMNS.filter(
      (name) => !userColumns.has(name),
    );

    assert(
      missingColumns.length === 0,
      `Missing users columns: ${missingColumns.join(', ')}`,
    );

    passed.push('Required users columns exist');

    await checkUserConstraints(connection);
    passed.push('User uniqueness and CHECK constraints exist');

    const foreignKeys = await getForeignKeys(
      connection,
      REQUIRED_TABLES,
    );

    assert(
      hasForeignKey(foreignKeys, 'user_roles', 'users'),
      'user_roles must reference users through a foreign key.',
    );

    assert(
      hasForeignKey(foreignKeys, 'user_roles', 'roles'),
      'user_roles must reference roles through a foreign key.',
    );

    assert(
      hasForeignKey(foreignKeys, 'role_permissions', 'roles'),
      'role_permissions must reference roles through a foreign key.',
    );

    assert(
      hasForeignKey(foreignKeys, 'role_permissions', 'permissions'),
      'role_permissions must reference permissions through a foreign key.',
    );

    passed.push('Core RBAC foreign-key relationships exist');

    const migrationHistory = await checkMigrationHistory(
      connection,
      tableMap,
    );

    if (migrationHistory.available) {
      passed.push('Migration history is accessible');
    } else {
      warnings.push(migrationHistory.message);
    }

    // These tests insert data only inside a transaction and then roll back.
    // Run against a dedicated test database, never production.
    await connection.beginTransaction();

    try {
      const { email } = await testUserInsertion(connection);
      passed.push('User insertion and default verification state');

      await testDuplicateEmail(connection, email);
      passed.push('Duplicate email rejected');

      await testInvalidRole(connection);
      passed.push('Invalid legacy role rejected');

      await connection.rollback();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    return {
      ok: true,
      database: health[0].database_name,
      passed,
      warnings,
      foreignKeysFound: foreignKeys.length,
      migrationHistory,
    };
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  run()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(`[auth-rbac-test] ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  REQUIRED_TABLES,
  REQUIRED_USER_COLUMNS,
  checkMigrationHistory,
  checkUserConstraints,
  getColumns,
  getConfig,
  getConstraints,
  getForeignKeys,
  run,
  tableExists,
  testDuplicateEmail,
  testInvalidRole,
  testUserInsertion,
};
