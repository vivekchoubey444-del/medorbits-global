
"use strict";

/**
 * =============================================================================
 * MEDORBITS -- NODE.JS CENTRAL CONFIGURATION
 * File: /node/config/node.config.js
 * Version: 2.0.0
 *
 * Purpose:
 * Central configuration for MedOrbits Node.js infrastructure.
 *
 * Security:
 * - Never store secrets in this file.
 * - Load sensitive values from environment variables.
 * - Validate configuration before application startup.
 * - Keep production and development settings separate.
 * =============================================================================
 */

const path = require("node:path");
const os = require("node:os");

const NODE_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(NODE_DIR, "..");

const NODE_ENV = process.env.NODE_ENV || "development";

const VALID_ENVIRONMENTS = [
  "development",
  "test",
  "staging",
  "production"
];

if (!VALID_ENVIRONMENTS.includes(NODE_ENV)) {
  throw new Error(
    `[MedOrbits] Invalid NODE_ENV: ${NODE_ENV}`
  );
}

const IS_PRODUCTION = NODE_ENV === "production";
const IS_DEVELOPMENT = NODE_ENV === "development";
const IS_TEST = NODE_ENV === "test";

const config = Object.freeze({

  // ===========================================================================
  // APPLICATION INFORMATION
  // ===========================================================================

  application: {
    name: "MedOrbits",
    module: "Node Infrastructure",
    version: "2.0.0",
    description:
      "Centralized Node.js infrastructure management.",
    environment: NODE_ENV,
    production: IS_PRODUCTION,
    development: IS_DEVELOPMENT,
    testing: IS_TEST
  },

  // ===========================================================================
  // RUNTIME
  // ===========================================================================

  runtime: {
    engine: "node",
    minimumVersion: 20,
    recommendedMajorVersion: 22,
    minimumNpmMajorVersion: 10,
    moduleSystem: "commonjs",
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.versions.node,
    pid: process.pid,
    hostname: os.hostname()
  },

  // ===========================================================================
  // DIRECTORY STRUCTURE
  // ===========================================================================

  paths: {
    root: ROOT_DIR,
    node: NODE_DIR,

    config: path.join(NODE_DIR, "config"),
    scripts: path.join(NODE_DIR, "scripts"),
    runtime: path.join(NODE_DIR, "runtime"),
    middleware: path.join(NODE_DIR, "middleware"),
    utils: path.join(NODE_DIR, "utils"),
    tests: path.join(NODE_DIR, "tests"),
    reports: path.join(NODE_DIR, "reports"),

    package: path.join(NODE_DIR, "package.json"),
    manifest: path.join(NODE_DIR, "manifest.json"),

    rootPackage: path.join(ROOT_DIR, "package.json"),
    rootServer: path.join(ROOT_DIR, "server.js"),

    environmentExample: path.join(
      ROOT_DIR,
      ".env.example"
    )
  },

  // ===========================================================================
  // ENVIRONMENT
  // ===========================================================================

  environment: {
    name: NODE_ENV,

    allowMissingOptionalVariables: true,

    allowDebug: IS_DEVELOPMENT,

    allowVerboseLogging:
      IS_DEVELOPMENT || IS_TEST,

    loadLocalEnvironment: !IS_PRODUCTION,

    requireHttps: IS_PRODUCTION,

    requiredVariables: [],

    optionalVariables: [
      "PORT",
      "DATABASE_URL",
      "SESSION_SECRET",
      "AI_API_KEY",
      "AI_API_URL",
      "AI_MODEL"
    ]
  },

  // ===========================================================================
  // SERVER
  // ===========================================================================

  server: {
    host: process.env.HOST || "0.0.0.0",

    port: Number(process.env.PORT || 3000),

    trustProxy: IS_PRODUCTION,

    requestTimeout: 30000,

    headersTimeout: 35000,

    keepAliveTimeout: 5000,

    gracefulShutdownTimeout: 15000
  },

  // ===========================================================================
  // SECURITY
  // ===========================================================================

  security: {
    helmet: true,

    cors: {
      enabled: true,

      credentials: true,

      origins: (
        process.env.ALLOWED_ORIGINS || ""
      )
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
    },

    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000,
      maximumRequests: 100
    },

    secrets: {
      useEnvironmentVariables: true,
      exposeInLogs: false,
      exposeInReports: false
    },

    permissions: {
      automaticDeployment: false,
      automaticDatabaseMigration: false,
      destructiveOperations: false
    }
  },

  // ===========================================================================
  // DATABASE
  // ===========================================================================

  database: {
    enabled: Boolean(process.env.DATABASE_URL),

    provider: process.env.DB_CLIENT || "postgresql",

    connectionStringVariable: "DATABASE_URL",

    ssl: IS_PRODUCTION,

    autoMigrate: false,

    connectionTimeout: 10000
  },

  // ===========================================================================
  // LOGGING
  // ===========================================================================

  logging: {
    level:
      process.env.LOG_LEVEL ||
      (IS_PRODUCTION ? "info" : "debug"),

    console: true,

    file: false,

    directory: path.join(NODE_DIR, "logs"),

    redact: [
      "password",
      "token",
      "authorization",
      "cookie",
      "secret",
      "apiKey",
      "DATABASE_URL"
    ]
  },

  // ===========================================================================
  // DIAGNOSTICS
  // ===========================================================================

  diagnostics: {
    enabled: true,

    runtimeValidation: true,

    packageValidation: true,

    lockfileValidation: true,

    environmentValidation: true,

    securityValidation: true,

    repositoryValidation: true,

    generateJsonReport: true,

    generateMarkdownReport: true,

    reportDirectory: path.join(
      NODE_DIR,
      "reports"
    )
  },

  // ===========================================================================
  // FEATURE FLAGS
  // ===========================================================================

  features: {
    automaticRepair: false,

    dependencyAutoUpgrade: false,

    automaticDeployment: false,

    backgroundWorkers: true,

    healthMonitoring: true,

    securityScanning: true,

    auditLogging: true
  },

  // ===========================================================================
  // SHUTDOWN
  // ===========================================================================

  shutdown: {
    enabled: true,

    timeout: 15000,

    signals: [
      "SIGINT",
      "SIGTERM"
    ],

    closeHttpServer: true,

    closeDatabaseConnections: true,

    flushLogs: true
  }

});

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

function validateConfig() {

  const errors = [];

  if (
    !Number.isInteger(config.server.port) ||
    config.server.port < 1 ||
    config.server.port > 65535
  ) {
    errors.push("Invalid server port.");
  }

  if (
    process.versions.node.split(".")[0] <
    config.runtime.minimumVersion
  ) {
    errors.push(
      `Node.js >= ${config.runtime.minimumVersion} required.`
    );
  }

  if (
    !Number.isFinite(config.server.requestTimeout) ||
    config.server.requestTimeout <= 0
  ) {
    errors.push("Invalid request timeout.");
  }

  if (errors.length > 0) {
    throw new Error(
      `[MedOrbits Configuration]\n${errors.join("\n")}`
    );
  }

  return true;
}

function getConfig() {
  validateConfig();
  return config;
}

module.exports = Object.freeze({
  config,
  validateConfig,
  getConfig,

  ROOT_DIR,
  NODE_DIR,

  IS_PRODUCTION,
  IS_DEVELOPMENT,
  IS_TEST
});
