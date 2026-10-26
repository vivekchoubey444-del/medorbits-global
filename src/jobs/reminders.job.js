
'use strict';

/**
 * MedOrbits -- Reminders Job
 *
 * File: src/jobs/reminders.job.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Discover due reminders through reminderService.
 * - Enqueue individual reminder tasks for a queue worker.
 * - Enforce bounded batches and retry limits.
 * - Generate stable job identifiers to reduce duplicate queue entries.
 * - Skip malformed reminder records safely.
 * - Report outcomes through structured logging.
 *
 * This job enqueues reminder work; it does not deliver reminders itself.
 *
 * Security and reliability:
 * - Workers must independently validate payloads and reminder eligibility.
 * - Reminder delivery must be idempotent.
 * - Queue-level deduplication depends on the configured queue implementation.
 * - Do not log reminder contents or sensitive recipient information.
 */

const QUEUE_NAME = 'reminders';

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1_000;

const DEFAULT_ATTEMPTS = 5;
const MAX_ATTEMPTS = 10;

const MAX_REMINDER_ID_LENGTH = 200;

function validateObject(value, name) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${name} must be an object.`);
  }
}

function validatePositiveInteger(
  value,
  name,
  fallback,
  maximum,
) {
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

function validateDependencies(deps) {
  validateObject(deps, 'dependencies');

  if (!deps.queue || typeof deps.queue.add !== 'function') {
    throw new TypeError('queue.add is required.');
  }

  if (
    !deps.reminderService ||
    typeof deps.reminderService.getDue !== 'function'
  ) {
    throw new TypeError(
      'reminderService.getDue is required.',
    );
  }
}

function log(logger, level, fields) {
  if (logger && typeof logger[level] === 'function') {
    logger[level](fields);
  }
}

function getReminderId(item) {
  if (
    !item ||
    typeof item !== 'object' ||
    Array.isArray(item) ||
    item.id === undefined ||
    item.id === null
  ) {
    return null;
  }

  if (
    typeof item.id !== 'string' &&
    typeof item.id !== 'number'
  ) {
    return null;
  }

  const id = String(item.id).trim();

  if (
    !id ||
    id.length > MAX_REMINDER_ID_LENGTH ||
    /[\u0000-\u001F\u007F]/u.test(id)
  ) {
    return null;
  }

  return id;
}

function normalizeDate(value) {
  const date = value === undefined
    ? new Date()
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('asOf must be a valid date.');
  }

  return date;
}

async function runRemindersJob(deps = {}, options = {}) {
  validateDependencies(deps);
  validateObject(options, 'options');

  const batchSize = validatePositiveInteger(
    options.batchSize,
    'batchSize',
    DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE,
  );

  const attempts = validatePositiveInteger(
    options.attempts,
    'attempts',
    DEFAULT_ATTEMPTS,
    MAX_ATTEMPTS,
  );

  const now = normalizeDate(options.asOf);
  const scheduledAt = now.toISOString();

  log(deps.logger, 'info', {
    event: 'reminders_job_started',
    queue: QUEUE_NAME,
    batchSize,
    scheduledAt,
  });

  const due = await deps.reminderService.getDue({
    limit: batchSize,
    asOf: new Date(now.getTime()),
  });

  if (!Array.isArray(due)) {
    throw new TypeError(
      'reminderService.getDue must return an array.',
    );
  }

  if (due.length > batchSize) {
    throw new Error(
      'reminderService.getDue returned more items than requested.',
    );
  }

  let enqueued = 0;
  let skipped = 0;
  let failed = 0;

  const seenIds = new Set();

  for (const item of due) {
    const reminderId = getReminderId(item);

    if (!reminderId) {
      skipped += 1;

      log(deps.logger, 'warn', {
        event: 'reminder_job_item_skipped',
        reason: 'invalid_reminder_id',
      });

      continue;
    }

    if (seenIds.has(reminderId)) {
      skipped += 1;

      log(deps.logger, 'warn', {
        event: 'reminder_job_item_skipped',
        reason: 'duplicate_reminder_id',
      });

      continue;
    }

    seenIds.add(reminderId);

    const jobId = `reminder:${reminderId}`;

    try {
      await deps.queue.add(
        QUEUE_NAME,
        {
          reminderId,
          scheduledAt,
        },
        {
          jobId,
          attempts,
        },
      );

      enqueued += 1;
    } catch (error) {
      failed += 1;

      log(deps.logger, 'error', {
        event: 'reminder_job_enqueue_failed',
        reminderId,
        errorName:
          error && typeof error.name === 'string'
            ? error.name
            : 'Error',
      });
    }
  }

  const result = {
    scanned: due.length,
    enqueued,
    skipped,
    failed,
    queue: QUEUE_NAME,
    scheduledAt,
  };

  log(deps.logger, failed > 0 ? 'warn' : 'info', {
    event: 'reminders_job_completed',
    ...result,
  });

  if (failed > 0 && options.throwOnEnqueueFailure === true) {
    const error = new Error(
      `Failed to enqueue ${failed} reminder job(s).`,
    );

    error.code = 'REMINDER_ENQUEUE_FAILED';
    error.result = result;

    throw error;
  }

  return result;
}

module.exports = {
  QUEUE_NAME,
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  DEFAULT_ATTEMPTS,
  MAX_ATTEMPTS,
  MAX_REMINDER_ID_LENGTH,
  runRemindersJob,
};
