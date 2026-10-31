
'use strict';

/**
 * =============================================================================
 * MedOrbits -- PostgreSQL Background Worker
 * File: /api/worker.js
 * Version: 3.0.0
 *
 * Runtime:
 *   Node.js >= 22
 *
 * Dependencies:
 *   pg
 *
 * Supported job types:
 *   email.send
 *   notification.create
 *   application.process
 *   document.process
 *   webhook.deliver
 *
 * Required environment:
 *   DATABASE_URL
 *   WORKER_HANDLERS_MODULE
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
 *   WORKER_SKIP_SCHEMA_INIT=true
 *   DATABASE_SSL=false
 *
 * Delivery:
 *   At-least-once execution.
 *
 * Important:
 *   Handlers must be idempotent. A handler may execute more than once
 *   following process crashes, lease expiry, or network failures.
 *
 * Production:
 *   Apply versioned migrations before starting the worker.
 *   Set WORKER_SKIP_SCHEMA_INIT=true in production.
 *
 * =============================================================================
 */

const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const { Pool } = require('pg');

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS = Object.freeze({
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
});

const SUPPORTED_TYPES = Object.freeze([
    'email.send',
    'notification.create',
    'application.process',
    'document.process',
    'webhook.deliver',
]);

const SUPPORTED_TYPE_SET = new Set(SUPPORTED_TYPES);

const PERMANENT_JOB_ERROR = 'PERMANENT_JOB_ERROR';

const MAX_RESULT_BYTES = 1024 * 1024;

const MAX_STORED_ERROR_LENGTH = 1000;

// =============================================================================
// ENVIRONMENT VALIDATION
// =============================================================================

function readInteger(name, fallback, min, max) {
    const raw = process.env[name];

    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }

    if (!/^\d+$/.test(raw.trim())) {
        throw new Error(
            `${name} must be an integer between ${min} and ${max}.`
        );
    }

    const value = Number(raw);

    if (
        !Number.isSafeInteger(value) ||
        value < min ||
        value > max
    ) {
        throw new Error(
            `${name} must be an integer between ${min} and ${max}.`
        );
    }

    return value;
}

function readBoolean(name, fallback = false) {
    const raw = process.env[name];

    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }

    const value = raw.trim().toLowerCase();

    if (value === 'true') return true;
    if (value === 'false') return false;

    throw new Error(`${name} must be true or false.`);
}

function readWorkerName() {
    const value =
        process.env.WORKER_NAME?.trim() ||
        `${os.hostname()}-${process.pid}`;

    if (
        value.length > 255 ||
        !/^[a-zA-Z0-9._:-]+$/.test(value)
    ) {
        throw new Error(
            'WORKER_NAME must contain only letters, numbers, dots, underscores, colons or hyphens and be at most 255 characters.'
        );
    }

    return value;
}

const CONFIG = Object.freeze({
    workerName: readWorkerName(),

    concurrency: readInteger(
        'WORKER_CONCURRENCY',
        3,
        1,
        50
    ),

    pollIntervalMs: readInteger(
        'WORKER_POLL_INTERVAL_MS',
        2000,
        250,
        60000
    ),

    maxAttempts: readInteger(
        'WORKER_MAX_ATTEMPTS',
        5,
        1,
        50
    ),

    retryBaseMs: readInteger(
        'WORKER_RETRY_BASE_MS',
        1000,
        100,
        3600000
    ),

    retryMaxMs: readInteger(
        'WORKER_RETRY_MAX_MS',
        3600000,
        1000,
        86400000
    ),

    staleJobMs: readInteger(
        'WORKER_STALE_JOB_MS',
        300000,
        10000,
        86400000
    ),

    heartbeatMs: readInteger(
        'WORKER_HEARTBEAT_MS',
        30000,
        1000,
        3600000
    ),

    shutdownTimeoutMs: readInteger(
        'WORKER_SHUTDOWN_TIMEOUT_MS',
        30000,
        1000,
        300000
    ),

    databaseUrl: process.env.DATABASE_URL?.trim() || '',

    handlersModule:
        process.env.WORKER_HANDLERS_MODULE?.trim() || '',

    skipSchemaInit: readBoolean(
        'WORKER_SKIP_SCHEMA_INIT',
        false
    ),

    databaseSsl: readBoolean(
        'DATABASE_SSL',
        false
    ),
});

if (CONFIG.heartbeatMs * 2 >= CONFIG.staleJobMs) {
    throw new Error(
        'WORKER_STALE_JOB_MS must be greater than twice WORKER_HEARTBEAT_MS.'
    );
}

if (CONFIG.retryBaseMs > CONFIG.retryMaxMs) {
    throw new Error(
        'WORKER_RETRY_BASE_MS cannot exceed WORKER_RETRY_MAX_MS.'
    );
}

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

const pool = new Pool({
    connectionString: CONFIG.databaseUrl || undefined,

    max: CONFIG.concurrency + 3,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000,

    application_name: 'medorbits-background-worker',

    ...(CONFIG.databaseSsl
        ? {
            ssl: {
                rejectUnauthorized: true,
            },
        }
        : {}),
});

pool.on('error', (error) => {
    log('error', 'database.idle_client_error', {
        error: safeError(error),
    });
});

// =============================================================================
// WORKER STATE
// =============================================================================

let started = false;
let stopping = false;
let schemaReady = false;
let poolClosed = false;

let shutdownPromise = null;
let loopPromise = null;

let heartbeatTimer = null;
let recoveryTimer = null;

const activeTasks = new Set();
const activeJobs = new Map();

const rootAbortController = new AbortController();

let jobHandlers = new Map();

// =============================================================================
// LOGGING
// =============================================================================

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

        code:
            typeof error?.code === 'string'
                ? error.code.slice(0, 100)
                : undefined,
    };
}

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

function createPermanentError(message) {
    const error = new Error(message);

    error.code = PERMANENT_JOB_ERROR;

    return error;
}

function isPermanentError(error) {
    return error?.code === PERMANENT_JOB_ERROR;
}

// =============================================================================
// RETRY POLICY
// =============================================================================

function retryDelay(attempt) {
    const exponent = Math.min(
        Math.max(attempt - 1, 0),
        30
    );

    const exponential = Math.min(
        CONFIG.retryBaseMs * (2 ** exponent),
        CONFIG.retryMaxMs
    );

    const jitter = Math.floor(
        Math.random() *
        Math.min(exponential * 0.2, 5000)
    );

    return Math.min(
        exponential + jitter,
        CONFIG.retryMaxMs
    );
}

// =============================================================================
// ASYNC UTILITIES
// =============================================================================

function sleep(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve();
            return;
        }

        let settled = false;

        let timer;

        const finish = () => {
            if (settled) return;

            settled = true;

            clearTimeout(timer);

            signal?.removeEventListener(
                'abort',
                finish
            );

            resolve();
        };

        timer = setTimeout(finish, ms);

        signal?.addEventListener(
            'abort',
            finish,
            { once: true }
        );
    });
}

function assertJsonObject(value, name) {
    if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {
        throw new TypeError(
            `${name} must be a JSON object.`
        );
    }
}

function serializeJson(value, name, maxBytes) {
    let serialized;

    try {
        serialized = JSON.stringify(value);
    } catch {
        throw createPermanentError(
            `${name} is not JSON serializable.`
        );
    }

    if (serialized === undefined) {
        throw createPermanentError(
            `${name} cannot be serialized.`
        );
    }

    if (
        Buffer.byteLength(serialized, 'utf8') >
        maxBytes
    ) {
        throw createPermanentError(
            `${name} exceeds the permitted storage size.`
        );
    }

    return serialized;
}

// =============================================================================
// HANDLER REGISTRATION
// =============================================================================

/**
 * Configure actual business handlers before starting the worker.
 *
 * Expected dependencies:
 *   sendEmail
 *   createNotification
 *   processApplication
 *   processDocument
 *   deliverWebhook
 *
 * Each handler receives:
 *   handler(payload, {
 *       jobId,
 *       attempt,
 *       workerName,
 *       signal
 *   })
 *
 * Do not register placeholder handlers in production.
 */

function configureJobHandlers(dependencies = {}) {
    if (started || activeJobs.size > 0) {
        throw new Error(
            'Configure job handlers before starting the worker.'
        );
    }

    assertJsonObject(
        dependencies,
        'Handler dependencies'
    );

    const definitions = {
        'email.send': dependencies.sendEmail,

        'notification.create':
            dependencies.createNotification,

        'application.process':
            dependencies.processApplication,

        'document.process':
            dependencies.processDocument,

        'webhook.deliver':
            dependencies.deliverWebhook,
    };

    const nextHandlers = new Map();

    for (const [type, handler] of Object.entries(definitions)) {
        if (handler === undefined) continue;

        if (typeof handler !== 'function') {
            throw new TypeError(
                `Handler for ${type} must be a function.`
            );
        }

        nextHandlers.set(type, handler);
    }

    jobHandlers = nextHandlers;
}

/**
 * Load the real handler module specified by the environment.
 */

function loadJobHandlers() {
    if (!CONFIG.handlersModule) {
        throw new Error(
            'WORKER_HANDLERS_MODULE is required.'
        );
    }

    const resolvedPath = path.resolve(
        process.cwd(),
        CONFIG.handlersModule
    );

    const dependencies = require(resolvedPath);

    assertJsonObject(
        dependencies,
        'Worker handler module exports'
    );

    configureJobHandlers(dependencies);

    if (jobHandlers.size === 0) {
        throw new Error(
            'No real worker handlers were registered.'
        );
    }

    log('info', 'worker.handlers_registered', {
        count: jobHandlers.size,
        types: [...jobHandlers.keys()],
    });
}

// =============================================================================
// SCHEMA INITIALIZATION
// =============================================================================

/**
 * Development-only schema initializer.
 *
 * Production must use a versioned database migration.
 * Set WORKER_SKIP_SCHEMA_INIT=true after applying the migration.
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

            max_attempts INTEGER NOT NULL
                DEFAULT ${CONFIG.maxAttempts},

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

    await pool.query(`
        CREATE INDEX IF NOT EXISTS worker_jobs_pending_idx
        ON worker_jobs (
            available_at,
            created_at
        )
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

// =============================================================================
// ATOMIC JOB CLAIMING
// =============================================================================

async function claimJob() {
    if (stopping || !schemaReady) {
        return null;
    }

    const client = await pool.connect();

    let transactionOpen = false;

    try {
        await client.query('BEGIN');

        transactionOpen = true;

        const selected = await client.query(
            `
                SELECT id
                FROM worker_jobs
                WHERE status = $1
                  AND available_at <= NOW()
                  AND attempts < max_attempts
                ORDER BY available_at ASC, created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED;
            `,
            [STATUS.PENDING]
        );

        if (selected.rowCount === 0) {
            await client.query('COMMIT');

            transactionOpen = false;

            return null;
        }

        const id = selected.rows[0].id;

        const leaseToken = crypto.randomUUID();

        const claimed = await client.query(
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
                    id,
                    type,
                    payload,
                    attempts,
                    max_attempts,
                    locked_at,
                    locked_by,
                    lease_token;
            `,
            [
                STATUS.PROCESSING,
                CONFIG.workerName,
                leaseToken,
                id,
                STATUS.PENDING,
            ]
        );

        if (claimed.rowCount !== 1) {
            throw new Error(
                'Atomic job claim did not update exactly one row.'
            );
        }

        await client.query('COMMIT');

        transactionOpen = false;

        return claimed.rows[0];
    } catch (error) {
        if (transactionOpen) {
            await client.query('ROLLBACK').catch(() => {});
        }

        throw error;
    } finally {
        client.release();
    }
}

// =============================================================================
// HEARTBEAT AND LEASE RENEWAL
// =============================================================================

async function renewLeases() {
    if (stopping || activeJobs.size === 0) {
        return;
    }

    const jobs = [...activeJobs.values()];

    await Promise.allSettled(
        jobs.map(async (active) => {
            if (
                stopping ||
                active.controller.signal.aborted
            ) {
                return;
            }

            try {
                const result = await pool.query(
                    `
                        UPDATE worker_jobs
                        SET
                            locked_at = NOW(),
                            updated_at = NOW()
                        WHERE id = $1
                          AND status = $2
                          AND locked_by = $3
                          AND lease_token = $4;
                    `,
                    [
                        active.job.id,
                        STATUS.PROCESSING,
                        CONFIG.workerName,
                        active.job.lease_token,
                    ]
                );

                if (result.rowCount !== 1) {
                    active.controller.abort(
                        new Error('Job lease lost.')
                    );

                    log('warn', 'job.lease_lost', {
                        jobId: active.job.id,
                        jobType: active.job.type,
                    });
                }
            } catch (error) {
                log('error', 'job.lease_renewal_failed', {
                    jobId: active.job.id,
                    error: safeError(error),
                });
            }
        })
    );
}

// =============================================================================
// STALE JOB RECOVERY
// =============================================================================

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
                ORDER BY locked_at ASC
                LIMIT 100
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

                last_error = 'Worker lease expired; execution may have been interrupted',

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

// =============================================================================
// JOB COMPLETION
// =============================================================================

async function markCompleted(job, result) {
    const serialized = serializeJson(
        result ?? null,
        'Handler result',
        MAX_RESULT_BYTES
    );

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
            'Completion rejected because the worker no longer owns the job lease.'
        );
    }
}

// =============================================================================
// JOB FAILURE AND RETRY
// =============================================================================

async function markFailed(job, error) {
    const details = safeError(error);

    const exhausted =
        isPermanentError(error) ||
        job.attempts >= job.max_attempts;

    const delayMs = exhausted
        ? 0
        : retryDelay(job.attempts);

    const storedError = JSON.stringify({
        name: details.name,
        code: details.code,
        category: exhausted
            ? 'permanent_or_exhausted'
            : 'retryable',
    }).slice(0, MAX_STORED_ERROR_LENGTH);

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
            storedError,
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
        error: details,
    });
}

// =============================================================================
// JOB EXECUTION
// =============================================================================

async function processJob(job) {
    const startedAt = Date.now();

    const controller = new AbortController();

    const active = {
        job,
        controller,
    };

    activeJobs.set(job.lease_token, active);

    log('info', 'job.started', {
        jobId: job.id,
        jobType: job.type,
        attempt: job.attempts,
    });

    try {
        if (!SUPPORTED_TYPE_SET.has(job.type)) {
            throw createPermanentError(
                'Unsupported job type.'
            );
        }

        const handler = jobHandlers.get(job.type);

        if (!handler) {
            throw createPermanentError(
                `No handler configured for ${job.type}.`
            );
        }

        assertJsonObject(
            job.payload,
            'Job payload'
        );

        const result = await handler(job.payload, {
            jobId: job.id,
            attempt: job.attempts,
            workerName: CONFIG.workerName,
            signal: controller.signal,
        });

        if (controller.signal.aborted) {
            throw new Error(
                'Job execution was aborted or its lease was lost.'
            );
        }

        await markCompleted(job, result);

        log('info', 'job.completed', {
            jobId: job.id,
            jobType: job.type,
            durationMs: Date.now() - startedAt,
        });
    } catch (error) {
        if (stopping || controller.signal.aborted) {
            log('warn', 'job.execution_interrupted', {
                jobId: job.id,
                jobType: job.type,
                error: safeError(error),
            });

            return;
        }

        try {
            await markFailed(job, error);
        } catch (persistenceError) {
            log('error', 'job.failure_persist_failed', {
                jobId: job.id,
                error: safeError(persistenceError),
            });
        }
    } finally {
        activeJobs.delete(job.lease_token);
    }
}

// =============================================================================
// JOB SCHEDULER
// =============================================================================

async function runOneJob() {
    if (stopping || !schemaReady) {
        return false;
    }

    let job;

    try {
        job = await claimJob();
    } catch (error) {
        log('error', 'job.claim_failed', {
            error: safeError(error),
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
                error: safeError(error),
            });
        })
        .finally(() => {
            activeTasks.delete(task);
        });

    activeTasks.add(task);

    return true;
}

// =============================================================================
// WORKER LOOP
// =============================================================================

async function workerLoop() {
    log('info', 'worker.started', {
        concurrency: CONFIG.concurrency,
        pollIntervalMs: CONFIG.pollIntervalMs,
        maxAttempts: CONFIG.maxAttempts,
    });

    while (!stopping) {
        let claimedAny = false;

        while (
            !stopping &&
            activeTasks.size < CONFIG.concurrency
        ) {
            const claimed = await runOneJob();

            if (!claimed) {
                break;
            }

            claimedAny = true;
        }

        if (!stopping && !claimedAny) {
            await sleep(
                CONFIG.pollIntervalMs,
                rootAbortController.signal
            );
        }
    }

    log('info', 'worker.loop_stopped');
}

// =============================================================================
// STARTUP
// =============================================================================

async function startWorker() {
    if (started) {
        throw new Error(
            'Worker has already been started.'
        );
    }

    if (stopping) {
        throw new Error(
            'Worker cannot start after shutdown begins.'
        );
    }

    if (!CONFIG.databaseUrl) {
        throw new Error(
            'DATABASE_URL is required.'
        );
    }

    if (jobHandlers.size === 0) {
        throw new Error(
            'At least one real job handler must be registered before startup.'
        );
    }

    started = true;

    try {
        await pool.query('SELECT 1');

        log('info', 'database.connected');

        await initializeSchema();

        await recoverStaleJobs();

        heartbeatTimer = setInterval(() => {
            renewLeases().catch((error) => {
                log('error', 'leases.renewal_failed', {
                    error: safeError(error),
                });
            });
        }, CONFIG.heartbeatMs);

        recoveryTimer = setInterval(() => {
            recoverStaleJobs().catch((error) => {
                log('error', 'jobs.recovery_failed', {
                    error: safeError(error),
                });
            });
        }, Math.max(
            10000,
            Math.floor(CONFIG.staleJobMs / 2)
        ));

        heartbeatTimer.unref?.();
        recoveryTimer.unref?.();

        loopPromise = workerLoop();

        await loopPromise;
    } catch (error) {
        started = false;

        throw error;
    }
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

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

        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
        }

        if (recoveryTimer) {
            clearInterval(recoveryTimer);
        }

        heartbeatTimer = null;
        recoveryTimer = null;

        rootAbortController.abort();

        for (const active of activeJobs.values()) {
            active.controller.abort(
                new Error('Worker is shutting down.')
            );
        }

        const deadline =
            Date.now() + CONFIG.shutdownTimeoutMs;

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

            process.exitCode = 1;

            return;
        }

        if (loopPromise) {
            await loopPromise.catch(() => {});
        }

        if (!poolClosed) {
            await pool.end();

            poolClosed = true;
        }

        log('info', 'worker.stopped');
    })();

    return shutdownPromise;
}

// =============================================================================
// PROCESS SIGNAL HANDLERS
// =============================================================================

function installSignalHandlers() {
    process.once('SIGTERM', () => {
        shutdown('SIGTERM').catch(() => {
            process.exitCode = 1;
        });
    });

    process.once('SIGINT', () => {
        shutdown('SIGINT').catch(() => {
            process.exitCode = 1;
        });
    });

    process.on('unhandledRejection', (error) => {
        log('error', 'process.unhandled_rejection', {
            error: safeError(error),
        });

        process.exitCode = 1;

        shutdown('unhandledRejection').catch(() => {});
    });

    process.on('uncaughtException', (error) => {
        log('error', 'process.uncaught_exception', {
            error: safeError(error),
        });

        process.exitCode = 1;

        shutdown('uncaughtException').catch(() => {});
    });
}

// =============================================================================
// STANDALONE BOOTSTRAP
// =============================================================================

async function bootstrap() {
    installSignalHandlers();

    try {
        loadJobHandlers();

        await startWorker();
    } catch (error) {
        log('error', 'worker.start_failed', {
            error: safeError(error),
        });

        process.exitCode = 1;

        await shutdown('startup_failure').catch(() => {});
    }
}

if (require.main === module) {
    bootstrap();
}

// =============================================================================
// PUBLIC MODULE API
// =============================================================================

module.exports = {
    CONFIG,
    STATUS,
    SUPPORTED_TYPES,

    configureJobHandlers,
    loadJobHandlers,

    initializeSchema,

    claimJob,
    renewLeases,
    recoverStaleJobs,

    markCompleted,
    markFailed,

    processJob,
    runOneJob,
    workerLoop,

    startWorker,
    shutdown,

    retryDelay,
    createPermanentError,
};
