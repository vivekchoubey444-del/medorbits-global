
/**
 * MedOrbits API Server
 * File: server.js
 *
 * Runtime: Node.js >= 20.19.0
 * Module system: ES Modules
 *
 * Responsibilities:
 * - Express 5 HTTP server
 * - PostgreSQL connection pool
 * - Helmet, CORS, compression and rate limiting
 * - Request IDs and structured logs
 * - Liveness, readiness and API discovery
 * - Validated dynamic Express router registration
 * - Consistent JSON errors and success responses
 * - Optional static asset serving
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

function readString(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function readInteger(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  if (!/^-?\d+$/.test(raw.trim())) {
    throw new Error(`${name} must be an integer.`);
  }

  const value = Number(raw.trim());

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

  const value = raw.trim().toLowerCase();

  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`${name} must be "true" or "false".`);
}

const environment = readString("NODE_ENV", "development");

if (!["development", "test", "production"].includes(environment)) {
  throw new Error(
    'NODE_ENV must be "development", "test", or "production".'
  );
}

const bodyLimit = readString("BODY_LIMIT", "1mb");

if (!/^\d+(?:b|kb|mb|gb)$/i.test(bodyLimit)) {
  throw new Error("BODY_LIMIT must look like 1024b, 1mb, or 2gb.");
}

const databaseUrl = readString("DATABASE_URL");

const configuredOrigins = readString(
  "ALLOWED_ORIGINS",
  environment === "production"
    ? ""
    : "http://localhost:3000,http://127.0.0.1:3000"
);

const allowedOrigins = new Set(
  configuredOrigins
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
);

if (environment === "production" && !databaseUrl) {
  throw new Error("DATABASE_URL is required in production.");
}

if (environment === "production" && allowedOrigins.size === 0) {
  throw new Error(
    "ALLOWED_ORIGINS must contain trusted production frontend origins."
  );
}

const staticDirectorySetting = readString("STATIC_DIRECTORY");

const CONFIG = Object.freeze({
  appName: "MedOrbits",
  version: readString(
    "APP_VERSION",
    process.env.npm_package_version || "0.1.0"
  ),
  environment,
  production: environment === "production",
  host: readString("HOST", "0.0.0.0"),
  port: readInteger("PORT", 3000, { min: 1, max: 65535 }),
  apiPrefix: "/api/v1",
  bodyLimit,
  allowedOrigins,
  rateLimit: readInteger("API_RATE_LIMIT", 300, {
    min: 1,
    max: 1000000
  }),
  rateWindowMs: readInteger("API_RATE_WINDOW_MS", 900000, {
    min: 1000,
    max: 86400000
  }),
  shutdownTimeoutMs: readInteger("SHUTDOWN_TIMEOUT_MS", 15000, {
    min: 1000,
    max: 300000
  }),
  dbPoolMax: readInteger("DB_POOL_MAX", 10, { min: 1, max: 100 }),
  dbConnectionTimeoutMs: readInteger("DB_CONNECTION_TIMEOUT_MS", 5000, {
    min: 100,
    max: 120000
  }),
  dbIdleTimeoutMs: readInteger("DB_IDLE_TIMEOUT_MS", 30000, {
    min: 1000,
    max: 600000
  }),
  dbStatementTimeoutMs: readInteger("DB_STATEMENT_TIMEOUT_MS", 15000, {
    min: 100,
    max: 300000
  }),
  trustProxyHops: readInteger("TRUST_PROXY_HOPS", 0, {
    min: 0,
    max: 32
  }),
  databaseSsl: readBoolean("DATABASE_SSL", false),
  databaseSslRejectUnauthorized: readBoolean(
    "DATABASE_SSL_REJECT_UNAUTHORIZED",
    true
  ),
  staticDirectory: staticDirectorySetting,
  enableRequestLogs: readBoolean("ENABLE_REQUEST_LOGS", true)
});

/* -------------------------------------------------------------------------- */
/* Application and runtime state                                              */
/* -------------------------------------------------------------------------- */

const app = express();
const server = http.createServer(app);

let shuttingDown = false;
let shutdownStarted = false;
let serverStarted = false;
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
    ...metadata
  };

  const output = JSON.stringify(entry);

  if (level === "error" || level === "fatal") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/* -------------------------------------------------------------------------- */
/* Standard JSON responses                                                    */
/* -------------------------------------------------------------------------- */

export function sendSuccess(res, data, statusCode = 200, meta) {
  return res.status(statusCode).json({
    success: true,
    requestId: res.getHeader("X-Request-ID") || null,
    data,
    ...(meta && Object.keys(meta).length ? { meta } : {})
  });
}

export function sendError(
  res,
  statusCode,
  code,
  message,
  details
) {
  const error = { code, message };

  if (!CONFIG.production && details !== undefined) {
    error.details = details;
  }

  return res.status(statusCode).json({
    success: false,
    requestId: res.getHeader("X-Request-ID") || null,
    error
  });
}

app.locals.respond = {
  success: sendSuccess,
  error: sendError
};

/* -------------------------------------------------------------------------- */
/* PostgreSQL                                                                 */
/* -------------------------------------------------------------------------- */

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: CONFIG.dbPoolMax,
      connectionTimeoutMillis: CONFIG.dbConnectionTimeoutMs,
      idleTimeoutMillis: CONFIG.dbIdleTimeoutMs,
      statement_timeout: CONFIG.dbStatementTimeoutMs,
      application_name: "medorbits-api",
      ...(CONFIG.databaseSsl
        ? {
            ssl: {
              rejectUnauthorized:
                CONFIG.databaseSslRejectUnauthorized
            }
          }
        : {})
    })
  : null;

app.locals.pool = pool;

let databaseAvailable = false;

if (pool) {
  pool.on("error", (error) => {
    databaseAvailable = false;

    log("error", "Unexpected PostgreSQL pool error.", {
      errorName: error.name || "Error",
      errorCode: error.code || null
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Request IDs and lifecycle                                                  */
/* -------------------------------------------------------------------------- */

app.use((req, res, next) => {
  const suppliedId = req.get("X-Request-ID");

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

    const level =
      res.statusCode >= 500
        ? "error"
        : res.statusCode >= 400
          ? "warn"
          : "info";

    log(level, "HTTP request completed.", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    });
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
/* Security headers and CORS                                                  */
/* -------------------------------------------------------------------------- */

app.use(
  helmet({
    contentSecurityPolicy: CONFIG.production ? undefined : false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients may omit Origin.
      if (!origin) return callback(null, true);

      const normalized = origin.replace(/\/+$/, "");

      if (CONFIG.allowedOrigins.has(normalized)) {
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
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID"
    ],
    exposedHeaders: [
      "X-Request-ID",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "Retry-After"
    ],
    maxAge: 600,
    optionsSuccessStatus: 204
  })
);

/* -------------------------------------------------------------------------- */
/* Request parsing and compression                                            */
/* -------------------------------------------------------------------------- */

app.use(
  express.json({
    limit: CONFIG.bodyLimit,
    strict: true,
    type: ["application/json", "application/*+json"]
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: CONFIG.bodyLimit,
    parameterLimit: 100
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
  handler(_req, res) {
    res.setHeader(
      "Retry-After",
      String(Math.ceil(CONFIG.rateWindowMs / 1000))
    );

    return sendError(
      res,
      429,
      "RATE_LIMIT_EXCEEDED",
      "Too many requests. Please try again later."
    );
  }
});

app.use(CONFIG.apiPrefix, apiLimiter);

/* -------------------------------------------------------------------------- */
/* Health and discovery                                                       */
/* -------------------------------------------------------------------------- */

app.get("/health", (_req, res) => {
  return sendSuccess(res, {
    status: shuttingDown ? "shutting_down" : "alive",
    service: CONFIG.appName,
    version: CONFIG.version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get("/ready", async (req, res) => {
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
      dependencies: { database: "available" }
    });
  } catch (error) {
    databaseAvailable = false;

    log("error", "Readiness check failed.", {
      requestId: req.id,
      errorName: error.name || "Error",
      errorCode: error.code || null
    });

    return sendError(
      res,
      503,
      "DATABASE_UNAVAILABLE",
      "The service is temporarily unavailable."
    );
  }
});

app.get("/api", (_req, res) => {
  return sendSuccess(res, {
    service: CONFIG.appName,
    version: CONFIG.version,
    apiBase: CONFIG.apiPrefix,
    endpoints: {
      liveness: "/health",
      readiness: "/ready",
      discovery: "/api",
      versionedApi: CONFIG.apiPrefix
    }
  });
});

app.get(CONFIG.apiPrefix, (_req, res) => {
  return sendSuccess(res, {
    service: CONFIG.appName,
    version: CONFIG.version,
    routes: mountedRoutes.map((route) => route.path)
  });
});

/* -------------------------------------------------------------------------- */
/* Dynamic route registration                                                 */
/* -------------------------------------------------------------------------- */

// Only optional routes are skipped. A present but invalid route fails startup.
// Verify candidate filenames against the actual repository before deployment.

const routeDefinitions = [
  { prefix: "/health", candidates: ["health.js", "health.routes.js"] },
  { prefix: "/auth", candidates: ["auth.js", "auth.routes.js"] },
  { prefix: "/users", candidates: ["users.js", "user.routes.js", "users.routes.js"] },
  { prefix: "/admissions", candidates: ["admissions.js", "admissions.routes.js"] },
  { prefix: "/documents", candidates: ["documents.js", "document.routes.js"] },
  { prefix: "/jobs", candidates: ["jobs.js", "jobs.routes.js"] },
  { prefix: "/support", candidates: ["support.js", "support.routes.js"] },
  { prefix: "/properties", candidates: ["properties.js", "property.routes.js"] },
  { prefix: "/search", candidates: ["search.js", "search.routes.js"] },
  { prefix: "/visits", candidates: ["visits.js", "visit.routes.js"] },
  { prefix: "/offers", candidates: ["offers.js", "offer.routes.js"] },
  { prefix: "/applications", candidates: ["applications.js", "application.routes.js"] }
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
    imported.router,
    imported.default,
    imported.default?.router,
    imported.default?.default
  ];

  const router = candidates.find(isExpressRouter);

  if (!router) {
    throw new TypeError(
      `${filename} must export an Express Router, for example ` +
      "`export default router` or `export { router }`."
    );
  }

  return router;
}

async function registerRoutes() {
  const routesDirectory = path.join(__dirname, "routes");

  for (const definition of routeDefinitions) {
    let selectedFile;
    let absolutePath;

    for (const filename of definition.candidates) {
      const candidate = path.join(routesDirectory, filename);

      if (!fs.existsSync(candidate)) continue;

      if (!fs.statSync(candidate).isFile()) {
        throw new Error(`Route candidate is not a file: ${filename}`);
      }

      selectedFile = filename;
      absolutePath = candidate;
      break;
    }

    if (!selectedFile) {
      log("warn", "Optional route module not found.", {
        prefix: definition.prefix,
        candidates: definition.candidates
      });
      continue;
    }

    const mountPath = `${CONFIG.apiPrefix}${definition.prefix}`;

    try {
      const router = await loadRouter(absolutePath, selectedFile);

      app.use(mountPath, router);

      mountedRoutes.push({
        file: selectedFile,
        path: mountPath
      });

      log("info", "API route mounted.", {
        filename: selectedFile,
        mountPath
      });
    } catch (error) {
      log("fatal", "API route registration failed.", {
        filename: selectedFile,
        mountPath,
        errorName: error.name || "Error",
        errorMessage: error.message
      });

      throw error;
    }
  }

  app.locals.mountedRoutes = mountedRoutes;
}

/* -------------------------------------------------------------------------- */
/* Optional static files                                                      */
/* -------------------------------------------------------------------------- */

function registerStaticFiles() {
  if (!CONFIG.staticDirectory) return;

  if (path.isAbsolute(CONFIG.staticDirectory)) {
    throw new Error(
      "STATIC_DIRECTORY must be relative to the server directory."
    );
  }

  const directory = path.resolve(__dirname, CONFIG.staticDirectory);
  const relative = path.relative(__dirname, directory);

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "STATIC_DIRECTORY must remain inside the server directory."
    );
  }

  if (
    !fs.existsSync(directory) ||
    !fs.statSync(directory).isDirectory()
  ) {
    throw new Error(
      "STATIC_DIRECTORY must point to an existing directory."
    );
  }

  app.use(
    express.static(directory, {
      index: false,
      dotfiles: "deny",
      etag: true,
      fallthrough: true,
      maxAge: CONFIG.production ? "1d" : 0,
      setHeaders(res, filePath) {
        if (/\.(?:html|json)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache");
        }
      }
    })
  );

  log("info", "Static assets enabled.", { directory: relative });
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
      log("error", "Error after response headers were sent.", {
        requestId: req.id || null,
        errorName: error.name || "Error",
        errorCode: error.code || null
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
    } else if (error.type === "charset.unsupported") {
      status = 415;
      code = "UNSUPPORTED_CHARSET";
      message = "The request character set is not supported.";
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
      requestId: req.id || null,
      method: req.method,
      path: req.path,
      status,
      errorName: error.name || "Error",
      errorCode: error.code || null,
      ...(status >= 500 && !CONFIG.production
        ? { errorMessage: error.message }
        : {})
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
/* Shutdown                                                                   */
/* -------------------------------------------------------------------------- */

function closeHttpServer() {
  if (!server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });

    server.closeIdleConnections?.();
  });
}

export async function shutdown(signal = "manual", { fatal = false } = {}) {
  if (shutdownStarted) return;

  shutdownStarted = true;
  shuttingDown = true;

  log("warn", "Graceful shutdown initiated.", { signal, fatal });

  const timeout = setTimeout(() => {
    log("fatal", "Shutdown timed out; forcing connection closure.", {
      signal
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
      errorName: error.name || "Error",
      errorCode: error.code || null
    });
  }

  try {
    if (pool) await pool.end();
  } catch (error) {
    shutdownFailed = true;
    log("error", "PostgreSQL pool shutdown failed.", {
      errorName: error.name || "Error",
      errorCode: error.code || null
    });
  }

  clearTimeout(timeout);

  const exitCode =
    fatal || fatalErrorSeen || shutdownFailed ? 1 : 0;

  log(exitCode === 0 ? "info" : "error", "Shutdown completed.", {
    exitCode
  });

  process.exitCode = exitCode;
}

/* -------------------------------------------------------------------------- */
/* Startup                                                                     */
/* -------------------------------------------------------------------------- */

export async function startServer() {
  if (serverStarted) return server;
  if (shuttingDown) {
    throw new Error("Startup cancelled because shutdown has started.");
  }

  await registerRoutes();
  registerStaticFiles();
  registerErrorHandlers();

  if (pool) {
    await pool.query("SELECT 1");
    databaseAvailable = true;

    log("info", "PostgreSQL connection established.", {
      poolMax: CONFIG.dbPoolMax
    });
  } else {
    databaseAvailable = false;

    if (CONFIG.production) {
      throw new Error("DATABASE_URL is required in production.");
    }

    log("warn", "DATABASE_URL is not configured.");
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
    mountedRoutes
  });

  return server;
}

/* -------------------------------------------------------------------------- */
/* Direct execution                                                           */
/* -------------------------------------------------------------------------- */

// Importing server.js in tests does not automatically start a listener.
const isDirectExecution =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("unhandledRejection", (reason) => {
    fatalErrorSeen = true;

    log("fatal", "Unhandled promise rejection.", {
      reason: reason instanceof Error
        ? reason.message
        : String(reason)
    });

    void shutdown("unhandledRejection", { fatal: true });
  });

  process.once("uncaughtException", (error) => {
    fatalErrorSeen = true;

    log("fatal", "Uncaught exception.", {
      errorName: error.name || "Error",
      errorCode: error.code || null,
      errorMessage: error.message
    });

    void shutdown("uncaughtException", { fatal: true });
  });

  startServer().catch(async (error) => {
    fatalErrorSeen = true;
    shuttingDown = true;

    log("fatal", "Server startup failed.", {
      errorName: error.name || "Error",
      errorCode: error.code || null,
      errorMessage: error.message
    });

    try {
      await closeHttpServer();
    } catch {
      // Preserve the original startup failure.
    }

    if (pool) {
      await pool.end().catch((poolError) => {
        log("error", "Database cleanup after startup failure failed.", {
          errorName: poolError.name || "Error",
          errorCode: poolError.code || null
        });
      });
    }

    process.exitCode = 1;
  });
}

export { app, server, CONFIG };
