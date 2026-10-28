
'use strict';

function positiveInteger(value, fallback) {
  if (value === undefined || value === '') return fallback;

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error('Monitoring configuration must be a positive integer.');
  }

  return number;
}

function loadMonitoringConfig(env = process.env) {
  return Object.freeze({
    enabled: env.MONITORING_ENABLED !== 'false',

    serviceName: env.MONITORING_SERVICE_NAME || 'medorbits-api',

    environment: env.NODE_ENV || 'development',

    metricsEnabled: env.MONITORING_METRICS_ENABLED !== 'false',

    metricsToken: env.MONITORING_METRICS_TOKEN || '',

    maxEventBytes: positiveInteger(
      env.MONITORING_MAX_EVENT_BYTES,
      16384
    ),

    logLevel: env.LOG_LEVEL || 'info',

    logDirectory: env.MONITORING_LOG_DIR || '',

    alertWebhookUrl: env.MONITORING_ALERT_WEBHOOK_URL || '',

    alertCooldownMs: positiveInteger(
      env.MONITORING_ALERT_COOLDOWN_MS,
      300000
    ),

    requestSlowMs: positiveInteger(
      env.MONITORING_SLOW_REQUEST_MS,
      2000
    ),

    retentionDays: positiveInteger(
      env.MONITORING_RETENTION_DAYS,
      14
    ),

    healthTimeoutMs: positiveInteger(
      env.MONITORING_HEALTH_TIMEOUT_MS,
      3000
    ),
  });
}

module.exports = { loadMonitoringConfig };
