'use strict';

/**
 * MedOrbits -- Reminders Worker
 *
 * File: src/workers/reminders.worker.js
 *
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Process reminder jobs through an injected reminder service.
 * - Supply a stable idempotency key for retry protection.
 * - Validate job payloads and required dependencies.
 * - Log job outcomes without logging reminder payloads.
 * - Integrate with the shared worker runtime.
 */

const QUEUE_NAME = 'reminders';

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

function validateReminderJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    throw new TypeError('Reminder job must be an object.');
  }

  if (
    job.id === undefined ||
    job.id === null ||
    String(job.id).trim() === ''
  ) {
    throw new TypeError('Reminder job requires a valid id.');
  }

  if (
    !job.data ||
    typeof job.data !== 'object' ||
    Array.isArray(job.data)
  ) {
    throw new TypeError('Reminder job requires an object data payload.');
  }
}

function validateDependencies(deps) {
  if (
    !deps.reminderService ||
    typeof deps.reminderService.deliver !== 'function'
  ) {
    throw new TypeError('reminderService.deliver is required.');
  }
}

async function processReminderJob(job, deps = {}) {
  validateReminderJob(job);
  validateDependencies(deps);

  const logger = loggerOf(deps.logger);
  const jobId = String(job.id);

  try {
    const result = await deps.reminderService.deliver(job.data, {
      idempotencyKey: `reminder:${jobId}`,
    });

    logger.info({
      event: 'reminder_job_completed',
      jobId,
    });

    return result;
  } catch (error) {
    logger.error({
      event: 'reminder_job_failed',
      jobId,
      errorName: error instanceof Error && error.name
        ? error.name
        : 'Error',
      message: error instanceof Error
        ? error.message
        : 'Unknown reminder error',
    });

    throw error;
  }
}

function createRemindersWorker(deps = {}) {
  validateDependencies(deps);

  return async function reminderJobHandler(job) {
    return processReminderJob(job, deps);
  };
}

function startRemindersWorker(options = {}) {
  const { startPollingWorker } = require('./worker-runtime');

  return startPollingWorker({
    ...options,
    queueName: options.queueName || QUEUE_NAME,
    handler: createRemindersWorker(options),
  });
}

module.exports = {
  QUEUE_NAME,
  validateReminderJob,
  validateDependencies,
  processReminderJob,
  createRemindersWorker,
  startRemindersWorker,
};