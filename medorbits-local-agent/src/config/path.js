
/**
 * MedOrbits Local Agent
 * File: src/config/paths.js
 *
 * Centralized path resolution and repository-boundary protection.
 * Node.js built-ins only.
 */

import fs from "node:fs";
import path from "node:path";
import config from "./env.js";

const AGENT_ROOT = path.resolve(config.paths.agentRoot);
const REPOSITORY_ROOT = path.resolve(
  config.paths.globalRepositoryRoot
);

const PROTECTED_DIRECTORY_NAMES = new Set([
  ".git",
  ".ssh",
  ".aws",
  ".azure",
  ".gnupg",
  "node_modules"
]);

const PROTECTED_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".npmrc",
  ".netrc",
  "id_rsa",
  "id_ed25519",
  "credentials",
  "secrets.json"
]);

const PROTECTED_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".p12",
  ".pfx"
]);

function isWithin(parent, target) {
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

function normalizeInput(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new TypeError("A non-empty relative path is required.");
  }

  if (input.includes("\0")) {
    throw new Error("Null bytes are not allowed in paths.");
  }

  if (path.isAbsolute(input)) {
    throw new Error("Absolute paths are not accepted.");
  }

  const normalized = path.normalize(input);

  if (
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    throw new Error("Path traversal is not allowed.");
  }

  return normalized;
}

function isProtectedPath(relativePath) {
  const parts = relativePath
    .split(path.sep)
    .filter(Boolean);

  for (const part of parts) {
    if (PROTECTED_DIRECTORY_NAMES.has(part)) {
      return true;
    }

    if (PROTECTED_FILE_NAMES.has(part)) {
      return true;
    }

    if (part.startsWith(".env.")) {
      return true;
    }

    if (PROTECTED_EXTENSIONS.has(path.extname(part).toLowerCase())) {
      return true;
    }
  }

  return false;
}

function assertRepositoryExists() {
  if (!fs.existsSync(REPOSITORY_ROOT)) {
    throw new Error(
      `Repository root does not exist: ${REPOSITORY_ROOT}`
    );
  }

  const realRoot = fs.realpathSync(REPOSITORY_ROOT);

  if (realRoot !== REPOSITORY_ROOT) {
    throw new Error(
      "Repository root resolves through a symbolic link. " +
      "Configure a canonical repository path."
    );
  }

  return realRoot;
}

/**
 * Resolve a path inside the parent MedOrbits repository.
 *
 * This function does not read or modify the target.
 * Symbolic links are checked to prevent escaping the repository.
 */
export function resolveRepositoryPath(input, options = {}) {
  const {
    allowProtected = false,
    mustExist = false,
    expectedType = "any"
  } = options;

  const root = assertRepositoryExists();
  const relative = normalizeInput(input);

  if (!allowProtected && isProtectedPath(relative)) {
    throw new Error("Access to this protected path is denied.");
  }

  const candidate = path.resolve(root, relative);

  if (!isWithin(root, candidate)) {
    throw new Error("Path is outside the repository root.");
  }

  if (mustExist && !fs.existsSync(candidate)) {
    throw new Error(`Path does not exist: ${relative}`);
  }

  if (fs.existsSync(candidate)) {
    const realCandidate = fs.realpathSync(candidate);

    if (!isWithin(root, realCandidate)) {
      throw new Error(
        "Symbolic link resolves outside the repository root."
      );
    }

    if (!allowProtected && isProtectedPath(path.relative(root, realCandidate))) {
      throw new Error("Resolved path is protected.");
    }

    const stats = fs.statSync(realCandidate);

    if (expectedType === "file" && !stats.isFile()) {
      throw new Error("Expected a file path.");
    }

    if (expectedType === "directory" && !stats.isDirectory()) {
      throw new Error("Expected a directory path.");
    }

    return realCandidate;
  }

  if (expectedType !== "any") {
    throw new Error(
      "Cannot verify the type of a path that does not exist."
    );
  }

  return candidate;
}

/**
 * Resolve an agent-owned path, such as a report destination.
 */
export function resolveAgentPath(input, options = {}) {
  const {
    mustExist = false,
    expectedType = "any"
  } = options;

  const relative = normalizeInput(input);
  const candidate = path.resolve(AGENT_ROOT, relative);

  if (!isWithin(AGENT_ROOT, candidate)) {
    throw new Error("Path is outside the local-agent directory.");
  }

  if (isProtectedPath(relative)) {
    throw new Error("Access to this protected path is denied.");
  }

  if (mustExist && !fs.existsSync(candidate)) {
    throw new Error(`Path does not exist: ${relative}`);
  }

  if (fs.existsSync(candidate)) {
    const realCandidate = fs.realpathSync(candidate);

    if (!isWithin(AGENT_ROOT, realCandidate)) {
      throw new Error(
        "Symbolic link resolves outside the local-agent directory."
      );
    }

    if (isProtectedPath(path.relative(AGENT_ROOT, realCandidate))) {
      throw new Error("Resolved path is protected.");
    }

    const stats = fs.statSync(realCandidate);

    if (expectedType === "file" && !stats.isFile()) {
      throw new Error("Expected a file path.");
    }

    if (expectedType === "directory" && !stats.isDirectory()) {
      throw new Error("Expected a directory path.");
    }

    return realCandidate;
  }

  if (expectedType !== "any") {
    throw new Error(
      "Cannot verify the type of a path that does not exist."
    );
  }

  return candidate;
}

export function getRepositoryRoot() {
  return assertRepositoryExists();
}

export function getAgentRoot() {
  return AGENT_ROOT;
}

export function isRepositoryPath(input) {
  try {
    resolveRepositoryPath(input);
    return true;
  } catch {
    return false;
  }
}

export function isProtectedRepositoryPath(input) {
  try {
    return isProtectedPath(normalizeInput(input));
  } catch {
    return true;
  }
}

export default {
  resolveRepositoryPath,
  resolveAgentPath,
  getRepositoryRoot,
  getAgentRoot,
  isRepositoryPath,
  isProtectedRepositoryPath
};
