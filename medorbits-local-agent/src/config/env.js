
/**
 * MedOrbits Local Agent
 * File: src/config/env.js
 *
 * Central configuration loader.
 * Uses Node.js built-in modules only.
 */

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

const AGENT_ROOT = path.resolve(MODULE_DIR, "../..");
const GLOBAL_REPOSITORY_ROOT = path.resolve(AGENT_ROOT, "..");

function readString(name, fallback, options = {}) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : raw.trim();

  if (options.required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (options.allowed && !options.allowed.includes(value)) {
    throw new Error(
      `Invalid ${name}. Allowed values: ${options.allowed.join(", ")}`
    );
  }

  return value;
}

function readInteger(name, fallback, min, max) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`${name} must be an integer.`);
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }

  return value;
}

function readBoolean(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const value = raw.trim().toLowerCase();

  if (["true", "1", "yes"].includes(value)) {
    return true;
  }

  if (["false", "0", "no"].includes(value)) {
    return false;
  }

  throw new Error(`${name} must be true or false.`);
}

function readLocalUrl(name, fallback) {
  const raw = readString(name, fallback);

  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }

  if (url.username || url.password) {
    throw new Error(`${name} must not contain embedded credentials.`);
  }

  return url;
}

const mode = readString("AGENT_MODE", "readonly", {
  allowed: ["readonly", "approval"]
});

const host = readString("AGENT_HOST", "127.0.0.1");

if (!["127.0.0.1", "::1", "localhost"].includes(host)) {
  throw new Error(
    "AGENT_HOST must be localhost, 127.0.0.1 or ::1."
  );
}

const ollamaUrl = readLocalUrl(
  "OLLAMA_BASE_URL",
  "http://127.0.0.1:11434"
);

if (
  !["localhost", "127.0.0.1", "::1"].includes(
    ollamaUrl.hostname.toLowerCase()
  )
) {
  throw new Error(
    "OLLAMA_BASE_URL must point to a local Ollama instance."
  );
}

const reportDirectory = path.resolve(
  AGENT_ROOT,
  readString("AGENT_REPORT_DIR", "reports")
);

function isInside(parent, target) {
  const relative = path.relative(parent, target);

  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

if (!isInside(AGENT_ROOT, reportDirectory)) {
  throw new Error(
    "AGENT_REPORT_DIR must remain inside the local-agent directory."
  );
}

const config = {
  app: {
    name: "MedOrbits Local Agent",
    environment: readString("NODE_ENV", "development"),
    mode,
    version: "1.0.0"
  },

  server: {
    host,
    port: readInteger("AGENT_PORT", 3035, 1, 65535)
  },

  paths: {
    agentRoot: AGENT_ROOT,
    globalRepositoryRoot: GLOBAL_REPOSITORY_ROOT,
    reportDirectory
  },

  ollama: {
    baseUrl: ollamaUrl.origin,
    model: readString("OLLAMA_MODEL", "qwen2.5-coder:7b"),
    timeoutMs: readInteger(
      "OLLAMA_TIMEOUT_MS",
      120000,
      1000,
      600000
    )
  },

  safety: {
    readOnly: mode === "readonly",
    requireApproval: true,
    allowShellExecution: false,
    allowAutomaticGitChanges: false,
    allowAutomaticDeployment: false,
    allowExternalNetwork: false,
    allowFileWrites: mode === "approval",
    maxFileBytes: readInteger(
      "AGENT_MAX_FILE_BYTES",
      1048576,
      1024,
      10485760
    )
  },

  logging: {
    level: readString("AGENT_LOG_LEVEL", "info", {
      allowed: ["debug", "info", "warn", "error"]
    })
  },

  features: {
    repositoryInspection: true,
    routeInspection: true,
    diffPreview: true,
    automaticFileModification: false
  }
};

export function getConfig() {
  return config;
}

export default config;
