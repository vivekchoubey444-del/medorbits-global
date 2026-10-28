
'use strict';

/**
 * MedOrbits Application Server
 * ===========================
 *
 * File: server.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Express application bootstrap
 * - Security headers and configurable CORS
 * - Request rate limiting
 * - JSON request parsing and error handling
 * - Optional PostgreSQL connection and health checks
 * - Safe mounting of existing API route modules
 * - Controlled delivery of HTML pages and public assets
 * - Graceful shutdown
 *
 * Required environment variables:
 *   NODE_ENV=production
 *   PORT=3000
 *
 * Optional:
 *   DATABASE_URL=postgresql://...
 *   CORS_ORIGINS=https://medorbits.in,https://www.medorbits.in
 *   TRUST_PROXY=0
 *   RATE_LIMIT_WINDOW_MS=900000
 *   RATE_LIMIT_MAX=200
 *   BODY_LIMIT=1mb
 *   ENABLE_DATABASE=false
 *
 * This file does not create database tables or run migrations.
 * It does not automatically execute missing route modules.
 */

const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
});

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

const VERSION = '2.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const ROOT_DIR = path.resolve(__dirname);
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PAGES_DIR = path.join(ROOT_DIR, 'pages');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const PORT = parsePort(process.env.PORT, 3000);
const BODY_LIMIT = process.env.BODY_LIMIT || '1mb';
const RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
  process.env.RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const RATE_LIMIT_MAX = parsePositiveInteger(
  process.env.RATE_LIMIT_MAX,
  200
);

const SHUTDOWN_TIMEOUT_MS = 10000;

let databasePool = null;
let databaseStatus = 'disabled';
let shuttingDown = false;

/**
 * API route map.
 *
 * Each entry is:
 *   [URL prefix, relative route-module path]
 *
 * Missing modules are skipped with a warning.
 * Existing modules that fail to load or export a valid router cause startup
 * to fail, rather than silently leaving an API endpoint broken.
 */
const API_ROUTES = [
  ['/api/auth', 'routes/auth.routes.js'],
  ['/api/users', 'routes/user.routes.js'],
  ['/api/properties', 'routes/property.routes.js'],
  ['/api/search', 'routes/search.routes.js'],
  ['/api/visits', 'routes/visit.routes.js'],
  ['/api/offers', 'routes/offer.routes.js'],
  ['/api/applications', 'routes/application.routes.js'],
  ['/api/documents', 'routes/document.routes.js'],
];

/**
 * Parse an integer environment variable safely.
 */
function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer configuration: ${value}`);
  }

  return parsed;
}

/**
 * Parse and validate the listening port.
 */
function parsePort(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 65535
  ) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return parsed;
}

/**
 * Return a normalized list of permitted CORS origins.
 */
function getAllowedOrigins() {
  const configured = process.env.CORS_ORIGINS;

  if (configured) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (!IS_PRODUCTION) {
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];
  }

  // Configure CORS_ORIGINS explicitly in production.
  return [];
}

/**
 * Resolve a candidate path and reject paths outside a permitted directory.
 */
function isInsideDirectory(candidate, directory) {
  const relative = path.relative(
    path.resolve(directory),
    path.resolve(candidate)
  );

  return (
    relative === '' ||
    (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

/**
 * Confirm a path is a regular file and has no symlinked path components.
 */
function isSafeRegularFile(candidate, baseDirectory) {
  const absoluteBase = path.resolve(baseDirectory);
  const absoluteCandidate = path.resolve(candidate);

  if (!isInsideDirectory(absoluteCandidate, absoluteBase)) {
    return false;
  }

  let current = absoluteBase;
  const relative = path.relative(absoluteBase, absoluteCandidate);

  try {
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);

      const stats = fs.lstatSync(current);

      if (stats.isSymbolicLink()) {
        return false;
      }
    }

    return fs.statSync(absoluteCandidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Standard JSON response helper.
 */
function sendJsonError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
    requestId: res.locals.requestId || null,
  });
}

/**
 * Request correlation ID.
 *
 * A client-provided request ID is accepted only when it has a safe format.
 */
app.use((req, res, next) => {
  const supplied = req.get('x-request-id');

  res.locals.requestId =
    supplied && /^[a-zA-Z0-9._-]{1,100}$/.test(supplied)
      ? supplied
      : require('node:crypto').randomUUID();

  res.setHeader('X-Request-ID', res.locals.requestId);

  next();
});

/**
 * Reverse proxy configuration.
 *
 * Set TRUST_PROXY to a deployment-specific value only when running behind
 * a trusted proxy. Avoid blindly trusting arbitrary forwarded headers.
 */
if (process.env.TRUST_PROXY) {
  const value = process.env.TRUST_PROXY.trim();

  if (value === 'true') {
    app.set('trust proxy', 1);
  } else if (value === 'false' || value === '0') {
    app.set('trust proxy', false);
  } else if (/^\d+$/.test(value)) {
    app.set('trust proxy', Number(value));
  } else {
    throw new Error(
      'TRUST_PROXY must be true, false, 0, or a non-negative integer.'
    );
  }
}

/**
 * Security headers.
 *
 * Inline scripts and styles are not enabled by this CSP. If the existing
 * frontend uses inline code, migrate it to external files or configure a
 * suitable nonce-based CSP before enabling this policy for those pages.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'https:'],
        upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

/**
 * CORS.
 *
 * Requests from non-allowed browser origins are rejected.
 * Requests without an Origin header are allowed, as is typical for
 * server-to-server requests and command-line clients.
 */
const allowedOrigins = new Set(getAllowedOrigins());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      const error = new Error('Origin is not allowed by CORS.');
      error.status = 403;
      error.code = 'CORS_ORIGIN_DENIED';

      return callback(error);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
    credentials: false,
    maxAge: 600,
  })
);

/**
 * Request parsing.
 */
app.use(
  express.json({
    limit: BODY_LIMIT,
    strict: true,
    type: ['application/json', 'application/*+json'],
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: BODY_LIMIT,
    parameterLimit: 1000,
  })
);

/**
 * API rate limiting.
 *
 * If the application later adds login or password-reset routes, apply a
 * stricter, route-specific limiter to those endpoints as well.
 */
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
  handler(req, res) {
    return sendJsonError(
      res,
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please try again later.'
    );
  },
});

app.use('/api', apiLimiter);

/**
 * Basic request logging.
 *
 * Do not log request bodies, authorization headers, cookies, or credentials.
 */
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const record = {
      time: new Date().toISOString(),
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    };

    if (IS_PRODUCTION) {
      console.log(JSON.stringify(record));
    } else {
      console.log(
        `[${record.status}] ${record.method} ${record.path} ` +
        `${record.durationMs}ms [${record.requestId}]`
      );
    }
  });

  next();
});

/**
 * Initialize PostgreSQL only when explicitly enabled or configured.
 *
 * DATABASE_URL alone enables the database unless ENABLE_DATABASE=false.
 * The pool is not created when the database is disabled.
 */
async function initializeDatabase() {
  const enabled =
    process.env.ENABLE_DATABASE === 'true' ||
    Boolean(process.env.DATABASE_URL);

  if (process.env.ENABLE_DATABASE === 'false' || !enabled) {
    databaseStatus = 'disabled';
    console.log('[MedOrbits] Database integration disabled.');
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Database is enabled, but DATABASE_URL is not configured.'
    );
  }

  let Pool;

  try {
    ({ Pool } = require('pg'));
  } catch {
    throw new Error(
      'PostgreSQL is configured but package "pg" is missing. ' +
      'Install it with npm install pg.'
    );
  }

  databasePool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parsePositiveInteger(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined,
  });

  databasePool.on('error', (error) => {
    console.error('[MedOrbits] Unexpected idle database client error:', error.message);
  });

  // Verify connectivity at startup. Do not log the connection string.
  await databasePool.query('SELECT 1');

  databaseStatus = 'connected';
  console.log('[MedOrbits] PostgreSQL connection verified.');
}

/**
 * Health endpoints.
 *
 * /health/live confirms the process is running.
 * /health/ready checks whether configured dependencies are ready.
 */
app.get('/health/live', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'alive',
    service: 'medorbits',
    version: VERSION,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', async (req, res) => {
  if (shuttingDown) {
    return res.status(503).json({
      success: false,
      status: 'shutting_down',
    });
  }

  let database = databaseStatus;

  if (databasePool) {
    try {
      await databasePool.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'unavailable';
    }
  }

  const ready = database !== 'unavailable';

  return res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? 'ready' : 'degraded',
    service: 'medorbits',
    version: VERSION,
    dependencies: {
      database,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Compatibility health endpoint.
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    service: 'medorbits',
    version: VERSION,
  });
});

/**
 * API index.
 */
app.get('/api', (req, res) => {
  res.json({
    success: true,
    service: 'MedOrbits API',
    version: VERSION,
    health: {
      live: '/health/live',
      ready: '/health/ready',
    },
    routes: API_ROUTES.map(([prefix]) => prefix),
  });
});

/**
 * Static assets.
 *
 * Only explicitly designated public asset directories are exposed here.
 * The repository root is not mounted as a general static directory, which
 * helps prevent accidental exposure of source code and configuration files.
 */
if (fs.existsSync(ASSETS_DIR) && fs.statSync(ASSETS_DIR).isDirectory()) {
  app.use(
    '/assets',
    express.static(ASSETS_DIR, {
      dotfiles: 'deny',
      fallthrough: true,
      index: false,
      maxAge: IS_PRODUCTION ? '7d' : 0,
      etag: true,
    })
  );
}

if (fs.existsSync(PUBLIC_DIR) && fs.statSync(PUBLIC_DIR).isDirectory()) {
  app.use(
    '/public',
    express.static(PUBLIC_DIR, {
      dotfiles: 'deny',
      fallthrough: true,
      index: false,
      maxAge: IS_PRODUCTION ? '1d' : 0,
      etag: true,
    })
  );
}

/**
 * Safely deliver HTML pages from the repository root or /pages.
 *
 * This handler serves only .html/.htm files. It does not expose .env,
 * JavaScript source, Python source, SQL files, package manifests, or JSON
 * data files through the root-page route.
 */
function serveHtmlPage(req, res, next) {
  let pathname;

  try {
    pathname = decodeURIComponent(req.path);
  } catch {
    return sendJsonError(res, 400, 'INVALID_PATH', 'Invalid URL path.');
  }

  if (pathname.includes('\0') || pathname.includes('\\')) {
    return sendJsonError(res, 400, 'INVALID_PATH', 'Invalid URL path.');
  }

  const normalized = pathname.replace(/^\/+/, '');

  // The homepage is handled explicitly below.
  if (!normalized || normalized === 'index.html') {
    return next();
  }

  const relativePath = path.normalize(normalized);

  if (
    relativePath === '.' ||
    relativePath.startsWith('..' + path.sep) ||
    path.isAbsolute(relativePath)
  ) {
    return sendJsonError(res, 400, 'INVALID_PATH', 'Invalid URL path.');
  }

  const extension = path.extname(relativePath).toLowerCase();

  if (!['.html', '.htm'].includes(extension)) {
    return next();
  }

  // Limit page delivery to root-level HTML files and the /pages directory.
  const segments = relativePath.split(path.sep);
  const allowedLocation =
    segments.length === 1 ||
    segments[0] === 'pages';

  if (!allowedLocation) {
    return next();
  }

  const candidate = path.resolve(ROOT_DIR, relativePath);

  if (
    !isSafeRegularFile(candidate, ROOT_DIR) ||
    !fs.existsSync(candidate)
  ) {
    return next();
  }

  return res.sendFile(candidate, {
    dotfiles: 'deny',
    cacheControl: true,
    maxAge: IS_PRODUCTION ? '1h' : 0,
  });
}

app.get('/', (req, res, next) => {
  const candidates = [
    path.join(ROOT_DIR, 'index.html'),
    path.join(PUBLIC_DIR, 'index.html'),
  ];

  const homepage = candidates.find((candidate) => {
    const base = candidate.startsWith(PUBLIC_DIR) ? PUBLIC_DIR : ROOT_DIR;
    return isSafeRegularFile(candidate, base);
  });

  if (!homepage) {
    return res.status(200).type('text/plain').send(
      'MedOrbits server is running. Add index.html or configure the frontend.'
    );
  }

  return res.sendFile(homepage);
});

app.get('/favicon.ico', (req, res, next) => {
  const favicon = path.join(ASSETS_DIR, 'favicon.ico');

  if (!isSafeRegularFile(favicon, ASSETS_DIR)) {
    return res.status(204).end();
  }

  return res.sendFile(favicon);
});

app.get('*', serveHtmlPage);

/**
 * Normalize supported CommonJS route exports.
 *
 * Accepted forms:
 *   module.exports = router;
 *   exports.router = router;
 *   exports.default = router;
 *
 * A module exporting a plain object is rejected unless it contains a valid
 * router property. This helps catch the "callback function but got object"
 * startup error early.
 */
function normalizeRouter(exported, modulePath) {
  const candidates = [
    exported,
    exported && exported.router,
    exported && exported.default,
    exported && exported.default && exported.default.router,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      return candidate;
    }
  }

  throw new TypeError(
    `Route module "${modulePath}" must export an Express router/function. ` +
    'A plain controller object is not a router.'
  );
}

/**
 * Mount route modules.
 *
 * A missing route file is optional and skipped with a warning.
 * A present but invalid module causes startup to fail so route bugs are not
 * hidden by a partially running API.
 */
function mountApiRoutes() {
  for (const [prefix, relativeModulePath] of API_ROUTES) {
    const absoluteModulePath = path.resolve(
      ROOT_DIR,
      relativeModulePath
    );

    if (!isInsideDirectory(absoluteModulePath, ROOT_DIR)) {
      throw new Error(`Invalid route module path: ${relativeModulePath}`);
    }

    if (!fs.existsSync(absoluteModulePath)) {
      console.warn(
        `[MedOrbits] Route module not found; skipping ${prefix}: ` +
        relativeModulePath
      );
      continue;
    }

    if (!isSafeRegularFile(absoluteModulePath, ROOT_DIR)) {
      throw new Error(
        `Route module is not a safe regular file: ${relativeModulePath}`
      );
    }

    let exported;

    try {
      // The module is required only to mount the application's configured
      // routes. It must be trusted application code.
      exported = require(absoluteModulePath);
    } catch (error) {
      throw new Error(
        `Failed to load ${relativeModulePath}: ${error.message}`,
        { cause: error }
      );
    }

    const router = normalizeRouter(exported, relativeModulePath);

    app.use(prefix, router);

    console.log(`[MedOrbits] Mounted ${prefix} -> ${relativeModulePath}`);
  }
}

/**
 * API 404 handler.
 *
 * Use a middleware instead of app.all('*', ...) so the server works with
 * Express versions using newer path-to-regexp syntax.
 */
app.use('/api', (req, res) => {
  return sendJsonError(
    res,
    404,
    'API_ROUTE_NOT_FOUND',
    'The requested API endpoint does not exist.'
  );
});

/**
 * General 404 handler.
 */
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).type('html').send(
      '<!doctype html>' +
      '<html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>404 | MedOrbits</title></head>' +
      '<body><main><h1>Page not found</h1>' +
      '<p>The requested page could not be found.</p>' +
      '<p><a href="/">Return to home</a></p></main></body></html>'
    );
  }

  return sendJsonError(
    res,
    404,
    'NOT_FOUND',
    'The requested resource could not be found.'
  );
});

/**
 * Central error handler.
 *
 * Never expose stack traces or raw internal errors in production responses.
 */
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let status = Number(error.status || error.statusCode || 500);
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
  }

  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred.';

  if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body contains invalid JSON.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'REQUEST_TOO_LARGE';
    message = 'The request body exceeds the configured size limit.';
  } else if (error.code === 'CORS_ORIGIN_DENIED') {
    status = 403;
    code = 'CORS_ORIGIN_DENIED';
    message = 'The request origin is not allowed.';
  } else if (status !== 500 && error.expose === true) {
    message = error.message;
  }

  if (status >= 500) {
    console.error('[MedOrbits] Request error:', {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      message: error.message,
    });
  }

  return sendJsonError(res, status, code, message);
});

/**
 * Graceful shutdown.
 */
async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(`[MedOrbits] Received ${signal}; shutting down.`);

  const timeout = setTimeout(() => {
    console.error('[MedOrbits] Shutdown timed out.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  timeout.unref();

  server.close(async (serverError) => {
    try {
      if (databasePool) {
        await databasePool.end();
      }

      clearTimeout(timeout);

      if (serverError) {
        console.error('[MedOrbits] HTTP server shutdown error:', serverError.message);
        process.exitCode = 1;
      }

      console.log('[MedOrbits] Shutdown complete.');
      process.exit();
    } catch (error) {
      clearTimeout(timeout);
      console.error('[MedOrbits] Shutdown failed:', error.message);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

/**
 * Start the application.
 */
async function startServer() {
  await initializeDatabase();
  mountApiRoutes();

  await new Promise((resolve, reject) => {
    server.once('error', reject);

    server.listen(PORT, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  console.log(`[MedOrbits] Server listening on port ${PORT}`);
  console.log(`[MedOrbits] Environment: ${NODE_ENV}`);
  console.log(`[MedOrbits] Health: http://localhost:${PORT}/health`);
}

startServer().catch(async (error) => {
  console.error('[MedOrbits] Startup failed:', error.message);

  if (error.cause) {
    console.error('[MedOrbits] Cause:', error.cause.message);
  }

  if (databasePool) {
    try {
      await databasePool.end();
    } catch {
      // Preserve the original startup error.
    }
  }

  process.exitCode = 1;
});

module.exports = {
  app,
  server,
  startServer,
};
