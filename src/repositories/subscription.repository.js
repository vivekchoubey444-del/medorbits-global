'use strict';

/**
 * MedOrbits -- Subscription Repository
 *
 * File: src/repositories/subscription.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/subscription.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Subscription model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});