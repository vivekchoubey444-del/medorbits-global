
'use strict';

const { loadMonitoringConfig } = require('./config');
const { createLogger } = require('./logger');
const { createMetrics } = require('./metrics');
const { createRequestMonitor } = require('./request-monitor');
const { createHealthHandlers } = require('./health');
const { createAlertManager } = require('./alerts');

function createMonitoring(options = {}) {
  const config = loadMonitoringConfig(options.env || process.env);

  const logger = createLogger({
    service: config.serviceName,
    level: config.logLevel,
  });

  const metrics = createMetrics();

  const alerts = createAlertManager({
    webhookUrl: config.alertWebhookUrl,
    cooldownMs: config.alertCooldownMs,
  });

  const health = createHealthHandlers({
    serviceName: config.serviceName,
    version: options.version || '1.0.0',
    timeoutMs: config.healthTimeoutMs,
    checks: options.checks || {},
  });

  const requestMiddleware = createRequestMonitor({
    metrics,
    logger,
    slowRequestMs: config.requestSlowMs,
  });

  function mount(app) {
    if (!config.enabled) return;

    app.use(requestMiddleware);

    app.get('/health/live', health.live);
    app.get('/health/ready', health.ready);

    if (config.metricsEnabled) {
      app.get('/internal/metrics', (req, res) => {
        if (config.metricsToken) {
          const authorization = req.get('authorization') || '';
          const supplied = authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : '';

          const crypto = require('node:crypto');
          const expectedBuffer = Buffer.from(config.metricsToken);
          const suppliedBuffer = Buffer.from(supplied);

          const valid =
            expectedBuffer.length === suppliedBuffer.length &&
            crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);

          if (!valid) {
            return res.status(401).json({
              error: 'Unauthorized',
            });
          }
        }

        res.setHeader(
          'Content-Type',
          'text/plain; version=0.0.4; charset=utf-8'
        );

        return res.status(200).send(metrics.prometheus());
      });
    }
  }

  return Object.freeze({
    config,
    logger,
    metrics,
    alerts,
    health,
    requestMiddleware,
    mount,
  });
}

module.exports = { createMonitoring };
