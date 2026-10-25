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

const CONFIG = Object.freeze({
  appName: "MedOrbits",
  version: process.env.npm_package_version || "0.1.0",
  environment: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3000),
  apiPrefix: "/api/v1",
  bodyLimit: process.env.BODY_LIMIT || "1mb",
  rateLimit: Number(process.env.API_RATE_LIMIT || 300),
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS || 15000),
  dbPoolMax: Number(process.env.DB_POOL_MAX || 10),
  production: (process.env.NODE_ENV || "development") === "production"
});

const app = express();
const server = http.createServer(app);

let shuttingDown = false;
let shutdownStarted = false;
let databaseAvailable = false;
let serverStarted = false;

function log(level, message, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: CONFIG.appName,
    environment: CONFIG.environment,
    message,
    ...metadata
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "fatal") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function validateConfig() {
  if (!Number.isInteger(CONFIG.port) || CONFIG.port < 1 || CONFIG.port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  if (!Number.isInteger(CONFIG.shutdownTimeoutMs) || CONFIG.shutdownTimeoutMs < 1000) {
    throw new Error("SHUTDOWN_TIMEOUT_MS must be at least 1000.");
  }
  if (!Number.isInteger(CONFIG.dbPoolMax) || CONFIG.dbPoolMax < 1) {
    throw new Error("DB_POOL_MAX must be a positive integer.");
  }
  if (!Number.isInteger(CONFIG.rateLimit) || CONFIG.rateLimit < 1) {
    throw new Error("API_RATE_LIMIT must be a positive integer.");
  }
  if (CONFIG.production && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production.");
  }
}

validateConfig();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || (
  CONFIG.production ? "" : "http://localhost:3000,http://127.0.0.1:3000"
))
  .split(",")
  .map(value => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (CONFIG.production && allowedOrigins.length === 0) {
  throw new Error("Set ALLOWED_ORIGINS to trusted production frontend origins.");
}

if (process.env.TRUST_PROXY_HOPS) {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 1) {
    throw new Error("TRUST_PROXY_HOPS must be a positive integer.");
  }
  app.set("trust proxy", hops);
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: CONFIG.dbPoolMax,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 15000,
      application_name: "medorbits-server",
      ...(process.env.DATABASE_SSL === "true"
        ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } }
        : {})
    })
  : null;

if (pool) {
  pool.on("error", error => {
    databaseAvailable = false;
    log("error", "Unexpected PostgreSQL pool error.", {
      errorCode: error.code || null,
      errorName: error.name
    });
  });
}

app.disable("x-powered-by");
app.set("env", CONFIG.environment);
app.locals.appName = CONFIG.appName;
app.locals.appVersion = CONFIG.version;
app.locals.pool = pool;
app.locals.startedAt = new Date().toISOString();

app.use(helmet({
  contentSecurityPolicy: CONFIG.production ? undefined : false
}));

app.use(cors({
  origin(origin, callback) {
    // CORS is a browser policy, not authentication. Non-browser clients may omit Origin.
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/+$/, "");
    if (allowedOrigins.includes(normalized)) return callback(null, true);
    const error = new Error("Origin denied by CORS policy.");
    error.status = 403;
    error.code = "CORS_ORIGIN_DENIED";
    return callback(error);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  exposedHeaders: ["X-Request-ID", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
  maxAge: 600,
  optionsSuccessStatus: 204
}));

app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-ID", req.id);
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const metadata = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    };
    log(res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      "HTTP request completed.", metadata);
  });

  if (shuttingDown) {
    return res.status(503).json({
      success: false,
      requestId: req.id,
      error: { code: "SERVER_SHUTTING_DOWN", message: "The service is shutting down." }
    });
  }
  next();
});

app.use(express.json({
  limit: CONFIG.bodyLimit,
  strict: true,
  type: ["application/json", "application/*+json"]
}));
app.use(express.urlencoded({
  extended: false,
  limit: CONFIG.bodyLimit,
  parameterLimit: 100
}));
app.use(compression());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: CONFIG.rateLimit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: req => req.method === "OPTIONS",
  handler(req, res) {
    return res.status(429).json({
      success: false,
      requestId: req.id,
      error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please try again later." }
    });
  }
});
app.use(CONFIG.apiPrefix, apiLimiter);

export function sendSuccess(res, data, statusCode = 200, meta) {
  return res.status(statusCode).json({
    success: true,
    requestId: res.getHeader("X-Request-ID"),
    data,
    ...(meta && Object.keys(meta).length ? { meta } : {})
  });
}

export function sendError(res, statusCode, code, message, details) {
  const error = { code, message };
  if (!CONFIG.production && details !== undefined) error.details = details;
  return res.status(statusCode).json({
    success: false,
    requestId: res.getHeader("X-Request-ID"),
    error
  });
}

app.locals.respond = { success: sendSuccess, error: sendError };

app.get("/health", (_req, res) => sendSuccess(res, {
  status: "alive",
  service: CONFIG.appName,
  version: CONFIG.version,
  uptimeSeconds: Math.floor(process.uptime()),
  timestamp: new Date().toISOString()
}));

app.get("/ready", async (req, res) => {
  if (shuttingDown || !pool) {
    return sendError(res, 503, "SERVICE_NOT_READY", "The service is not ready.");
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
      errorCode: error.code || null
    });
    return sendError(res, 503, "DEPENDENCY_UNAVAILABLE", "A required dependency is unavailable.");
  }
});

app.get("/api", (_req, res) => sendSuccess(res, {
  service: CONFIG.appName,
  version: CONFIG.version,
  apiBase: CONFIG.apiPrefix,
  endpoints: { liveness: "/health", readiness: "/ready" }
}));

// Route files are optional during development. Existing files must default-export an Express Router.
const routeDefinitions = [
  ["auth.routes.js", "/auth"],
  ["user.routes.js", "/users"],
  ["property.routes.js", "/properties"],
  ["search.routes.js", "/search"],
  ["visit.routes.js", "/visits"],
  ["offer.routes.js", "/offers"],
  ["application.routes.js", "/applications"],
  ["document.routes.js", "/documents"]
];

const routesDirectory = path.join(__dirname, "routes");
const mountedRoutes = [];

for (const [filename, prefix] of routeDefinitions) {
  const absolutePath = path.join(routesDirectory, filename);
  if (!fs.existsSync(absolutePath)) {
    log("warn", "Optional route module not found.", { filename, prefix });
    continue;
  }

  try {
    const imported = await import(pathToFileURL(absolutePath).href);
    const router = imported.default ?? imported.router;

    if (typeof router !== "function" ||
        typeof router.use !== "function" ||
        typeof router.handle !== "function") {
      throw new TypeError(`${filename} must export an Express Router as default.`);
    }

    const mountPath = `${CONFIG.apiPrefix}${prefix}`;
    app.use(mountPath, router);
    mountedRoutes.push({ file: filename, path: mountPath });
    log("info", "API route mounted.", { filename, mountPath });
  } catch (error) {
    log("fatal", "API route registration failed.", {
      filename,
      errorName: error.name,
      errorMessage: error.message
    });
    throw error;
  }
}

app.locals.mountedRoutes = mountedRoutes;

// Only expose an explicitly configured public directory; never expose the repository root.
if (process.env.STATIC_DIRECTORY) {
  const staticDirectory = path.resolve(__dirname, process.env.STATIC_DIRECTORY);
  if (!fs.existsSync(staticDirectory) || !fs.statSync(staticDirectory).isDirectory()) {
    throw new Error("STATIC_DIRECTORY must point to an existing directory.");
  }

  app.use(express.static(staticDirectory, {
    index: false,
    dotfiles: "deny",
    etag: true,
    maxAge: CONFIG.production ? "1d" : 0,
    setHeaders(res, filePath) {
      if (/\.(?:html|json)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));
}

app.use((req, res) => sendError(
  res, 404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist."
));

app.use((error, req, res, _next) => {
  if (res.headersSent) {
    log("error", "Error after response headers.", {
      requestId: req.id,
      errorName: error.name,
      errorMessage: error.message
    });
    return;
  }

  let status = Number(error.status || error.statusCode) || 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected server error occurred.";

  if (error.type === "entity.parse.failed") {
    status = 400; code = "INVALID_JSON"; message = "The request body contains invalid JSON.";
  } else if (error.type === "entity.too.large") {
    status = 413; code = "PAYLOAD_TOO_LARGE"; message = "The request body is too large.";
  } else if (error.code === "CORS_ORIGIN_DENIED") {
    status = 403; code = "CORS_ORIGIN_DENIED"; message = "The request origin is not permitted.";
  } else if (status === 400) {
    code = "BAD_REQUEST"; message = "The request could not be processed.";
  } else if (status === 401) {
    code = "UNAUTHORIZED"; message = "Authentication is required.";
  } else if (status === 403) {
    code = "FORBIDDEN"; message = "You are not permitted to perform this action.";
  } else if (status === 404) {
    code = "NOT_FOUND"; message = "The requested resource was not found.";
  } else if (status === 429) {
    code = "RATE_LIMIT_EXCEEDED"; message = "Too many requests. Please try again later.";
  }

  if (status < 400 || status > 599) {
    status = 500; code = "INTERNAL_SERVER_ERROR"; message = "An unexpected server error occurred.";
  }

  log(status >= 500 ? "error" : "warn", "Request failed.", {
    requestId: req.id,
    method: req.method,
    path: req.path,
    status,
    errorName: error.name,
    errorCode: error.code || null,
    errorMessage: error.message
  });

  return sendError(res, status, code, message,
    CONFIG.production ? undefined : error.message);
});

async function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  shuttingDown = true;

  log("warn", "Graceful shutdown initiated.", { signal });

  const timeout = setTimeout(() => {
    log("fatal", "Graceful shutdown timed out.");
    process.exit(1);
  }, CONFIG.shutdownTimeoutMs);
  timeout.unref();

  try {
    if (serverStarted) {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeIdleConnections?.();
      });
    }
    if (pool) await pool.end();

    clearTimeout(timeout);
    log("info", "Graceful shutdown completed.");
    process.exitCode = 0;
  } catch (error) {
    clearTimeout(timeout);
    log("fatal", "Graceful shutdown failed.", {
      errorName: error.name,
      errorMessage: error.message
    });
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", reason => {
  log("fatal", "Unhandled promise rejection.", {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
  void shutdown("unhandledRejection");
});

process.on("uncaughtException", error => {
  log("fatal", "Uncaught exception.", {
    errorName: error.name,
    errorMessage: error.message
  });
  void shutdown("uncaughtException");
});

async function startServer() {
  if (pool) {
    await pool.query("SELECT 1");
    databaseAvailable = true;
    log("info", "PostgreSQL connection established.");
  } else if (CONFIG.production) {
    throw new Error("Production startup requires DATABASE_URL.");
  } else {
    log("warn", "DATABASE_URL is not configured; database-dependent endpoints will be unavailable.");
  }

  await new Promise((resolve, reject) => {
    const onError = error => {
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
  log("info", "MedOrbits server started.", {
    host: CONFIG.host,
    port: CONFIG.port,
    version: CONFIG.version,
    databaseAvailable,
    mountedRoutes
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch(async error => {
    log("fatal", "Server startup failed.", {
      errorName: error.name,
      errorCode: error.code || null,
      errorMessage: error.message
    });
    if (pool) await pool.end().catch(() => {});
    process.exitCode = 1;
  });
}

export { pool };
