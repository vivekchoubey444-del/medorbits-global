'use strict';

/**
 * MedOrbits -- University Repository
 *
 * File: src/repositories/university.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/university.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('University model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});