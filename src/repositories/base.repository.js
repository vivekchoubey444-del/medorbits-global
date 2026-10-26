'use strict';

/**
 * MedOrbits -- Base Repository
 *
 * File: src/repositories/base.repository.js
 * Runtime: Node.js >= 20
 *
 * MySQL-compatible repository factory.
 *
 * Security:
 * - Table and column identifiers must come from trusted model definitions.
 * - Client values are passed through parameterized queries.
 * - Update and delete operations support optional ownership filters.
 * - Pagination and sorting are validated.
 */

const { query } = require('../db');
const { getPagination } = require('../utils/http');

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;
const MAX_SEARCH_LENGTH = 100;
const MAX_STATUS_LENGTH = 50;

function createRepository({
  table,
  columns,
  searchable = [],
  defaultOrder = 'id',
}) {
  if (typeof table !== 'string' || !IDENTIFIER_PATTERN.test(table)) {
    throw new TypeError('Invalid repository table identifier.');
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new TypeError(`Repository "${table}" requires column definitions.`);
  }

  if (!Array.isArray(searchable)) {
    throw new TypeError('searchable must be an array.');
  }

  const uniqueColumns = [...new Set(columns)];

  for (const column of uniqueColumns) {
    if (typeof column !== 'string' || !IDENTIFIER_PATTERN.test(column)) {
      throw new TypeError(`Invalid column identifier in repository "${table}".`);
    }
  }

  for (const column of searchable) {
    if (
      typeof column !== 'string' ||
      !IDENTIFIER_PATTERN.test(column) ||
      !uniqueColumns.includes(column)
    ) {
      throw new TypeError(`Invalid searchable column in repository "${table}".`);
    }
  }

  if (
    typeof defaultOrder !== 'string' ||
    !IDENTIFIER_PATTERN.test(defaultOrder) ||
    !uniqueColumns.includes(defaultOrder)
  ) {
    throw new TypeError(`Invalid default ordering column for "${table}".`);
  }

  const allowed = new Set(uniqueColumns);

  function assertId(id) {
    if (
      id === undefined ||
      id === null ||
      (typeof id === 'string' && id.trim() === '') ||
      (typeof id === 'number' && (!Number.isSafeInteger(id) || id <= 0))
    ) {
      throw Object.assign(new Error('A valid record ID is required.'), {
        status: 400,
        code: 'INVALID_ID',
        publicMessage: 'A valid record ID is required.',
      });
    }
  }

  function assertObject(data, operation) {
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      Object.getPrototypeOf(data) !== Object.prototype
    ) {
      throw Object.assign(new Error(`Invalid ${operation} payload.`), {
        status: 400,
        code: 'INVALID_INPUT',
        publicMessage: `A valid ${operation} payload is required.`,
      });
    }
  }

  function inputError(message, code = 'EMPTY_INPUT') {
    return Object.assign(new Error(message), {
      status: 400,
      code,
      publicMessage: message,
    });
  }

  function filterEntries(data, { excludeId = false } = {}) {
    return Object.entries(data).filter(([key, value]) => (
      allowed.has(key) &&
      value !== undefined &&
      !(excludeId && key === 'id')
    ));
  }

  function buildWhere(params = {}) {
    const where = [];
    const values = [];

    if (params.q !== undefined && params.q !== null && String(params.q).trim()) {
      if (searchable.length) {
        const term = String(params.q).trim().slice(0, MAX_SEARCH_LENGTH);
        const escapedTerm = term.replace(/[\\%_]/g, '\\$&');
        const pattern = `%${escapedTerm}%`;

        where.push(
          `(${searchable.map((column) => `\`${column}\` LIKE ? ESCAPE '\\\\'`).join(' OR ')})`
        );

        searchable.forEach(() => values.push(pattern));
      }
    }

    if (params.status !== undefined && params.status !== null && allowed.has('status')) {
      const status = String(params.status).trim();

      if (!status || status.length > MAX_STATUS_LENGTH) {
        throw inputError('Invalid status filter.', 'INVALID_STATUS');
      }

      where.push('`status` = ?');
      values.push(status);
    }

    if (params.user_id !== undefined && params.user_id !== null && allowed.has('user_id')) {
      where.push('`user_id` = ?');
      values.push(params.user_id);
    }

    return {
      sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
      values,
    };
  }

  async function findById(id) {
    assertId(id);

    const rows = await query(
      `SELECT * FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`,
      [id]
    );

    return rows[0] || null;
  }

  async function list(params = {}) {
    assertObject(params, 'list');

    const pagination = getPagination(params);
    const { page, limit, offset } = pagination;

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      !Number.isSafeInteger(offset) ||
      page < 1 ||
      limit < 1 ||
      offset < 0
    ) {
      throw inputError('Invalid pagination parameters.', 'INVALID_PAGINATION');
    }

    const { sql: whereSql, values } = buildWhere(params);

    const sort = typeof params.sort === 'string' ? params.sort : '';
    const orderColumn = allowed.has(sort) ? sort : defaultOrder;
    const direction = String(params.order || '').toLowerCase() === 'asc'
      ? 'ASC'
      : 'DESC';

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM \`${table}\` ${whereSql}`,
      values
    );

    const total = Number(countRows[0]?.total ?? 0);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error(`Invalid count returned by repository "${table}".`);
    }

    const items = await query(
      `SELECT * FROM \`${table}\` ${whereSql}
       ORDER BY \`${orderColumn}\` ${direction}
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async function create(data) {
    assertObject(data, 'create');

    const entries = filterEntries(data);

    if (!entries.length) {
      throw inputError('No valid fields supplied.');
    }

    // Prevent callers from explicitly setting an auto-incrementing primary key.
    if (entries.some(([key]) => key === 'id')) {
      throw inputError('The record ID cannot be supplied when creating a record.', 'IMMUTABLE_FIELD');
    }

    const columnsSql = entries.map(([key]) => `\`${key}\``).join(', ');
    const placeholders = entries.map(() => '?').join(', ');

    const result = await query(
      `INSERT INTO \`${table}\` (${columnsSql}) VALUES (${placeholders})`,
      entries.map(([, value]) => value)
    );

    if (!result || result.insertId === undefined || result.insertId === null) {
      throw new Error(`Insert did not return an ID for repository "${table}".`);
    }

    return findById(result.insertId);
  }

  async function update(id, data) {
    assertId(id);
    assertObject(data, 'update');

    const entries = filterEntries(data, { excludeId: true });

    // updated_at is maintained only if it is part of the trusted model schema.
    const hasUpdatedAt = allowed.has('updated_at');
    const assignments = entries.map(([key]) => `\`${key}\` = ?`);

    if (hasUpdatedAt && !entries.some(([key]) => key === 'updated_at')) {
      assignments.push('`updated_at` = CURRENT_TIMESTAMP');
    }

    if (!assignments.length) {
      throw inputError('No valid fields supplied.');
    }

    const values = entries.map(([, value]) => value);

    const result = await query(
      `UPDATE \`${table}\`
       SET ${assignments.join(', ')}
       WHERE \`id\` = ?`,
      [...values, id]
    );

    // Some MySQL drivers report affectedRows = 0 for a matching record
    // when all submitted values are unchanged. Check existence separately.
    if (!result || result.affectedRows === 0) {
      return findById(id);
    }

    return findById(id);
  }

  async function remove(id) {
    assertId(id);

    const result = await query(
      `DELETE FROM \`${table}\` WHERE \`id\` = ?`,
      [id]
    );

    return Boolean(result && result.affectedRows > 0);
  }

  /**
   * Conditional update for state transitions.
   * Returns the updated record or null when the expected current state
   * did not match. This must run against a repository/model that has
   * a "status" column.
   */
  async function updateIfStatusMatches(id, expectedStatus, data) {
    assertId(id);
    assertObject(data, 'conditional update');

    if (!allowed.has('status')) {
      throw new Error(`Repository "${table}" does not support status transitions.`);
    }

    if (expectedStatus === undefined || expectedStatus === null) {
      throw inputError('Expected status is required.', 'INVALID_STATUS');
    }

    const entries = filterEntries(data, { excludeId: true });

    if (entries.some(([key]) => key === 'status')) {
      // Status is set explicitly by the transition payload and is allowed.
    }

    const assignments = entries.map(([key]) => `\`${key}\` = ?`);

    if (allowed.has('updated_at') && !entries.some(([key]) => key === 'updated_at')) {
      assignments.push('`updated_at` = CURRENT_TIMESTAMP');
    }

    if (!assignments.length) {
      throw inputError('No valid fields supplied.');
    }

    const result = await query(
      `UPDATE \`${table}\`
       SET ${assignments.join(', ')}
       WHERE \`id\` = ? AND \`status\` = ?`,
      [...entries.map(([, value]) => value), id, expectedStatus]
    );

    if (!result || result.affectedRows === 0) {
      return null;
    }

    return findById(id);
  }

  return {
    table,
    columns: [...uniqueColumns],
    findById,
    list,
    create,
    update,
    remove,
    updateIfStatusMatches,
  };
}

module.exports = { createRepository };