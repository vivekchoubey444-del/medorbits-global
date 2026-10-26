'use strict';

/**
 * MedOrbits -- College Repository
 *
 * File: src/repositories/college.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/college.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('College model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});