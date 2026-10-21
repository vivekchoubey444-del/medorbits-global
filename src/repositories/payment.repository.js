'use strict';

/**
 * MedOrbits -- Payment Repository
 *
 * File: src/repositories/payment.repository.js
 */

const { createRepository } = require('./base.repository');
const model = require('../models/payment.model');

if (!model || typeof model !== 'object') {
  throw new TypeError('Payment model must export a valid model definition.');
}

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});