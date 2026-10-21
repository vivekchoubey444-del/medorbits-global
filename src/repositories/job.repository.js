'use strict';

/**
 * MedOrbits -- Job Repository
 *
 * File: src/repositories/job.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/job.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Job model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});