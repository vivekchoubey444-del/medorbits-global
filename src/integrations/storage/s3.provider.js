
'use strict';

/**
 * MedOrbits -- S3 Storage Provider
 *
 * File: src/integrations/storage/s3.provider.js
 * Runtime: Node.js >= 20
 *
 * Implements private object storage using AWS S3 or a compatible service.
 *
 * API:
 * - put({ key, body, contentType })
 * - get(key)
 * - delete(key)
 * - close()
 *
 * Dependency:
 * npm install @aws-sdk/client-s3
 *
 * Security:
 * - Validates object keys and prevents path traversal.
 * - Enforces upload and download size limits.
 * - Uses configured server-side encryption.
 * - Does not make objects publicly accessible.
 * - Supports bounded downloads and provider shutdown.
 */

const { loadStorageConfig } = require('./storage.config');

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const MAX_KEY_LENGTH = 1024;
const MAX_CONTENT_TYPE_LENGTH = 255;
const ALLOWED_ENCRYPTION = new Set([
  'AES256',
  'aws:kms',
]);

class S3StorageProvider {
  constructor({
    client,
    commands,
    bucket,
    prefix = '',
    maxFileBytes,
    serverSideEncryption = 'AES256',
    kmsKeyId,
  } = {}) {
    if (
      !client ||
      typeof client.send !== 'function' ||
      typeof client.destroy !== 'function'
    ) {
      throw new TypeError(
        'A valid S3 client implementing send() and destroy() is required.',
      );
    }

    if (
      !commands ||
      typeof commands.PutObjectCommand !== 'function' ||
      typeof commands.GetObjectCommand !== 'function' ||
      typeof commands.DeleteObjectCommand !== 'function'
    ) {
      throw new TypeError(
        'Valid S3 command constructors are required.',
      );
    }

    if (
      typeof bucket !== 'string' ||
      !bucket.trim()
    ) {
      throw new TypeError('An S3 bucket is required.');
    }

    if (
      !Number.isSafeInteger(maxFileBytes) ||
      maxFileBytes <= 0
    ) {
      throw new TypeError(
        'maxFileBytes must be a positive safe integer.',
      );
    }

    if (
      typeof prefix !== 'string' ||
      prefix.includes('\0')
    ) {
      throw new TypeError('S3 prefix must be a valid string.');
    }

    if (!ALLOWED_ENCRYPTION.has(serverSideEncryption)) {
      throw new TypeError(
        'Unsupported S3 server-side encryption setting.',
      );
    }

    if (
      serverSideEncryption === 'aws:kms' &&
      kmsKeyId != null &&
      (
        typeof kmsKeyId !== 'string' ||
        !kmsKeyId.trim() ||
        /[\r\n\0]/u.test(kmsKeyId)
      )
    ) {
      throw new TypeError('Invalid S3 KMS key identifier.');
    }

    this.client = client;
    this.commands = commands;
    this.bucket = bucket.trim();
    this.prefix = this.normalizePrefix(prefix);
    this.maxFileBytes = maxFileBytes;
    this.serverSideEncryption = serverSideEncryption;
    this.kmsKeyId = kmsKeyId || undefined;

    this.closed = false;
    this.closePromise = null;
  }

  static fromEnv(environment = process.env) {
    const config = loadStorageConfig(environment);

    if (config.driver !== 's3') {
      throw new Error(
        'S3 storage is not the configured storage driver.',
      );
    }

    if (!config.s3.bucket || !config.s3.region) {
      throw new Error(
        'S3_BUCKET and S3_REGION are required for S3 storage.',
      );
    }

    let sdk;

    try {
      sdk = require('@aws-sdk/client-s3');
    } catch {
      throw new Error(
        'S3 storage requires @aws-sdk/client-s3. Install the dependency.',
      );
    }

    const clientOptions = {
      region: config.s3.region,
      forcePathStyle: config.s3.forcePathStyle === true,
    };

    if (config.s3.endpoint) {
      clientOptions.endpoint = config.s3.endpoint;
    }

    const client = new sdk.S3Client(clientOptions);

    try {
      return new S3StorageProvider({
        client,
        commands: sdk,
        bucket: config.s3.bucket,
        prefix: config.s3.prefix || '',
        maxFileBytes: config.maxFileBytes,
        serverSideEncryption:
          config.s3.serverSideEncryption || 'AES256',
        kmsKeyId: environment.S3_KMS_KEY_ID,
      });
    } catch (error) {
      client.destroy();
      throw error;
    }
  }

  normalizePrefix(prefix) {
    const trimmed = prefix.replace(/^\/+|\/+$/gu, '');

    if (!trimmed) {
      return '';
    }

    this.validateKey(trimmed);

    return `${trimmed}/`;
  }

  validateKey(key) {
    if (
      typeof key !== 'string' ||
      key.length === 0 ||
      key.length > MAX_KEY_LENGTH ||
      key !== key.trim() ||
      key.startsWith('/') ||
      /[\u0000-\u001F\u007F\\]/u.test(key)
    ) {
      throw new TypeError('Invalid S3 object key.');
    }

    const segments = key.split('/');

    if (
      segments.some(
        (segment) =>
          !segment ||
          segment === '.' ||
          segment === '..' ||
          !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(segment),
      )
    ) {
      throw new TypeError(
        'S3 object key contains an invalid path segment.',
      );
    }

    return key;
  }

  key(key) {
    return `${this.prefix}${this.validateKey(key)}`;
  }

  assertOpen() {
    if (this.closed) {
      throw new Error('S3 storage provider is closed.');
    }
  }

  normalizeBody(body) {
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
      'body must be a Buffer or Uint8Array.',
    );
  }

  validateContentType(contentType) {
    if (
      typeof contentType !== 'string' ||
      contentType.length === 0 ||
      contentType.length > MAX_CONTENT_TYPE_LENGTH ||
      /[\r\n\0]/u.test(contentType) ||
      !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+(?:\s*;\s*[a-zA-Z0-9!#$&^_.+-]+=(?:[a-zA-Z0-9!#$&^_.+-]+|"[^"\r\n]*"))*$/u.test(
        contentType.trim(),
      )
    ) {
      throw new TypeError('Invalid S3 content type.');
    }

    return contentType.trim();
  }

  async put({
    key,
    body,
    contentType = DEFAULT_CONTENT_TYPE,
  } = {}) {
    this.assertOpen();

    const data = this.normalizeBody(body);
    const normalizedContentType =
      this.validateContentType(contentType);
    const objectKey = this.key(key);

    if (data.byteLength > this.maxFileBytes) {
      throw new RangeError(
        'File exceeds the configured size limit.',
      );
    }

    const params = {
      Bucket: this.bucket,
      Key: objectKey,
      Body: data,
      ContentLength: data.byteLength,
      ContentType: normalizedContentType,
      ServerSideEncryption: this.serverSideEncryption,
    };

    if (
      this.serverSideEncryption === 'aws:kms' &&
      this.kmsKeyId
    ) {
      params.SSEKMSKeyId = this.kmsKeyId;
    }

    await this.client.send(
      new this.commands.PutObjectCommand(params),
    );

    return {
      key,
      size: data.byteLength,
      contentType: normalizedContentType,
    };
  }

  async get(key) {
    this.assertOpen();

    const objectKey = this.key(key);

    const response = await this.client.send(
      new this.commands.GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );

    if (!response.Body) {
      throw new Error('S3 returned an empty object stream.');
    }

    if (
      response.ContentLength != null &&
      (
        !Number.isSafeInteger(response.ContentLength) ||
        response.ContentLength < 0 ||
        response.ContentLength > this.maxFileBytes
      )
    ) {
      response.Body.destroy?.();

      throw new RangeError(
        'Stored object exceeds the configured size limit.',
      );
    }

    const chunks = [];
    let totalBytes = 0;

    try {
      for await (const chunk of response.Body) {
        if (
          !Buffer.isBuffer(chunk) &&
          !(chunk instanceof Uint8Array)
        ) {
          throw new TypeError(
            'S3 returned an unsupported response chunk.',
          );
        }

        const buffer = Buffer.from(
          chunk.buffer,
          chunk.byteOffset,
          chunk.byteLength,
        );

        totalBytes += buffer.byteLength;

        if (totalBytes > this.maxFileBytes) {
          throw new RangeError(
            'Downloaded object exceeds the configured size limit.',
          );
        }

        chunks.push(buffer);
      }
    } catch (error) {
      response.Body.destroy?.();
      throw error;
    }

    return {
      key,
      body: Buffer.concat(chunks, totalBytes),
      size: totalBytes,
      contentType: response.ContentType || DEFAULT_CONTENT_TYPE,
    };
  }

  async delete(key) {
    this.assertOpen();

    const objectKey = this.key(key);

    await this.client.send(
      new this.commands.DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );

    return {
      key,
      deleted: true,
    };
  }

  async close() {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closed = true;

    this.closePromise = Promise.resolve().then(() => {
      this.client.destroy();
    });

    return this.closePromise;
  }
}

module.exports = {
  S3StorageProvider,
  DEFAULT_CONTENT_TYPE,
  MAX_KEY_LENGTH,
  MAX_CONTENT_TYPE_LENGTH,
};
