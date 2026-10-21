'use strict';

/**
 * MedOrbits -- Candidate Repository
 *
 * File: src/repositories/candidate.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/candidate.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Candidate model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});