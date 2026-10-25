
/**
 * MedOrbits API Server
 * File: server.js
 *
 * Runtime: Node.js 20+
 * Module system: ES Modules
 *
 * Responsibilities:
 * - Secure HTTP server and request lifecycle
 * - PostgreSQL connection pool
 * - CORS, Helmet, compression and rate limiting
 * - Request IDs and structured logs
 * - Health, readiness and API discovery
 * - Dynamic Express router registration
 * - Consistent JSON responses and error handling
 * - Graceful shutdown and startup failure handling
 */

import "dotenv/config";

import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function readInteger(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  if (!/^-?\d+$/.test(raw.trim())) {
    throw new Error(`${name} must be an integer.`);
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }

  return value;
}

function readBoolean(name, fallback = false) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  if (raw === "true") return true;
  if (raw === "false") return false;

  throw new Error(`${name} must be "true" or "false".`);
}

const CONFIG = Object.freeze({
  appName: "MedOrbits",
  version: process.env.npm_package_version || "0.1.0",
  environment: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",

  port: readInteger("PORT", 3000, { min: 1, max: 65535 }),

  apiPrefix: "/api/v1",

  bodyLimit: process.env.BODY_LIMIT || "1mb",

  rateLimit: readInteger("API_RATE_LIMIT", 300),
  rateWindowMs: readInteger("API_RATE_WINDOW_MS", 15 * 60 * 1000),

  shutdownTimeoutMs: readInteger("SHUTDOWN_TIMEOUT_MS", 15000, {
    min: 1000,
    max: 300000,
  }),

  dbPoolMax: readInteger("DB_POOL_MAX", 10, { min: 1, max: 100 }),
  dbConnectionTimeoutMs: readInteger("DB_CONNECTION_TIMEOUT_MS", 5000),
  dbIdleTimeoutMs: readInteger("DB_IDLE_TIMEOUT_MS", 30000),
  dbStatementTimeoutMs: readInteger("DB_STATEMENT_TIMEOUT_MS", 15000),

  trustProxyHops: readInteger("TRUST_PROXY_HOPS", 0, { min: 0, max: 32 }),

  production: (process.env.NODE_ENV || "development") === "production",

  databaseSsl: readBoolean("DATABASE_SSL", false),
  databaseSslRejectUnauthorized: readBoolean(
    "DATABASE_SSL_REJECT_UNAUTHORIZED",
    true
  ),

  enableStaticFiles: Boolean(process.env.STATIC_DIRECTORY),

  enableRequestLogs: readBoolean("ENABLE_REQUEST_LOGS", true),
});

if (!["development", "test", "production"].includes(CONFIG.environment)) {
  throw new Error(
    'NODE_ENV must be "development", "test", or "production".'
  );
}

if (!/^\d+(?:kb|mb|gb|b)$/i.test(CONFIG.bodyLimit)) {
  throw new Error(
    "BODY_LIMIT must be a size such as 1024b, 1mb, or 2gb."
  );
}

if (CONFIG.production && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production.");
}

const app = express();
const server = http.createServer(app);

/* -------------------------------------------------------------------------- */
/* Runtime state                                                              */
/* -------------------------------------------------------------------------- */

let shuttingDown = false;
let shutdownStarted = false;
let serverStarted = false;
let databaseAvailable = false;
let fatalErrorSeen = false;

const mountedRoutes = [];

app.disable("x-powered-by");
app.set("env", CONFIG.environment);

if (CONFIG.trustProxyHops > 0) {
  app.set("trust proxy", CONFIG.trustProxyHops);
}

app.locals.appName = CONFIG.appName;
app.locals.appVersion = CONFIG.version;
app.locals.startedAt = new Date().toISOString();
app.locals.mountedRoutes = mountedRoutes;

/* -------------------------------------------------------------------------- */
/* Structured logging                                                         */
/* -------------------------------------------------------------------------- */

function log(level, message, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: CONFIG.appName,
    environment: CONFIG.environment,
    message,
    ...metadata,
  };

  const line = JSON.stringify(entry);

  if (level === "error" || level === "fatal") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/* -------------------------------------------------------------------------- */
/* Standard API responses                                                     */
/* -------------------------------------------------------------------------- */

export function sendSuccess(res, data, statusCode = 200, meta) {
  return res.status(statusCode).json({
    success: true,
    requestId: res.getHeader("X-Request-ID") || null,
    data,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  });
}

export function sendError(res, statusCode, code, message, details) {
  const error = { code, message };

  if (!CONFIG.production && details !== undefined) {
    error.details = details;
  }

  return res.status(statusCode).json({
    success: false,
    requestId: res.getHeader("X-Request-ID") || null,
    error,
  });
}

app.locals.respond = {
  success: sendSuccess,
  error: sendError,
};

/* -------------------------------------------------------------------------- */
/* PostgreSQL connection pool                                                 */
/* -------------------------------------------------------------------------- */

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: CONFIG.dbPoolMax,
      connectionTimeoutMillis: CONFIG.dbConnectionTimeoutMs,
      idleTimeoutMillis: CONFIG.dbIdleTimeoutMs,
      statement_timeout: CONFIG.dbStatementTimeoutMs,
      application_name: "medorbits-api",

      ...(CONFIG.databaseSsl
        ? {
            ssl: {
              rejectUnauthorized:
                CONFIG.databaseSslRejectUnauthorized,
            },
          }
        : {}),
    })
  : null;

app.locals.pool = pool;

if (pool) {
  pool.on("error", (error) => {
    databaseAvailable = false;

    log("error", "Unexpected PostgreSQL pool error.", {
      errorCode: error.code || null,
      errorName: error.name || "Error",
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Request ID and request lifecycle                                           */
/* -------------------------------------------------------------------------- */

app.use((req, res, next) => {
  const suppliedId = req.get("X-Request-ID");

  // Accept only a bounded, safe identifier from upstream infrastructure.
  // Otherwise generate a new ID to prevent log injection.
  const requestId =
    typeof suppliedId === "string" &&
    /^[A-Za-z0-9._-]{1,100}$/.test(suppliedId)
      ? suppliedId
      : randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    if (!CONFIG.enableRequestLogs) return;

    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1e6;

    const metadata = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    const level =
      res.statusCode >= 500
        ? "error"
        : res.statusCode >= 400
          ? "warn"
          : "info";

    log(level, "HTTP request completed.", metadata);
  });

  if (shuttingDown) {
    return sendError(
      res,
      503,
      "SERVER_SHUTTING_DOWN",
      "The service is shutting down."
    );
  }

  next();
});

/* -------------------------------------------------------------------------- */
/* Security headers                                                           */
/* -------------------------------------------------------------------------- */

app.use(
  helmet({
    contentSecurityPolicy: CONFIG.production ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

/* -------------------------------------------------------------------------- */
/* CORS                                                                        */
/* -------------------------------------------------------------------------- */

const configuredOrigins =
  process.env.ALLOWED_ORIGINS ??
  (CONFIG.production
    ? ""
    : "http://localhost:3000,http://127.0.0.1:3000");

const allowedOrigins = new Set(
  configuredOrigins
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
);

if (CONFIG.production && allowedOrigins.size === 0) {
  throw new Error(
    "Set ALLOWED_ORIGINS to trusted production frontend origins."
  );
}

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients may not send an Origin header.
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/+$/, "");

      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      const error = new Error("Origin denied by CORS policy.");
      error.status = 403;
      error.code = "CORS_ORIGIN_DENIED";

      return callback(error);
    },

    credentials: true,

    methods: [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
    ],

    exposedHeaders: [
      "X-Request-ID",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
    ],

    maxAge: 600,
    optionsSuccessStatus: 204,
  })
);

/* -------------------------------------------------------------------------- */
/* Request parsing and compression                                            */
/* -------------------------------------------------------------------------- */

app.use(
  express.json({
    limit: CONFIG.bodyLimit,
    strict: true,
    type: ["application/json", "application/*+json"],
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: CONFIG.bodyLimit,
    parameterLimit: 100,
  })
);

app.use(compression());

/* -------------------------------------------------------------------------- */
/* API rate limiting                                                          */
/* -------------------------------------------------------------------------- */

const apiLimiter = rateLimit({
  windowMs: CONFIG.rateWindowMs,
  limit: CONFIG.rateLimit,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  skip: (req) => req.method === "OPTIONS",

  handler(req, res) {
    return sendError(
      res,
      429,
      "RATE_LIMIT_EXCEEDED",
      "Too many requests. Please try again later."
    );
  },
});

app.use(CONFIG.apiPrefix, apiLimiter);

/* -------------------------------------------------------------------------- */
/* Liveness and readiness                                                     */
/* -------------------------------------------------------------------------- */

/**
 * GET /health
 *
 * Liveness check: verifies that the process is responsive.
 * It intentionally does not require the database to be available.
 */
app.get("/health", (_req, res) => {
  return sendSuccess(res, {
    status: shuttingDown ? "shutting_down" : "alive",
    service: CONFIG.appName,
    version: CONFIG.version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready
 *
 * Readiness check: verifies that the service can accept traffic.
 */
app.get("/ready", async (req, res, next) => {
  if (shuttingDown || !serverStarted || !pool) {
    return sendError(
      res,
      503,
      "SERVICE_NOT_READY",
      "The service is not ready."
    );
  }

  try {
    await pool.query("SELECT 1");
    databaseAvailable = true;

    return sendSuccess(res, {
      status: "ready",
      dependencies: {
        database: "available",
      },
    });
  } catch (error) {
    databaseAvailable = false;

    log("error", "Readiness check failed.", {
      requestId: req.id,
      errorCode: error.code || null,
    });

    return next(error);
  }
});

/* -------------------------------------------------------------------------- */
/* API discovery                                                              */
/* -------------------------------------------------------------------------- */

app.get("/api", (_req, res) => {
  return sendSuccess(res, {
    service: CONFIG.appName,
    version: CONFIG.version,
    apiBase: CONFIG.apiPrefix,
    endpoints: {
      liveness: "/health",
      readiness: "/ready",
      apiDiscovery: "/api",
    },
  });
});

app.get(CONFIG.apiPrefix, (_req, res) => {
  return sendSuccess(res, {
    service: CONFIG.appName,
    version: CONFIG.version,
    routes: mountedRoutes.map(({ path: routePath }) => routePath),
  });
});

/* -------------------------------------------------------------------------- */
/* Dynamic route registration                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Canonical route filenames match the current MedOrbits /api/routes structure.
 *
 * Legacy filenames are fallback candidates only. A canonical route and its
 * legacy counterpart are never mounted together under the same prefix.
 *
 * Route modules may export:
 *   export default router;
 *
 * CommonJS modules loaded through import() may expose:
 *   module.exports = router;
 * or:
 *   module.exports = { router };
 */
const routeDefinitions = [
  {
    prefix: "/health",
    candidates: ["health.js"],
  },
  {
    prefix: "/auth",
    candidates: ["auth.js", "auth.routes.js"],
  },
  {
    prefix: "/users",
    candidates: ["users.js", "user.routes.js"],
  },
  {
    prefix: "/admissions",
    candidates: ["admissions.js", "admissions.routes.js"],
  },
  {
    prefix: "/documents",
    candidates: ["documents.js", "document.routes.js"],
  },
  {
    prefix: "/jobs",
    candidates: ["jobs.js", "jobs.routes.js"],
  },
  {
    prefix: "/support",
    candidates: ["support.js", "support.routes.js"],
  },
  {
    prefix: "/properties",
    candidates: ["property.routes.js", "properties.js"],
  },
  {
    prefix: "/search",
    candidates: ["search.routes.js", "search.js"],
  },
  {
    prefix: "/visits",
    candidates: ["visit.routes.js", "visits.js"],
  },
  {
    prefix: "/offers",
    candidates: ["offer.routes.js", "offers.js"],
  },
  {
    prefix: "/applications",
    candidates: ["application.routes.js", "applications.js"],
  },
];

function isExpressRouter(value) {
  return (
    typeof value === "function" &&
    typeof value.use === "function" &&
    typeof value.handle === "function"
  );
}

async function loadRouter(absolutePath, filename) {
  const imported = await import(pathToFileURL(absolutePath).href);

  const candidates = [
    imported.default,
    imported.router,
    imported.default?.router,
  ];

  const router = candidates.find(isExpressRouter);

  if (!router) {
    throw new TypeError(
      `${filename} must export an Express Router using ` +
      "`export default router` or `module.exports = router`."
    );
  }

  return router;
}

async function registerRoutes() {
  const routesDirectory = path.join(__dirname, "routes");

  for (const definition of routeDefinitions) {
    let selectedFile = null;
    let absolutePath = null;

    for (const filename of definition.candidates) {
      const candidatePath = path.join(routesDirectory, filename);

      if (!fs.existsSync(candidatePath)) {
        continue;
      }

      const stat = fs.statSync(candidatePath);

      if (!stat.isFile()) {
        throw new Error(
          `Route candidate is not a regular file: ${filename}`
        );
      }

      selectedFile = filename;
      absolutePath = candidatePath;
      break;
    }

    if (!selectedFile) {
      log("warn", "Optional route module not found.", {
        prefix: definition.prefix,
        candidates: definition.candidates,
      });

      continue;
    }

    try {
      const router = await loadRouter(absolutePath, selectedFile);
      const mountPath = `${CONFIG.apiPrefix}${definition.prefix}`;

      app.use(mountPath, router);

      mountedRoutes.push({
        file: selectedFile,
        path: mountPath,
      });

      log("info", "API route mounted.", {
        filename: selectedFile,
        mountPath,
      });
    } catch (error) {
      log("fatal", "API route registration failed.", {
        filename: selectedFile,
        mountPath: `${CONFIG.apiPrefix}${definition.prefix}`,
        errorName: error.name,
        errorMessage: error.message,
      });

      // A broken route module should prevent startup rather than silently
      // deploying an API with incomplete functionality.
      throw error;
    }
  }

  app.locals.mountedRoutes = mountedRoutes;
}

/* -------------------------------------------------------------------------- */
/* Optional static assets                                                     */
/* -------------------------------------------------------------------------- */

function registerStaticFiles() {
  if (!CONFIG.enableStaticFiles) {
    return;
  }

  const configuredDirectory = process.env.STATIC_DIRECTORY;

  if (!configuredDirectory || path.isAbsolute(configuredDirectory)) {
    throw new Error(
      "STATIC_DIRECTORY must be a non-empty path relative to the server directory."
    );
  }

  const staticDirectory = path.resolve(__dirname, configuredDirectory);
  const relativePath = path.relative(__dirname, staticDirectory);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      "STATIC_DIRECTORY must remain inside the server directory."
    );
  }

  if (
    !fs.existsSync(staticDirectory) ||
    !fs.statSync(staticDirectory).isDirectory()
  ) {
    throw new Error(
      "STATIC_DIRECTORY must point to an existing directory."
    );
  }

  app.use(
    express.static(staticDirectory, {
      index: false,
      dotfiles: "deny",
      etag: true,
      maxAge: CONFIG.production ? "1d" : 0,

      setHeaders(res, filePath) {
        if (/\.(?:html|json)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  log("info", "Static directory enabled.", {
    directory: relativePath,
  });
}

/* -------------------------------------------------------------------------- */
/* Not-found and error handlers                                               */
/* -------------------------------------------------------------------------- */

function registerErrorHandlers() {
  app.use((req, res) => {
    return sendError(
      res,
      404,
      "ROUTE_NOT_FOUND",
      "The requested endpoint does not exist."
    );
  });

  app.use((error, req, res, _next) => {
    if (res.headersSent) {
      log("error", "Error occurred after response headers were sent.", {
        requestId: req.id,
        errorName: error.name,
        errorCode: error.code || null,
      });

      return;
    }

    let status = Number(error.status || error.statusCode) || 500;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "An unexpected server error occurred.";

    if (error.type === "entity.parse.failed") {
      status = 400;
      code = "INVALID_JSON";
      message = "The request body contains invalid JSON.";
    } else if (error.type === "entity.too.large") {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "The request body is too large.";
    } else if (error.type === "encoding.unsupported") {
      status = 415;
      code = "UNSUPPORTED_ENCODING";
      message = "The request encoding is not supported.";
    } else if (error.code === "CORS_ORIGIN_DENIED") {
      status = 403;
      code = "CORS_ORIGIN_DENIED";
      message = "The request origin is not permitted.";
    } else if (status === 400) {
      code = "BAD_REQUEST";
      message = "The request could not be processed.";
    } else if (status === 401) {
      code = "UNAUTHORIZED";
      message = "Authentication is required.";
    } else if (status === 403) {
      code = "FORBIDDEN";
      message = "You are not permitted to perform this action.";
    } else if (status === 404) {
      code = "NOT_FOUND";
      message = "The requested resource was not found.";
    } else if (status === 409) {
      code = "CONFLICT";
      message = "The request conflicts with the current resource state.";
    } else if (status === 413) {
      code = "PAYLOAD_TOO_LARGE";
      message = "The request body is too large.";
    } else if (status === 415) {
      code = "UNSUPPORTED_MEDIA_TYPE";
      message = "The request media type is not supported.";
    } else if (status === 422) {
      code = "VALIDATION_ERROR";
      message = "The request failed validation.";
    } else if (status === 429) {
      code = "RATE_LIMIT_EXCEEDED";
      message = "Too many requests. Please try again later.";
    } else if (status === 503) {
      code = "SERVICE_UNAVAILABLE";
      message = "The service is temporarily unavailable.";
    }

    if (!Number.isInteger(status) || status < 400 || status > 599) {
      status = 500;
      code = "INTERNAL_SERVER_ERROR";
      message = "An unexpected server error occurred.";
    }

    log(status >= 500 ? "error" : "warn", "Request failed.", {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status,
      errorName: error.name || "Error",
      errorCode: error.code || null,
      ...(status >= 500 && !CONFIG.production
        ? { errorMessage: error.message }
        : {}),
    });

    return sendError(
      res,
      status,
      code,
      message,
      CONFIG.production ? undefined : error.message
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Graceful shutdown                                                          */
/* -------------------------------------------------------------------------- */

function closeHttpServer() {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    // Stop idle keep-alive connections. Active connections get time to finish.
    server.closeIdleConnections?.();
  });
}

async function shutdown(signal, { fatal = false } = {}) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  shuttingDown = true;

  log("warn", "Graceful shutdown initiated.", {
    signal,
    fatal,
  });

  const timeout = setTimeout(() => {
    log("fatal", "Graceful shutdown timed out; forcing connection closure.", {
      signal,
    });

    server.closeAllConnections?.();

    if (pool) {
      void pool.end().catch(() => {});
    }

    process.exit(1);
  }, CONFIG.shutdownTimeoutMs);

  timeout.unref();

  let shutdownFailed = false;

  try {
    await closeHttpServer();
  } catch (error) {
    shutdownFailed = true;

    log("error", "HTTP server shutdown failed.", {
      errorName: error.name,
      errorCode: error.code || null,
    });
  }

  try {
    if (pool) {
      await pool.end();
    }
  } catch (error) {
    shutdownFailed = true;

    log("error", "PostgreSQL pool shutdown failed.", {
      errorName: error.name,
      errorCode: error.code || null,
    });
  }

  clearTimeout(timeout);

  const exitCode = fatal || fatalErrorSeen || shutdownFailed ? 1 : 0;

  log(exitCode === 0 ? "info" : "error", "Shutdown completed.", {
    exitCode,
  });

  process.exitCode = exitCode;
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("unhandledRejection", (reason) => {
  fatalErrorSeen = true;

  log("fatal", "Unhandled promise rejection.", {
    reason:
      reason instanceof Error
        ? reason.message
        : String(reason),
  });

  void shutdown("unhandledRejection", { fatal: true });
});

process.on("uncaughtException", (error) => {
  fatalErrorSeen = true;

  log("fatal", "Uncaught exception.", {
    errorName: error.name,
    errorCode: error.code || null,
    errorMessage: error.message,
  });

  void shutdown("uncaughtException", { fatal: true });
});

/* -------------------------------------------------------------------------- */
/* Startup                                                                    */
/* -------------------------------------------------------------------------- */

async function startServer() {
  if (shuttingDown) {
    throw new Error("Startup cancelled because shutdown has started.");
  }

  // Validate and mount routes before accepting network traffic.
  await registerRoutes();

  registerStaticFiles();
  registerErrorHandlers();

  if (pool) {
    await pool.query("SELECT 1");
    databaseAvailable = true;

    log("info", "PostgreSQL connection established.", {
      poolMax: CONFIG.dbPoolMax,
    });
  } else {
    databaseAvailable = false;

    log("warn", "DATABASE_URL is not configured.", {
      message:
        "Database-dependent endpoints will not work without a database.",
    });
  }

  if (shuttingDown) {
    throw new Error("Startup cancelled before listening.");
  }

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(CONFIG.port, CONFIG.host);
  });

  serverStarted = true;

  log("info", "MedOrbits API server started.", {
    host: CONFIG.host,
    port: CONFIG.port,
    version: CONFIG.version,
    apiPrefix: CONFIG.apiPrefix,
    databaseAvailable,
    mountedRoutes,
  });
}

/* -------------------------------------------------------------------------- */
/* Application entry point                                                    */
/* -------------------------------------------------------------------------- */

if (process.env.NODE_ENV !== "test") {
  startServer().catch(async (error) => {
    fatalErrorSeen = true;

    log("fatal", "Server startup failed.", {
      errorName: error.name,
      errorCode: error.code || null,
      errorMessage: error.message,
    });

    shuttingDown = true;

    if (pool) {
      await pool.end().catch(() => {});
    }

    process.exitCode = 1;
  });
}

export { app, pool, server, CONFIG };
