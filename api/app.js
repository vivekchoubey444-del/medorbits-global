
'use strict';

/**
 * =============================================================================
 * MEDORBITS API -- EXPRESS APPLICATION BOOTSTRAP
 * File: /api/app.js
 * Version: 2.2.0
 *
 * Runtime: Node.js >= 22
 * Framework: Express 4
 * Module System: CommonJS
 *
 * Responsibilities:
 *   - Initialize and configure Express.
 *   - Apply baseline HTTP security headers.
 *   - Validate environment configuration.
 *   - Configure reverse-proxy trust.
 *   - Identify incoming requests.
 *   - Apply API rate limiting.
 *   - Parse bounded JSON and URL-encoded requests.
 *   - Mount and validate API routes.
 *   - Centralize HTTP errors.
 *   - Start and stop the HTTP server.
 *   - Support graceful shutdown hooks.
 *   - Handle fatal process errors.
 *
 * =============================================================================
 */

// =============================================================================
// DEPENDENCIES
// =============================================================================

const http = require('node:http');
const { randomUUID } = require('node:crypto');

const express = require('express');

const {
    apiLimiter,
} = require('./middleware/rate-limit');

const {
    notFoundHandler,
    errorHandler,
} = require('./middleware/error-handler');

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PORT = 3000;
const DEFAULT_BODY_LIMIT = '1mb';

const MAX_BODY_BYTES = 10 * 1024 * 1024;

const SHUTDOWN_TIMEOUT_MS = 30000;

const SERVICE_NAME = 'medorbits-api';

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

function readPort(value) {
    const port = Number(value || DEFAULT_PORT);

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error(
            'PORT must be an integer between 1 and 65535.'
        );
    }

    return port;
}

function readBodyLimit(value) {
    const limit = String(
        value || DEFAULT_BODY_LIMIT
    ).trim();

    const match = limit.match(
        /^(\d+)(b|kb|mb|gb)?$/i
    );

    if (!match) {
        throw new Error(
            'JSON_BODY_LIMIT must use bytes, KB, MB or GB.'
        );
    }

    const amount = Number(match[1]);

    const unit = (
        match[2] || 'b'
    ).toLowerCase();

    const multipliers = {
        b: 1,
        kb: 1024,
        mb: 1024 ** 2,
        gb: 1024 ** 3,
    };

    const bytes = amount * multipliers[unit];

    if (
        !Number.isSafeInteger(bytes) ||
        bytes < 1 ||
        bytes > MAX_BODY_BYTES
    ) {
        throw new Error(
            'JSON_BODY_LIMIT must be between 1 byte and 10 MB.'
        );
    }

    return limit;
}

function readTrustProxy() {
    const hops = process.env.TRUST_PROXY_HOPS;

    if (hops !== undefined) {
        if (!/^\d+$/.test(hops)) {
            throw new Error(
                'TRUST_PROXY_HOPS must be a non-negative integer.'
            );
        }

        const parsed = Number(hops);

        if (
            !Number.isSafeInteger(parsed) ||
            parsed > 32
        ) {
            throw new Error(
                'TRUST_PROXY_HOPS must be between 0 and 32.'
            );
        }

        return parsed;
    }

    if (process.env.TRUST_PROXY === 'true') {
        return 1;
    }

    if (
        process.env.TRUST_PROXY !== undefined &&
        process.env.TRUST_PROXY !== 'false'
    ) {
        throw new Error(
            'TRUST_PROXY must be true or false.'
        );
    }

    return false;
}

function readEnvironment() {
    const environment =
        process.env.NODE_ENV || 'development';

    const allowed = [
        'development',
        'test',
        'production',
    ];

    if (!allowed.includes(environment)) {
        throw new Error(
            'NODE_ENV must be development, test or production.'
        );
    }

    return environment;
}

const CONFIG = Object.freeze({
    port: readPort(process.env.PORT),

    jsonBodyLimit: readBodyLimit(
        process.env.JSON_BODY_LIMIT
    ),

    trustProxy: readTrustProxy(),

    environment: readEnvironment(),

    shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
});

// =============================================================================
// DEPENDENCY VALIDATION
// =============================================================================

if (typeof apiLimiter !== 'function') {
    throw new TypeError(
        'rate-limit middleware must export apiLimiter.'
    );
}

if (typeof notFoundHandler !== 'function') {
    throw new TypeError(
        'error-handler must export notFoundHandler.'
    );
}

if (typeof errorHandler !== 'function') {
    throw new TypeError(
        'error-handler must export errorHandler.'
    );
}

// =============================================================================
// EXPRESS APPLICATION
// =============================================================================

const app = express();

app.disable('x-powered-by');

app.set('trust proxy', CONFIG.trustProxy);

// =============================================================================
// APPLICATION SECURITY HEADERS
// =============================================================================

app.use((req, res, next) => {
    res.setHeader(
        'X-Content-Type-Options',
        'nosniff'
    );

    res.setHeader(
        'X-Frame-Options',
        'DENY'
    );

    res.setHeader(
        'Referrer-Policy',
        'no-referrer'
    );

    res.setHeader(
        'X-Permitted-Cross-Domain-Policies',
        'none'
    );

    next();
});

// =============================================================================
// REQUEST IDENTIFICATION
// =============================================================================

app.use((req, res, next) => {
    const requestId = randomUUID();

    req.requestId = requestId;

    res.setHeader(
        'X-Request-ID',
        requestId
    );

    next();
});

// =============================================================================
// API RATE LIMITING
// =============================================================================

app.use(
    '/api',
    apiLimiter
);

// =============================================================================
// REQUEST PARSING
// =============================================================================

app.use(
    express.json({
        limit: CONFIG.jsonBodyLimit,
        strict: true,
        type: 'application/json',
    })
);

app.use(
    express.urlencoded({
        extended: false,
        limit: CONFIG.jsonBodyLimit,
        parameterLimit: 100,
    })
);

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

function mountRoute(mountPath, modulePath) {
    let router;

    try {
        router = require(modulePath);
    } catch (error) {
        throw new Error(
            `Failed to load route ${modulePath}.`,
            {
                cause: error,
            }
        );
    }

    if (typeof router !== 'function') {
        throw new TypeError(
            `Route ${modulePath} must export an Express router or middleware function.`
        );
    }

    app.use(
        mountPath,
        router
    );

    console.log(
        JSON.stringify({
            level: 'info',
            service: SERVICE_NAME,
            event: 'route.mounted',
            path: mountPath,
        })
    );
}

// =============================================================================
// HEALTH ROUTE
// =============================================================================

mountRoute(
    '/api/health',
    './routes/health'
);

// =============================================================================
// API ROUTES
// =============================================================================

const ROUTES = Object.freeze([
    {
        path: '/api/documents',
        module: './routes/documents',
    },
    {
        path: '/api/applications',
        module: './routes/applications',
    },
    {
        path: '/api/admissions',
        module: './routes/admissions',
    },
    {
        path: '/api/users',
        module: './routes/users',
    },
    {
        path: '/api/support',
        module: './routes/support',
    },
    {
        path: '/api/jobs',
        module: './routes/jobs',
    },
]);

for (const route of ROUTES) {
    mountRoute(
        route.path,
        route.module
    );
}

// =============================================================================
// NOT FOUND HANDLER
// =============================================================================

app.use(notFoundHandler);

// =============================================================================
// CENTRAL ERROR HANDLER
// Must remain the final Express middleware.
// =============================================================================

app.use(errorHandler);

// =============================================================================
// HTTP SERVER
// =============================================================================

const server = http.createServer(app);

let serverStarted = false;
let shuttingDown = false;
let shutdownPromise = null;
let fatalErrorHandled = false;

// =============================================================================
// SHUTDOWN HOOK REGISTRY
// =============================================================================

const shutdownHooks = new Set();

/**
 * Register asynchronous resource cleanup.
 *
 * Example:
 * registerShutdownHook(async () => {
 *     await databasePool.end();
 * });
 *
 * Register hooks from the application entry point
 * after importing this module.
 */

function registerShutdownHook(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError(
            'Shutdown hook must be a function.'
        );
    }

    if (shuttingDown) {
        throw new Error(
            'Cannot register shutdown hooks after shutdown begins.'
        );
    }

    shutdownHooks.add(callback);

    return function unregisterShutdownHook() {
        shutdownHooks.delete(callback);
    };
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

function startServer() {
    if (serverStarted || server.listening) {
        throw new Error(
            'MedOrbits API server has already started.'
        );
    }

    if (shuttingDown) {
        throw new Error(
            'Cannot start server after shutdown has begun.'
        );
    }

    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.removeListener(
                'listening',
                onListening
            );

            reject(error);
        };

        const onListening = () => {
            server.removeListener(
                'error',
                onError
            );

            serverStarted = true;

            console.log(
                JSON.stringify({
                    level: 'info',
                    service: SERVICE_NAME,
                    event: 'server.started',
                    environment: CONFIG.environment,
                    port: server.address().port,
                    routes: ROUTES.length + 1,
                    timestamp: new Date().toISOString(),
                })
            );

            resolve(server);
        };

        server.once('error', onError);

        server.once(
            'listening',
            onListening
        );

        server.listen(CONFIG.port);
    });
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

async function executeShutdownHooks() {
    const hooks = Array.from(shutdownHooks);

    for (const hook of hooks) {
        await hook();
    }

    shutdownHooks.clear();
}

function shutdown(signal = 'shutdown') {
    if (shutdownPromise) {
        return shutdownPromise;
    }

    shuttingDown = true;

    shutdownPromise = (async () => {
        console.log(
            JSON.stringify({
                level: 'info',
                service: SERVICE_NAME,
                event: 'shutdown.started',
                signal,
                timestamp: new Date().toISOString(),
            })
        );

        const timeout = setTimeout(() => {
            console.error(
                '[MedOrbits] Shutdown timeout exceeded. Forcing process termination.'
            );

            server.closeAllConnections?.();

            process.exit(1);
        }, CONFIG.shutdownTimeoutMs);

        try {
            if (serverStarted && server.listening) {
                await new Promise((resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve();
                    });

                    server.closeIdleConnections?.();
                });

                serverStarted = false;

                console.log(
                    '[MedOrbits] HTTP server closed.'
                );
            }

            await executeShutdownHooks();

            console.log(
                JSON.stringify({
                    level: 'info',
                    service: SERVICE_NAME,
                    event: 'shutdown.completed',
                    timestamp: new Date().toISOString(),
                })
            );
        } catch (error) {
            process.exitCode = 1;

            console.error(
                '[MedOrbits] Shutdown failure:',
                error.message
            );
        } finally {
            clearTimeout(timeout);
        }
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
}

// =============================================================================
// FATAL PROCESS ERROR HANDLING
// =============================================================================

function handleFatalError(type, error) {
    if (fatalErrorHandled) {
        return;
    }

    fatalErrorHandled = true;

    process.exitCode = 1;

    const message = error instanceof Error
        ? error.message
        : String(error);

    console.error(
        JSON.stringify({
            level: 'fatal',
            service: SERVICE_NAME,
            event: type,
            message,
            timestamp: new Date().toISOString(),
        })
    );

    shutdown(type)
        .catch(() => {})
        .finally(() => {
            process.exit(1);
        });
}

function installProcessErrorHandlers() {
    process.on('unhandledRejection', (reason) => {
        handleFatalError(
            'unhandledRejection',
            reason
        );
    });

    process.on('uncaughtException', (error) => {
        handleFatalError(
            'uncaughtException',
            error
        );
    });
}

// =============================================================================
// STANDALONE APPLICATION STARTUP
// =============================================================================

if (require.main === module) {
    installSignalHandlers();

    installProcessErrorHandlers();

    startServer().catch(async (error) => {
        console.error(
            '[MedOrbits] API startup failed:',
            error.message
        );

        process.exitCode = 1;

        await shutdown(
            'startup_failure'
        ).catch(() => {});
    });
}

// =============================================================================
// MODULE EXPORTS
// =============================================================================

module.exports = app;

module.exports.server = server;

module.exports.startServer = startServer;

module.exports.shutdown = shutdown;

module.exports.registerShutdownHook =
    registerShutdownHook;

module.exports.CONFIG = CONFIG;

module.exports.ROUTES = ROUTES;

module.exports.executeShutdownHooks =
    executeShutdownHooks;
