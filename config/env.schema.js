
/**
 * =============================================================================
 * MedOrbits -- Environment Configuration Schema and Audit
 * File: config/env.schema.js
 * Release: 1.0.0
 * Runtime: Node.js >=20, ES modules
 *
 * PURPOSE
 *   1. Audit environment-variable references in application source.
 *   2. Classify schema entries as verified, unverified, or unused.
 *   3. Validate explicitly configured environment-variable rules.
 *   4. Avoid assuming that documented variables are implemented.
 *
 * SECURITY
 *   - Never prints environment-variable values.
 *   - Does not load .env files or modify process.env.
 *   - Does not connect to databases or external services.
 *   - Does not generate secrets or perform migrations.
 *   - Does not treat the presence of a variable as proof that its
 *     associated security control is implemented.
 *
 * IMPORTANT
 *   This file is an audit framework, not evidence that a variable
 *   has been verified against the current MedOrbits source.
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(MODULE_DIR, "..");

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".mts",
  ".cts",
  ".jsx",
  ".tsx",
]);

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "coverage",
  ".nyc_output",
  ".next",
  "dist",
  "build",
  "out",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
]);

const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_FILES = 20_000;

/**
 * Classification meanings:
 *
 * verified:
 *   A developer has confirmed the source reference and intended behavior.
 *
 * unverified:
 *   A candidate variable that must be checked against application source.
 *
 * planned:
 *   A documented future capability, not assumed to be implemented.
 *
 * The default registry deliberately contains no verified entries.
 * Promote entries only after inspecting the relevant implementation.
 */
export const ENV_SCHEMA = Object.freeze({
  NODE_ENV: Object.freeze({
    classification: "unverified",
    type: "enum",
    allowed: ["development", "test", "production"],
    required: false,
    description: "Node.js runtime environment.",
  }),

  PORT: Object.freeze({
    classification: "unverified",
    type: "integer",
    min: 1,
    max: 65535,
    required: false,
    description: "Application listening port.",
  }),

  HOST: Object.freeze({
    classification: "unverified",
    type: "string",
    required: false,
    description: "Application bind address.",
  }),

  APP_URL: Object.freeze({
    classification: "unverified",
    type: "url",
    protocols: ["http:", "https:"],
    required: false,
    description: "Canonical application URL.",
  }),

  API_PREFIX: Object.freeze({
    classification: "unverified",
    type: "path",
    required: false,
    description: "Configured API route prefix.",
  }),

  ALLOWED_ORIGINS: Object.freeze({
    classification: "unverified",
    type: "origin-list",
    required: false,
    description: "Potential CORS origin allowlist.",
  }),

  DATABASE_URL: Object.freeze({
    classification: "unverified",
    type: "url",
    protocols: ["mysql:", "mysql2:", "postgres:", "postgresql:"],
    required: false,
    secret: true,
    description: "Potential database connection URL.",
  }),

  DB_CLIENT: Object.freeze({
    classification: "unverified",
    type: "enum",
    allowed: ["mysql", "mysql2", "postgres", "postgresql"],
    required: false,
    description: "Potential database adapter selector.",
  }),

  DB_HOST: Object.freeze({
    classification: "unverified",
    type: "string",
    required: false,
    description: "Potential database hostname.",
  }),

  DB_PORT: Object.freeze({
    classification: "unverified",
    type: "integer",
    min: 1,
    max: 65535,
    required: false,
    description: "Potential database port.",
  }),

  DB_NAME: Object.freeze({
    classification: "unverified",
    type: "string",
    required: false,
    description: "Potential database name.",
  }),

  DB_USER: Object.freeze({
    classification: "unverified",
    type: "string",
    required: false,
    secret: false,
    description: "Potential database username.",
  }),

  DB_PASSWORD: Object.freeze({
    classification: "unverified",
    type: "string",
    required: false,
    secret: true,
    description: "Potential database password.",
  }),

  SESSION_SECRET: Object.freeze({
    classification: "unverified",
    type: "secret",
    minLength: 32,
    required: false,
    secret: true,
    description: "Potential session-signing secret.",
  }),

  JWT_SECRET: Object.freeze({
    classification: "unverified",
    type: "secret",
    minLength: 32,
    required: false,
    secret: true,
    description: "Potential JWT signing secret.",
  }),

  JWT_REFRESH_SECRET: Object.freeze({
    classification: "unverified",
    type: "secret",
    minLength: 32,
    required: false,
    secret: true,
    description: "Potential refresh-token signing secret.",
  }),

  COOKIE_SECURE: Object.freeze({
    classification: "unverified",
    type: "boolean",
    required: false,
    description: "Potential secure-cookie setting.",
  }),

  TRUST_PROXY_HOPS: Object.freeze({
    classification: "unverified",
    type: "integer",
    min: 0,
    max: 32,
    required: false,
    description: "Potential Express proxy-trust setting.",
  }),

  LOG_LEVEL: Object.freeze({
    classification: "unverified",
    type: "enum",
    allowed: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
    required: false,
    description: "Potential application logging level.",
  }),

  AI_API_KEY: Object.freeze({
    classification: "unverified",
    type: "secret",
    required: false,
    secret: true,
    description: "Potential AI provider credential.",
  }),

  SMTP_PASSWORD: Object.freeze({
    classification: "unverified",
    type: "secret",
    required: false,
    secret: true,
    description: "Potential SMTP credential.",
  }),

  PAYMENT_SECRET_KEY: Object.freeze({
    classification: "unverified",
    type: "secret",
    required: false,
    secret: true,
    description: "Potential payment provider credential.",
  }),

  PAYMENT_WEBHOOK_SECRET: Object.freeze({
    classification: "unverified",
    type: "secret",
    required: false,
    secret: true,
    description: "Potential payment webhook signing secret.",
  }),
});

const BOOLEAN_VALUES = new Set(["true", "false"]);

/**
 * Escape text before using it to construct a regular expression.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Determine whether a source file is inside an excluded directory.
 */
function isExcludedDirectory(relativePath) {
  return relativePath
    .split(path.sep)
    .some((segment) => EXCLUDED_DIRECTORIES.has(segment));
}

/**
 * Recursively discover source files.
 *
 * This function intentionally ignores:
 *   - Dependencies and generated output.
 *   - Hidden files and directories.
 *   - Environment files and their contents.
 *
 * Symlinks are not followed.
 */
function discoverSourceFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();

    let entries;

    try {
      entries = fs.readdirSync(currentDir, {
        withFileTypes: true,
      });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (
          entry.name.startsWith(".") ||
          isExcludedDirectory(relativePath)
        ) {
          continue;
        }

        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (entry.name.startsWith(".")) {
        continue;
      }

      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        continue;
      }

      files.push(fullPath);

      if (files.length > MAX_SOURCE_FILES) {
        throw new Error(
          `Source audit exceeded the limit of ${MAX_SOURCE_FILES} files.`,
        );
      }
    }
  }

  return files.sort();
}

/**
 * Identify common static environment-variable references.
 *
 * Recognized patterns include:
 *   process.env.PORT
 *   process.env["PORT"]
 *   process.env['PORT']
 *   process.env.PORT || fallback
 *   import.meta.env.VITE_API_URL
 *   destructuring from process.env
 *
 * Static analysis cannot reliably discover dynamic expressions such as:
 *   process.env[prefix + "_SECRET"]
 *
 * Results must be reviewed manually.
 */
function findEnvironmentReferences(source) {
  const references = new Set();

  const directPatterns = [
    /\bprocess\s*\.\s*env\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    /\bprocess\s*\.\s*env\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g,
    /\bimport\s*\.\s*meta\s*\.\s*env\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    /\bimport\s*\.\s*meta\s*\.\s*env\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g,
  ];

  for (const pattern of directPatterns) {
    for (const match of source.matchAll(pattern)) {
      references.add(match[1]);
    }
  }

  const destructuringPatterns = [
    /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*process\s*\.\s*env\b/g,
    /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*import\s*\.\s*meta\s*\.\s*env\b/g,
  ];

  for (const pattern of destructuringPatterns) {
    for (const match of source.matchAll(pattern)) {
      const members = match[1].split(",");

      for (const member of members) {
        const normalized = member.trim();

        // Handles:
        // PORT
        // PORT: APP_PORT
        // PORT = "3000"
        // PORT: APP_PORT = "3000"
        const keyMatch = normalized.match(
          /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*[A-Za-z_$][A-Za-z0-9_$]*)?(?:\s*=.*)?$/,
        );

        if (keyMatch) {
          references.add(keyMatch[1]);
        }
      }
    }
  }

  return references;
}

/**
 * Read source files and gather static environment references.
 *
 * Only source files are read. No .env file is opened.
 */
export function auditEnvironmentUsage(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? DEFAULT_ROOT);

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new TypeError("rootDir must identify an existing directory.");
  }

  const sourceFiles = discoverSourceFiles(rootDir);
  const usage = new Map();
  const unreadableFiles = [];
  const oversizedFiles = [];

  for (const fullPath of sourceFiles) {
    let stat;

    try {
      stat = fs.statSync(fullPath);
    } catch {
      unreadableFiles.push(path.relative(rootDir, fullPath));
      continue;
    }

    if (stat.size > MAX_SOURCE_FILE_BYTES) {
      oversizedFiles.push(path.relative(rootDir, fullPath));
      continue;
    }

    let source;

    try {
      source = fs.readFileSync(fullPath, "utf8");
    } catch {
      unreadableFiles.push(path.relative(rootDir, fullPath));
      continue;
    }

    const relativePath = path.relative(rootDir, fullPath);
    const variables = findEnvironmentReferences(source);

    for (const variable of variables) {
      if (!usage.has(variable)) {
        usage.set(variable, []);
      }

      usage.get(variable).push(relativePath);
    }
  }

  const sourceReferenced = [...usage.keys()].sort();

  const schemaKeys = Object.keys(ENV_SCHEMA);
  const schemaReferenced = schemaKeys
    .filter((key) => usage.has(key))
    .sort();

  const schemaUnreferenced = schemaKeys
    .filter((key) => !usage.has(key))
    .sort();

  const sourceUndocumented = sourceReferenced
    .filter((key) => !Object.hasOwn(ENV_SCHEMA, key))
    .sort();

  const schemaStatus = Object.fromEntries(
    schemaKeys.map((key) => [
      key,
      usage.has(key)
        ? "referenced-unverified"
        : "not-found-in-static-scan",
    ]),
  );

  return {
    rootDir,
    scannedSourceFiles: sourceFiles.length,
    referencedVariableCount: sourceReferenced.length,
    sourceReferenced,
    sourceUndocumented,
    schemaReferenced,
    schemaUnreferenced,
    schemaStatus,
    usageByVariable: Object.fromEntries(
      [...usage.entries()].map(([key, value]) => [
        key,
        [...value].sort(),
      ]),
    ),
    unreadableFiles,
    oversizedFiles,
    limitations: [
      "A static reference does not prove that a variable is required or correctly implemented.",
      "Dynamic property access may not be discovered.",
      "Aliases, wrappers, configuration loaders, and external packages may require manual inspection.",
      "Comments and unreachable code can produce false-positive references.",
      "This audit does not read .env files or report variable values.",
      "Schema entries remain unverified until a developer reviews their implementation.",
    ],
  };
}

/**
 * Validate a single value against a schema definition.
 *
 * Undefined optional values are accepted.
 * Empty strings are treated as unset for optional configuration.
 */
function validateValue(name, value, rule) {
  if (value === undefined || value === null || value === "") {
    if (rule.required) {
      return `${name} is required.`;
    }

    return null;
  }

  if (typeof value !== "string") {
    return `${name} must be provided as a string.`;
  }

  if (rule.type === "string") {
    if (rule.minLength && value.length < rule.minLength) {
      return `${name} must contain at least ${rule.minLength} characters.`;
    }

    return null;
  }

  if (rule.type === "secret") {
    if (value.length < (rule.minLength ?? 1)) {
      return `${name} does not meet the configured minimum length.`;
    }

    if (/^REPLACE_WITH_/i.test(value)) {
      return `${name} contains an unresolved placeholder.`;
    }

    return null;
  }

  if (rule.type === "boolean") {
    return BOOLEAN_VALUES.has(value.toLowerCase())
      ? null
      : `${name} must be "true" or "false".`;
  }

  if (rule.type === "integer") {
    if (!/^-?\d+$/.test(value)) {
      return `${name} must be an integer.`;
    }

    const number = Number(value);

    if (!Number.isSafeInteger(number)) {
      return `${name} must be a safe integer.`;
    }

    if (rule.min !== undefined && number < rule.min) {
      return `${name} must be at least ${rule.min}.`;
    }

    if (rule.max !== undefined && number > rule.max) {
      return `${name} must be no greater than ${rule.max}.`;
    }

    return null;
  }

  if (rule.type === "enum") {
    return rule.allowed.includes(value)
      ? null
      : `${name} must be one of: ${rule.allowed.join(", ")}.`;
  }

  if (rule.type === "url") {
    let parsed;

    try {
      parsed = new URL(value);
    } catch {
      return `${name} must be a valid URL.`;
    }

    if (
      rule.protocols &&
      !rule.protocols.includes(parsed.protocol)
    ) {
      return `${name} uses an unsupported URL protocol.`;
    }

    if (parsed.username || parsed.password) {
      return `${name} must not embed credentials in its URL.`;
    }

    return null;
  }

  if (rule.type === "path") {
    if (!value.startsWith("/") || value.startsWith("//")) {
      return `${name} must be an absolute URL path beginning with one slash.`;
    }

    if (value.includes("?") || value.includes("#")) {
      return `${name} must not include a query string or fragment.`;
    }

    return null;
  }

  if (rule.type === "origin-list") {
    const origins = value.split(",").map((origin) => origin.trim());

    if (origins.some((origin) => origin.length === 0)) {
      return `${name} contains an empty origin entry.`;
    }

    for (const origin of origins) {
      let parsed;

      try {
        parsed = new URL(origin);
      } catch {
        return `${name} contains an invalid origin URL.`;
      }

      if (!["http:", "https:"].includes(parsed.protocol)) {
        return `${name} contains an unsupported origin protocol.`;
      }

      if (
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      ) {
        return `${name} entries must be origins without paths or credentials.`;
      }
    }

    return null;
  }

  return `No validator is implemented for ${name}'s schema type.`;
}

/**
 * Validate only schema entries explicitly marked "verified".
 *
 * No entry is verified by default. This prevents the framework from
 * enforcing assumptions before the corresponding code is audited.
 *
 * @param {object} options
 * @param {object} [options.env=process.env] Environment to validate.
 * @param {object} [options.schema=ENV_SCHEMA] Schema definitions.
 * @param {boolean} [options.production] Override production detection.
 * @returns {{valid: boolean, errors: string[], checked: string[]}}
 */
export function validateEnvironment(options = {}) {
  const env = options.env ?? process.env;
  const schema = options.schema ?? ENV_SCHEMA;

  const production =
    options.production ?? env.NODE_ENV === "production";

  const errors = [];
  const checked = [];

  for (const [name, rule] of Object.entries(schema)) {
    if (rule.classification !== "verified") {
      continue;
    }

    checked.push(name);

    const errorMessage = validateValue(name, env[name], rule);

    if (errorMessage) {
      errors.push(errorMessage);
    }
  }

  // Do not silently treat empty production credentials as valid.
  // These requirements activate only after the application team
  // explicitly verifies that the corresponding feature is required.
  if (production) {
    for (const [name, rule] of Object.entries(schema)) {
      if (
        rule.classification === "verified" &&
        rule.productionRequired === true &&
        !env[name]
      ) {
        const message = `${name} is required in production.`;

        if (!errors.includes(message)) {
          errors.push(message);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    checked,
  };
}

/**
 * Produce a safe audit summary.
 * Never includes environment-variable values.
 */
export function formatEnvironmentAudit(audit) {
  const lines = [
    "MedOrbits Environment Audit",
    "===========================",
    `Source files scanned: ${audit.scannedSourceFiles}`,
    `Distinct source references: ${audit.referencedVariableCount}`,
    `Schema variables referenced: ${audit.schemaReferenced.length}`,
    `Schema variables not found: ${audit.schemaUnreferenced.length}`,
    `Source variables missing from schema: ${audit.sourceUndocumented.length}`,
    "",
    "Referenced schema variables:",
  ];

  for (const name of audit.schemaReferenced) {
    lines.push(`  [UNVERIFIED] ${name}`);
  }

  lines.push("", "Schema variables not found in static source scan:");

  for (const name of audit.schemaUnreferenced) {
    lines.push(`  [NOT FOUND] ${name}`);
  }

  lines.push("", "Source references missing from schema:");

  for (const name of audit.sourceUndocumented) {
    lines.push(`  [UNDOCUMENTED] ${name}`);
  }

  if (audit.unreadableFiles.length > 0) {
    lines.push("", `Unreadable files: ${audit.unreadableFiles.length}`);
  }

  if (audit.oversizedFiles.length > 0) {
    lines.push("", `Files skipped due to size: ${audit.oversizedFiles.length}`);
  }

  lines.push(
    "",
    "Important: Static references are not proof of implementation.",
    "Review the referenced source before marking schema entries verified.",
  );

  return lines.join("\n");
}

/**
 * CLI usage:
 *
 *   node config/env.schema.js
 *   node config/env.schema.js /path/to/repository
 *
 * The CLI prints names and file counts only, never environment values.
 */
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    const rootDir = process.argv[2]
      ? path.resolve(process.argv[2])
      : DEFAULT_ROOT;

    const audit = auditEnvironmentUsage({ rootDir });

    process.stdout.write(`${formatEnvironmentAudit(audit)}\n`);

    if (
      audit.unreadableFiles.length > 0 ||
      audit.oversizedFiles.length > 0
    ) {
      process.stderr.write(
        "[MedOrbits] WARNING: Some source files could not be fully audited.\n",
      );
    }
  } catch (error) {
    process.stderr.write(
      `[MedOrbits] Environment audit failed: ${error.message}\n`,
    );
    process.exitCode = 1;
  }
}
