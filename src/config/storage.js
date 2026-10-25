
/**
 * MedOrbits -- Storage Configuration
 * File: src/config/storage.js
 *
 * Responsibilities:
 * - Resolve private and temporary storage paths.
 * - Validate storage directory boundaries.
 * - Create local storage directories with restrictive permissions.
 * - Reject symbolic links in existing path components.
 * - Expose validated upload limits and allowed MIME types.
 *
 * Dependencies: Node.js built-ins only.
 *
 * IMPORTANT:
 * - Local storage must remain outside public/.
 * - This module does not implement file uploads.
 * - Upload services must validate file contents, not just MIME headers.
 * - Filesystem permissions do not replace application authorization.
 * - For distributed deployments, consider private object storage.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..", "..");
export const publicRoot = path.resolve(projectRoot, "public");

const STORAGE_DIRECTORY_MODE = 0o700;
const MAX_FILES_LIMIT = 1_000;
const MAX_UPLOAD_SIZE_MB = 1_024;

const DEFAULT_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const DEFAULT_MAX_FILE_SIZE_MB = 25;
const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_TOTAL_SIZE_MB = 100;

function isWindowsAbsolutePath(value) {
  return path.win32.isAbsolute(value);
}

/**
 * Resolve a configured storage path relative to the project root.
 * Absolute paths are permitted, allowing mounted persistent disks.
 */
function resolveStoragePath(configuredPath, variableName) {
  if (
    typeof configuredPath !== "string" ||
    configuredPath.trim() === ""
  ) {
    throw new TypeError(`${variableName} must be a non-empty path.`);
  }

  const value = configuredPath.trim();

  if (/[\u0000-\u001F\u007F]/.test(value)) {
    throw new TypeError(`${variableName} contains invalid characters.`);
  }

  // Avoid accidentally interpreting a Windows absolute path as a relative
  // path when this service is running on a POSIX platform.
  if (process.platform !== "win32" && isWindowsAbsolutePath(value)) {
    throw new TypeError(
      `${variableName} must use a path format supported by this operating system.`
    );
  }

  return path.resolve(projectRoot, value);
}

export const privateStoragePath = resolveStoragePath(
  env.STORAGE_LOCAL_PATH,
  "STORAGE_LOCAL_PATH"
);

export const temporaryStoragePath = resolveStoragePath(
  env.STORAGE_TEMP_PATH,
  "STORAGE_TEMP_PATH"
);

/**
 * Return true when targetPath is the same as, or a descendant of,
 * directoryPath. Uses path-relative checks rather than string prefixes.
 */
export function isInsideDirectory(targetPath, directoryPath) {
  const target = path.resolve(targetPath);
  const directory = path.resolve(directoryPath);
  const relativePath = path.relative(directory, target);

  return (
    relativePath === "" ||
    (
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    )
  );
}

function pathsOverlap(firstPath, secondPath) {
  return (
    isInsideDirectory(firstPath, secondPath) ||
    isInsideDirectory(secondPath, firstPath)
  );
}

export function assertStoragePathsAreSafe() {
  if (privateStoragePath === temporaryStoragePath) {
    throw new Error(
      "Private and temporary storage must use separate directories."
    );
  }

  if (
    pathsOverlap(privateStoragePath, publicRoot) ||
    pathsOverlap(temporaryStoragePath, publicRoot)
  ) {
    throw new Error(
      "Private and temporary storage must not be located inside public/ or overlap it."
    );
  }

  if (pathsOverlap(temporaryStoragePath, privateStoragePath)) {
    throw new Error(
      "Private and temporary storage directories must not overlap."
    );
  }

  return true;
}

/**
 * Reject symbolic links in existing components of the target path.
 *
 * Missing components are allowed because they may be created later.
 * This is a defensive check, not a complete defense against filesystem
 * race conditions if an attacker can modify parent directories concurrently.
 */
export function assertNoSymlinkInExistingPath(targetPath) {
  if (typeof targetPath !== "string" || targetPath.trim() === "") {
    throw new TypeError("Storage path must be a non-empty string.");
  }

  const absolutePath = path.resolve(targetPath);
  const parsedPath = path.parse(absolutePath);
  const segments = absolutePath
    .slice(parsedPath.root.length)
    .split(path.sep)
    .filter(Boolean);

  let currentPath = parsedPath.root;

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);

    let stat;

    try {
      stat = fs.lstatSync(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        // The remaining path cannot currently exist beneath this missing
        // component. Recheck after directory creation.
        break;
      }

      throw error;
    }

    if (stat.isSymbolicLink()) {
      throw new Error(
        "Storage paths must not contain symbolic links."
      );
    }

    if (!stat.isDirectory()) {
      throw new Error(
        "A storage path component is not a directory."
      );
    }
  }

  return true;
}

/**
 * Create and verify a storage directory.
 *
 * POSIX permissions are restricted to the owner. On Windows, filesystem
 * ACLs must be managed through operating-system or deployment controls.
 */
function ensureDirectory(directoryPath) {
  assertNoSymlinkInExistingPath(directoryPath);

  fs.mkdirSync(directoryPath, {
    recursive: true,
    mode: STORAGE_DIRECTORY_MODE,
  });

  const stat = fs.lstatSync(directoryPath);

  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("Storage path is not a real directory.");
  }

  if (process.platform !== "win32") {
    fs.chmodSync(directoryPath, STORAGE_DIRECTORY_MODE);
  }

  // Recheck after creation and permission changes.
  assertNoSymlinkInExistingPath(directoryPath);

  const finalStat = fs.lstatSync(directoryPath);

  if (finalStat.isSymbolicLink() || !finalStat.isDirectory()) {
    throw new Error(
      "Storage directory verification failed."
    );
  }
}

/**
 * Initialize local storage when the selected driver is "local".
 * For cloud/object storage, local directories are not created.
 */
export function ensureLocalStorage() {
  if (env.STORAGE_DRIVER !== "local") {
    return false;
  }

  assertStoragePathsAreSafe();

  ensureDirectory(privateStoragePath);
  ensureDirectory(temporaryStoragePath);

  return true;
}

function normalizeMimeType(value) {
  if (typeof value !== "string") {
    throw new TypeError("Upload MIME types must be strings.");
  }

  const type = value.trim().toLowerCase();

  if (
    type === "" ||
    type.includes("*") ||
    !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(type)
  ) {
    throw new TypeError("Invalid upload MIME type configured.");
  }

  return type;
}

/**
 * UPLOAD_ALLOWED_MIME_TYPES may be a comma-separated string or an array.
 * If absent or empty, use the secure default allowlist.
 */
export function getAllowedMimeTypes() {
  const configuredTypes = env.UPLOAD_ALLOWED_MIME_TYPES;

  if (
    configuredTypes === undefined ||
    configuredTypes === null ||
    configuredTypes === ""
  ) {
    return [...DEFAULT_MIME_TYPES];
  }

  let values;

  if (Array.isArray(configuredTypes)) {
    values = configuredTypes;
  } else if (typeof configuredTypes === "string") {
    if (configuredTypes.trim() === "") {
      return [...DEFAULT_MIME_TYPES];
    }

    values = configuredTypes.split(",");
  } else {
    throw new TypeError(
      "UPLOAD_ALLOWED_MIME_TYPES must be a string or an array."
    );
  }

  if (values.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new TypeError(
      "UPLOAD_ALLOWED_MIME_TYPES contains an empty or invalid MIME type."
    );
  }

  const uniqueTypes = [
    ...new Set(values.map(normalizeMimeType)),
  ];

  if (uniqueTypes.length === 0) {
    throw new Error(
      "At least one upload MIME type must be configured."
    );
  }

  return uniqueTypes;
}

function validatePositiveInteger(value, variableName, max) {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > max
  ) {
    throw new RangeError(
      `${variableName} must be a positive integer not exceeding ${max}.`
    );
  }

  return value;
}

function getConfiguredLimit(value, fallback, variableName, max) {
  // Support an absent value while keeping explicit invalid values an error.
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return validatePositiveInteger(value, variableName, max);
}

/**
 * Return immutable upload limits in bytes and the MIME allowlist.
 * Values are read from env and validated each time this function is called.
 */
export function getUploadLimits() {
  const maxFileSizeMB = getConfiguredLimit(
    env.UPLOAD_MAX_FILE_SIZE_MB,
    DEFAULT_MAX_FILE_SIZE_MB,
    "UPLOAD_MAX_FILE_SIZE_MB",
    MAX_UPLOAD_SIZE_MB
  );

  const maxFiles = getConfiguredLimit(
    env.UPLOAD_MAX_FILES,
    DEFAULT_MAX_FILES,
    "UPLOAD_MAX_FILES",
    MAX_FILES_LIMIT
  );

  const maxTotalSizeMB = getConfiguredLimit(
    env.UPLOAD_MAX_TOTAL_SIZE_MB,
    DEFAULT_MAX_TOTAL_SIZE_MB,
    "UPLOAD_MAX_TOTAL_SIZE_MB",
    MAX_UPLOAD_SIZE_MB
  );

  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
  const maxTotalSizeBytes = maxTotalSizeMB * 1024 * 1024;

  if (
    !Number.isSafeInteger(maxFileSizeBytes) ||
    !Number.isSafeInteger(maxTotalSizeBytes)
  ) {
    throw new RangeError(
      "Configured upload size exceeds the safe integer range."
    );
  }

  if (maxFileSizeBytes > maxTotalSizeBytes) {
    throw new Error(
      "UPLOAD_MAX_FILE_SIZE_MB cannot exceed UPLOAD_MAX_TOTAL_SIZE_MB."
    );
  }

  return Object.freeze({
    maxFileSizeBytes,
    maxFiles,
    maxTotalSizeBytes,
    allowedMimeTypes: Object.freeze(getAllowedMimeTypes()),
  });
}

const storageConfig = Object.freeze({
  projectRoot,
  publicRoot,
  privateStoragePath,
  temporaryStoragePath,
  isInsideDirectory,
  assertStoragePathsAreSafe,
  assertNoSymlinkInExistingPath,
  ensureLocalStorage,
  getAllowedMimeTypes,
  getUploadLimits,
});

export default storageConfig;
