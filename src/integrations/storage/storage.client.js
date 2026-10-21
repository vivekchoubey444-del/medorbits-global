
'use strict';

/**
 * MedOrbits -- Storage Client
 *
 * File: src/integrations/storage/storage.client.js
 * Runtime: Node.js >= 20
 *
 * Provides a stable interface over local and S3-compatible storage.
 *
 * API:
 * - put({ key, body, contentType })
 * - get(key)
 * - delete(key)
 * - close()
 *
 * Security:
 * - Validates storage keys and payload types.
 * - Enforces configurable upload-size limits.
 * - Prevents path traversal and unsafe object keys.
 * - Supports explicit provider ownership and idempotent shutdown.
 *
 * Authorization, malware scanning, file-content validation, and
 * access-control policies must be enforced by application services.
 */

const REQUIRED_METHODS = Object.freeze([
  'put',
  'get',
  'delete',
]);

const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_KEY_LENGTH = 1024;
const MAX_CONTENT_TYPE_LENGTH = 255;

const CONTENT_TYPE_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*(?:\s*;\s*[a-zA-Z0-9!#$&^_.+-]+=(?:[a-zA-Z0-9!#$&^_.+-]+|"[^"\r\n]*"))*$/u;

function validateOptions(options) {
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Storage client options must be an object.');
  }

  if (
    options.maxFileBytes !== undefined &&
    (
      !Number.isSafeInteger(options.maxFileBytes) ||
      options.maxFileBytes < 1
    )
  ) {
    throw new TypeError(
      'maxFileBytes must be a positive safe integer.',
    );
  }

  if (
    options.ownsProvider !== undefined &&
    typeof options.ownsProvider !== 'boolean'
  ) {
    throw new TypeError('ownsProvider must be a boolean.');
  }
}

function validateProvider(provider) {
  if (
    !provider ||
    typeof provider !== 'object' ||
    Array.isArray(provider)
  ) {
    throw new TypeError('A valid storage provider is required.');
  }

  for (const method of REQUIRED_METHODS) {
    if (typeof provider[method] !== 'function') {
      throw new TypeError(
        `Storage provider must implement ${method}().`,
      );
    }
  }

  if (
    provider.close != null &&
    typeof provider.close !== 'function'
  ) {
    throw new TypeError(
      'Storage provider close must be a function when provided.',
    );
  }

  return provider;
}

function validateKey(key) {
  if (
    typeof key !== 'string' ||
    !key ||
    key !== key.trim() ||
    key.length > MAX_KEY_LENGTH ||
    /[\u0000-\u001F\u007F\\]/u.test(key) ||
    key.startsWith('/') ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(key)
  ) {
    throw new TypeError('Invalid storage key.');
  }

  const segments = key.split('/');

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..',
    )
  ) {
    throw new TypeError(
      'Storage key contains an invalid path segment.',
    );
  }

  return key;
}

function normalizeBody(body) {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(
      body.buffer,
      body.byteOffset,
      body.byteLength,
    );
  }

  throw new TypeError(
    'Storage body must be a Buffer or Uint8Array.',
  );
}

function validateContentType(contentType) {
  if (contentType === undefined || contentType === null) {
    return 'application/octet-stream';
  }

  if (
    typeof contentType !== 'string' ||
    contentType.length > MAX_CONTENT_TYPE_LENGTH ||
    /[\r\n\0]/u.test(contentType) ||
    !CONTENT_TYPE_PATTERN.test(contentType.trim())
  ) {
    throw new TypeError('Invalid storage content type.');
  }

  return contentType.trim();
}

class StorageClient {
  #provider;
  #maxFileBytes;
  #ownsProvider;
  #closed = false;
  #closePromise = null;

  constructor(provider, options = {}) {
    validateOptions(options);

    this.#provider = validateProvider(provider);
    this.#maxFileBytes =
      options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.#ownsProvider = options.ownsProvider === true;
  }

  get closed() {
    return this.#closed;
  }

  async put(input) {
    this.#assertOpen();

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      throw new TypeError(
        'Storage put() requires an options object.',
      );
    }

    const key = validateKey(input.key);
    const body = normalizeBody(input.body);

    if (body.byteLength > this.#maxFileBytes) {
      throw new RangeError(
        'Storage payload exceeds the configured file-size limit.',
      );
    }

    const contentType = validateContentType(input.contentType);

    // Pass only explicitly supported fields to the provider.
    // This prevents accidental propagation of arbitrary caller data.
    const request = Object.freeze({
      key,
      body,
      contentType,
    });

    return this.#provider.put(request);
  }

  async get(key) {
    this.#assertOpen();
    return this.#provider.get(validateKey(key));
  }

  async delete(key) {
    this.#assertOpen();
    return this.#provider.delete(validateKey(key));
  }

  async close() {
    if (this.#closePromise) {
      return this.#closePromise;
    }

    this.#closed = true;

    this.#closePromise = (async () => {
      if (
        this.#ownsProvider &&
        typeof this.#provider.close === 'function'
      ) {
        await this.#provider.close();
      }
    })();

    return this.#closePromise;
  }

  #assertOpen() {
    if (this.#closed) {
      throw new Error('Storage client is closed.');
    }
  }
}

module.exports = {
  StorageClient,
  validateProvider,
  validateKey,
  normalizeBody,
  validateContentType,
  DEFAULT_MAX_FILE_BYTES,
  MAX_KEY_LENGTH,
  MAX_CONTENT_TYPE_LENGTH,
};
