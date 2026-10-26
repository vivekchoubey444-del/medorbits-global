'use strict';

/**
 * MedOrbits -- User Repository
 *
 * File: src/repositories/user.repository.js */

const { createRepository } = require('./base.repository');
const model = require('../models/user.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('User model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});