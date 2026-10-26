'use strict';

/**
 * MedOrbits -- Notifications Worker
 *
 * File: src/workers/notifications.worker.js
 *
 * Responsibilities:
 * - Process notification jobs through an injected notification service.
 * - Provide an idempotency key for duplicate-delivery protection.
 * - Log completion and failures without logging notification payloads.
 * - Support dependency injection for isolated unit testing.
 * - Integrate with the shared worker runtime.
 *
 * Runtime: Node.js >= 20
 */

const QUEUE_NAME = 'notifications';

const defaultLogger = Object.freeze({
  info() {},
  error() {},
});

function loggerOf(logger) {
  if (!logger) return defaultLogger;

  return {
    info: typeof logger.info === 'function'
      ? logger.info.bind(logger)
      : defaultLogger.info,
    error: typeof logger.error === 'function'
      ? logger.error.bind(logger)
      : defaultLogger.error,
  };
}

function validateNotificationJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    throw new TypeError('Notification job must be an object.');
  }

  if (
    job.id === undefined ||
    job.id === null ||
    String(job.id).trim() === ''
  ) {
    throw new TypeError('Notification job requires a valid id.');
  }

  if (
    !job.data ||
    typeof job.data !== 'object' ||
    Array.isArray(job.data)
  ) {
    throw new TypeError('Notification job requires an object data payload.');
  }
}

function validateDependencies(deps) {
  if (
    !deps.notificationService ||
    typeof deps.notificationService.send !== 'function'
  ) {
    throw new TypeError('notificationService.send is required.');
  }
}

async function processNotificationJob(job, deps = {}) {
  validateNotificationJob(job);
  validateDependencies(deps);

  const logger = loggerOf(deps.logger);
  const jobId = String(job.id);

  try {
    const result = await deps.notificationService.send(job.data, {
      idempotencyKey: `notification:${jobId}`,
    });

    logger.info({
      event: 'notification_job_completed',
      jobId,
    });

    return result;
  } catch (error) {
    logger.error({
      event: 'notification_job_failed',
      jobId,
      errorName: error instanceof Error && error.name
        ? error.name
        : 'Error',
      message: error instanceof Error
        ? error.message
        : 'Unknown notification error',
    });

    throw error;
  }
}

function createNotificationsWorker(deps = {}) {
  validateDependencies(deps);

  return async function notificationJobHandler(job) {
    return processNotificationJob(job, deps);
  };
}

function startNotificationsWorker(options = {}) {
  const { startPollingWorker } = require('./worker-runtime');

  return startPollingWorker({
    ...options,
    queueName: options.queueName || QUEUE_NAME,
    handler: createNotificationsWorker(options),
  });
}

module.exports = {
  QUEUE_NAME,
  validateNotificationJob,
  validateDependencies,
  processNotificationJob,
  createNotificationsWorker,
  startNotificationsWorker,
};