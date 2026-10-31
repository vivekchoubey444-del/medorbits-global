
'use strict';

/**
 * =============================================================================
 * MedOrbits API -- Express Application Bootstrap
 * File: /api/app.js
 * Version: 2.1.1
 *
 * Runtime: Node.js >= 22
 * Framework: Express 4
 *
 * Responsibilities:
 *   - Initialize Express.
 *   - Configure security and request parsing.
 *   - Apply API rate limiting.
 *   - Mount API routes.
 *   - Handle 404 and application errors.
 *   - Validate server configuration.
 *   - Support graceful shutdown.
 *
 * =============================================================================
 */

// =============================================================================
// DEPENDENCIES
// =============================================================================

const http = require('node:http');

const express = require('express');

const {
    apiLimiter,
} = require('./middleware/rate-limit');

const {
    notFoundHandler,
    errorHandler,
} = require('./middleware/error-handler');

// =============================================================================
// CONFIGURATION
// =============================================================================

function readPort(value) {
    const port = Number(value || 3000);

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
    const limit = value?.trim() || '1mb';

    if (!/^\d+(?:b|kb|mb|gb)?$/i.test(limit)) {
        throw new Error(
            'JSON_BODY_LIMIT must be a valid byte size, such as 1mb or 512kb.'
        );
    }

    return limit;
}

const CONFIG = Object.freeze({
    port: readPort(process.env.PORT),

    jsonBodyLimit: readBodyLimit(
        process.env.JSON_BODY_LIMIT
    ),

    environment:
        process.env.NODE_ENV || 'development',

    shutdownTimeoutMs: 30000,
});

// =============================================================================
// APPLICATION
// =============================================================================

const app = express();

app.disable('x-powered-by');

// Trust proxy must be configured explicitly when deployed behind
// a known reverse proxy. Do not blindly trust every proxy.
if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

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

// Parse URL-encoded form bodies with a bounded parameter count.
app.use(
    express.urlencoded({
        extended: false,
        limit: CONFIG.jsonBodyLimit,
        parameterLimit: 100,
    })
);

// =============================================================================
// REQUEST IDENTIFICATION
// =============================================================================

app.use((req, res, next) => {
    const requestId = require('node:crypto').randomUUID();

    req.requestId = requestId;

    res.setHeader(
        'X-Request-ID',
        requestId
    );

    next();
});

// =============================================================================
// RATE LIMITING
// =============================================================================

if (typeof apiLimiter !== 'function') {
    throw new TypeError(
        'middleware/rate-limit must export apiLimiter as a middleware function.'
    );
}

app.use('/api', apiLimiter);

// =============================================================================
// HEALTH ROUTE
// =============================================================================

function mountRoute(mountPath, modulePath) {
    let router;

    try {
        router = require(modulePath);
    } catch (error) {
        throw new Error(
            `Failed to load route ${modulePath}: ${error.message}`,
            { cause: error }
        );
    }

    if (typeof router !== 'function') {
        throw new TypeError(
            `Route ${modulePath} must export an Express router or middleware function.`
        );
    }

    app.use(mountPath, router);

    console.log(
        `[MedOrbits] Mounted ${mountPath}`
    );
}

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

if (typeof notFoundHandler !== 'function') {
    throw new TypeError(
        'middleware/error-handler must export notFoundHandler.'
    );
}

app.use(notFoundHandler);

// =============================================================================
// CENTRAL ERROR HANDLER
// =============================================================================

if (typeof errorHandler !== 'function') {
    throw new TypeError(
        'middleware/error-handler must export errorHandler.'
    );
}

app.use(errorHandler);

// =============================================================================
// HTTP SERVER
// =============================================================================

const server = http.createServer(app);

let serverStarted = false;
let shuttingDown = false;
let shutdownPromise = null;

// =============================================================================
// SERVER STARTUP
// =============================================================================

function startServer() {
    if (serverStarted) {
        throw new Error(
            'MedOrbits API server has already started.'
        );
    }

    if (shuttingDown) {
        throw new Error(
            'Cannot start the server after shutdown has begun.'
        );
    }

    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.removeListener('listening', onListening);

            reject(error);
        };

        const onListening = () => {
            server.removeListener('error', onError);

            serverStarted = true;

            console.log(
                JSON.stringify({
                    level: 'info',
                    service: 'medorbits-api',
                    event: 'server.started',
                    environment: CONFIG.environment,
                    port: CONFIG.port,
                    routes: ROUTES.length + 1,
                    timestamp: new Date().toISOString(),
                })
            );

            resolve(server);
        };

        server.once('error', onError);
        server.once('listening', onListening);

        server.listen(CONFIG.port);
    });
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

function shutdown(signal = 'shutdown') {
    if (shutdownPromise) {
        return shutdownPromise;
    }

    shutdownPromise = (async () => {
        if (shuttingDown) return;

        shuttingDown = true;

        console.log(
            `[MedOrbits] Shutdown initiated: ${signal}`
        );

        if (!serverStarted) {
            console.log(
                '[MedOrbits] HTTP server was not running.'
            );

            return;
        }

        const timeout = setTimeout(() => {
            console.error(
                '[MedOrbits] Graceful shutdown timed out.'
            );

            process.exitCode = 1;

            server.closeAllConnections?.();
        }, CONFIG.shutdownTimeoutMs);

        timeout.unref?.();

        try {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });

                // Prevent new keep-alive connections while draining.
                server.closeIdleConnections?.();
            });

            console.log(
                '[MedOrbits] HTTP server closed successfully.'
            );
        } catch (error) {
            process.exitCode = 1;

            console.error(
                '[MedOrbits] HTTP server shutdown failed:',
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
// PROCESS ERROR HANDLING
// =============================================================================

function installProcessErrorHandlers() {
    process.on('unhandledRejection', (reason) => {
        console.error(
            '[MedOrbits] Unhandled promise rejection:',
            reason instanceof Error
                ? reason.message
                : String(reason)
        );

        process.exitCode = 1;

        shutdown('unhandledRejection').catch(() => {});
    });

    process.on('uncaughtException', (error) => {
        console.error(
            '[MedOrbits] Uncaught exception:',
            error.message
        );

        process.exitCode = 1;

        shutdown('uncaughtException').catch(() => {});
    });
}

// =============================================================================
// STANDALONE STARTUP
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

        await shutdown('startup_failure').catch(() => {});
    });
}

// =============================================================================
// MODULE EXPORTS
// =============================================================================

module.exports = app;

module.exports.server = server;
module.exports.startServer = startServer;
module.exports.shutdown = shutdown;
module.exports.CONFIG = CONFIG;
module.exports.ROUTES = ROUTES;
