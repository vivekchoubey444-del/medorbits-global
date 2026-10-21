
'use strict';

/**
 * MedOrbits -- Background Queue Configuration
 * File: src/config/queue.js
 *
 * Responsibilities:
 * - Configure Redis-backed BullMQ queues.
 * - Reuse queue instances by name.
 * - Validate queue names and job options.
 * - Prevent duplicate queue initialization.
 * - Support graceful shutdown.
 * - Avoid logging credentials or sensitive job payloads.
 *
 * Dependencies:
 * - bullmq
 * - ./redis
 * - ./env
 * - ./logger
 *
 * IMPORTANT:
 * Queue payloads should contain opaque identifiers rather than
 * passwords, OTPs, payment credentials, or document contents.
 */

const { Queue } = require('bullmq');
const { connectRedis } = require('./redis');
const { env } = require('./env');
const logger = require('./logger');

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 1000;
const DEFAULT_REMOVE_ON_COMPLETE = 1000;
const DEFAULT_REMOVE_ON_FAIL = 5000;

const QUEUE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,99}$/;

const queues = new Map();
const queuePromises = new Map();

let closing = false;
let closePromise;

function isQueueEnabled() {
  return env.QUEUE_ENABLED === true;
}

function validateQueueName(name) {
  if (
    typeof name !== 'string' ||
    !QUEUE_NAME_PATTERN.test(name)
  ) {
    throw new TypeError(
      'Queue name must be 1–100 characters and contain only letters, numbers, colons, underscores, or hyphens.'
    );
  }

  return name;
}

function validateJobOptions(options = {}) {
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Job options must be an object.');
  }

  const normalized = { ...options };

  if (normalized.attempts !== undefined) {
    if (
      !Number.isSafeInteger(normalized.attempts) ||
      normalized.attempts < 1 ||
      normalized.attempts > 20
    ) {
      throw new Error(
        'Job attempts must be an integer between 1 and 20.'
      );
    }
  }

  if (normalized.delay !== undefined) {
    if (
      !Number.isSafeInteger(normalized.delay) ||
      normalized.delay < 0 ||
      normalized.delay > 86400000
    ) {
      throw new Error(
        'Job delay must be between 0 and 86400000 milliseconds.'
      );
    }
  }

  if (normalized.priority !== undefined) {
    if (
      !Number.isSafeInteger(normalized.priority) ||
      normalized.priority < 1 ||
      normalized.priority > 2097152
    ) {
      throw new Error(
        'Job priority must be an integer between 1 and 2097152.'
      );
    }
  }

  if (normalized.backoff !== undefined) {
    const backoff = normalized.backoff;

    if (
      !backoff ||
      typeof backoff !== 'object' ||
      Array.isArray(backoff)
    ) {
      throw new TypeError('Job backoff must be an object.');
    }

    if (
      !['fixed', 'exponential'].includes(backoff.type) ||
      !Number.isSafeInteger(backoff.delay) ||
      backoff.delay < 0 ||
      backoff.delay > 3600000
    ) {
      throw new Error('Invalid job backoff configuration.');
    }
  }

  return normalized;
}

function getDefaultJobOptions() {
  return {
    attempts: DEFAULT_ATTEMPTS,

    backoff: {
      type: 'exponential',
      delay: DEFAULT_BACKOFF_MS,
    },

    removeOnComplete: DEFAULT_REMOVE_ON_COMPLETE,
    removeOnFail: DEFAULT_REMOVE_ON_FAIL,
  };
}

async function getQueue(name, options = {}) {
  validateQueueName(name);

  if (!isQueueEnabled()) {
    throw new Error(
      'Background queues are disabled. Set QUEUE_ENABLED=true to enable them.'
    );
  }

  if (closing || closePromise) {
    throw new Error(
      'Queue system is shutting down. New queues cannot be created.'
    );
  }

  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Queue configuration must be an object.');
  }

  if (queues.has(name)) {
    return queues.get(name);
  }

  if (queuePromises.has(name)) {
    return queuePromises.get(name);
  }

  const initialization = (async () => {
    const redis = await connectRedis();

    if (!redis || !redis.isReady) {
      throw new Error(
        'Redis must be connected before a queue can be initialized.'
      );
    }

    if (closing || closePromise) {
      throw new Error(
        'Queue system is shutting down.'
      );
    }

    const queue = new Queue(name, {
      connection: redis,
      defaultJobOptions: {
        ...getDefaultJobOptions(),
        ...(options.defaultJobOptions || {}),
      },
      ...(options.prefix ? { prefix: options.prefix } : {}),
    });

    queue.on('error', (error) => {
      logger.error(
        {
          queue: name,
          err: {
            name: error.name,
            message: error.message,
          },
        },
        'Background queue error'
      );
    });

    try {
      await queue.waitUntilReady();

      if (closing || closePromise) {
        await queue.close();

        throw new Error(
          'Queue system began shutting down during initialization.'
        );
      }

      queues.set(name, queue);

      logger.info(
        { queue: name },
        'Background queue initialized'
      );

      return queue;
    } catch (error) {
      try {
        await queue.close();
      } catch {
        // Preserve the original initialization error.
      }

      throw error;
    }
  })();

  queuePromises.set(name, initialization);

  try {
    return await initialization;
  } finally {
    if (queuePromises.get(name) === initialization) {
      queuePromises.delete(name);
    }
  }
}

async function addJob(
  queueName,
  jobName,
  payload,
  options = {}
) {
  validateQueueName(queueName);

  if (
    typeof jobName !== 'string' ||
    !QUEUE_NAME_PATTERN.test(jobName)
  ) {
    throw new TypeError('Invalid background job name.');
  }

  if (
    payload === undefined ||
    typeof payload === 'function' ||
    typeof payload === 'symbol'
  ) {
    throw new TypeError('Job payload must be serializable data.');
  }

  const jobOptions = validateJobOptions(options);
  const queue = await getQueue(queueName);

  // BullMQ serializes payloads into Redis. Do not include sensitive
  // documents, credentials, payment details, or raw OTP values.
  return queue.add(jobName, payload, jobOptions);
}

async function closeQueues() {
  if (closePromise) {
    return closePromise;
  }

  closing = true;

  closePromise = (async () => {
    // Wait for all pending queue initializations to settle.
    const pending = [...queuePromises.values()];

    await Promise.allSettled(pending);

    const currentQueues = [...queues.entries()];

    const results = await Promise.allSettled(
      currentQueues.map(async ([name, queue]) => {
        await queue.close();

        logger.info(
          { queue: name },
          'Background queue closed'
        );
      })
    );

    queues.clear();

    const failures = results.filter(
      (result) => result.status === 'rejected'
    );

    if (failures.length > 0) {
      logger.error(
        { failedQueues: failures.length },
        'One or more background queues failed to close'
      );

      throw new Error(
        `${failures.length} background queue(s) failed to close.`
      );
    }
  })().finally(() => {
    closing = false;
    closePromise = undefined;
  });

  return closePromise;
}

function getQueueNames() {
  return [...queues.keys()];
}

module.exports = {
  getQueue,
  addJob,
  closeQueues,
  getQueueNames,
  validateQueueName,
  validateJobOptions,
  getDefaultJobOptions,
};
