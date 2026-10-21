'use strict';

/**
 * MedOrbits -- Shared Worker Runtime
 *
 * File: src/workers/worker-runtime.js
 *
 * Queue adapter contract:
 *   reserve({ queueName, visibilityTimeoutMs }) -> job | null
 *   ack(job) -> Promise<void>
 *   retry(job, error) -> Promise<void>
 *   deadLetter(job, error) -> Promise<void> (optional)
 *
 * Runtime: Node.js >= 20
 */

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_VISIBILITY_TIMEOUT_MS = 60000;
const DEFAULT_MAX_ATTEMPTS = 5;
const MIN_IDLE_DELAY_MS = 1000;
const SHUTDOWN_POLL_INTERVAL_MS = 10;

const noop = () => {};

function createLogger(logger) {
  const source = logger || console;

  return {
    info: typeof source.info === 'function'
      ? source.info.bind(source)
      : noop,
    error: typeof source.error === 'function'
      ? source.error.bind(source)
      : noop,
    warn: typeof source.warn === 'function'
      ? source.warn.bind(source)
      : noop,
  };
}

function validatePositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive safe integer.`);
  }
}

function validateOptions(options) {
  const {
    queue,
    queueName,
    handler,
    pollIntervalMs,
    visibilityTimeoutMs,
    maxAttempts,
  } = options;

  if (!queue || typeof queue !== 'object') {
    throw new TypeError('A queue adapter is required.');
  }

  for (const method of ['reserve', 'ack', 'retry']) {
    if (typeof queue[method] !== 'function') {
      throw new TypeError(
        `Queue adapter must implement ${method}().`,
      );
    }
  }

  if (queueName !== undefined &&
      (typeof queueName !== 'string' || !queueName.trim())) {
    throw new TypeError('queueName must be a non-empty string.');
  }

  if (typeof handler !== 'function') {
    throw new TypeError('handler must be a function.');
  }

  validatePositiveInteger(pollIntervalMs, 'pollIntervalMs');
  validatePositiveInteger(visibilityTimeoutMs, 'visibilityTimeoutMs');
  validatePositiveInteger(maxAttempts, 'maxAttempts');
}

function errorDetails(error) {
  return {
    errorName: error instanceof Error && error.name
      ? error.name
      : 'Error',
    message: error instanceof Error
      ? error.message
      : 'Unknown worker error',
  };
}

function safeJobId(job) {
  if (job && job.id !== undefined && job.id !== null) {
    return String(job.id).slice(0, 200);
  }

  return 'unknown';
}

function startPollingWorker(options = {}) {
  const config = {
    ...options,
    pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    visibilityTimeoutMs:
      options.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_TIMEOUT_MS,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
  };

  validateOptions(config);

  const {
    queue,
    queueName,
    handler,
    pollIntervalMs,
    visibilityTimeoutMs,
    maxAttempts,
  } = config;

  const logger = createLogger(config.logger);

  let stopped = false;
  let running = false;
  let timer = null;
  let activeJob = null;
  let shutdownPromise = null;

  function scheduleNext(delayMs) {
    if (stopped) return;

    timer = setTimeout(() => {
      timer = null;
      void tick();
    }, delayMs);

    // Do not keep the Node.js process alive solely for polling.
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  async function handleJob(job) {
    activeJob = job;

    try {
      await handler(job);
    } catch (error) {
      logger.error({
        event: 'worker_job_failed',
        queueName,
        jobId: safeJobId(job),
        ...errorDetails(error),
      });

      const attempts = Number.isSafeInteger(job.attempts) && job.attempts >= 0
        ? job.attempts
        : 0;

      if (
        attempts >= maxAttempts &&
        typeof queue.deadLetter === 'function'
      ) {
        try {
          await queue.deadLetter(job, error);

          logger.warn({
            event: 'worker_job_dead_lettered',
            queueName,
            jobId: safeJobId(job),
            attempts,
          });
        } catch (deadLetterError) {
          logger.error({
            event: 'worker_dead_letter_failed',
            queueName,
            jobId: safeJobId(job),
            ...errorDetails(deadLetterError),
          });

          // Preserve the original failure while attempting recovery.
          try {
            await queue.retry(job, deadLetterError);
          } catch (retryError) {
            logger.error({
              event: 'worker_retry_failed',
              queueName,
              jobId: safeJobId(job),
              ...errorDetails(retryError),
            });
          }
        }

        return;
      }

      try {
        await queue.retry(job, error);
      } catch (retryError) {
        logger.error({
          event: 'worker_retry_failed',
          queueName,
          jobId: safeJobId(job),
          ...errorDetails(retryError),
        });
      }

      return;
    }

    try {
      await queue.ack(job);

      logger.info({
        event: 'worker_job_acknowledged',
        queueName,
        jobId: safeJobId(job),
      });
    } catch (error) {
      // The handler may already have completed. The queue adapter must
      // support idempotent processing because acknowledgement can fail.
      logger.error({
        event: 'worker_ack_failed',
        queueName,
        jobId: safeJobId(job),
        ...errorDetails(error),
      });

      try {
        await queue.retry(job, error);
      } catch (retryError) {
        logger.error({
          event: 'worker_retry_after_ack_failure_failed',
          queueName,
          jobId: safeJobId(job),
          ...errorDetails(retryError),
        });
      }
    } finally {
      activeJob = null;
    }
  }

  async function tick() {
    if (stopped || running) return;

    running = true;
    let delay = pollIntervalMs;

    try {
      const job = await queue.reserve({
        queueName,
        visibilityTimeoutMs,
      });

      if (!job) {
        delay = Math.max(MIN_IDLE_DELAY_MS, pollIntervalMs);
      } else if (stopped) {
        // A job was reserved while shutdown began. Return it for later
        // processing instead of starting new application work.
        try {
          await queue.retry(job, new Error('Worker is shutting down.'));
        } catch (error) {
          logger.error({
            event: 'worker_shutdown_release_failed',
            queueName,
            jobId: safeJobId(job),
            ...errorDetails(error),
          });
        }
      } else {
        await handleJob(job);
      }
    } catch (error) {
      logger.error({
        event: 'worker_poll_failed',
        queueName,
        ...errorDetails(error),
      });

      delay = Math.max(pollIntervalMs, MIN_IDLE_DELAY_MS);
    } finally {
      activeJob = null;
      running = false;

      if (!stopped) {
        scheduleNext(delay);
      }
    }
  }

  logger.info({
    event: 'worker_started',
    queueName,
    pollIntervalMs,
    visibilityTimeoutMs,
    maxAttempts,
  });

  scheduleNext(0);

  function stop() {
    if (shutdownPromise) return shutdownPromise;

    stopped = true;

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    shutdownPromise = (async () => {
      while (running) {
        await new Promise((resolve) => {
          setTimeout(resolve, SHUTDOWN_POLL_INTERVAL_MS);
        });
      }

      logger.info({
        event: 'worker_stopped',
        queueName,
      });
    })();

    return shutdownPromise;
  }

  return {
    queueName,
    stop,
    get isRunning() {
      return running;
    },
    get isStopped() {
      return stopped;
    },
    get activeJobId() {
      return activeJob ? safeJobId(activeJob) : null;
    },
  };
}

module.exports = {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_VISIBILITY_TIMEOUT_MS,
  DEFAULT_MAX_ATTEMPTS,
  validatePositiveInteger,
  startPollingWorker,
};