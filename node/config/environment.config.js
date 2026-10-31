
"use strict";

/**
 * =============================================================================
 * MEDORBITS -- ENVIRONMENT CONFIGURATION & VALIDATION
 * File: /node/config/environment.config.js
 * Version: 3.0.0
 * Runtime: Node.js >= 20
 * Backend: Express.js
 * Database: MySQL
 *
 * Responsibilities:
 * - Environment variable parsing.
 * - Type and format validation.
 * - Production security validation.
 * - MySQL configuration.
 * - Authentication and session configuration.
 * - CORS and cookie validation.
 * - Email, AI, payment and storage validation.
 * - Centralized configuration export.
 *
 * Security:
 * - Never prints environment secrets.
 * - Never generates production secrets automatically.
 * - Never modifies .env files.
 * - Never performs database migrations.
 * =============================================================================
 */

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const ROOT_DIR = path.resolve(__dirname, "../..");

const VALID_ENVIRONMENTS = [
  "development",
  "test",
  "staging",
  "production"
];

const errors = [];
const warnings = [];

// =============================================================================
// ENVIRONMENT
// =============================================================================

const ENV = process.env.NODE_ENV || "development";

if (!VALID_ENVIRONMENTS.includes(ENV)) {
  throw new Error(
    "[MedOrbits] Invalid NODE_ENV. " +
    "Use development, test, staging or production."
  );
}

const IS_PRODUCTION = ENV === "production";
const IS_DEVELOPMENT = ENV === "development";
const IS_TEST = ENV === "test";
const IS_STAGING = ENV === "staging";

// =============================================================================
// BASIC HELPERS
// =============================================================================

function getString(name, fallback = "") {
  const value = process.env[name];

  return value === undefined
    ? fallback
    : String(value).trim();
}

function getBoolean(name, fallback = false) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  errors.push(`${name} must be a valid boolean.`);
  return fallback;
}

function getNumber(
  name,
  fallback,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER
) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    errors.push(
      `${name} must be a number between ${minimum} and ${maximum}.`
    );

    return fallback;
  }

  return parsed;
}

function getInteger(name, fallback, minimum = 0, maximum = 1000000) {
  const value = getNumber(
    name,
    fallback,
    minimum,
    maximum
  );

  if (!Number.isInteger(value)) {
    errors.push(`${name} must be an integer.`);
    return fallback;
  }

  return value;
}

function getList(name, fallback = []) {
  const value = getString(name);

  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function getEnum(name, fallback, allowed) {
  const value = getString(name, fallback);

  if (!allowed.includes(value)) {
    errors.push(
      `${name} must be one of: ${allowed.join(", ")}.`
    );

    return fallback;
  }

  return value;
}

function getUrl(name, fallback = "", options = {}) {
  const value = getString(name, fallback);

  if (!value) {
    return value;
  }

  try {
    const parsed = new URL(value);

    const allowedProtocols =
      options.protocols || ["http:", "https:"];

    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new Error("Unsupported URL protocol.");
    }

    if (
      IS_PRODUCTION &&
      options.requireHttps &&
      parsed.protocol !== "https:"
    ) {
      throw new Error("HTTPS is required.");
    }

    return parsed.toString().replace(/\/$/, "");

  } catch {
    errors.push(`${name} must be a valid URL.`);
    return fallback;
  }
}

function requireValue(name) {
  if (!getString(name)) {
    errors.push(`${name} is required.`);
  }
}

function requireSecret(name, minimumBytes = 32) {
  const value = getString(name);

  if (!value) {
    errors.push(`${name} is required.`);
    return;
  }

  if (Buffer.byteLength(value, "utf8") < minimumBytes) {
    errors.push(
      `${name} must contain at least ${minimumBytes} bytes.`
    );
  }

  if (
    IS_PRODUCTION &&
    /^(change.?me|secret|password|your.?secret|example)$/i.test(value)
  ) {
    errors.push(`${name} contains an insecure placeholder.`);
  }
}

function validateExistingFile(name, required = false) {
  const value = getString(name);

  if (!value) {
    if (required) {
      errors.push(`${name} is required.`);
    }

    return "";
  }

  const resolved = path.resolve(ROOT_DIR, value);

  if (!fs.existsSync(resolved)) {
    errors.push(`${name} points to a missing file.`);
    return "";
  }

  return resolved;
}

function addWarning(message) {
  warnings.push(message);
}

// =============================================================================
// APPLICATION CONFIGURATION
// =============================================================================

const application = {
  name: getString("APP_NAME", "MedOrbits"),
  version: getString("APP_VERSION", "3.0.0"),
  environment: getString(
    "APP_ENVIRONMENT",
    IS_PRODUCTION ? "production" : "local"
  ),

  url: getUrl(
    "APP_URL",
    "http://localhost:3000",
    { requireHttps: true }
  ),

  apiPrefix: getString("API_PREFIX", "/api/v1"),

  apiPublicUrl: getUrl(
    "API_PUBLIC_URL",
    "http://localhost:3000/api/v1",
    { requireHttps: true }
  ),

  frontendUrl: getUrl(
    "FRONTEND_URL",
    "http://localhost:3000",
    { requireHttps: true }
  ),

  supportEmail: getString(
    "SUPPORT_EMAIL",
    "support@medorbits.in"
  ),

  host: getString(
    "HOST",
    IS_PRODUCTION ? "0.0.0.0" : "127.0.0.1"
  ),

  port: getInteger("PORT", 3000, 1, 65535),

  shutdownTimeoutMs: getInteger(
    "SHUTDOWN_TIMEOUT_MS",
    15000,
    1000,
    120000
  ),

  requestTimeoutMs: getInteger(
    "REQUEST_TIMEOUT_MS",
    30000,
    1000,
    300000
  ),

  headersTimeoutMs: getInteger(
    "HEADERS_TIMEOUT_MS",
    35000,
    1000,
    300000
  ),

  keepAliveTimeoutMs: getInteger(
    "KEEP_ALIVE_TIMEOUT_MS",
    5000,
    1000,
    120000
  ),

  gracefulShutdown: getBoolean(
    "ENABLE_GRACEFUL_SHUTDOWN",
    true
  ),

  startupBanner: getBoolean(
    "ENABLE_STARTUP_BANNER",
    !IS_PRODUCTION
  ),

  stackTraces: getBoolean(
    "ENABLE_STACK_TRACES",
    false
  )
};

// =============================================================================
// CORS AND SECURITY HEADERS
// =============================================================================

const corsOrigins = getList(
  "ALLOWED_ORIGINS",
  IS_PRODUCTION
    ? ["https://www.medorbits.in"]
    : [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
      ]
);

for (const origin of corsOrigins) {
  try {
    const parsed = new URL(origin);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error();
    }

    if (parsed.origin !== origin.replace(/\/$/, "")) {
      throw new Error();
    }

    if (IS_PRODUCTION && parsed.protocol !== "https:") {
      throw new Error();
    }

  } catch {
    errors.push("ALLOWED_ORIGINS contains an invalid origin.");
  }
}

const cors = {
  enabled: true,

  origins: corsOrigins,

  credentials: getBoolean(
    "CORS_ALLOW_CREDENTIALS",
    true
  ),

  maxAgeSeconds: getInteger(
    "CORS_MAX_AGE_SECONDS",
    600,
    0,
    86400
  ),

  methods: getList(
    "CORS_ALLOWED_METHODS",
    ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  ),

  headers: getList(
    "CORS_ALLOWED_HEADERS",
    [
      "Accept",
      "Authorization",
      "Content-Type",
      "Origin",
      "X-Request-ID",
      "X-Correlation-ID",
      "X-CSRF-Token"
    ]
  ),

  securityHeaders: getBoolean(
    "ENABLE_SECURITY_HEADERS",
    true
  ),

  contentSecurityPolicy: getBoolean(
    "ENABLE_CSP",
    false
  ),

  crossOriginResourcePolicy: getString(
    "CROSS_ORIGIN_RESOURCE_POLICY",
    "same-site"
  ),

  referrerPolicy: getString(
    "REFERRER_POLICY",
    "strict-origin-when-cross-origin"
  ),

  trustProxyHops: getInteger(
    "TRUST_PROXY_HOPS",
    IS_PRODUCTION ? 1 : 0,
    0,
    10
  )
};

if (cors.credentials && cors.origins.includes("*")) {
  errors.push(
    "Wildcard CORS origin cannot be used with credentials."
  );
}

// =============================================================================
// MYSQL DATABASE
// =============================================================================

const database = {
  client: getEnum(
    "DB_CLIENT",
    "mysql",
    ["mysql"]
  ),

  host: getString("DB_HOST", "127.0.0.1"),

  port: getInteger(
    "DB_PORT",
    3306,
    1,
    65535
  ),

  name: getString("DB_NAME", "medorbits"),

  user: getString("DB_USER", "medorbits_app"),

  password: getString("DB_PASSWORD"),

  connectionLimit: getInteger(
    "DB_CONNECTION_LIMIT",
    10,
    1,
    1000
  ),

  connectTimeoutMs: getInteger(
    "DB_CONNECT_TIMEOUT_MS",
    10000,
    1000,
    120000
  ),

  queueLimit: getInteger(
    "DB_QUEUE_LIMIT",
    100,
    0,
    100000
  ),

  checkOnStart: getBoolean(
    "DB_CHECK_ON_START",
    true
  ),

  keepAlive: getBoolean(
    "DB_ENABLE_KEEP_ALIVE",
    true
  ),

  idleTimeoutMs: getInteger(
    "DB_IDLE_TIMEOUT_MS",
    60000,
    1000,
    3600000
  ),

  maxIdleConnections: getInteger(
    "DB_MAX_IDLE_CONNECTIONS",
    5,
    0,
    1000
  ),

  queryTimeoutMs: getInteger(
    "DB_QUERY_TIMEOUT_MS",
    15000,
    1000,
    300000
  ),

  slowQueryThresholdMs: getInteger(
    "DB_SLOW_QUERY_THRESHOLD_MS",
    1000,
    1,
    300000
  ),

  logQueries: getBoolean(
    "DB_LOG_QUERIES",
    false
  ),

  logParameters: getBoolean(
    "DB_LOG_PARAMETERS",
    false
  ),

  multipleStatements: getBoolean(
    "DB_MULTIPLE_STATEMENTS",
    false
  ),

  isolationLevel: getEnum(
    "DB_DEFAULT_ISOLATION_LEVEL",
    "READ COMMITTED",
    [
      "READ UNCOMMITTED",
      "READ COMMITTED",
      "REPEATABLE READ",
      "SERIALIZABLE"
    ]
  ),

  transactionTimeoutMs: getInteger(
    "DB_TRANSACTION_TIMEOUT_MS",
    30000,
    1000,
    300000
  ),

  sslEnabled: getBoolean(
    "DB_SSL_ENABLED",
    IS_PRODUCTION
  ),

  sslRejectUnauthorized: getBoolean(
    "DB_SSL_REJECT_UNAUTHORIZED",
    true
  ),

  autoMigrate: getBoolean(
    "DB_AUTO_MIGRATE",
    false
  ),

  seedOnStart: getBoolean(
    "DB_SEED_ON_START",
    false
  )
};

database.ssl = {
  enabled: database.sslEnabled,
  rejectUnauthorized: database.sslRejectUnauthorized,

  ca: validateExistingFile("DB_SSL_CA_PATH"),
  cert: validateExistingFile("DB_SSL_CERT_PATH"),
  key: validateExistingFile("DB_SSL_KEY_PATH")
};

if (database.logParameters && IS_PRODUCTION) {
  errors.push(
    "DB_LOG_PARAMETERS must be disabled in production."
  );
}

if (database.multipleStatements && IS_PRODUCTION) {
  errors.push(
    "DB_MULTIPLE_STATEMENTS must be disabled in production."
  );
}

if (IS_PRODUCTION) {
  requireValue("DB_HOST");
  requireValue("DB_NAME");
  requireValue("DB_USER");
  requireValue("DB_PASSWORD");

  if (!database.sslEnabled) {
    errors.push("MySQL SSL must be enabled in production.");
  }

  if (!database.sslRejectUnauthorized) {
    errors.push(
      "MySQL SSL certificate verification must remain enabled."
    );
  }

  if (database.autoMigrate || database.seedOnStart) {
    errors.push(
      "Automatic migration and seeding are prohibited by this configuration."
    );
  }
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

const authentication = {
  sessionSecret: getString("SESSION_SECRET"),

  jwtSecret: getString("JWT_SECRET"),

  jwtRefreshSecret: getString("JWT_REFRESH_SECRET"),

  issuer: getString(
    "JWT_ISSUER",
    "https://www.medorbits.in"
  ),

  audience: getString(
    "JWT_AUDIENCE",
    "medorbits-api"
  ),

  accessTtl: getString("JWT_ACCESS_TTL", "15m"),

  refreshTtl: getString("JWT_REFRESH_TTL", "7d"),

  algorithm: getEnum(
    "JWT_ALGORITHM",
    "HS256",
    ["HS256"]
  ),

  refreshRotation: getBoolean(
    "JWT_REFRESH_ROTATION",
    true
  ),

  revokeOnLogout: getBoolean(
    "JWT_REVOKE_ON_LOGOUT",
    true
  ),

  clockToleranceSeconds: getInteger(
    "JWT_CLOCK_TOLERANCE_SECONDS",
    30,
    0,
    300
  ),

  password: {
    minimumLength: getInteger(
      "PASSWORD_MIN_LENGTH",
      12,
      8,
      128
    ),

    maximumLength: getInteger(
      "PASSWORD_MAX_LENGTH",
      128,
      8,
      256
    ),

    bcryptRounds: getInteger(
      "PASSWORD_BCRYPT_ROUNDS",
      12,
      10,
      15
    )
  },

  maximumFailedAttempts: getInteger(
    "AUTH_MAX_FAILED_ATTEMPTS",
    5,
    1,
    100
  ),

  lockoutDurationMs: getInteger(
    "AUTH_LOCKOUT_DURATION_MS",
    900000,
    1000,
    86400000
  ),

  emailVerificationRequired: getBoolean(
    "AUTH_REQUIRE_EMAIL_VERIFICATION",
    true
  ),

  selfRegistration: getBoolean(
    "AUTH_ALLOW_SELF_REGISTRATION",
    true
  ),

  adminMfaRequired: getBoolean(
    "AUTH_REQUIRE_MFA_FOR_ADMIN",
    true
  )
};

if (
  authentication.password.maximumLength <
  authentication.password.minimumLength
) {
  errors.push(
    "PASSWORD_MAX_LENGTH cannot be less than PASSWORD_MIN_LENGTH."
  );
}

if (IS_PRODUCTION) {
  requireSecret("SESSION_SECRET", 32);
  requireSecret("JWT_SECRET", 32);
  requireSecret("JWT_REFRESH_SECRET", 32);

  if (
    authentication.jwtSecret &&
    authentication.jwtRefreshSecret &&
    authentication.jwtSecret === authentication.jwtRefreshSecret
  ) {
    errors.push(
      "JWT_SECRET and JWT_REFRESH_SECRET must be different."
    );
  }

  if (
    authentication.sessionSecret &&
    authentication.jwtSecret &&
    authentication.sessionSecret === authentication.jwtSecret
  ) {
    errors.push(
      "SESSION_SECRET must be independent of JWT_SECRET."
    );
  }
}

// =============================================================================
// SESSION AND COOKIES
// =============================================================================

const session = {
  enabled: getBoolean("SESSION_ENABLED", true),

  cookieName: getString(
    "SESSION_COOKIE_NAME",
    "medorbits.sid"
  ),

  ttlMs: getInteger(
    "SESSION_TTL_MS",
    86400000,
    1000,
    2592000000
  ),

  store: getEnum(
    "SESSION_STORE",
    "mysql",
    ["mysql", "redis", "memory"]
  ),

  httpOnly: getBoolean("COOKIE_HTTP_ONLY", true),

  secure: getBoolean(
    "COOKIE_SECURE",
    IS_PRODUCTION
  ),

  sameSite: getEnum(
    "COOKIE_SAME_SITE",
    "lax",
    ["strict", "lax", "none"]
  ),

  path: getString("COOKIE_PATH", "/"),

  domain: getString("COOKIE_DOMAIN"),

  csrfEnabled: getBoolean(
    "CSRF_PROTECTION_ENABLED",
    true
  ),

  csrfCookieName: getString(
    "CSRF_COOKIE_NAME",
    "medorbits.csrf"
  ),

  csrfHeaderName: getString(
    "CSRF_HEADER_NAME",
    "X-CSRF-Token"
  )
};

if (IS_PRODUCTION && !session.secure) {
  errors.push(
    "COOKIE_SECURE must be true in production."
  );
}

if (session.sameSite === "none" && !session.secure) {
  errors.push(
    "SameSite=None requires Secure cookies."
  );
}

if (
  session.enabled &&
  session.store === "memory" &&
  IS_PRODUCTION
) {
  errors.push(
    "In-memory sessions are not suitable for production."
  );
}

// =============================================================================
// RATE LIMITING
// =============================================================================

const rateLimit = {
  enabled: getBoolean("RATE_LIMIT_ENABLED", true),

  windowMs: getInteger(
    "RATE_LIMIT_WINDOW_MS",
    900000,
    1000,
    86400000
  ),

  maximumRequests: getInteger(
    "RATE_LIMIT_MAX_REQUESTS",
    100,
    1,
    100000
  ),

  authWindowMs: getInteger(
    "AUTH_RATE_LIMIT_WINDOW_MS",
    900000,
    1000,
    86400000
  ),

  authMaximumRequests: getInteger(
    "AUTH_RATE_LIMIT_MAX_REQUESTS",
    10,
    1,
    10000
  ),

  store: getEnum(
    "RATE_LIMIT_STORE",
    "memory",
    ["memory", "redis", "database"]
  )
};

if (IS_PRODUCTION && rateLimit.store === "memory") {
  addWarning(
    "Memory rate limiting is not shared across multiple application instances. Consider Redis."
  );
}

// =============================================================================
// EMAIL
// =============================================================================

const email = {
  enabled: getBoolean("EMAIL_ENABLED", false),

  provider: getString("EMAIL_PROVIDER", "smtp"),

  host: getString("SMTP_HOST"),

  port: getInteger("SMTP_PORT", 587, 1, 65535),

  secure: getBoolean("SMTP_SECURE", false),

  user: getString("SMTP_USER"),

  password: getString("SMTP_PASSWORD"),

  fromName: getString("EMAIL_FROM_NAME", "MedOrbits"),

  fromAddress: getString(
    "EMAIL_FROM_ADDRESS",
    "no-reply@medorbits.in"
  ),

  replyTo: getString(
    "EMAIL_REPLY_TO",
    "support@medorbits.in"
  ),

  timeoutMs: getInteger(
    "EMAIL_SEND_TIMEOUT_MS",
    10000,
    1000,
    120000
  ),

  pooling: getBoolean(
    "EMAIL_POOLING_ENABLED",
    true
  ),

  maximumConnections: getInteger(
    "EMAIL_MAX_CONNECTIONS",
    5,
    1,
    100
  ),

  maximumRetries: getInteger(
    "EMAIL_MAX_RETRIES",
    3,
    0,
    20
  )
};

if (email.enabled && email.provider === "smtp") {
  requireValue("SMTP_HOST");
  requireValue("SMTP_USER");
  requireValue("SMTP_PASSWORD");
}

if (email.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.fromAddress)) {
  errors.push("EMAIL_FROM_ADDRESS must be a valid email address.");
}

// =============================================================================
// UPLOADS
// =============================================================================

const uploads = {
  enabled: getBoolean("UPLOADS_ENABLED", true),

  maximumFileSizeBytes: getInteger(
    "UPLOAD_MAX_FILE_SIZE_BYTES",
    10485760,
    1,
    1073741824
  ),

  maximumFiles: getInteger(
    "UPLOAD_MAX_FILES",
    5,
    1,
    100
  ),

  maximumTotalSizeBytes: getInteger(
    "UPLOAD_MAX_TOTAL_SIZE_BYTES",
    52428800,
    1,
    2147483648
  ),

  allowedExtensions: getList(
    "UPLOAD_ALLOWED_EXTENSIONS",
    [".pdf", ".jpg", ".jpeg", ".png"]
  ),

  directory: getString(
    "UPLOAD_DIRECTORY",
    "storage/uploads"
  ),

  tempDirectory: getString(
    "UPLOAD_TEMP_DIRECTORY",
    "storage/tmp"
  ),

  validateSignature: getBoolean(
    "UPLOAD_VALIDATE_SIGNATURE",
    true
  ),

  scanForMalware: getBoolean(
    "UPLOAD_SCAN_FOR_MALWARE",
    false
  ),

  overwriteExisting: getBoolean(
    "UPLOAD_OVERWRITE_EXISTING",
    false
  ),

  privateDocuments: getBoolean(
    "DOCUMENTS_PRIVATE",
    true
  )
};

// =============================================================================
// AI
// =============================================================================

const ai = {
  enabled: getBoolean("AI_ENABLED", false),

  provider: getString("AI_PROVIDER"),

  model: getString("AI_MODEL"),

  apiUrl: getUrl("AI_API_URL"),

  apiKey: getString("AI_API_KEY"),

  timeoutMs: getInteger(
    "AI_REQUEST_TIMEOUT_MS",
    30000,
    1000,
    300000
  ),

  maximumRetries: getInteger(
    "AI_MAX_RETRIES",
    2,
    0,
    10
  ),

  maximumOutputTokens: getInteger(
    "AI_MAX_OUTPUT_TOKENS",
    2000,
    1,
    100000
  ),

  requireConsent: getBoolean(
    "AI_REQUIRE_USER_CONSENT",
    true
  ),

  sendPersonalDocuments: getBoolean(
    "AI_SEND_PERSONAL_DOCUMENTS",
    false
  ),

  redactPersonalData: getBoolean(
    "AI_REDACT_PERSONAL_DATA",
    true
  ),

  logPrompts: getBoolean(
    "AI_LOG_PROMPTS",
    false
  )
};

if (ai.enabled) {
  requireValue("AI_PROVIDER");
  requireValue("AI_MODEL");
  requireValue("AI_API_URL");
  requireValue("AI_API_KEY");

  if (!ai.requireConsent || !ai.redactPersonalData) {
    addWarning(
      "AI consent and personal-data safeguards require review."
    );
  }

  if (ai.logPrompts && IS_PRODUCTION) {
    errors.push(
      "AI_LOG_PROMPTS must be disabled in production."
    );
  }

  if (ai.sendPersonalDocuments && IS_PRODUCTION) {
    addWarning(
      "AI document transfer requires a separate privacy and security review."
    );
  }
}

// =============================================================================
// PAYMENTS
// =============================================================================

const payments = {
  enabled: getBoolean("PAYMENT_ENABLED", false),

  provider: getString("PAYMENT_PROVIDER"),

  currency: getString("PAYMENT_CURRENCY", "INR"),

  captureMode: getEnum(
    "PAYMENT_CAPTURE_MODE",
    "automatic",
    ["automatic", "manual"]
  ),

  timeoutMs: getInteger(
    "PAYMENT_REQUEST_TIMEOUT_MS",
    15000,
    1000,
    120000
  ),

  webhookToleranceSeconds: getInteger(
    "PAYMENT_WEBHOOK_TOLERANCE_SECONDS",
    300,
    1,
    3600
  ),

  requireWebhookSignature: getBoolean(
    "PAYMENT_REQUIRE_WEBHOOK_SIGNATURE",
    true
  )
};

if (payments.enabled) {
  requireValue("PAYMENT_PROVIDER");

  if (IS_PRODUCTION && !payments.requireWebhookSignature) {
    errors.push(
      "Payment webhook signature verification is mandatory."
    );
  }
}

// =============================================================================
// REDIS AND CACHE
// =============================================================================

const redis = {
  enabled: getBoolean("REDIS_ENABLED", false),

  url: getString("REDIS_URL"),

  connectTimeoutMs: getInteger(
    "REDIS_CONNECT_TIMEOUT_MS",
    5000,
    1000,
    120000
  ),

  keyPrefix: getString(
    "REDIS_KEY_PREFIX",
    "medorbits:"
  )
};

if (redis.enabled) {
  requireValue("REDIS_URL");
}

// =============================================================================
// OBJECT STORAGE
// =============================================================================

const storage = {
  enabled: getBoolean("OBJECT_STORAGE_ENABLED", false),

  provider: getString(
    "OBJECT_STORAGE_PROVIDER",
    "s3"
  ),

  endpoint: getUrl("OBJECT_STORAGE_ENDPOINT"),

  region: getString(
    "OBJECT_STORAGE_REGION",
    "ap-south-1"
  ),

  bucket: getString("OBJECT_STORAGE_BUCKET"),

  accessKey: getString("OBJECT_STORAGE_ACCESS_KEY"),

  secretKey: getString("OBJECT_STORAGE_SECRET_KEY")
};

if (storage.enabled) {
  requireValue("OBJECT_STORAGE_BUCKET");
  requireValue("OBJECT_STORAGE_ACCESS_KEY");
  requireValue("OBJECT_STORAGE_SECRET_KEY");
}

// =============================================================================
// LOGGING
// =============================================================================

const logging = {
  level: getEnum(
    "LOG_LEVEL",
    IS_PRODUCTION ? "info" : "debug",
    ["fatal", "error", "warn", "info", "debug", "trace"]
  ),

  format: getEnum(
    "LOG_FORMAT",
    "json",
    ["json", "text"]
  ),

  redactSensitive: getBoolean(
    "LOG_REDACT_SENSITIVE",
    true
  ),

  includeStacks: getBoolean(
    "LOG_INCLUDE_STACKS",
    false
  ),

  requestLogging: getBoolean(
    "LOG_REQUESTS",
    true
  ),

  responseBodies: getBoolean(
    "LOG_RESPONSE_BODIES",
    false
  ),

  sqlLogging: getBoolean(
    "LOG_SQL",
    false
  ),

  retentionDays: getInteger(
    "LOG_RETENTION_DAYS",
    30,
    1,
    3650
  )
};

if (IS_PRODUCTION) {
  if (!logging.redactSensitive) {
    errors.push(
      "LOG_REDACT_SENSITIVE must be enabled in production."
    );
  }

  if (logging.responseBodies) {
    errors.push(
      "Response body logging must be disabled in production."
    );
  }
}

// =============================================================================
// HEALTH AND MONITORING
// =============================================================================

const health = {
  enabled: getBoolean("HEALTH_CHECK_ENABLED", true),

  path: getString(
    "HEALTH_CHECK_PATH",
    "/health"
  ),

  readinessPath: getString(
    "READINESS_CHECK_PATH",
    "/ready"
  ),

  livenessPath: getString(
    "LIVENESS_CHECK_PATH",
    "/live"
  ),

  databaseCheck: getBoolean(
    "HEALTH_CHECK_DATABASE",
    true
  )
};

// =============================================================================
// FEATURE FLAGS
// =============================================================================

const features = {
  courses: getBoolean("FEATURE_COURSES", true),
  colleges: getBoolean("FEATURE_COLLEGES", true),
  universities: getBoolean("FEATURE_UNIVERSITIES", true),
  scholarships: getBoolean("FEATURE_SCHOLARSHIPS", true),
  admissions: getBoolean("FEATURE_ADMISSIONS", true),
  careers: getBoolean("FEATURE_CAREERS", true),
  recruitment: getBoolean("FEATURE_RECRUITMENT", true),
  hostels: getBoolean("FEATURE_HOSTELS", true),
  news: getBoolean("FEATURE_NEWS", true),
  testimonials: getBoolean("FEATURE_TESTIMONIALS", true),
  contactForms: getBoolean("FEATURE_CONTACT_FORMS", true)
};

// =============================================================================
// CROSS-FIELD PRODUCTION VALIDATION
// =============================================================================

if (IS_PRODUCTION) {
  if (application.stackTraces) {
    errors.push(
      "ENABLE_STACK_TRACES must be false in production."
    );
  }

  if (application.host !== "0.0.0.0") {
    addWarning(
      "Production HOST should normally be 0.0.0.0 on managed hosting."
    );
  }

  if (cors.origins.length === 0) {
    errors.push(
      "Production requires explicit CORS origins."
    );
  }

  if (session.enabled && !session.csrfEnabled) {
    addWarning(
      "Cookie-based authentication requires CSRF protection."
    );
  }

  if (application.url.startsWith("http://")) {
    errors.push("APP_URL must use HTTPS in production.");
  }

  if (application.frontendUrl.startsWith("http://")) {
    errors.push("FRONTEND_URL must use HTTPS in production.");
  }

  if (application.apiPublicUrl.startsWith("http://")) {
    errors.push("API_PUBLIC_URL must use HTTPS in production.");
  }

  if (!logging.redactSensitive) {
    errors.push("Sensitive-data redaction is mandatory.");
  }
}

// =============================================================================
// FINAL VALIDATION
// =============================================================================

function validateEnvironment() {
  if (errors.length > 0) {
    const message = [
      "[MedOrbits] Environment validation failed.",
      "",
      ...errors.map((error, index) =>
        `${index + 1}. ${error}`
      )
    ].join("\n");

    const error = new Error(message);
    error.code = "MEDORBITS_ENV_VALIDATION_FAILED";
    error.validationErrors = [...errors];

    throw error;
  }

  return true;
}

function getWarnings() {
  return [...warnings];
}

// =============================================================================
// FINAL CONFIGURATION
// =============================================================================

const config = {
  application,
  cors,
  database,
  authentication,
  session,
  rateLimit,
  email,
  uploads,
  ai,
  payments,
  redis,
  storage,
  logging,
  health,
  features,

  environment: {
    name: ENV,
    isProduction: IS_PRODUCTION,
    isDevelopment: IS_DEVELOPMENT,
    isStaging: IS_STAGING,
    isTest: IS_TEST
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = Object.freeze({
  config,
  validateEnvironment,
  getWarnings,

  ROOT_DIR,

  IS_PRODUCTION,
  IS_DEVELOPMENT,
  IS_STAGING,
  IS_TEST
});
