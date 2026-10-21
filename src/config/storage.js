
'use strict';

/**
 * MedOrbits -- Storage Configuration
 * File: src/config/storage.js
 *
 * Responsibilities:
 * - Resolve private and temporary storage paths.
 * - Validate storage directory boundaries.
 * - Create local storage directories securely.
 * - Expose validated upload limits and MIME types.
 *
 * Notes:
 * - This module does not implement file uploads.
 * - Uploaded file contents must still be validated by the upload service.
 * - Local storage should remain outside the public web root.
 * - Filesystem permissions do not replace application-level authorization.
 */

const fs = require('node:fs');
const path = require('node:path');
const { env } = require('./env');

const projectRoot = path.resolve(__dirname, '..', '..');
const publicRoot = path.join(projectRoot, 'public');

const STORAGE_DIRECTORY_MODE = 0o700;
const DEFAULT_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const MAX_FILES_LIMIT = 1000;
const MAX_UPLOAD_SIZE_MB = 1024 * 1024;

function resolveStoragePath(configuredPath, variableName) {
  if (
    typeof configuredPath !== 'string' ||
    configuredPath.trim() === ''
  ) {
    throw new Error(
      `${variableName} must be a non-empty path.`
    );
  }

  const trimmedPath = configuredPath.trim();

  if (
    trimmedPath.includes('\0') ||
    /[\u0001-\u001F\u007F]/.test(trimmedPath)
  ) {
    throw new Error(
      `${variableName} contains invalid characters.`
    );
  }

  return path.resolve(projectRoot, trimmedPath);
}

const privateStoragePath = resolveStoragePath(
  env.STORAGE_LOCAL_PATH,
  'STORAGE_LOCAL_PATH'
);

const temporaryStoragePath = resolveStoragePath(
  env.STORAGE_TEMP_PATH,
  'STORAGE_TEMP_PATH'
);

function isInsideDirectory(targetPath, directoryPath) {
  const relativePath = path.relative(
    path.resolve(directoryPath),
    path.resolve(targetPath)
  );

  return (
    relativePath === '' ||
    (
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    )
  );
}

function assertStoragePathsAreSafe() {
  if (privateStoragePath === temporaryStoragePath) {
    throw new Error(
      'Private and temporary storage must use separate directories.'
    );
  }

  if (
    isInsideDirectory(privateStoragePath, publicRoot) ||
    isInsideDirectory(temporaryStoragePath, publicRoot)
  ) {
    throw new Error(
      'Private and temporary storage must not be located inside public/.'
    );
  }

  if (
    isInsideDirectory(temporaryStoragePath, privateStoragePath) ||
    isInsideDirectory(privateStoragePath, temporaryStoragePath)
  ) {
    throw new Error(
      'Private and temporary storage directories must not overlap.'
    );
  }
}

/**
 * Reject symbolic links in existing path components.
 * Missing components are permitted because they may be created later.
 */
function assertNoSymlinkInExistingPath(targetPath) {
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
      if (error.code === 'ENOENT') {
        break;
      }

      throw error;
    }

    if (stat.isSymbolicLink()) {
      throw new Error(
        'Storage paths must not contain symbolic links.'
      );
    }

    if (!stat.isDirectory()) {
      throw new Error(
        'A storage path component is not a directory.'
      );
    }
  }
}

function ensureDirectory(directoryPath) {
  assertNoSymlinkInExistingPath(directoryPath);

  fs.mkdirSync(directoryPath, {
    recursive: true,
    mode: STORAGE_DIRECTORY_MODE,
  });

  const stat = fs.lstatSync(directoryPath);

  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(
      'Storage path is not a real directory.'
    );
  }

  // Restrict permissions on POSIX systems, including existing directories.
  if (process.platform !== 'win32') {
    fs.chmodSync(directoryPath, STORAGE_DIRECTORY_MODE);
  }

  // Recheck after creation to detect unexpected path changes.
  assertNoSymlinkInExistingPath(directoryPath);
}

function ensureLocalStorage() {
  if (env.STORAGE_DRIVER !== 'local') {
    return;
  }

  assertStoragePathsAreSafe();

  ensureDirectory(privateStoragePath);
  ensureDirectory(temporaryStoragePath);
}

function getAllowedMimeTypes() {
  const configuredTypes = env.UPLOAD_ALLOWED_MIME_TYPES;

  if (
    typeof configuredTypes !== 'string' ||
    configuredTypes.trim() === ''
  ) {
    return [...DEFAULT_MIME_TYPES];
  }

  const types = configuredTypes
    .split(',')
    .map((type) => type.trim().toLowerCase());

  if (types.some((type) => !type)) {
    throw new Error(
      'UPLOAD_ALLOWED_MIME_TYPES contains an empty MIME type.'
    );
  }

  for (const type of types) {
    // Accept conventional MIME type/subtype values, not wildcards.
    if (
      type.includes('*') ||
      !/^[a-z0-9!#$&^.+-]+\/[a-z0-9!#$&^.+-]+$/.test(type)
    ) {
      throw new Error(
        `Invalid upload MIME type configured: ${type}`
      );
    }
  }

  const uniqueTypes = [...new Set(types)];

  if (uniqueTypes.length === 0) {
    throw new Error(
      'At least one upload MIME type must be configured.'
    );
  }

  return uniqueTypes;
}

function validatePositiveInteger(
  value,
  variableName,
  max = Number.MAX_SAFE_INTEGER
) {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > max
  ) {
    throw new Error(
      `${variableName} must be a positive safe integer not exceeding ${max}.`
    );
  }

  return value;
}

function getUploadLimits() {
  const maxFileSizeMB = validatePositiveInteger(
    env.UPLOAD_MAX_FILE_SIZE_MB,
    'UPLOAD_MAX_FILE_SIZE_MB',
    MAX_UPLOAD_SIZE_MB
  );

  const maxFiles = validatePositiveInteger(
    env.UPLOAD_MAX_FILES,
    'UPLOAD_MAX_FILES',
    MAX_FILES_LIMIT
  );

  const maxTotalSizeMB = validatePositiveInteger(
    env.UPLOAD_MAX_TOTAL_SIZE_MB,
    'UPLOAD_MAX_TOTAL_SIZE_MB',
    MAX_UPLOAD_SIZE_MB
  );

  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
  const maxTotalSizeBytes = maxTotalSizeMB * 1024 * 1024;

  if (
    !Number.isSafeInteger(maxFileSizeBytes) ||
    !Number.isSafeInteger(maxTotalSizeBytes)
  ) {
    throw new Error(
      'Configured upload size exceeds the safe integer range.'
    );
  }

  if (maxFileSizeBytes > maxTotalSizeBytes) {
    throw new Error(
      'UPLOAD_MAX_FILE_SIZE_MB cannot exceed UPLOAD_MAX_TOTAL_SIZE_MB.'
    );
  }

  return Object.freeze({
    maxFileSizeBytes,
    maxFiles,
    maxTotalSizeBytes,
    allowedMimeTypes: Object.freeze(getAllowedMimeTypes()),
  });
}

module.exports = {
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
};
