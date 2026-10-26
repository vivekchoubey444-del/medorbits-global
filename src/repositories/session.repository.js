'use strict';

/**
 * MedOrbits -- Session Repository
 *
 * File: src/repositories/session.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/session.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Session model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});