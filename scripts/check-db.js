
#!/usr/bin/env node
'use strict';

require('dotenv').config();

const mysql = require('mysql2/promise');

const DEFAULT_PORT = 3306;
const CONNECTION_TIMEOUT_MS = 10000;

function getDatabaseConfig() {
  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const database = process.env.DB_NAME?.trim();
  const password = process.env.DB_PASSWORD;

  if (!host && !user && !database && !password) {
    return null;
  }

  const missing = [];

  if (!host) missing.push('DB_HOST');
  if (!user) missing.push('DB_USER');
  if (!database) missing.push('DB_NAME');

  if (missing.length > 0) {
    throw new Error(
      `Incomplete database configuration. Missing: ${missing.join(', ')}`
    );
  }

  const rawPort = process.env.DB_PORT?.trim() || String(DEFAULT_PORT);
  const port = Number(rawPort);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  return {
    host,
    port,
    user,
    password: password ?? '',
    database,
    connectTimeout: CONNECTION_TIMEOUT_MS,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    multipleStatements: false
  };
}

async function main() {
  let connection;

  try {
    const config = getDatabaseConfig();

    if (!config) {
      console.log('Database configuration not set; skipping database check.');
      return;
    }

    connection = await mysql.createConnection(config);

    await connection.query('SELECT 1 AS health_check');

    console.log('Database connection OK.');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main().catch((error) => {
  console.error(`Database check failed: ${error.message}`);
  process.exitCode = 1;
});
