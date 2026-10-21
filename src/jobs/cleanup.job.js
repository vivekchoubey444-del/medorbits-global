'use strict';

/**
 * MedOrbits -- Cleanup Job
 *
 * File: src/jobs/cleanup.job.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Build a cleanup plan through cleanupService.
 * - Enqueue cleanup work for a queue worker.
 * - Default to dry-run mode.
 * - Require explicit authorization for destructive execution.
 * - Generate stable, bounded job identifiers.
 * - Validate queue and service dependencies.
 *
 * This job schedules cleanup work; it does not delete records itself.
 *
 * Security:
 * - Destructive execution requires explicit authorization.
 * - Workers must independently enforce destructive-operation controls.
 * - Cleanup plans must be validated by the worker before execution.
 * - Queue retries must be safe and cleanup operations idempotent.
 */

const QUEUE_NAME = 'cleanup';

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 5_000;

const DEFAULT_ATTEMPTS = 3;
const MAX_ATTEMPTS = 10;

const DEFAULT_RETENTION_DAYS = 90;
const MAX_RETENTION_DAYS = 3_650;

const MAX_JOB_ID_LENGTH = 200;

function validateObject(value, name) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${name} must be an object.`);
  }
}

function positiveInteger(value, name, fallback, maximum) {
  const resolved = value == null ? fallback : value;

  if (
    !Number.isSafeInteger(resolved) ||
    resolved < 1 ||
    resolved > maximum
  ) {
    throw new RangeError(
      `${name} must be an integer between 1 and ${maximum}.`,
    );
  }

  return resolved;
}

function normalizeDate(value, name, fallback = new Date()) {
  let date;

  if (value == null) {
    date = new Date(fallback);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${name} must be a valid date.`);
  }

  return date;
}

function validateJobId(value, fallback) {
  if (value == null) {
    return fallback;
  }

  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > MAX_JOB_ID_LENGTH ||
    /[\u0000-\u001F\u007F]/u.test(value)
  ) {
    throw new TypeError(
      `jobId must be a non-empty string of at most ${MAX_JOB_ID_LENGTH} characters without control characters.`,
    );
  }

  return value.trim();
}

function log(logger, level, data) {
  if (logger && typeof logger[level] === 'function') {
    logger[level](data);
  }
}

function validatePlan(plan) {
  if (
    plan === null ||
    typeof plan !== 'object' ||
    Array.isArray(plan)
  ) {
    throw new TypeError(
      'cleanupService.buildPlan must return a plan object.',
    );
  }

  return plan;
}

async function runCleanupJob(deps = {}, options = {}) {
  validateObject(deps, 'Job dependencies');
  validateObject(options, 'Cleanup options');

  if (!deps.queue || typeof deps.queue.add !== 'function') {
    throw new TypeError('queue.add is required.');
  }

  if (
    !deps.cleanupService ||
    typeof deps.cleanupService.buildPlan !== 'function'
  ) {
    throw new TypeError('cleanupService.buildPlan is required.');
  }

  const dryRun = options.dryRun !== false;

  if (typeof options.dryRun !== 'undefined' &&
      typeof options.dryRun !== 'boolean') {
    throw new TypeError('dryRun must be a boolean.');
  }

  if (!dryRun && options.allowDestructive !== true) {
    throw new Error(
      'Destructive cleanup requires allowDestructive: true.',
    );
  }

  const retentionDays = positiveInteger(
    options.retentionDays,
    'retentionDays',
    DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
  );

  const batchSize = positiveInteger(
    options.batchSize,
    'batchSize',
    DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE,
  );

  const attempts = positiveInteger(
    options.attempts,
    'attempts',
    DEFAULT_ATTEMPTS,
    MAX_ATTEMPTS,
  );

  const asOf = normalizeDate(options.asOf, 'asOf');
  const requestedAt = new Date().toISOString();

  const defaultJobId = [
    QUEUE_NAME,
    asOf.toISOString().slice(0, 10),
    dryRun ? 'dry-run' : 'execute',
  ].join(':');

  const jobId = validateJobId(options.jobId, defaultJobId);

  log(deps.logger, 'info', {
    event: 'cleanup_plan_started',
    queue: QUEUE_NAME,
    dryRun,
    jobId,
    retentionDays,
    batchSize,
    asOf: asOf.toISOString(),
  });

  const plan = validatePlan(
    await deps.cleanupService.buildPlan({
      dryRun,
      retentionDays,
      limit: batchSize,
      asOf,
    }),
  );

  const payload = {
    plan,
    dryRun,
    retentionDays,
    batchSize,
    asOf: asOf.toISOString(),
    requestedAt,
  };

  const queueOptions = {
    jobId,
    attempts,
  };

  await deps.queue.add(
    QUEUE_NAME,
    payload,
    queueOptions,
  );

  log(deps.logger, 'info', {
    event: 'cleanup_job_enqueued',
    queue: QUEUE_NAME,
    dryRun,
    jobId,
    retentionDays,
    batchSize,
  });

  return {
    enqueued: true,
    dryRun,
    jobId,
    queue: QUEUE_NAME,
  };
}

module.exports = {
  QUEUE_NAME,
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  DEFAULT_ATTEMPTS,
  MAX_ATTEMPTS,
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  runCleanupJob,
};