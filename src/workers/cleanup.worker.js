'use strict';

/**
 * MedOrbits -- Cleanup Worker
 *
 * File: src/workers/cleanup.worker.js
 *
 * Responsibilities:
 * - Process cleanup jobs through an injected cleanup service.
 * - Default to dry-run mode unless explicitly disabled.
 * - Provide an idempotency key for safe retry handling.
 * - Log job completion and failures without exposing sensitive job data.
 * - Support dependency injection for isolated unit testing.
 *
 * Runtime: Node.js >= 20
 */

const QUEUE_NAME = 'cleanup';

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

function validateCleanupJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    throw new TypeError('Cleanup job must be an object.');
  }

  if (job.id === undefined || job.id === null || String(job.id).trim() === '') {
    throw new TypeError('Cleanup job requires a valid id.');
  }

  if (!job.data || typeof job.data !== 'object' || Array.isArray(job.data)) {
    throw new TypeError('Cleanup job requires an object data payload.');
  }

  if (
    job.data.dryRun !== undefined &&
    typeof job.data.dryRun !== 'boolean'
  ) {
    throw new TypeError('Cleanup job data.dryRun must be a boolean.');
  }
}

function validateDependencies(deps) {
  if (
    !deps.cleanupService ||
    typeof deps.cleanupService.run !== 'function'
  ) {
    throw new TypeError('cleanupService.run is required.');
  }
}

async function processCleanupJob(job, deps = {}) {
  validateCleanupJob(job);
  validateDependencies(deps);

  const logger = loggerOf(deps.logger);
  const jobId = String(job.id);

  try {
    const result = await deps.cleanupService.run(job.data, {
      // Destructive cleanup must be explicitly enabled by the job payload.
      dryRun: job.data.dryRun !== false,
      idempotencyKey: `cleanup:${jobId}`,
    });

    logger.info({
      event: 'cleanup_job_completed',
      jobId,
    });

    return result;
  } catch (error) {
    logger.error({
      event: 'cleanup_job_failed',
      jobId,
      errorName: error && error.name ? error.name : 'Error',
      message: error instanceof Error ? error.message : 'Unknown cleanup error',
    });

    throw error;
  }
}

function createCleanupWorker(deps = {}) {
  validateDependencies(deps);

  return async function cleanupJobHandler(job) {
    return processCleanupJob(job, deps);
  };
}

function startCleanupWorker(options = {}) {
  const {
    startPollingWorker,
  } = require('./worker-runtime');

  return startPollingWorker({
    ...options,
    queueName: options.queueName || QUEUE_NAME,
    handler: createCleanupWorker(options),
  });
}

module.exports = {
  QUEUE_NAME,
  validateCleanupJob,
  validateDependencies,
  processCleanupJob,
  createCleanupWorker,
  startCleanupWorker,
};