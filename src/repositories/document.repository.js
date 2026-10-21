'use strict';

/**
 * MedOrbits -- Document Repository
 *
 * File: src/repositories/document.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/document.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Document model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});