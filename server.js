
'use strict';

/**
 * MedOrbits Application Server
 * ===========================
 *
 * File: server.js
 * Runtime: Node.js >= 20
 *
 * Features:
 * - Express 4/5 compatible routing
 * - Security headers and configurable CORS
 * - Request IDs, structured request logging and rate limiting
 * - Optional PostgreSQL integration
 * - Monitoring integration with graceful fallback
 * - Health, readiness and metrics endpoints
 * - Safe API router mounting
 * - Restricted HTML and public asset delivery
 * - Centralized error handling
 * - Graceful shutdown
 *
 * Recommended dependencies:
 *   npm install express helmet cors express-rate-limit dotenv
 *   npm install pg
 *
 * Optional:
 *   MONITORING_ENABLED=true
 *   MONITORING_METRICS_ENABLED=true
 *   MONITORING_METRICS_TOKEN=your_long_random_secret
 *   DATABASE_URL=postgresql://...
 *   CORS_ORIGINS=https://medorbits.in,https://www.medorbits.in
 *   TRUST_PROXY=0
 *   RATE_LIMIT_WINDOW_MS=900000
 *   RATE_LIMIT_MAX=200
 *   BODY_LIMIT=1mb
 *   ENABLE_DATABASE=false
 *
 * This server does not run database migrations.
 * Route modules must export an Express router or middleware function.
 */

const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');

require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
});

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

const VERSION = '2.1.0';
const SERVICE_NAME = 'medorbits';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const ROOT_DIR = path.resolve(__dirname);
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PAGES_DIR = path.join(ROOT_DIR, 'pages');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MONITORING_DIR = path.join(ROOT_DIR, 'monitoring');

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

const SHUTDOWN_TIMEOUT_MS = parsePositiveInteger(
  process.env.SHUTDOWN_TIMEOUT_MS,
  10000
);

const ENABLE_MONITORING =
  process.env.MONITORING_ENABLED !== 'false';

let databasePool = null;
let databaseStatus = 'disabled';
let monitoring = null;
let monitoringStatus = 'disabled';
let shuttingDown = false;
let started = false;

/**
 * API route map.
 *
 * Missing files are skipped with a warning.
 * Present but invalid modules cause startup to fail.
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
 * Parse a positive integer environment variable.
 */
function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Expected a positive integer but received: ${value}`
    );
  }

  return parsed;
}

/**
 * Parse the listening port.
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
 * Resolve the permitted CORS origins.
 */
function getAllowedOrigins() {
  const configured = process.env.CORS_ORIGINS;

  if (configured !== undefined && configured.trim() !== '') {
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

  // An empty list means no browser origins are trusted.
  return [];
}

/**
 * Determine whether a path is contained inside a directory.
 */
function isInsideDirectory(candidate, directory) {
  const absoluteCandidate = path.resolve(candidate);
  const absoluteDirectory = path.resolve(directory);

  const relative = path.relative(
    absoluteDirectory,
    absoluteCandidate
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
 * Confirm that a file is a regular file and has no symlinked
 * components between the designated base and the target.
 */
function isSafeRegularFile(candidate, baseDirectory) {
  const absoluteBase = path.resolve(baseDirectory);
  const absoluteCandidate = path.resolve(candidate);

  if (!isInsideDirectory(absoluteCandidate, absoluteBase)) {
    return false;
  }

  const relative = path.relative(
    absoluteBase,
    absoluteCandidate
  );

  let current = absoluteBase;

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
 * Standard JSON error response.
 */
function sendJsonError(res, status, code, message) {
  if (res.headersSent) {
    return;
  }

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
 * Request correlation IDs.
 *
 * Only accept client IDs matching a safe, bounded character set.
 */
app.use((req, res, next) => {
  const supplied = req.get('x-request-id');

  res.locals.requestId =
    supplied && /^[a-zA-Z0-9._-]{1,100}$/.test(supplied)
      ? supplied
      : crypto.randomUUID();

  res.setHeader('X-Request-ID', res.locals.requestId);

  next();
});

/**
 * Reverse proxy configuration.
 *
 * Configure this only for a known, trusted deployment topology.
 */
if (process.env.TRUST_PROXY !== undefined) {
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
 * Inline scripts and inline styles are not permitted by this CSP.
 * If existing pages use inline code, migrate it to external files or
 * implement a suitable nonce-based policy.
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
 * CORS configuration.
 *
 * Requests without an Origin header are allowed.
 * Browser origins must match the allowlist exactly.
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

    methods: [
      'GET',
      'HEAD',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

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
 * Request body parsing.
 */
app.use(
  express.json({
    limit: BODY_LIMIT,
    strict: true,
    type: [
      'application/json',
      'application/*+json',
    ],
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
 * Add stricter limiters to login, registration, and password-reset
 * endpoints in their respective route modules.
 */
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

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
 * Never record request bodies, cookies, authorization headers,
 * passwords, access tokens, or database credentials.
 */
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(
      process.hrtime.bigint() - startedAt
    ) / 1e6;

    const record = {
      time: new Date().toISOString(),
      service: SERVICE_NAME,
      version: VERSION,
      environment: NODE_ENV,
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
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
 * Initialize the optional monitoring module.
 *
 * Expected integration:
 *   monitoring/index.js
 *   exports.createMonitoring(options)
 *
 * The module should expose mount(app), and mount its middleware and
 * health/metrics endpoints before application routes and 404 handlers.
 *
 * If the directory is absent, built-in health endpoints remain available.
 * If monitoring exists but is broken, fail startup rather than silently
 * claiming monitoring is active.
 */
function initializeMonitoring() {
  if (!ENABLE_MONITORING) {
    monitoringStatus = 'disabled';
    console.log('[MedOrbits] Monitoring disabled by configuration.');
    return;
  }

  const monitoringEntry = path.join(
    MONITORING_DIR,
    'index.js'
  );

  if (!fs.existsSync(monitoringEntry)) {
    monitoringStatus = 'unavailable';

    console.warn(
      '[MedOrbits] monitoring/index.js not found; using built-in health endpoints.'
    );

    return;
  }

  if (!isSafeRegularFile(monitoringEntry, MONITORING_DIR)) {
    throw new Error(
      'Monitoring entry point is not a safe regular file.'
    );
  }

  const monitoringModule = require(monitoringEntry);

  if (
    !monitoringModule ||
    typeof monitoringModule.createMonitoring !== 'function'
  ) {
    throw new TypeError(
      'monitoring/index.js must export createMonitoring(options).'
    );
  }

  monitoring = monitoringModule.createMonitoring({
    serviceName: SERVICE_NAME,
    version: VERSION,
    environment: NODE_ENV,

    checks: {
      database: async () => {
        if (!databasePool) {
          // A disabled database is not a failed dependency.
          return;
        }

        await databasePool.query('SELECT 1');
      },
    },
  });

  if (!monitoring || typeof monitoring.mount !== 'function') {
    throw new TypeError(
      'createMonitoring() must return an object with mount(app).'
    );
  }

  monitoring.mount(app);
  monitoringStatus = 'enabled';

  console.log('[MedOrbits] Monitoring module mounted.');
}

/**
 * Initialize PostgreSQL only when explicitly enabled or configured.
 *
 * DATABASE_URL enables PostgreSQL unless ENABLE_DATABASE=false.
 * No database pool is created when database integration is disabled.
 */
async function initializeDatabase() {
  const explicitlyDisabled =
    process.env.ENABLE_DATABASE === 'false';

  const enabled =
    process.env.ENABLE_DATABASE === 'true' ||
    Boolean(process.env.DATABASE_URL);

  if (explicitlyDisabled || !enabled) {
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

  const poolOptions = {
    connectionString: process.env.DATABASE_URL,
    max: parsePositiveInteger(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  if (process.env.DATABASE_SSL === 'true') {
    poolOptions.ssl = {
      rejectUnauthorized: true,
    };
  }

  databasePool = new Pool(poolOptions);
  databaseStatus = 'connecting';

  databasePool.on('error', (error) => {
    databaseStatus = 'unavailable';

    console.error(
      '[MedOrbits] Unexpected idle database client error:',
      error.message
    );
  });

  try {
    await databasePool.query('SELECT 1');
    databaseStatus = 'connected';

    console.log('[MedOrbits] PostgreSQL connection verified.');
  } catch (error) {
    databaseStatus = 'unavailable';
    throw error;
  }
}

/**
 * Built-in health endpoints.
 *
 * These are registered only when the monitoring module is unavailable
 * or disabled. They do not replace application-level monitoring.
 */
function mountBuiltInHealthEndpoints() {
  app.get('/health/live', (req, res) => {
    res.status(200).json({
      success: true,
      status: 'alive',
      service: SERVICE_NAME,
      version: VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (req, res) => {
    if (shuttingDown) {
      return res.status(503).json({
        success: false,
        status: 'shutting_down',
        service: SERVICE_NAME,
      });
    }

    let database = databaseStatus;

    if (databasePool) {
      try {
        await databasePool.query('SELECT 1');
        database = 'connected';
        databaseStatus = 'connected';
      } catch {
        database = 'unavailable';
        databaseStatus = 'unavailable';
      }
    }

    const ready =
      database !== 'unavailable' &&
      database !== 'connecting';

    return res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? 'ready' : 'degraded',
      service: SERVICE_NAME,
      version: VERSION,
      dependencies: {
        database,
        monitoring: monitoringStatus,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      status: 'ok',
      service: SERVICE_NAME,
      version: VERSION,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * API index.
 */
app.get('/api', (req, res) => {
  res.json({
    success: true,
    service: 'MedOrbits API',
    version: VERSION,
    environment: NODE_ENV,
    health: {
      live: '/health/live',
      ready: '/health/ready',
    },
    monitoring: {
      enabled: monitoringStatus === 'enabled',
      metrics: '/internal/metrics',
    },
    routes: API_ROUTES.map(([prefix]) => prefix),
  });
});

/**
 * Mount a static directory only when it exists and is a directory.
 */
function mountStaticDirectory(urlPrefix, directory, maxAge) {
  try {
    const stats = fs.lstatSync(directory);

    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      console.warn(
        `[MedOrbits] Static directory ignored: ${directory}`
      );
      return;
    }

    app.use(
      urlPrefix,
      express.static(directory, {
        dotfiles: 'deny',
        fallthrough: true,
        index: false,
        maxAge,
        etag: true,
        setHeaders(res) {
          res.setHeader('X-Content-Type-Options', 'nosniff');
        },
      })
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

mountStaticDirectory(
  '/assets',
  ASSETS_DIR,
  IS_PRODUCTION ? '7d' : 0
);

mountStaticDirectory(
  '/public',
  PUBLIC_DIR,
  IS_PRODUCTION ? '1d' : 0
);

/**
 * Safely deliver HTML pages from the root or /pages.
 *
 * This handler only serves .html/.htm files. It never mounts the repository
 * root as a general static directory.
 */
function serveHtmlPage(req, res, next) {
  let pathname;

  try {
    pathname = decodeURIComponent(req.path);
  } catch {
    return sendJsonError(
      res,
      400,
      'INVALID_PATH',
      'Invalid URL path.'
    );
  }

  if (
    pathname.includes('\0') ||
    pathname.includes('\\')
  ) {
    return sendJsonError(
      res,
      400,
      'INVALID_PATH',
      'Invalid URL path.'
    );
  }

  const normalized = pathname.replace(/^\/+/, '');

  if (!normalized || normalized === 'index.html') {
    return next();
  }

  const relativePath = path.normalize(normalized);

  if (
    relativePath === '.' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return sendJsonError(
      res,
      400,
      'INVALID_PATH',
      'Invalid URL path.'
    );
  }

  const extension = path.extname(relativePath).toLowerCase();

  if (!['.html', '.htm'].includes(extension)) {
    return next();
  }

  const segments = relativePath.split(path.sep);

  const allowedLocation =
    segments.length === 1 ||
    (
      segments[0] === 'pages' &&
      segments.length >= 2
    );

  if (!allowedLocation) {
    return next();
  }

  const candidate = path.resolve(ROOT_DIR, relativePath);

  if (!isSafeRegularFile(candidate, ROOT_DIR)) {
    return next();
  }

  return res.sendFile(candidate, {
    dotfiles: 'deny',
    cacheControl: true,
    maxAge: IS_PRODUCTION ? '1h' : 0,
  });
}

/**
 * Homepage delivery.
 */
app.get('/', (req, res) => {
  const candidates = [
    {
      file: path.join(ROOT_DIR, 'index.html'),
      base: ROOT_DIR,
    },
    {
      file: path.join(PUBLIC_DIR, 'index.html'),
      base: PUBLIC_DIR,
    },
  ];

  const homepage = candidates.find(({ file, base }) =>
    isSafeRegularFile(file, base)
  );

  if (!homepage) {
    return res
      .status(200)
      .type('text/plain')
      .send(
        'MedOrbits server is running. Add index.html or configure the frontend.'
      );
  }

  return res.sendFile(homepage.file, {
    dotfiles: 'deny',
    cacheControl: true,
    maxAge: IS_PRODUCTION ? '1h' : 0,
  });
});

/**
 * Favicon.
 */
app.get('/favicon.ico', (req, res) => {
  const favicon = path.join(ASSETS_DIR, 'favicon.ico');

  if (!isSafeRegularFile(favicon, ASSETS_DIR)) {
    return res.status(204).end();
  }

  return res.sendFile(favicon, {
    dotfiles: 'deny',
    maxAge: IS_PRODUCTION ? '7d' : 0,
  });
});

/**
 * Normalize supported CommonJS route exports.
 *
 * Supported:
 *   module.exports = router;
 *   exports.router = router;
 *   exports.default = router;
 *   exports.default.router = router;
 *
 * A controller object is not a router. Export an actual Express Router
 * from each route module.
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
 * Mount API routes.
 *
 * This function must run before the API 404 handler is registered.
 */
function mountApiRoutes() {
  for (const [prefix, relativeModulePath] of API_ROUTES) {
    const absoluteModulePath = path.resolve(
      ROOT_DIR,
      relativeModulePath
    );

    if (!isInsideDirectory(absoluteModulePath, ROOT_DIR)) {
      throw new Error(
        `Invalid route module path: ${relativeModulePath}`
      );
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
      exported = require(absoluteModulePath);
    } catch (error) {
      throw new Error(
        `Failed to load ${relativeModulePath}: ${error.message}`,
        { cause: error }
      );
    }

    const router = normalizeRouter(
      exported,
      relativeModulePath
    );

    app.use(prefix, router);

    console.log(
      `[MedOrbits] Mounted ${prefix} -> ${relativeModulePath}`
    );
  }
}

/**
 * Register monitoring and health endpoints before API routes.
 */
initializeMonitoring();

if (monitoringStatus !== 'enabled') {
  mountBuiltInHealthEndpoints();
}

/**
 * Critical ordering:
 *
 * API route modules are mounted before the API 404 middleware.
 * This prevents the 404 handler from swallowing valid API requests.
 *
 * Mounting happens synchronously before the server starts listening.
 */
mountApiRoutes();

/**
 * Express 4/5-compatible HTML fallback.
 *
 * A regular expression is used instead of app.get('*', ...), which can
 * throw a path-to-regexp "Missing parameter name" error under Express 5.
 *
 * Non-HTML requests call next(), allowing API and asset requests to
 * continue through the middleware stack.
 */
app.get(/.*/, serveHtmlPage);

/**
 * API 404 handler.
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
      '<html lang="en">' +
      '<head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta name="robots" content="noindex">' +
      '<title>404 | MedOrbits</title>' +
      '</head>' +
      '<body>' +
      '<main>' +
      '<h1>Page not found</h1>' +
      '<p>The requested page could not be found.</p>' +
      '<p><a href="/">Return to home</a></p>' +
      '</main>' +
      '</body>' +
      '</html>'
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
 * Keep this after all routes and 404 handlers.
 */
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let status = Number(
    error.status || error.statusCode || 500
  );

  if (
    !Number.isInteger(status) ||
    status < 400 ||
    status > 599
  ) {
    status = 500;
  }

  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred.';

  if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body contains invalid JSON.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'REQUEST_TOO_LARGE';
    message = 'The request body exceeds the configured size limit.';
  } else if (error.type === 'parameters.too.many') {
    status = 413;
    code = 'TOO_MANY_PARAMETERS';
    message = 'The request contains too many parameters.';
  } else if (error.code === 'CORS_ORIGIN_DENIED') {
    status = 403;
    code = 'CORS_ORIGIN_DENIED';
    message = 'The request origin is not allowed.';
  } else if (status < 500 && error.expose === true) {
    code = error.code || 'REQUEST_ERROR';
    message = error.message;
  }

  if (status >= 500) {
    console.error(
      '[MedOrbits] Request error:',
      JSON.stringify({
        time: new Date().toISOString(),
        requestId: res.locals.requestId || null,
        method: req.method,
        path: req.path,
        status,
        message: error.message,
      })
    );
  }

  return sendJsonError(res, status, code, message);
});

/**
 * Start the server.
 */
async function startServer() {
  if (started) {
    return server;
  }

  await initializeDatabase();

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };

    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(PORT);
  });

  started = true;

  console.log(`[MedOrbits] Server listening on port ${PORT}`);
  console.log(`[MedOrbits] Environment: ${NODE_ENV}`);
  console.log(`[MedOrbits] Version: ${VERSION}`);
  console.log(`[MedOrbits] Database: ${databaseStatus}`);
  console.log(`[MedOrbits] Monitoring: ${monitoringStatus}`);
  console.log(`[MedOrbits] Health: http://localhost:${PORT}/health`);

  return server;
}

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

  try {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    if (databasePool) {
      await databasePool.end();
      databasePool = null;
    }

    clearTimeout(timeout);

    console.log('[MedOrbits] Shutdown complete.');
    process.exitCode = 0;
  } catch (error) {
    clearTimeout(timeout);

    console.error(
      '[MedOrbits] Shutdown failed:',
      error.message
    );

    process.exitCode = 1;
  }
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

/**
 * Handle uncaught failures without exposing internal details to clients.
 */
process.on('unhandledRejection', (reason) => {
  const message =
    reason instanceof Error
      ? reason.message
      : String(reason);

  console.error(
    '[MedOrbits] Unhandled promise rejection:',
    message
  );

  // A rejection may leave application state inconsistent.
  // Initiate controlled shutdown rather than continuing blindly.
  void shutdown('UNHANDLED_REJECTION');
});

/**
 * Start automatically when executed directly.
 *
 * Requiring this module for tests does not start a listening server.
 */
if (require.main === module) {
  startServer().catch(async (error) => {
    console.error(
      '[MedOrbits] Startup failed:',
      error.message
    );

    if (error.cause) {
      console.error(
        '[MedOrbits] Cause:',
        error.cause.message
      );
    }

    if (databasePool) {
      try {
        await databasePool.end();
      } catch {
        // Preserve the original startup error.
      }

      databasePool = null;
    }

    process.exitCode = 1;
  });
}

module.exports = {
  app,
  server,
  startServer,
  shutdown,
  initializeDatabase,
  initializeMonitoring,
  mountApiRoutes,
  normalizeRouter,
  isInsideDirectory,
  isSafeRegularFile,
  getAllowedOrigins,
  API_ROUTES,
  VERSION,
};
