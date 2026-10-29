'use strict';
const { json, methodOnly, requestId } = require('../_lib/http');

module.exports = async function health(req, res) {
  const id = requestId(req);
  if (methodOnly(req, res, ['GET', 'HEAD'])) return;
  json(res, 200, {
    status: 'ok',
    service: 'medorbits-api',
    timestamp: new Date().toISOString(),
    requestId: id,
    checks: { api: 'ok', database: process.env.DATABASE_URL ? 'configured' : 'not_configured' }
  });
};
