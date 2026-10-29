  'use strict';

  let pool;

  function getPool() {
    if (!process.env.DATABASE_URL) {
      const error = new Error('Database is not configured. Set DATABASE_URL before enabling form submissions.');
      error.statusCode = 503;
      throw error;
    }
    if (!pool) {
      const { Pool } = require('pg');
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number.parseInt(process.env.PG_POOL_MAX || '5', 10),
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
        ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
      });
    }
    return pool;
  }

  async function insertSubmission(kind, data, metadata = {}) {
    const db = getPool();
    const result = await db.query(
      `INSERT INTO api_submissions (kind, name, email, phone, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, created_at`,
      [kind, data.name || null, data.email || null, data.phone || null, data.message || null, JSON.stringify(metadata)]
    );
    return result.rows[0];
  }

  module.exports = { getPool, insertSubmission };
