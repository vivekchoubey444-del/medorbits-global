
'use strict';

/**
 * MedOrbits -- Cryptographic Utilities
 *
 * File: src/utils/crypto.js
 * Runtime: Node.js >= 20
 *
 * Provides:
 * - Cryptographically secure random tokens.
 * - SHA-256 digests.
 * - HMAC-SHA-256 signatures.
 * - Timing-safe comparisons.
 * - Scrypt password hashing and verification.
 *
 * Security:
 * - Never store plaintext passwords or raw reset tokens.
 * - Use independent secrets for different HMAC purposes.
 * - Store secrets in environment variables or a secret manager.
 * - Never accept scrypt resource parameters directly from untrusted input.
 */

const nodeCrypto = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(nodeCrypto.scrypt);

const DEFAULT_TOKEN_BYTES = 32;
const DEFAULT_SCRYPT_KEY_LENGTH = 64;
const DEFAULT_SCRYPT_COST = 16384;
const DEFAULT_SCRYPT_BLOCK_SIZE = 8;
const DEFAULT_SCRYPT_PARALLELIZATION = 1;
const DEFAULT_SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const DEFAULT_SALT_LENGTH = 16;

const MIN_TOKEN_BYTES = 16;
const MAX_TOKEN_BYTES = 1024;
const MAX_PASSWORD_BYTES = 1024;
const MAX_HMAC_SECRET_BYTES = 4096;

const SCRYPT_FORMAT = 'scrypt';
const SCRYPT_FORMAT_VERSION = '1';

function assertString(value, name) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string.`);
  }
}

function randomToken(bytes = DEFAULT_TOKEN_BYTES) {
  if (
    !Number.isSafeInteger(bytes) ||
    bytes < MIN_TOKEN_BYTES ||
    bytes > MAX_TOKEN_BYTES
  ) {
    throw new RangeError(
      `Token byte length must be between ${MIN_TOKEN_BYTES} and ${MAX_TOKEN_BYTES}.`,
    );
  }

  return nodeCrypto.randomBytes(bytes).toString('base64url');
}

function sha256(value) {
  assertString(value, 'Hash input');

  return nodeCrypto
    .createHash('sha256')
    .update(value, 'utf8')
    .digest('hex');
}

function hmacSha256(value, secret) {
  assertString(value, 'HMAC input');
  assertString(secret, 'HMAC secret');

  if (
    Buffer.byteLength(secret, 'utf8') === 0 ||
    Buffer.byteLength(secret, 'utf8') > MAX_HMAC_SECRET_BYTES
  ) {
    throw new RangeError(
      `HMAC secret must be between 1 and ${MAX_HMAC_SECRET_BYTES} bytes.`,
    );
  }

  return nodeCrypto
    .createHmac('sha256', secret)
    .update(value, 'utf8')
    .digest('hex');
}

/**
 * Compares UTF-8 strings without leaking content-dependent timing
 * through the final equality comparison.
 *
 * Different-length inputs return false immediately because
 * timingSafeEqual requires equal-length buffers.
 */
function safeEqual(left, right) {
  if (
    typeof left !== 'string' ||
    typeof right !== 'string'
  ) {
    return false;
  }

  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return nodeCrypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidPasswordInput(password) {
  return (
    typeof password === 'string' &&
    password.length > 0 &&
    Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES
  );
}

async function derivePasswordKey(password, salt) {
  return scryptAsync(
    password,
    salt,
    DEFAULT_SCRYPT_KEY_LENGTH,
    {
      N: DEFAULT_SCRYPT_COST,
      r: DEFAULT_SCRYPT_BLOCK_SIZE,
      p: DEFAULT_SCRYPT_PARALLELIZATION,
      maxmem: DEFAULT_SCRYPT_MAX_MEMORY,
    },
  );
}

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('A non-empty password is required.');
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new RangeError(
      'Password exceeds the maximum supported byte length.',
    );
  }

  const salt = nodeCrypto.randomBytes(DEFAULT_SALT_LENGTH);
  const derivedKey = await derivePasswordKey(password, salt);

  return [
    SCRYPT_FORMAT,
    SCRYPT_FORMAT_VERSION,
    DEFAULT_SCRYPT_COST,
    DEFAULT_SCRYPT_BLOCK_SIZE,
    DEFAULT_SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    Buffer.from(derivedKey).toString('base64url'),
  ].join('$');
}

function decodeBase64UrlStrict(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, 'base64url');

    if (
      decoded.length === 0 ||
      decoded.toString('base64url') !== value
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

async function verifyPassword(password, storedHash) {
  if (
    !isValidPasswordInput(password) ||
    typeof storedHash !== 'string'
  ) {
    return false;
  }

  const parts = storedHash.split('$');

  // Format: scrypt$1$N$r$p$salt$derivedKey
  if (
    parts.length !== 7 ||
    parts[0] !== SCRYPT_FORMAT ||
    parts[1] !== SCRYPT_FORMAT_VERSION
  ) {
    return false;
  }

  const cost = Number(parts[2]);
  const blockSize = Number(parts[3]);
  const parallelization = Number(parts[4]);

  // Never allow stored hash parameters to select arbitrary resource usage.
  if (
    cost !== DEFAULT_SCRYPT_COST ||
    blockSize !== DEFAULT_SCRYPT_BLOCK_SIZE ||
    parallelization !== DEFAULT_SCRYPT_PARALLELIZATION
  ) {
    return false;
  }

  const salt = decodeBase64UrlStrict(parts[5]);
  const expectedKey = decodeBase64UrlStrict(parts[6]);

  if (
    !salt ||
    !expectedKey ||
    salt.length !== DEFAULT_SALT_LENGTH ||
    expectedKey.length !== DEFAULT_SCRYPT_KEY_LENGTH
  ) {
    return false;
  }

  try {
    const actualKey = await derivePasswordKey(password, salt);

    return nodeCrypto.timingSafeEqual(
      Buffer.from(actualKey),
      expectedKey,
    );
  } catch {
    return false;
  }
}

module.exports = Object.freeze({
  randomToken,
  sha256,
  hmacSha256,
  safeEqual,
  hashPassword,
  verifyPassword,
});
