
'use strict';

/**
 * MedOrbits -- Production-oriented PostgreSQL Background Worker
 *
 * File: api/worker.js
 * Runtime: Node.js >= 20
 * Dependencies: pg
 *
 * Job types:
 *   email.send
 *   notification.create
 *   application.process
 *   document.process
 *   webhook.deliver
 *
 * Required environment:
 *   DATABASE_URL
 *
 * Optional environment:
 *   WORKER_NAME
 *   WORKER_CONCURRENCY=3
 *   WORKER_POLL_INTERVAL_MS=2000
 *   WORKER_MAX_ATTEMPTS=5
 *   WORKER_RETRY_BASE_MS=1000
 *   WORKER_RETRY_MAX_MS=3600000
 *   WORKER_STALE_JOB_MS=300000
 *   WORKER_HEARTBEAT_MS=30000
 *   WORKER_SHUTDOWN_TIMEOUT_MS=30000
 *   WORKER_SKIP_SCHEMA_INIT=false
 *   DATABASE_SSL=false
 *
 * Important:
 *   Job handlers must be explicitly injected. No fake production
 *   handlers are registered by default.
 *
 *   Apply migrations before deployment in managed environments.
 *   External handlers should be idempotent because a crash after
 *   an external side effect can cause the job to run again.
 */

const os = require('node:os');
const crypto = require('node:crypto');

let Pool;

try {
  ({ Pool } = require('pg'));
} catch {
  console.error(
    '[worker] Missing dependency: install pg before starting.'
  );
}

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

function readBoolean(name, fallback = false) {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return fallback;
  }

  if (raw === 'true') return true;
  if (raw === 'false') return false;

  throw new Error(`${name} must be true or false.`);
}

const CONFIG = Object.freeze({
  workerName:
    process.env.WORKER_NAME ||
    `${os.hostname()}-${process.pid}`,

  concurrency: readInteger(
    'WORKER_CONCURRENCY', 3, 1, 50
  ),

  pollIntervalMs: readInteger(
    'WORKER_POLL_INTERVAL_MS', 2000, 250, 60000
  ),

  maxAttempts: readInteger(
    'WORKER_MAX_ATTEMPTS', 5, 1, 50
  ),

  retryBaseMs: readInteger(
    'WORKER_RETRY_BASE_MS', 1000, 100, 3600000
  ),

  retryMaxMs: readInteger(
    'WORKER_RETRY_MAX_MS', 3600000, 1000, 86400000
  ),

  staleJobMs: readInteger(
    'WORKER_STALE_JOB_MS', 300000, 10000, 86400000
  ),

  heartbeatMs: readInteger(
    'WORKER_HEARTBEAT_MS', 30000, 1000, 3600000
  ),

  shutdownTimeoutMs: readInteger(
    'WORKER_SHUTDOWN_TIMEOUT_MS', 30000, 1000, 300000
  ),

  databaseUrl: process.env.DATABASE_URL || '',

  skipSchemaInit: readBoolean(
    'WORKER_SKIP_SCHEMA_INIT', false
  ),

  databaseSsl: readBoolean('DATABASE_SSL', false),
});

if (CONFIG.heartbeatMs >= CONFIG.staleJobMs) {
  throw new Error(
    'WORKER_HEARTBEAT_MS must be lower than WORKER_STALE_JOB_MS.'
  );
}

const STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

const SUPPORTED_TYPES = new Set([
  'email.send',
  'notification.create',
  'application.process',
  'document.process',
  'webhook.deliver',
]);

const PERMANENT_JOB_ERROR = 'PERMANENT_JOB_ERROR';

let pool = null;
let stopping = false;
let schemaReady = false;
let shutdownPromise = null;
let loopPromise = null;
let pollTimer = null;
let heartbeatTimer = null;

const activeTasks = new Set();
const activeJobs = new Map();
const abortController = new AbortController();

function log(level, event, details = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'medorbits-worker',
    worker: CONFIG.workerName,
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

function safeError(error) {
  return {
    name: String(error?.name || 'Error').slice(0, 100),
    message: String(
      error?.message || 'Unknown error'
    ).slice(0, 1000),
    code: typeof error?.code === 'string'
      ? error.code.slice(0, 100)
      : undefined,
  };
}

function retryDelay(attempt) {
  const exponent = Math.min(Math.max(attempt - 1, 0), 30);

  const exponential = Math.min(
    CONFIG.retryBaseMs * (2 ** exponent),
    CONFIG.retryMaxMs
  );

  const jitter = Math.floor(
    Math.random() * Math.min(exponential * 0.2, 5000)
  );

  return Math.min(
    exponential + jitter,
    CONFIG.retryMaxMs
  );
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

function createPermanentError(message) {
  const error = new Error(message);
  error.code = PERMANENT_JOB_ERROR;
  return error;
}

function isPermanentError(error) {
  return error?.code === PERMANENT_JOB_ERROR;
}

/**
 * Production migrations should normally create this table and indexes.
 * This initializer is intended for controlled standalone deployments.
 */
async function initializeSchema() {
  if (CONFIG.skipSchemaInit) {
    schemaReady = true;
    log('info', 'schema.initialization_skipped');
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
      lease_token UUID,
      last_error TEXT,
      result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,

      CONSTRAINT worker_jobs_status_check
        CHECK (
          status IN (
            'pending',
            'processing',
            'completed',
            'failed'
          )
        ),

      CONSTRAINT worker_jobs_attempts_check
        CHECK (
          attempts >= 0
          AND max_attempts >= 1
          AND attempts <= max_attempts
        ),

      CONSTRAINT worker_jobs_lease_check
        CHECK (
          (
            status = 'processing'
            AND locked_at IS NOT NULL
            AND locked_by IS NOT NULL
            AND lease_token IS NOT NULL
          )
          OR
          (
            status <> 'processing'
            AND locked_at IS NULL
            AND locked_by IS NULL
            AND lease_token IS NULL
          )
        )
    );
  `);

  // Safe additive migration for an existing worker_jobs table.
  await pool.query(`
    ALTER TABLE worker_jobs
    ADD COLUMN IF NOT EXISTS lease_token UUID;
  `);

  // Legacy processing rows must be recovered before the new lease
  // constraint can be added to an existing deployment.
  await pool.query(`
    UPDATE worker_jobs
    SET
      status = CASE
        WHEN attempts >= max_attempts THEN 'failed'
        ELSE 'pending'
      END,
      locked_at = NULL,
      locked_by = NULL,
      lease_token = NULL,
      updated_at = NOW()
    WHERE status = 'processing'
      AND lease_token IS NULL;
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
 * Claim one job atomically.
 *
 * The lease token fences off an earlier execution if its lease expires
 * and the job is subsequently claimed by another worker.
 */
async function claimJob() {
  if (stopping || !schemaReady) {
    return null;
  }

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
      [STATUS.PENDING]
    );

    if (result.rowCount === 0) {
      await client.query('COMMIT');
      return null;
    }

    const selected = result.rows[0];
    const leaseToken = crypto.randomUUID();

    const updated = await client.query(
      `
        UPDATE worker_jobs
        SET
          status = $1,
          attempts = attempts + 1,
          locked_at = NOW(),
          locked_by = $2,
          lease_token = $3,
          updated_at = NOW()
        WHERE id = $4
          AND status = $5
        RETURNING
          id, type, payload, attempts, max_attempts,
          locked_at, locked_by, lease_token;
      `,
      [
        STATUS.PROCESSING,
        CONFIG.workerName,
        leaseToken,
        selected.id,
        STATUS.PENDING,
      ]
    );

    if (updated.rowCount !== 1) {
      throw new Error('Job claim lost inside transaction.');
    }

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Renew leases only for jobs owned by this execution.
 */
async function renewLeases() {
  if (stopping || activeJobs.size === 0) {
    return;
  }

  for (const job of activeJobs.values()) {
    if (stopping) return;

    try {
      const result = await pool.query(
        `
          UPDATE worker_jobs
          SET locked_at = NOW(), updated_at = NOW()
          WHERE id = $1
            AND status = $2
            AND locked_by = $3
            AND lease_token = $4;
        `,
        [
          job.id,
          STATUS.PROCESSING,
          CONFIG.workerName,
          job.lease_token,
        ]
      );

      if (result.rowCount !== 1) {
        job.controller.abort(
          new Error('Job lease was lost.')
        );

        log('warn', 'job.lease_lost', {
          jobId: job.id,
          jobType: job.type,
        });
      }
    } catch (error) {
      log('error', 'job.lease_renewal_failed', {
        jobId: job.id,
        errorCode: safeError(error).code,
      });
    }
  }
}

/**
 * Recover expired jobs.
 *
 * The row lock and conditional updates prevent competing workers from
 * recovering the same job simultaneously.
 */
async function recoverStaleJobs() {
  if (stopping) return;

  const result = await pool.query(
    `
      WITH stale AS (
        SELECT id
        FROM worker_jobs
        WHERE status = $1
          AND locked_at < NOW() -
            ($2 * INTERVAL '1 millisecond')
        FOR UPDATE SKIP LOCKED
      )
      UPDATE worker_jobs AS job
      SET
        status = CASE
          WHEN job.attempts >= job.max_attempts
            THEN $3
          ELSE $4
        END,
        available_at = CASE
          WHEN job.attempts >= job.max_attempts
            THEN job.available_at
          ELSE NOW()
        END,
        locked_at = NULL,
        locked_by = NULL,
        lease_token = NULL,
        last_error = COALESCE(
          job.last_error,
          'Job lease expired; execution may have been interrupted'
        ),
        updated_at = NOW()
      FROM stale
      WHERE job.id = stale.id
      RETURNING job.id, job.status;
    `,
    [
      STATUS.PROCESSING,
      CONFIG.staleJobMs,
      STATUS.FAILED,
      STATUS.PENDING,
    ]
  );

  if (result.rowCount > 0) {
    log('warn', 'jobs.recovered', {
      count: result.rowCount,
    });
  }
}

/**
 * All state updates are fenced by the lease token.
 * A worker whose lease has been replaced cannot overwrite the new owner.
 */
async function markCompleted(job, result) {
  const serialized = JSON.stringify(result ?? null);

  if (serialized === undefined) {
    throw createPermanentError(
      'Job handler returned an unsupported result.'
    );
  }

  if (Buffer.byteLength(serialized, 'utf8') > 1024 * 1024) {
    throw createPermanentError(
      'Job result exceeds the 1 MiB storage limit.'
    );
  }

  const updated = await pool.query(
    `
      UPDATE worker_jobs
      SET
        status = $1,
        result = $2::jsonb,
        last_error = NULL,
        locked_at = NULL,
        locked_by = NULL,
        lease_token = NULL,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
        AND status = $4
        AND locked_by = $5
        AND lease_token = $6;
    `,
    [
      STATUS.COMPLETED,
      serialized,
      job.id,
      STATUS.PROCESSING,
      CONFIG.workerName,
      job.lease_token,
    ]
  );

  if (updated.rowCount !== 1) {
    throw new Error(
      'Completion rejected because the job lease is no longer owned.'
    );
  }
}

async function markFailed(job, error) {
  const details = safeError(error);
  const exhausted =
    isPermanentError(error) ||
    job.attempts >= job.max_attempts;

  const delayMs = exhausted ? 0 : retryDelay(job.attempts);

  const updated = await pool.query(
    `
      UPDATE worker_jobs
      SET
        status = $1,
        available_at = CASE
          WHEN $1 = $2
            THEN NOW() + ($3 * INTERVAL '1 millisecond')
          ELSE available_at
        END,
        last_error = $4,
        locked_at = NULL,
        locked_by = NULL,
        lease_token = NULL,
        updated_at = NOW()
      WHERE id = $5
        AND status = $6
        AND locked_by = $7
        AND lease_token = $8;
    `,
    [
      exhausted ? STATUS.FAILED : STATUS.PENDING,
      STATUS.PENDING,
      delayMs,
      `${details.name}: ${details.message}`,
      job.id,
      STATUS.PROCESSING,
      CONFIG.workerName,
      job.lease_token,
    ]
  );

  if (updated.rowCount !== 1) {
    log('warn', 'job.failure_update_skipped', {
      jobId: job.id,
      reason: 'lease_not_owned',
    });

    return;
  }

  log(exhausted ? 'error' : 'warn', 'job.failed', {
    jobId: job.id,
    jobType: job.type,
    attempt: job.attempts,
    maxAttempts: job.max_attempts,
    retryInMs: exhausted ? null : delayMs,
    errorName: details.name,
    errorCode: details.code,
  });
}

/**
 * Explicit service injection. No production handlers are fabricated.
 *
 * Each handler receives:
 *   handler(payload, { jobId, attempt, workerName, signal })
 *
 * Handlers should validate payloads and support idempotent execution.
 */
function createJobHandlers(dependencies = {}) {
  const mapping = {
    'email.send': dependencies.sendEmail,
    'notification.create': dependencies.createNotification,
    'application.process': dependencies.processApplication,
    'document.process': dependencies.processDocument,
    'webhook.deliver': dependencies.deliverWebhook,
  };

  const handlers = new Map();

  for (const [type, handler] of Object.entries(mapping)) {
    if (handler !== undefined) {
      if (typeof handler !== 'function') {
        throw new TypeError(
          `Handler for ${type} must be a function.`
        );
      }

      handlers.set(type, handler);
    }
  }

  return handlers;
}

let jobHandlers = createJobHandlers();

function configureJobHandlers(dependencies) {
  if (activeJobs.size > 0) {
    throw new Error(
      'Cannot replace handlers while jobs are running.'
    );
  }

  jobHandlers = createJobHandlers(dependencies);
}

async function processJob(job) {
  const startedAt = Date.now();
  const controller = new AbortController();

  activeJobs.set(job.lease_token, {
    ...job,
    controller,
  });

  log('info', 'job.started', {
    jobId: job.id,
    jobType: job.type,
    attempt: job.attempts,
  });

  try {
    if (!SUPPORTED_TYPES.has(job.type)) {
      throw createPermanentError(
        `Unsupported job type: ${job.type}`
      );
    }

    const handler = jobHandlers.get(job.type);

    if (!handler) {
      throw createPermanentError(
        `No handler configured for job type: ${job.type}`
      );
    }

    if (
      !job.payload ||
      typeof job.payload !== 'object' ||
      Array.isArray(job.payload)
    ) {
      throw createPermanentError(
        'Job payload must be a JSON object.'
      );
    }

    const result = await handler(job.payload, {
      jobId: job.id,
      attempt: job.attempts,
      workerName: CONFIG.workerName,
      signal: controller.signal,
    });

    if (controller.signal.aborted) {
      throw new Error(
        'Job execution cancelled or its lease was lost.'
      );
    }

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
        errorCode: safeError(persistenceError).code,
      });
    }
  } finally {
    activeJobs.delete(job.lease_token);
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
      errorCode: safeError(error).code,
    });

    return false;
  }

  if (!job) {
    return false;
  }

  let task;

  task = processJob(job)
    .catch((error) => {
      log('error', 'job.unhandled_error', {
        jobId: job.id,
        errorCode: safeError(error).code,
      });
    })
    .finally(() => {
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
    let claimedAny = false;

    while (
      !stopping &&
      activeTasks.size < CONFIG.concurrency
    ) {
      const claimed = await runOneJob();

      if (!claimed) break;

      claimedAny = true;
    }

    if (!stopping && !claimedAny) {
      await sleep(
        CONFIG.pollIntervalMs,
        abortController.signal
      );
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

  if (loopPromise) {
    throw new Error('Worker has already been started.');
  }

  pool = new Pool({
    connectionString: CONFIG.databaseUrl,
    max: CONFIG.concurrency + 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: `medorbits-worker-${CONFIG.workerName}`,
    ...(CONFIG.databaseSsl
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  });

  pool.on('error', (error) => {
    log('error', 'database.idle_client_error', {
      errorCode: safeError(error).code,
    });
  });

  await pool.query('SELECT 1');
  await initializeSchema();

  await recoverStaleJobs();

  heartbeatTimer = setInterval(() => {
    renewLeases().catch((error) => {
      log('error', 'leases.renewal_failed', {
        errorCode: safeError(error).code,
      });
    });
  }, CONFIG.heartbeatMs);

  pollTimer = setInterval(() => {
    if (stopping) return;

    recoverStaleJobs().catch((error) => {
      log('error', 'jobs.recovery_failed', {
        errorCode: safeError(error).code,
      });
    });
  }, Math.max(
    10000,
    Math.floor(CONFIG.staleJobMs / 2)
  ));

  heartbeatTimer.unref?.();
  pollTimer.unref?.();

  loopPromise = workerLoop();
  await loopPromise;
}

/**
 * Graceful shutdown stops new claims, aborts cooperative handlers,
 * and waits for active work up to the configured deadline.
 *
 * JavaScript cannot safely force-cancel arbitrary promises. The
 * supervisor should enforce a final process termination deadline.
 */
async function shutdown(signal = 'shutdown') {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    stopping = true;

    log('info', 'worker.shutdown_started', {
      signal,
      activeJobs: activeTasks.size,
    });

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    abortController.abort();

    for (const active of activeJobs.values()) {
      active.controller.abort(
        new Error('Worker is shutting down.')
      );
    }

    const deadline = Date.now() + CONFIG.shutdownTimeoutMs;

    while (
      activeTasks.size > 0 &&
      Date.now() < deadline
    ) {
      await Promise.race([
        Promise.allSettled([...activeTasks]),
        sleep(100),
      ]);
    }

    if (activeTasks.size > 0) {
      log('error', 'worker.shutdown_timeout', {
        activeJobs: activeTasks.size,
      });
    }

    // Do not close the pool underneath handlers still using it.
    // If the deadline is exceeded, leave final termination to the
    // process supervisor and report an unsuccessful shutdown.
    if (activeTasks.size > 0) {
      process.exitCode = 1;
      return;
    }

    if (pool) {
      await pool.end();
      pool = null;
    }

    log('info', 'worker.stopped');
  })();

  return shutdownPromise;
}

function installSignalHandlers() {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      shutdown(signal).catch((error) => {
        log('error', 'worker.shutdown_failed', {
          errorCode: safeError(error).code,
        });

        process.exitCode = 1;
      });
    });
  }

  process.on('unhandledRejection', (reason) => {
    log('error', 'process.unhandled_rejection', {
      errorName: reason?.name || 'Error',
    });

    // Unhandled rejections can leave worker state uncertain.
    process.exitCode = 1;

    shutdown('unhandledRejection').catch(() => {});
  });

  process.on('uncaughtException', (error) => {
    log('error', 'process.uncaught_exception', {
      errorName: error?.name || 'Error',
      errorCode: safeError(error).code,
    });

    process.exitCode = 1;

    shutdown('uncaughtException').catch(() => {});
  });
}

if (require.main === module) {
  installSignalHandlers();

  startWorker().catch(async (error) => {
    log('error', 'worker.start_failed', {
      errorName: error?.name || 'Error',
      errorCode: safeError(error).code,
    });

    process.exitCode = 1;

    try {
      await shutdown('startup_failure');
    } catch {
      // Startup is already failing; preserve the nonzero exit code.
    }
  });
}

module.exports = {
  CONFIG,
  STATUS,
  SUPPORTED_TYPES,
  createJobHandlers,
  configureJobHandlers,
  initializeSchema,
  claimJob,
  recoverStaleJobs,
  renewLeases,
  markCompleted,
  markFailed,
  processJob,
  startWorker,
  shutdown,
  retryDelay,
};
