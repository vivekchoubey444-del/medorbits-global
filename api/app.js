'use strict';

const express = require('express');
const { apiLimiter } = require('./middleware/rate-limit');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(apiLimiter);

const health = require('./routes/health');
app.use('/api/health', health);

for (const [mount, file] of [
  ['/api/documents', './routes/documents'],
  ['/api/applications', './routes/applications'],
  ['/api/admissions', './routes/admissions'],
  ['/api/users', './routes/users'],
  ['/api/support', './routes/support'],
  ['/api/jobs', './routes/jobs'],
]) {
  app.use(mount, require(file));
}

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  app.listen(port, () => {
    console.log(`MedOrbits API listening on port ${port}`);
  });
}

module.exports = app;
