'use strict';

/**
 * MedOrbits -- Employer Repository
 *
 * File: src/repositories/employer.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/employer.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Employer model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});