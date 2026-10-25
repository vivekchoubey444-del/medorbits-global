api/worker.js

'use strict';
/**
 * MedOrbits -- Background Worker
 * Path: api/worker.js
 *
 * Responsibilities:
 * - Process PostgreSQL-backed background jobs.
 * - Retry failed jobs with exponential backoff.
 * - Recover jobs abandoned by a previous worker.
 * - Handle graceful shutdown and process signals.
 * - Log job lifecycle events without exposing sensitive payloads.
 *
 * Requirements:
 * - Node.js >= 20
 * - PostgreSQL
 * - pg package
 *
 * Environment:
 * - DATABASE_URL (required)
 * - WORKER_CONCURRENCY (default: 3)
 * - WORKER_POLL_INTERVAL_MS (default: 2000)
 * - WORKER_MAX_ATTEMPTS (default: 5)
 * - WORKER_RETRY_BASE_MS (default: 1000)
 * - WORKER_STALE_JOB_MS (default: 300000)
 * - WORKER_SHUTDOWN_TIMEOUT_MS (default: 30000)
 * - WORKER_NAME (optional)
 */
const os = require('node:os');
const crypto = require('node:crypto');
let Pool;
try {
  ({ Pool } = require('pg'));
} catch {
  console.error(
    '[worker] Missing dependency: install pg before starting the worker.'
  );
  process.exitCode = 1;
}
const WORKER_NAME =
  process.env.WORKER_NAME ||
  `${os.hostname()}-${process.pid}`;
const CONFIG = Object.freeze({
  concurrency: readInteger('WORKER_CONCURRENCY', 3, 1, 50),
  pollIntervalMs: readInteger(
    'WORKER_POLL_INTERVAL_MS',
    2000,
    250,
    60000
  ),
  maxAttempts: readInteger('WORKER_MAX_ATTEMPTS', 5, 1, 50),
  retryBaseMs: readInteger('WORKER_RETRY_BASE_MS', 1000, 100, 3600000),
  staleJobMs: readInteger('WORKER_STALE_JOB_MS', 300000, 10000, 86400000),
  shutdownTimeoutMs: readInteger(
    'WORKER_SHUTDOWN_TIMEOUT_MS',
    30000,
    1000,
    300000
  ),
  databaseUrl: process.env.DATABASE_URL || '',
});
const JOB_STATUSES = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});
const SUPPORTED_JOB_TYPES = new Set([
  'email.send',
  'notification.create',
  'application.process',
  'document.process',
  'webhook.deliver',
]);
let pool;
let stopping = false;
let schemaReady = false;
let activeJobs = 0;
let pollTimer = null;
let shutdownPromise = null;
let workerAbortController = new AbortController();
const activeTasks = new Set();
function readInteger(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(
      `${name} must be an integer between ${min} and ${max}.`
    );
  }
  return value;
}
function log(level, event, details = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'medorbits-worker',
    worker: WORKER_NAME,
    event,
    ...details,
  };
  const output = JSON.stringify(record);
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}
function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}
function safeError(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || 'Unknown error').slice(0, 1000),
    code: error?.code || undefined,
  };
}
function retryDelay(attempt) {
  const exponential = CONFIG.retryBaseMs * (2 ** Math.max(0, attempt - 1));
  const capped = Math.min(exponential, 60 * 60 * 1000);
  const jitter = Math.floor(Math.random() * Math.min(capped * 0.2, 5000));
  return capped + jitter;
}
/**
 * Create the worker_jobs table and indexes.
 *
 * In managed environments, you may prefer to apply this schema through
 * your migration system and set WORKER_SKIP_SCHEMA_INIT=true.
 */
async function initializeSchema() {
  if (process.env.WORKER_SKIP_SCHEMA_INIT === 'true') {
    schemaReady = true;
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS worker_jobs (
      id UUID PRIMARY KEY,
      type VARCHAR(120) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_at TIMESTAMPTZ,
      locked_by VARCHAR(255),
      last_error TEXT,
      result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      CONSTRAINT worker_jobs_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      CONSTRAINT worker_jobs_attempts_check
        CHECK (attempts >= 0 AND max_attempts >= 1)
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS worker_jobs_pending_idx
    ON worker_jobs (available_at, created_at)
    WHERE status = 'pending';
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS worker_jobs_processing_idx
    ON worker_jobs (locked_at)
    WHERE status = 'processing';
  `);
  schemaReady = true;
  log('info', 'schema.ready');
}
/**
 * Requeue jobs left processing by a worker that crashed or was terminated.
 * The timeout should exceed the normal processing time for most jobs.
 */
async function recoverStaleJobs() {
  const result = await pool.query(
    `
      UPDATE worker_jobs
      SET
        status = CASE
          WHEN attempts >= max_attempts THEN $1
          ELSE $2
        END,
        available_at = CASE
          WHEN attempts >= max_attempts THEN available_at
          ELSE NOW()
        END,
        locked_at = NULL,
        locked_by = NULL,
        last_error = COALESCE(
          last_error,
          'Recovered after worker lease expired'
        ),
        updated_at = NOW()
      WHERE status = $3
        AND locked_at < NOW() - ($4 * INTERVAL '1 millisecond')
      RETURNING id, status;
    `,
    [
      JOB_STATUSES.FAILED,
      JOB_STATUSES.PENDING,
      JOB_STATUSES.PROCESSING,
      CONFIG.staleJobMs,
    ]
  );
  if (result.rowCount > 0) {
    log('warn', 'jobs.recovered', {
      count: result.rowCount,
    });
  }
}
/**
 * Atomically claim one eligible job.
 * FOR UPDATE SKIP LOCKED allows multiple worker processes to cooperate.
 */
async function claimJob() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        SELECT id, type, payload, attempts, max_attempts
        FROM worker_jobs
        WHERE status = $1
          AND available_at <= NOW()
          AND attempts < max_attempts
        ORDER BY available_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;
      `,
      [JOB_STATUSES.PENDING]
    );
    if (result.rowCount === 0) {
      await client.query('COMMIT');
      return null;
    }
    const selected = result.rows[0];
    const updated = await client.query(
      `
        UPDATE worker_jobs
        SET
          status = $1,
          attempts = attempts + 1,
          locked_at = NOW(),
          locked_by = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING id, type, payload, attempts, max_attempts;
      `,
      [
        JOB_STATUSES.PROCESSING,
        WORKER_NAME,
        selected.id,
      ]
    );
    await client.query('COMMIT');
    return updated.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
async function markCompleted(job, result) {
  await pool.query(
    `
      UPDATE worker_jobs
      SET
        status = $1,
        result = $2::jsonb,
        last_error = NULL,
        locked_at = NULL,
        locked_by = NULL,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
        AND status = $4
        AND locked_by = $5;
    `,
    [
      JOB_STATUSES.COMPLETED,
      JSON.stringify(result ?? null),
      job.id,
      JOB_STATUSES.PROCESSING,
      WORKER_NAME,
    ]
  );
}
async function markFailed(job, error) {
  const details = safeError(error);
  const exhausted = job.attempts >= job.max_attempts;
  const delayMs = exhausted ? 0 : retryDelay(job.attempts);
  await pool.query(
    `
      UPDATE worker_jobs
      SET
        status = $1,
        available_at = CASE
          WHEN $1 = 'pending'
          THEN NOW() + ($2 * INTERVAL '1 millisecond')
          ELSE available_at
        END,
        last_error = $3,
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
      WHERE id = $4
        AND status = $5
        AND locked_by = $6;
    `,
    [
      exhausted ? JOB_STATUSES.FAILED : JOB_STATUSES.PENDING,
      delayMs,
      `${details.name}: ${details.message}`,
      job.id,
      JOB_STATUSES.PROCESSING,
      WORKER_NAME,
    ]
  );
  log(exhausted ? 'error' : 'warn', 'job.failed', {
    jobId: job.id,
    jobType: job.type,
    attempt: job.attempts,
    maxAttempts: job.max_attempts,
    retryInMs: exhausted ? null : delayMs,
    errorName: details.name,
    errorCode: details.code,
    errorMessage: details.message,
  });
}
/**
 * Register application-specific job handlers in this function.
 *
 * IMPORTANT:
 * The default handlers deliberately fail closed. Connect them to your
 * actual services before enqueueing these job types in production.
 * Never evaluate arbitrary code from a job payload.
 */
function createJobHandlers(dependencies = {}) {
  const handlers = new Map();
  if (typeof dependencies.sendEmail === 'function') {
    handlers.set('email.send', dependencies.sendEmail);
  }
  if (typeof dependencies.createNotification === 'function') {
    handlers.set(
      'notification.create',
      dependencies.createNotification
    );
  }
  if (typeof dependencies.processApplication === 'function') {
    handlers.set(
      'application.process',
      dependencies.processApplication
    );
  }
  if (typeof dependencies.processDocument === 'function') {
    handlers.set('document.process', dependencies.processDocument);
  }
  if (typeof dependencies.deliverWebhook === 'function') {
    handlers.set('webhook.deliver', dependencies.deliverWebhook);
  }
  return handlers;
}
const jobHandlers = createJobHandlers({
  // Wire real service functions here, for example:
  // sendEmail: async (payload, context) => emailService.send(payload),
  // createNotification: async (payload, context) =>
  //   notificationService.create(payload),
  // processApplication: async (payload, context) =>
  //   applicationService.process(payload),
  // processDocument: async (payload, context) =>
  //   documentService.process(payload),
  // deliverWebhook: async (payload, context) =>
  //   webhookService.deliver(payload),
});
async function processJob(job) {
  const startedAt = Date.now();
  log('info', 'job.started', {
    jobId: job.id,
    jobType: job.type,
    attempt: job.attempts,
  });
  try {
    if (!SUPPORTED_JOB_TYPES.has(job.type)) {
      throw new Error(`Unsupported job type: ${job.type}`);
    }
    const handler = jobHandlers.get(job.type);
    if (!handler) {
      throw new Error(
        `No handler configured for job type: ${job.type}`
      );
    }
    const result = await handler(job.payload, {
      jobId: job.id,
      attempt: job.attempts,
      workerName: WORKER_NAME,
      signal: workerAbortController.signal,
    });
    await markCompleted(job, result);
    log('info', 'job.completed', {
      jobId: job.id,
      jobType: job.type,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    try {
      await markFailed(job, error);
    } catch (persistenceError) {
      log('error', 'job.failure_persist_failed', {
        jobId: job.id,
        errorName: persistenceError?.name || 'Error',
        errorMessage: String(
          persistenceError?.message || 'Database update failed'
        ).slice(0, 500),
      });
      // The job may remain processing and will be recovered after its lease
      // expires. Handlers should therefore be idempotent.
    }
  }
}
async function runOneJob() {
  if (stopping || !schemaReady) {
    return false;
  }
  let job;
  try {
    job = await claimJob();
  } catch (error) {
    log('error', 'job.claim_failed', {
      errorName: error?.name || 'Error',
      errorMessage: String(
        error?.message || 'Could not claim job'
      ).slice(0, 500),
    });
    return false;
  }
  if (!job) {
    return false;
  }
  activeJobs += 1;
  const task = processJob(job)
    .catch((error) => {
      log('error', 'job.unhandled_error', {
        jobId: job.id,
        errorName: error?.name || 'Error',
      });
    })
    .finally(() => {
      activeJobs -= 1;
      activeTasks.delete(task);
    });
  activeTasks.add(task);
  return true;
}
async function workerLoop() {
  log('info', 'worker.started', {
    concurrency: CONFIG.concurrency,
    pollIntervalMs: CONFIG.pollIntervalMs,
  });
  while (!stopping) {
    const slots = CONFIG.concurrency - activeJobs;
    if (slots <= 0) {
      await sleep(100, workerAbortController.signal);
      continue;
    }
    let claimedAny = false;
    for (let i = 0; i < slots && !stopping; i += 1) {
      const claimed = await runOneJob();
      if (claimed) {
        claimedAny = true;
      } else {
        break;
      }
    }
    if (!claimedAny) {
      await sleep(CONFIG.pollIntervalMs, workerAbortController.signal);
    }
  }
  log('info', 'worker.loop_stopped');
}
async function startWorker() {
  if (!Pool) {
    throw new Error('The pg package is not installed.');
  }
  if (!CONFIG.databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }
  pool = new Pool({
    connectionString: CONFIG.databaseUrl,
    max: CONFIG.concurrency + 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: `medorbits-worker-${WORKER_NAME}`,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: true }
        : undefined,
  });
  pool.on('error', (error) => {
    log('error', 'database.idle_client_error', {
      errorName: error?.name || 'Error',
      errorCode: error?.code,
    });
  });
  await pool.query('SELECT 1');
  await initializeSchema();
  await recoverStaleJobs();
  pollTimer = setInterval(() => {
    recoverStaleJobs().catch((error) => {
      log('error', 'jobs.recovery_failed', {
        errorName: error?.name || 'Error',
        errorMessage: String(
          error?.message || 'Recovery failed'
        ).slice(0, 500),
      });
    });
  }, Math.max(CONFIG.staleJobMs / 2, 10000));
  pollTimer.unref?.();
  await workerLoop();
}
async function shutdown(signal = 'shutdown') {
  if (shutdownPromise) {
    return shutdownPromise;
  }
  shutdownPromise = (async () => {
    stopping = true;
    log('info', 'worker.shutdown_started', {
      signal,
      activeJobs,
    });
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    // Stop sleeps and notify handlers that support cancellation.
    workerAbortController.abort();
    const pending = Promise.allSettled([...activeTasks]);
    let timeout;
    const timedOut = new Promise((resolve) => {
      timeout = setTimeout(
        () => resolve('timeout'),
        CONFIG.shutdownTimeoutMs
      );
    });
    const outcome = await Promise.race([pending, timedOut]);
    clearTimeout(timeout);
    if (outcome === 'timeout') {
      log('warn', 'worker.shutdown_timeout', {
        activeJobs,
      });
    }
    if (pool) {
      await pool.end().catch((error) => {
        log('error', 'database.close_failed', {
          errorMessage: String(error?.message || 'Pool close failed'),
        });
      });
    }
    log('info', 'worker.stopped', {
      activeJobs,
    });
  })();
  return shutdownPromise;
}
function installSignalHandlers() {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      shutdown(signal)
        .then(() => {
          process.exitCode = 0;
        })
        .catch((error) => {
          log('error', 'worker.shutdown_failed', {
            errorMessage: String(error?.message || 'Shutdown failed'),
          });
          process.exitCode = 1;
        });
    });
  }
  process.on('unhandledRejection', (reason) => {
    log('error', 'process.unhandled_rejection', {
      errorMessage: String(
        reason?.message || reason || 'Unhandled rejection'
      ).slice(0, 500),
    });
  });
  process.on('uncaughtException', (error) => {
    log('error', 'process.uncaught_exception', {
      errorName: error?.name || 'Error',
      errorMessage: String(error?.message || 'Uncaught exception').slice(
        0,
        500
      ),
    });
    shutdown('uncaughtException')
      .finally(() => {
        process.exitCode = 1;
      });
  });
}
if (require.main === module) {
  installSignalHandlers();
  startWorker().catch(async (error) => {
    log('error', 'worker.start_failed', {
      errorName: error?.name || 'Error',
      errorMessage: String(error?.message || 'Startup failed').slice(
        0,
        1000
      ),
    });
    process.exitCode = 1;
    await shutdown('startup_failure');
  });
}
module.exports = {
  CONFIG,
  JOB_STATUSES,
  SUPPORTED_JOB_TYPES,
  createJobHandlers,
  initializeSchema,
  recoverStaleJobs,
  claimJob,
  processJob,
  startWorker,
  shutdown,
  retryDelay,
};

Integration checklist

1. Install the PostgreSQL driver if it is not already present:

npm install pg

2. Set DATABASE_URL in your deployment environment. Keep credentials out of source control.
3. Add a worker start script to package.json:

{
  "scripts": {
    "worker": "node api/worker.js"
  }
}

4. Run it as a separate background worker process, not as part of every web-server instance.
5. Connect the real application handlers in createJobHandlers(). Until configured, recognized job types fail with a retryable error rather than performing a fake operation.
6. Use idempotent handlers. A worker can crash after performing an external action but before saving the job as completed, causing that action to be attempted again.

Important: This is a standalone worker foundation, not a verified integration with your existing MedOrbits database schema. Before deploying, align worker_jobs with your migration strategy and connect the actual email, notification, application, document, and webhook services. The worker currently uses PostgreSQL, consistent with the backend architecture discussed earlier.