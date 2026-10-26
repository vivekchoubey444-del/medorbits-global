'use strict';

/**
 * MedOrbits -- Course Repository
 *
 * File: src/repositories/course.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/course.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Course model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});