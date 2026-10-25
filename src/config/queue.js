
/**
 * MedOrbits -- Background Queue Configuration
 * File: src/config/queue.js
 *
 * Responsibilities:
 * - Configure Redis-backed BullMQ queues.
 * - Reuse queue instances by name.
 * - Prevent duplicate concurrent initialization.
 * - Validate queue configuration, job options and payloads.
 * - Support graceful, idempotent shutdown.
 * - Avoid logging credentials or sensitive job payloads.
 *
 * Dependencies:
 *   npm install bullmq ioredis
 *
 * Integration:
 * - ./redis.js must export connectRedis.
 * - ./env.js must export env with QUEUE_ENABLED.
 * - ./logger.js must export a default logger.
 *
 * IMPORTANT:
 * BullMQ requires an ioredis-compatible connection. If connectRedis()
 * returns a node-redis client, adapt redis.js before using this module.
 *
 * Queue payloads should contain opaque identifiers rather than passwords,
 * OTPs, payment credentials, or document contents.
 */

import { Queue } from "bullmq";
import { connectRedis } from "./redis.js";
import { env } from "./env.js";
import logger from "./logger.js";

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 1_000;
const DEFAULT_REMOVE_ON_COMPLETE = 1_000;
const DEFAULT_REMOVE_ON_FAIL = 5_000;

const MAX_JOB_DELAY_MS = 86_400_000;
const MAX_BACKOFF_DELAY_MS = 3_600_000;
const MAX_JOB_PAYLOAD_BYTES = 256 * 1024;

const QUEUE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,99}$/;
const PREFIX_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,99}$/;

const queues = new Map();
const queuePromises = new Map();

let closing = false;
let closePromise;

function isQueueEnabled() {
  return env.QUEUE_ENABLED === true;
}

function assertPlainObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be an object.`);
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

export function validateQueueName(name) {
  if (typeof name !== "string" || !QUEUE_NAME_PATTERN.test(name)) {
    throw new TypeError(
      "Queue name must be 1–100 characters and contain only letters, numbers, colons, underscores, or hyphens."
    );
  }

  return name;
}

function validateRemovalOption(value, label) {
  if (typeof value === "boolean") {
    return;
  }

  if (Number.isSafeInteger(value) && value >= 0) {
    return;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const allowedKeys = new Set(["age", "count"]);

    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) {
        throw new TypeError(`${label} contains an unsupported option.`);
      }
    }

    if (
      value.age !== undefined &&
      (!Number.isSafeInteger(value.age) || value.age < 0)
    ) {
      throw new TypeError(`${label}.age must be a non-negative integer.`);
    }

    if (
      value.count !== undefined &&
      (!Number.isSafeInteger(value.count) || value.count < 0)
    ) {
      throw new TypeError(`${label}.count must be a non-negative integer.`);
    }

    return;
  }

  throw new TypeError(
    `${label} must be a boolean, non-negative integer, or valid retention object.`
  );
}

export function validateJobOptions(options = {}) {
  assertPlainObject(options, "Job options");

  const normalized = { ...options };

  if (normalized.attempts !== undefined) {
    if (
      !Number.isSafeInteger(normalized.attempts) ||
      normalized.attempts < 1 ||
      normalized.attempts > 20
    ) {
      throw new RangeError("Job attempts must be an integer between 1 and 20.");
    }
  }

  if (normalized.delay !== undefined) {
    if (
      !Number.isSafeInteger(normalized.delay) ||
      normalized.delay < 0 ||
      normalized.delay > MAX_JOB_DELAY_MS
    ) {
      throw new RangeError(
        `Job delay must be between 0 and ${MAX_JOB_DELAY_MS} milliseconds.`
      );
    }
  }

  if (normalized.priority !== undefined) {
    if (
      !Number.isSafeInteger(normalized.priority) ||
      normalized.priority < 1 ||
      normalized.priority > 2_097_152
    ) {
      throw new RangeError(
        "Job priority must be an integer between 1 and 2097152."
      );
    }
  }

  if (normalized.backoff !== undefined) {
    const backoff = normalized.backoff;

    assertPlainObject(backoff, "Job backoff");

    if (!["fixed", "exponential"].includes(backoff.type)) {
      throw new TypeError("Backoff type must be fixed or exponential.");
    }

    if (
      !Number.isSafeInteger(backoff.delay) ||
      backoff.delay < 0 ||
      backoff.delay > MAX_BACKOFF_DELAY_MS
    ) {
      throw new RangeError(
        `Backoff delay must be between 0 and ${MAX_BACKOFF_DELAY_MS} milliseconds.`
      );
    }

    if (backoff.jitter !== undefined) {
      if (
        typeof backoff.jitter !== "number" ||
        !Number.isFinite(backoff.jitter) ||
        backoff.jitter < 0 ||
        backoff.jitter > 1
      ) {
        throw new RangeError("Backoff jitter must be between 0 and 1.");
      }
    }
  }

  if (normalized.removeOnComplete !== undefined) {
    validateRemovalOption(normalized.removeOnComplete, "removeOnComplete");
  }

  if (normalized.removeOnFail !== undefined) {
    validateRemovalOption(normalized.removeOnFail, "removeOnFail");
  }

  if (
    normalized.jobId !== undefined &&
    (typeof normalized.jobId !== "string" ||
      normalized.jobId.length === 0 ||
      normalized.jobId.length > 200)
  ) {
    throw new TypeError("Job ID must be a non-empty string of at most 200 characters.");
  }

  if (
    normalized.lifo !== undefined &&
    typeof normalized.lifo !== "boolean"
  ) {
    throw new TypeError("Job lifo option must be a boolean.");
  }

  return normalized;
}

export function getDefaultJobOptions() {
  return {
    attempts: DEFAULT_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: DEFAULT_BACKOFF_MS,
    },
    removeOnComplete: DEFAULT_REMOVE_ON_COMPLETE,
    removeOnFail: DEFAULT_REMOVE_ON_FAIL,
  };
}

function validateQueueConfiguration(options = {}) {
  assertPlainObject(options, "Queue configuration");

  const allowedKeys = new Set(["defaultJobOptions", "prefix"]);

  for (const key of Object.keys(options)) {
    if (!allowedKeys.has(key)) {
      throw new TypeError(`Unsupported queue configuration option: ${key}`);
    }
  }

  if (options.prefix !== undefined) {
    if (
      typeof options.prefix !== "string" ||
      !PREFIX_PATTERN.test(options.prefix)
    ) {
      throw new TypeError(
        "Queue prefix must be 1–100 characters and contain only letters, numbers, colons, underscores, or hyphens."
      );
    }
  }

  const customDefaults = options.defaultJobOptions ?? {};
  const validatedDefaults = validateJobOptions(customDefaults);

  return {
    ...(options.prefix !== undefined ? { prefix: options.prefix } : {}),
    defaultJobOptions: {
      ...getDefaultJobOptions(),
      ...validatedDefaults,
    },
  };
}

/**
 * Convert a payload into a JSON-safe snapshot.
 * This rejects circular references, BigInt, functions, symbols and
 * other values that cannot safely be persisted as JSON.
 */
function serializePayload(payload) {
  if (payload === undefined) {
    throw new TypeError("Job payload cannot be undefined.");
  }

  let serialized;

  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new TypeError("Job payload must be JSON-serializable data.");
  }

  if (typeof serialized !== "string") {
    throw new TypeError("Job payload must serialize to a JSON value.");
  }

  if (Buffer.byteLength(serialized, "utf8") > MAX_JOB_PAYLOAD_BYTES) {
    throw new RangeError(
      `Job payload exceeds the ${MAX_JOB_PAYLOAD_BYTES}-byte limit.`
    );
  }

  try {
    return JSON.parse(serialized);
  } catch {
    throw new TypeError("Job payload could not be safely serialized.");
  }
}

function assertRedisReady(redis) {
  // ioredis exposes status === "ready".
  // node-redis exposes isReady === true, but is not a compatible
  // BullMQ connection object and must not be passed to Queue.
  if (!redis || (redis.status !== "ready" && redis.isReady !== true)) {
    throw new Error("Redis must be connected before initializing a queue.");
  }
}

function logQueueError(name, error) {
  // Avoid logging arbitrary error messages, which can contain connection
  // details, URLs, or other sensitive values.
  logger.error(
    {
      queue: name,
      errorName:
        error && typeof error.name === "string"
          ? error.name.slice(0, 100)
          : "Error",
    },
    "Background queue error"
  );
}

export async function getQueue(name, options = {}) {
  validateQueueName(name);

  if (!isQueueEnabled()) {
    throw new Error(
      "Background queues are disabled. Set QUEUE_ENABLED=true to enable them."
    );
  }

  if (closing || closePromise) {
    throw new Error("Queue system is shutting down. New queues are unavailable.");
  }

  const configuration = validateQueueConfiguration(options);

  if (queues.has(name)) {
    return queues.get(name);
  }

  if (queuePromises.has(name)) {
    return queuePromises.get(name);
  }

  const initialization = (async () => {
    const redis = await connectRedis();

    assertRedisReady(redis);

    if (closing || closePromise) {
      throw new Error("Queue system is shutting down.");
    }

    const queue = new Queue(name, {
      connection: redis,
      ...configuration,
    });

    queue.on("error", (error) => {
      logQueueError(name, error);
    });

    try {
      await queue.waitUntilReady();

      if (closing || closePromise) {
        await queue.close();
        throw new Error("Queue system began shutting down during initialization.");
      }

      queues.set(name, queue);

      logger.info({ queue: name }, "Background queue initialized");

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

export async function addJob(queueName, jobName, payload, options = {}) {
  validateQueueName(queueName);

  if (typeof jobName !== "string" || !QUEUE_NAME_PATTERN.test(jobName)) {
    throw new TypeError("Invalid background job name.");
  }

  const safePayload = serializePayload(payload);
  const jobOptions = validateJobOptions(options);
  const queue = await getQueue(queueName);

  // Never log payloads or returned job data here.
  return queue.add(jobName, safePayload, jobOptions);
}

export function getQueueNames() {
  return [...queues.keys()];
}

export async function closeQueues() {
  if (closePromise) {
    return closePromise;
  }

  closing = true;

  closePromise = (async () => {
    // Wait for queue creation already in progress before closing instances.
    const pendingInitializations = [...queuePromises.values()];
    await Promise.allSettled(pendingInitializations);

    const currentQueues = [...queues.entries()];

    const results = await Promise.allSettled(
      currentQueues.map(async ([name, queue]) => {
        await queue.close();
        logger.info({ queue: name }, "Background queue closed");
      })
    );

    const failures = results.filter(
      (result) => result.status === "rejected"
    );

    // Remove only queues whose close operation succeeded.
    for (let index = 0; index < currentQueues.length; index += 1) {
      if (results[index].status === "fulfilled") {
        queues.delete(currentQueues[index][0]);
      }
    }

    if (failures.length > 0) {
      logger.error(
        { failedQueues: failures.length },
        "One or more background queues failed to close"
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

const queueService = Object.freeze({
  getQueue,
  addJob,
  closeQueues,
  getQueueNames,
  validateQueueName,
  validateJobOptions,
  getDefaultJobOptions,
});

export default queueService;
