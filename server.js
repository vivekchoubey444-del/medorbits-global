
"use strict";

/**
 * =============================================================================
 * MEDORBITS -- APPLICATION SERVER
 * File: /server.js
 * Version: 3.0.0
 *
 * Runtime: Node.js >= 20
 * Framework: Express.js
 * Database: MySQL (adapter integration required separately)
 *
 * Responsibilities:
 * - Environment initialization and validation
 * - Express application bootstrap
 * - Security headers and CORS
 * - Compression and HTTP request parsing
 * - Request identification and logging
 * - API rate limiting
 * - API route registration
 * - Static website delivery
 * - Health, readiness and liveness endpoints
 * - Error handling and 404 responses
 * - Graceful application shutdown
 *
 * Safety:
 * - No automatic database migrations
 * - No automatic database seeding
 * - No automatic dependency upgrades
 * - No deployment operations
 * - No secret exposure in logs
 * =============================================================================
 */

// =============================================================================
// 01. CORE MODULES
// =============================================================================

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const http = require("node:http");

// =============================================================================
// 02. PROJECT DIRECTORIES
// =============================================================================

const ROOT_DIR = __dirname;

const NODE_DIR = path.join(ROOT_DIR, "node");

const ROUTES_DIR = path.join(ROOT_DIR, "routes");

const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const STORAGE_DIR = path.join(ROOT_DIR, "storage");

// =============================================================================
// 03. LOAD ENVIRONMENT VARIABLES
// =============================================================================

const NODE_ENV = process.env.NODE_ENV || "development";

if (NODE_ENV !== "production") {
  const dotenv = require("dotenv");

  dotenv.config({
    path: path.join(ROOT_DIR, ".env"),
    override: false
  });
}

// =============================================================================
// 04. LOAD CENTRALIZED ENVIRONMENT CONFIGURATION
// =============================================================================

const environment = require(
  "./node/config/environment.config.js"
);

// Validate all environment variables before application startup.
environment.validateEnvironment();

const config = environment.config;

const IS_PRODUCTION = environment.IS_PRODUCTION;

const IS_DEVELOPMENT = environment.IS_DEVELOPMENT;

const IS_TEST = environment.IS_TEST;

// =============================================================================
// 05. LOAD NODE CONFIGURATION
// =============================================================================

const nodeConfigurationPath = path.join(
  NODE_DIR,
  "config",
  "node.config.js"
);

let nodeConfiguration = null;

if (fs.existsSync(nodeConfigurationPath)) {
  nodeConfiguration = require(nodeConfigurationPath);

  if (typeof nodeConfiguration.validateConfig === "function") {
    nodeConfiguration.validateConfig();
  }
}

// =============================================================================
// 06. THIRD-PARTY DEPENDENCIES
// =============================================================================

const express = require("express");

const helmet = require("helmet");

const cors = require("cors");

const compression = require("compression");

const morgan = require("morgan");

const rateLimitModule = require("express-rate-limit");

const rateLimit =
  rateLimitModule.rateLimit ||
  rateLimitModule.default ||
  rateLimitModule;

if (typeof rateLimit !== "function") {
  throw new Error(
    "[MedOrbits] express-rate-limit is not configured correctly."
  );
}

// =============================================================================
// 07. EXPRESS APPLICATION
// =============================================================================

const app = express();

app.disable("x-powered-by");

app.set("env", config.environment.name);

app.set("trust proxy", config.application
  ? config.cors.trustProxyHops
  : 0);

// =============================================================================
// 08. STARTUP INFORMATION
// =============================================================================

function startupLog(message) {
  console.log(`[MedOrbits] ${message}`);
}

function startupWarning(message) {
  console.warn(`[MedOrbits WARNING] ${message}`);
}

startupLog("Initializing application server.");

startupLog(`Environment: ${config.environment.name}`);

startupLog(`Node.js: ${process.version}`);

startupLog(`Database adapter: ${config.database.client}`);

startupLog(`Port: ${config.application.port}`);

for (const warning of environment.getWarnings()) {
  startupWarning(warning);
}

// =============================================================================
// 09. SECURITY HEADERS
// =============================================================================

app.use(
  helmet({
    contentSecurityPolicy:
      config.cors.contentSecurityPolicy
        ? undefined
        : false,

    crossOriginResourcePolicy: {
      policy: config.cors.crossOriginResourcePolicy
    },

    referrerPolicy: {
      policy: config.cors.referrerPolicy
    },

    hsts: IS_PRODUCTION
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        }
      : false
  })
);

// =============================================================================
// 10. CORS CONFIGURATION
// =============================================================================

const allowedOrigins = new Set(
  config.cors.origins.map(origin => origin.replace(/\/$/, ""))
);

const corsOptions = {
  credentials: config.cors.credentials,

  methods: config.cors.methods,

  allowedHeaders: config.cors.headers,

  maxAge: config.cors.maxAgeSeconds,

  origin(origin, callback) {
    // Allow requests without Origin, such as same-origin and server-to-server.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(
      new Error("Origin not allowed by MedOrbits CORS policy.")
    );
  }
};

app.use(cors(corsOptions));

// Explicitly handle preflight requests.
app.options(/.*/, cors(corsOptions));

// =============================================================================
// 11. COMPRESSION
// =============================================================================

app.use(
  compression({
    threshold: 1024,
    level: 6
  })
);

// =============================================================================
// 12. REQUEST IDENTIFICATION
// =============================================================================

app.use((req, res, next) => {
  const incomingId = req.get("X-Request-ID");

  const validIncomingId =
    incomingId &&
    incomingId.length <= 128 &&
    /^[a-zA-Z0-9._:-]+$/.test(incomingId);

  const requestId = validIncomingId
    ? incomingId
    : crypto.randomUUID();

  const incomingCorrelationId = req.get("X-Correlation-ID");

  const correlationId =
    incomingCorrelationId &&
    incomingCorrelationId.length <= 128 &&
    /^[a-zA-Z0-9._:-]+$/.test(incomingCorrelationId)
      ? incomingCorrelationId
      : requestId;

  req.id = requestId;

  req.correlationId = correlationId;

  res.setHeader("X-Request-ID", requestId);

  res.setHeader(
    "X-Correlation-ID",
    correlationId
  );

  next();
});

// =============================================================================
// 13. REQUEST TIMEOUT
// =============================================================================

app.use((req, res, next) => {
  req.setTimeout(
    config.application.requestTimeoutMs,
    () => {
      if (!res.headersSent && !res.writableEnded) {
        res.status(408).json({
          success: false,
          error: "Request timeout",
          requestId: req.id
        });
      }
    }
  );

  next();
});

// =============================================================================
// 14. REQUEST LOGGING
// =============================================================================

const logFormat = IS_PRODUCTION
  ? "combined"
  : "dev";

app.use(
  morgan(logFormat, {
    skip(req) {
      return (
        req.path === "/health" ||
        req.path === "/health/live" ||
        req.path === "/live"
      );
    }
  })
);

// =============================================================================
// 15. REQUEST BODY PARSING
// =============================================================================

app.use(
  express.json({
    limit: "10mb",
    strict: true
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 1000
  })
);

// =============================================================================
// 16. API RATE LIMITING
// =============================================================================

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,

  limit: config.rateLimit.maximumRequests,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message: {
    success: false,
    error: "Too many requests. Please try again later."
  },

  handler(req, res) {
    res.status(429).json({
      success: false,
      error: "Too many requests.",
      requestId: req.id
    });
  }
});

if (config.rateLimit.enabled) {
  app.use("/api", apiLimiter);
}

// =============================================================================
// 17. SECURITY CONFIGURATION
// =============================================================================

app.locals.config = Object.freeze({
  application: {
    name: config.application.name,
    version: config.application.version,
    environment: config.environment.name
  },

  apiPrefix: config.application.apiPrefix,

  features: config.features
});

// =============================================================================
// 18. STATIC FILE SERVING
// =============================================================================

const staticDirectories = [
  {
    url: "/public",
    directory: PUBLIC_DIR
  },
  {
    url: "/assets",
    directory: path.join(ROOT_DIR, "assets")
  },
  {
    url: "/images",
    directory: path.join(ROOT_DIR, "images")
  },
  {
    url: "/brochures",
    directory: path.join(ROOT_DIR, "brochures")
  },
  {
    url: "/data",
    directory: path.join(ROOT_DIR, "data")
  },
  {
    url: "/pages",
    directory: path.join(ROOT_DIR, "pages")
  }
];

for (const item of staticDirectories) {
  if (!fs.existsSync(item.directory)) {
    continue;
  }

  app.use(
    item.url,
    express.static(item.directory, {
      dotfiles: "deny",
      index: false,
      fallthrough: true,
      etag: true,
      lastModified: true,
      maxAge: IS_PRODUCTION ? "1d" : 0
    })
  );

  startupLog(`Static directory mounted: ${item.url}`);
}

// Serve selected root-level public files only.
const publicRootFiles = [
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "offline.html"
];

for (const filename of publicRootFiles) {
  const filePath = path.join(ROOT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    continue;
  }

  app.get(`/${filename}`, (req, res, next) => {
    res.sendFile(filePath, error => {
      if (error && !res.headersSent) {
        next(error);
      }
    });
  });
}

// =============================================================================
// 19. ROOT WEBSITE ROUTE
// =============================================================================

app.get("/", (req, res, next) => {
  const indexFile = path.join(ROOT_DIR, "index.html");

  if (!fs.existsSync(indexFile)) {
    return res.status(200).json({
      success: true,
      application: config.application.name,
      version: config.application.version,
      environment: config.environment.name,
      message: "MedOrbits application server is running."
    });
  }

  res.sendFile(indexFile, error => {
    if (error && !res.headersSent) {
      next(error);
    }
  });
});

// =============================================================================
// 20. OPTIONAL PAGE ROUTES
// =============================================================================

const allowedPages = [
  "about.html",
  "courses.html",
  "colleges.html",
  "universities.html",
  "contact.html",
  "search.html",
  "brochures.html",
  "help-centre.html",
  "sitemap.html",
  "offline.html"
];

app.get("/:page", (req, res, next) => {
  const page = req.params.page;

  if (!allowedPages.includes(page)) {
    return next();
  }

  const pageFile = path.join(ROOT_DIR, page);

  if (!fs.existsSync(pageFile)) {
    return next();
  }

  res.sendFile(pageFile, error => {
    if (error && !res.headersSent) {
      next(error);
    }
  });
});

// =============================================================================
// 21. API ROOT
// =============================================================================

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    application: config.application.name,
    version: config.application.version,
    apiPrefix: config.application.apiPrefix,
    environment: config.environment.name,
    message: "MedOrbits API is operational."
  });
});

// =============================================================================
// 22. ROUTE LOADER
// =============================================================================

function loadRouter(relativePath) {
  const absolutePath = path.join(
    ROUTES_DIR,
    relativePath
  );

  if (!absolutePath.startsWith(ROUTES_DIR + path.sep)) {
    throw new Error("Invalid route module path.");
  }

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  let imported;

  try {
    imported = require(absolutePath);
  } catch (error) {
    throw new Error(
      `Failed to load ${relativePath}: ${error.message}`,
      { cause: error }
    );
  }

  // Support CommonJS routers and transpiled default exports.
  const router =
    imported?.default ||
    imported?.router ||
    imported;

  if (typeof router !== "function") {
    throw new TypeError(
      `${relativePath} must export an Express Router.`
    );
  }

  return router;
}

// =============================================================================
// 23. API ROUTE REGISTRATION
// =============================================================================

const routeDefinitions = [
  {
    name: "Authentication",
    prefix: "/api/auth",
    file: "auth.routes.js"
  },
  {
    name: "Users",
    prefix: "/api/users",
    file: "user.routes.js",
    alternate: "users.routes.js"
  },
  {
    name: "Properties",
    prefix: "/api/properties",
    file: "property.routes.js",
    alternate: "properties.routes.js"
  },
  {
    name: "Search",
    prefix: "/api/search",
    file: "search.routes.js"
  },
  {
    name: "Visits",
    prefix: "/api/visits",
    file: "visit.routes.js",
    alternate: "visits.routes.js"
  },
  {
    name: "Offers",
    prefix: "/api/offers",
    file: "offer.routes.js",
    alternate: "offers.routes.js"
  },
  {
    name: "Applications",
    prefix: "/api/applications",
    file: "application.routes.js",
    alternate: "applications.routes.js"
  },
  {
    name: "Documents",
    prefix: "/api/documents",
    file: "document.routes.js",
    alternate: "documents.routes.js"
  }
];

const mountedRoutes = [];

const skippedRoutes = [];

for (const definition of routeDefinitions) {
  const candidates = [
    definition.file,
    definition.alternate
  ].filter(Boolean);

  let selectedFile = null;

  for (const candidate of candidates) {
    if (
      fs.existsSync(
        path.join(ROUTES_DIR, candidate)
      )
    ) {
      selectedFile = candidate;
      break;
    }
  }

  if (!selectedFile) {
    skippedRoutes.push(definition.name);

    startupWarning(
      `Route not found: ${definition.name}.`
    );

    continue;
  }

  try {
    const router = loadRouter(selectedFile);

    if (!router) {
      continue;
    }

    app.use(definition.prefix, router);

    mountedRoutes.push({
      name: definition.name,
      prefix: definition.prefix,
      file: selectedFile
    });

    startupLog(
      `Mounted ${definition.prefix} -> ${selectedFile}`
    );

  } catch (error) {
    startupWarning(
      `Failed to mount ${definition.name}: ${error.message}`
    );

    throw error;
  }
}

// =============================================================================
// 24. ROUTE REGISTRATION SUMMARY
// =============================================================================

app.locals.routes = Object.freeze(
  mountedRoutes.map(route => ({
    name: route.name,
    prefix: route.prefix
  }))
);

startupLog(
  `${mountedRoutes.length} API route module(s) mounted.`
);

// =============================================================================
// 25. HEALTH CHECK
// =============================================================================

function healthResponse(req, res) {
  res.status(200).json({
    success: true,

    status: "ok",

    application: config.application.name,

    version: config.application.version,

    environment: config.environment.name,

    uptimeSeconds: Math.floor(process.uptime()),

    timestamp: new Date().toISOString(),

    requestId: req.id
  });
}

if (config.health.enabled) {
  app.get(config.health.path, healthResponse);

  app.get(config.health.livenessPath, healthResponse);

  app.get("/live", healthResponse);

  // Process readiness only.
  // A real database check must be added after a MySQL adapter exists.
  app.get(config.health.readinessPath, (req, res) => {
    res.status(200).json({
      success: true,
      status: "ready",
      checks: {
        application: "ok",
        database: "not-integrated"
      },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  });

  app.get("/ready", (req, res) => {
    res.status(200).json({
      success: true,
      status: "ready",
      requestId: req.id
    });
  });
}

// =============================================================================
// 26. APPLICATION INFORMATION
// =============================================================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    application: config.application.name,
    version: config.application.version,
    environment: config.environment.name,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// 27. 404 HANDLER
// =============================================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Resource not found.",
    path: req.path,
    requestId: req.id
  });
});

// =============================================================================
// 28. GLOBAL ERROR HANDLER
// =============================================================================

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = Number.isInteger(error.status)
    ? error.status
    : error.message?.includes("CORS policy")
      ? 403
      : 500;

  const safeStatus = statusCode >= 400 && statusCode < 600
    ? statusCode
    : 500;

  console.error("[MedOrbits ERROR]", {
    requestId: req.id,
    method: req.method,
    path: req.path,
    status: safeStatus,
    message: safeStatus >= 500
      ? "Internal application error."
      : error.message
  });

  const response = {
    success: false,
    error: safeStatus >= 500
      ? "Internal server error."
      : error.message,
    requestId: req.id
  };

  if (IS_DEVELOPMENT && config.application.stackTraces) {
    response.stack = error.stack;
  }

  res.status(safeStatus).json(response);
});

// =============================================================================
// 29. HTTP SERVER
// =============================================================================

const server = http.createServer(app);

server.requestTimeout =
  config.application.requestTimeoutMs;

server.headersTimeout =
  config.application.headersTimeoutMs;

server.keepAliveTimeout =
  config.application.keepAliveTimeoutMs;

// =============================================================================
// 30. GRACEFUL SHUTDOWN
// =============================================================================

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  startupWarning(
    `Received ${signal}. Starting graceful shutdown.`
  );

  const forceExitTimer = setTimeout(() => {
    startupWarning(
      "Graceful shutdown timeout exceeded."
    );

    process.exit(1);
  }, config.application.shutdownTimeoutMs);

  forceExitTimer.unref();

  if (!server.listening) {
    clearTimeout(forceExitTimer);
    process.exit(0);
    return;
  }

  server.close(error => {
    clearTimeout(forceExitTimer);

    if (error) {
      console.error(
        "[MedOrbits] Shutdown error:",
        error.message
      );

      process.exitCode = 1;
      return;
    }

    startupLog(
      "HTTP server closed successfully."
    );

    // Add database pool and worker shutdown here
    // after their respective adapters are implemented.

    process.exitCode = 0;
  });

  if (typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }
}

if (config.application.gracefulShutdown) {
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// =============================================================================
// 31. PROCESS ERROR HANDLING
// =============================================================================

process.on("unhandledRejection", reason => {
  console.error(
    "[MedOrbits] Unhandled promise rejection:",
    reason instanceof Error
      ? reason.message
      : "Unknown rejection"
  );

  if (IS_PRODUCTION) {
    shutdown("UNHANDLED_REJECTION");
  }
});

process.on("uncaughtException", error => {
  console.error(
    "[MedOrbits] Uncaught exception:",
    error.message
  );

  console.error(
    error.stack || "Stack unavailable."
  );

  // An uncaught exception leaves application state uncertain.
  // Do not continue serving requests.
  shutdown("UNCAUGHT_EXCEPTION");

  process.exitCode = 1;
});

// =============================================================================
// 32. START SERVER
// =============================================================================

function startServer() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(
      config.application.port,
      config.application.host,
      () => {
        server.removeListener("error", reject);

        startupLog(
          "================================================"
        );

        startupLog(
          "MEDORBITS SERVER STARTED"
        );

        startupLog(
          `URL: ${config.application.url}`
        );

        startupLog(
          `API: ${config.application.apiPrefix}`
        );

        startupLog(
          `Environment: ${config.environment.name}`
        );

        startupLog(
          `Mounted API routes: ${mountedRoutes.length}`
        );

        startupLog(
          `Skipped optional routes: ${skippedRoutes.length}`
        );

        startupLog(
          "Database migrations: disabled"
        );

        startupLog(
          "================================================"
        );

        resolve(server);
      }
    );
  });
}

// =============================================================================
// 33. SERVER BOOTSTRAP
// =============================================================================

if (require.main === module) {
  startServer().catch(error => {
    console.error(
      "[MedOrbits] Server startup failed:",
      error.message
    );

    process.exitCode = 1;
  });
}

// =============================================================================
// 34. MODULE EXPORTS
// =============================================================================

module.exports = {
  app,
  server,
  startServer,
  shutdown,
  config,

  mountedRoutes,

  getServerStatus() {
    return {
      listening: server.listening,
      shuttingDown,
      environment: config.environment.name,
      uptimeSeconds: Math.floor(process.uptime())
    };
  }
};

// =============================================================================
// END OF MEDORBITS SERVER
// =============================================================================
