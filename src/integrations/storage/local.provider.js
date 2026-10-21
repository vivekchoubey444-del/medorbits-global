
'use strict';

/**
 * MedOrbits -- Local Storage Provider
 *
 * File: src/integrations/storage/local.provider.js
 * Runtime: Node.js >= 20
 *
 * Implements private filesystem storage with:
 * - Path traversal protection.
 * - Symlink detection.
 * - File-size enforcement.
 * - Atomic, non-overwriting object creation.
 * - SHA-256 integrity metadata.
 * - Bounded file reads.
 *
 * API:
 * - put({ key, body, contentType })
 * - get(key)
 * - delete(key)
 * - close()
 *
 * Important:
 * Filesystem path checks reduce risk but cannot completely eliminate
 * races against other processes that can modify the storage directory.
 * Keep the storage root private and writable only by the application.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const { loadStorageConfig } = require('./storage.config');

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const CONTENT_TYPE_MAX_LENGTH = 255;
const MAX_KEY_LENGTH = 1024;

const CONTENT_TYPE_PATTERN =
  /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+(?:\s*;\s*[a-zA-Z0-9!#$&^_.+-]+=(?:[a-zA-Z0-9!#$&^_.+-]+|"[^"\r\n]*"))*$/u;

class LocalStorageProvider {
  constructor(config = loadStorageConfig()) {
    if (
      !config ||
      typeof config !== 'object' ||
      Array.isArray(config)
    ) {
      throw new TypeError(
        'Storage configuration is required.',
      );
    }

    if (
      typeof config.root !== 'string' ||
      !config.root.trim() ||
      config.root.includes('\0')
    ) {
      throw new TypeError(
        'Storage root must be a valid non-empty path.',
      );
    }

    if (
      !Number.isSafeInteger(config.maxFileBytes) ||
      config.maxFileBytes <= 0
    ) {
      throw new TypeError(
        'maxFileBytes must be a positive safe integer.',
      );
    }

    this.root = path.resolve(config.root);
    this.maxFileBytes = config.maxFileBytes;
  }

  resolveKey(key) {
    if (
      typeof key !== 'string' ||
      key.length === 0 ||
      key.length > MAX_KEY_LENGTH ||
      key !== key.trim() ||
      /[\u0000-\u001F\u007F\\]/u.test(key) ||
      key.startsWith('/') ||
      path.posix.isAbsolute(key) ||
      path.win32.isAbsolute(key) ||
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
          segment === '..' ||
          !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(segment),
      )
    ) {
      throw new TypeError(
        'Storage key contains an invalid path segment.',
      );
    }

    const target = path.resolve(this.root, ...segments);
    const relative = path.relative(this.root, target);

    if (
      !relative ||
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error(
        'Storage key escapes the storage root.',
      );
    }

    return target;
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
      contentType.length > CONTENT_TYPE_MAX_LENGTH ||
      /[\r\n\0]/u.test(contentType) ||
      !CONTENT_TYPE_PATTERN.test(contentType.trim())
    ) {
      throw new TypeError('Invalid content type.');
    }

    return contentType.trim();
  }

  async ensureRoot() {
    await fs.mkdir(this.root, {
      recursive: true,
      mode: 0o700,
    });

    const rootStat = await fs.lstat(this.root);

    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      throw new Error(
        'Storage root must be a real directory, not a symbolic link.',
      );
    }

    const realRoot = await fs.realpath(this.root);

    if (realRoot !== this.root) {
      throw new Error(
        'Storage root resolves through an unexpected filesystem path.',
      );
    }
  }

  async assertSafeDirectory(directory) {
    const relative = path.relative(this.root, directory);

    if (
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error(
        'Directory escapes the storage root.',
      );
    }

    await this.ensureRoot();

    let current = this.root;
    const segments = relative ? relative.split(path.sep) : [];

    for (const segment of segments) {
      current = path.join(current, segment);

      let stat;

      try {
        stat = await fs.lstat(current);
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue;
        }

        throw error;
      }

      if (stat.isSymbolicLink()) {
        throw new Error(
          'Symbolic links are not allowed in storage paths.',
        );
      }

      if (!stat.isDirectory()) {
        throw new Error(
          'A storage path component is not a directory.',
        );
      }
    }
  }

  async ensureParentDirectory(directory) {
    await this.ensureRoot();
    await this.assertSafeDirectory(directory);

    await fs.mkdir(directory, {
      recursive: true,
      mode: 0o700,
    });

    await this.assertSafeDirectory(directory);
  }

  async put({
    key,
    body,
    contentType = DEFAULT_CONTENT_TYPE,
  } = {}) {
    const target = this.resolveKey(key);
    const data = this.normalizeBody(body);
    const normalizedContentType =
      this.validateContentType(contentType);

    if (data.byteLength > this.maxFileBytes) {
      throw new RangeError(
        'File exceeds the configured size limit.',
      );
    }

    const directory = path.dirname(target);

    await this.ensureParentDirectory(directory);

    const temporaryPath = path.join(
      directory,
      `.upload-${crypto.randomUUID()}.tmp`,
    );

    let handle;
    let temporaryExists = false;

    try {
      handle = await fs.open(
        temporaryPath,
        'wx',
        0o600,
      );

      temporaryExists = true;

      await handle.writeFile(data);
      await handle.sync();
      await handle.close();
      handle = undefined;

      // Hard-link creation fails if the target already exists,
      // preventing accidental replacement of an existing object.
      await fs.link(temporaryPath, target);

      await fs.unlink(temporaryPath);
      temporaryExists = false;

      return {
        key,
        size: data.byteLength,
        contentType: normalizedContentType,
        sha256: crypto
          .createHash('sha256')
          .update(data)
          .digest('hex'),
      };
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => {});
      }

      if (temporaryExists) {
        await fs.unlink(temporaryPath).catch(() => {});
      }

      throw error;
    }
  }

  async get(key) {
    const target = this.resolveKey(key);
    const directory = path.dirname(target);

    await this.assertSafeDirectory(directory);

    // O_NOFOLLOW prevents opening a final-component symlink on
    // platforms that support it. Directory permissions remain essential.
    const noFollow = fs.constants?.O_NOFOLLOW || 0;

    let handle;

    try {
      handle = await fs.open(
        target,
        fsConstantsReadOnly() | noFollow,
      );

      const stat = await handle.stat();

      if (!stat.isFile()) {
        throw new Error(
          'Storage object is not a regular file.',
        );
      }

      if (stat.size > this.maxFileBytes) {
        throw new RangeError(
          'Stored object exceeds the configured size limit.',
        );
      }

      const body = await handle.readFile();

      if (body.byteLength > this.maxFileBytes) {
        throw new RangeError(
          'Stored object exceeds the configured size limit.',
        );
      }

      return {
        key,
        body,
        size: body.byteLength,
        contentType: DEFAULT_CONTENT_TYPE,
      };
    } catch (error) {
      if (error.code === 'ELOOP') {
        throw new Error(
          'Symbolic links are not allowed for storage objects.',
        );
      }

      throw error;
    } finally {
      if (handle) {
        await handle.close();
      }
    }
  }

  async delete(key) {
    const target = this.resolveKey(key);
    const directory = path.dirname(target);

    await this.assertSafeDirectory(directory);

    try {
      const noFollow = fs.constants?.O_NOFOLLOW || 0;
      const handle = await fs.open(
        target,
        fsConstantsReadOnly() | noFollow,
      );

      try {
        const stat = await handle.stat();

        if (!stat.isFile()) {
          throw new Error(
            'Storage object is not a regular file.',
          );
        }
      } finally {
        await handle.close();
      }

      // Recheck the parent before unlinking. Keep the storage root
      // writable only by the application to reduce race conditions.
      await this.assertSafeDirectory(directory);
      await fs.unlink(target);

      return {
        key,
        deleted: true,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          key,
          deleted: false,
        };
      }

      if (error.code === 'ELOOP') {
        throw new Error(
          'Symbolic links are not allowed for storage objects.',
        );
      }

      throw error;
    }
  }

  async close() {
    // No persistent file handles are held between operations.
  }
}

function fsConstantsReadOnly() {
  return require('node:fs').constants.O_RDONLY;
}

module.exports = {
  LocalStorageProvider,
  DEFAULT_CONTENT_TYPE,
  CONTENT_TYPE_MAX_LENGTH,
  MAX_KEY_LENGTH,
};
