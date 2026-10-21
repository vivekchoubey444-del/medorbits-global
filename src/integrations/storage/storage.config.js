
'use strict';

/**
 * MedOrbits -- Storage Configuration
 *
 * File: src/config/storage.config.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Validate local and S3-compatible storage configuration.
 * - Enforce upload-size limits.
 * - Normalize private storage paths and object prefixes.
 * - Validate endpoint URLs and transport security.
 * - Return immutable configuration.
 *
 * This module does not create directories, connect to S3,
 * upload files, or expose stored files publicly.
 */

const path = require('node:path');

const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024 * 1024;

const DEFAULT_S3_REGION = 'ap-south-1';
const DEFAULT_S3_PREFIX = 'private/';

const ALLOWED_DRIVERS = new Set(['local', 's3']);

function parsePositiveInteger(
  value,
  variableName,
  fallback,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    parsed > maximum
  ) {
    throw new Error(
      `${variableName} must be a positive integer not exceeding ${maximum}.`,
    );
  }

  return parsed;
}

function parseBoolean(value, variableName, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`${variableName} must be true or false.`);
  }

  switch (value.trim().toLowerCase()) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      throw new Error(`${variableName} must be true or false.`);
  }
}

function readString(value, variableName, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new Error(`${variableName} must be a string.`);
  }

  if (value.includes('\0')) {
    throw new Error(`${variableName} contains an invalid character.`);
  }

  return value.trim();
}

function normalizePrefix(value) {
  if (typeof value !== 'string' || value.includes('\0')) {
    throw new Error('S3_PREFIX must be a valid string.');
  }

  const prefix = value.trim().replace(/^\/+|\/+$/gu, '');

  if (!prefix) {
    return '';
  }

  const segments = prefix.split('/');

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        !/^[a-zA-Z0-9_-]+$/u.test(segment),
    )
  ) {
    throw new Error(
      'S3_PREFIX contains an invalid path segment.',
    );
  }

  return `${segments.join('/')}/`;
}

function validateEndpoint(value, options = {}) {
  const { production = false } = options;

  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error('S3_ENDPOINT must be a valid URL.');
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error('S3_ENDPOINT must be a valid URL.');
  }

  if (
    !['https:', 'http:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      'S3_ENDPOINT must be an HTTP(S) URL without credentials, query, or fragment.',
    );
  }

  if (production && parsed.protocol !== 'https:') {
    throw new Error(
      'S3_ENDPOINT must use HTTPS in production.',
    );
  }

  if (
    parsed.pathname.split('/').some(
      (segment) => segment === '.' || segment === '..',
    )
  ) {
    throw new Error(
      'S3_ENDPOINT must not contain traversal path segments.',
    );
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/u, '')}`;
}

function validateBucketName(bucket, endpointProvided) {
  if (!bucket) {
    return '';
  }

  if (
    bucket.length > 255 ||
    /[\s/\\?#\0]/u.test(bucket)
  ) {
    throw new Error('S3_BUCKET contains invalid characters.');
  }

  // S3-compatible providers may use non-AWS bucket naming rules.
  // Enforce strict AWS-style names when using the standard AWS endpoint.
  if (!endpointProvided) {
    const validAwsBucket =
      bucket.length >= 3 &&
      bucket.length <= 63 &&
      /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/u.test(bucket) &&
      !bucket.includes('..') &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(bucket) &&
      !bucket.includes('.-') &&
      !bucket.includes('-.');

    if (!validAwsBucket) {
      throw new Error(
        'S3_BUCKET is not a valid AWS S3 bucket name.',
      );
    }
  }

  return bucket;
}

function loadStorageConfig(env = process.env) {
  if (
    !env ||
    typeof env !== 'object' ||
    Array.isArray(env)
  ) {
    throw new TypeError(
      'Storage environment configuration is required.',
    );
  }

  const nodeEnv = readString(
    env.NODE_ENV,
    'NODE_ENV',
    'development',
  ).toLowerCase();

  const production = nodeEnv === 'production';

  const driver = readString(
    env.STORAGE_DRIVER,
    'STORAGE_DRIVER',
    'local',
  ).toLowerCase();

  if (!ALLOWED_DRIVERS.has(driver)) {
    throw new Error('STORAGE_DRIVER must be local or s3.');
  }

  const rootValue = readString(
    env.STORAGE_LOCAL_ROOT,
    'STORAGE_LOCAL_ROOT',
    path.join('storage', 'private'),
  );

  if (!rootValue) {
    throw new Error(
      'STORAGE_LOCAL_ROOT must not be empty.',
    );
  }

  const maxFileBytes = parsePositiveInteger(
    env.STORAGE_MAX_FILE_BYTES,
    'STORAGE_MAX_FILE_BYTES',
    DEFAULT_MAX_FILE_BYTES,
    MAX_FILE_BYTES,
  );

  const region = readString(
    env.S3_REGION,
    'S3_REGION',
    DEFAULT_S3_REGION,
  );

  const rawBucket = readString(
    env.S3_BUCKET,
    'S3_BUCKET',
    '',
  );

  const rawEndpoint = readString(
    env.S3_ENDPOINT,
    'S3_ENDPOINT',
    '',
  );

  const endpoint = validateEndpoint(rawEndpoint, {
    production,
  });

  const bucket = validateBucketName(
    rawBucket,
    Boolean(endpoint),
  );

  if (!region) {
    throw new Error('S3_REGION must not be empty.');
  }

  if (driver === 's3' && !bucket) {
    throw new Error(
      'S3_BUCKET is required when STORAGE_DRIVER=s3.',
    );
  }

  const forcePathStyle = parseBoolean(
    env.S3_FORCE_PATH_STYLE,
    'S3_FORCE_PATH_STYLE',
    false,
  );

  const prefix = normalizePrefix(
    env.S3_PREFIX === undefined
      ? DEFAULT_S3_PREFIX
      : env.S3_PREFIX,
  );

  if (driver === 's3' && production && endpoint) {
    const endpointUrl = new URL(endpoint);

    if (endpointUrl.protocol !== 'https:') {
      throw new Error(
        'Custom S3 endpoints must use HTTPS in production.',
      );
    }
  }

  const localConfig = Object.freeze({
    root: path.resolve(rootValue),
  });

  const s3Config = Object.freeze({
    region,
    bucket,
    endpoint,
    forcePathStyle,
    prefix,
    serverSideEncryption: 'AES256',
  });

  return Object.freeze({
    driver,
    root: localConfig.root,
    maxFileBytes,
    local: localConfig,
    s3: s3Config,
  });
}

module.exports = {
  loadStorageConfig,
  parsePositiveInteger,
  parseBoolean,
  normalizePrefix,
  validateEndpoint,
  validateBucketName,
  DEFAULT_MAX_FILE_BYTES,
  MAX_FILE_BYTES,
  DEFAULT_S3_REGION,
  DEFAULT_S3_PREFIX,
};
