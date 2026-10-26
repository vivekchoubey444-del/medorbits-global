'use strict';

/**
 * MedOrbits -- Internship Repository
 *
 * File: src/repositories/internship.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/internship.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Internship model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});