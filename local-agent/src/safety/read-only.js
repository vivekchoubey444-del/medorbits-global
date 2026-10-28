
'use strict';

/**
 * MedOrbits Local Agent -- Read-Only Safety Layer
 * ------------------------------------------------
 * Restricts repository operations to read-only access by default.
 *
 * Features:
 * - Explicit read-only mode
 * - Path confinement through path-guard.js
 * - File-size and total-read limits
 * - Directory listing limits
 * - Symlink rejection
 * - Read-only repository inspection
 * - No shell execution or network access
 *
 * Runtime: Node.js 20+
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  PathGuardError,
  resolveInsideRoot
} = require('./path-guard');

const READ_ONLY_VERSION = '1.0.0';

const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_DIRECTORY_ENTRIES = 500;
const DEFAULT_MAX_DEPTH = 8;

class ReadOnlyError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'ReadOnlyError';
    this.code = options.code || 'READ_ONLY_ERROR';
    this.path = options.path || null;
  }
}

function positiveInteger(value, fallback, name) {
  const result = value === undefined ? fallback : value;

  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new TypeError(`${name} must be a positive safe integer.`);
  }

  return result;
}

function validateRoot(root) {
  if (typeof root !== 'string' || !root.trim()) {
    throw new ReadOnlyError(
      'A valid repository root is required.',
      { code: 'INVALID_ROOT' }
    );
  }

  let canonicalRoot;

  try {
    canonicalRoot = fs.realpathSync.native(path.resolve(root));
  } catch {
    throw new ReadOnlyError(
      'Repository root must exist and be accessible.',
      { code: 'INVALID_ROOT' }
    );
  }

  let stat;

  try {
    stat = fs.statSync(canonicalRoot);
  } catch {
    throw new ReadOnlyError(
      'Unable to inspect repository root.',
      { code: 'INVALID_ROOT' }
    );
  }

  if (!stat.isDirectory()) {
    throw new ReadOnlyError(
      'Repository root must be a directory.',
      { code: 'INVALID_ROOT' }
    );
  }

  return canonicalRoot;
}

function isInsideRoot(root, target) {
  const relative = path.relative(root, target);

  return (
    relative === '' ||
    (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

class ReadOnlyRepository {
  constructor(options = {}) {
    this.root = validateRoot(
      options.root || process.env.MEDORBITS_REPO_ROOT || process.cwd()
    );

    this.maxFileBytes = positiveInteger(
      options.maxFileBytes,
      DEFAULT_MAX_FILE_BYTES,
      'maxFileBytes'
    );

    this.maxTotalBytes = positiveInteger(
      options.maxTotalBytes,
      DEFAULT_MAX_TOTAL_BYTES,
      'maxTotalBytes'
    );

    this.maxDirectoryEntries = positiveInteger(
      options.maxDirectoryEntries,
      DEFAULT_MAX_DIRECTORY_ENTRIES,
      'maxDirectoryEntries'
    );

    this.maxDepth = positiveInteger(
      options.maxDepth,
      DEFAULT_MAX_DEPTH,
      'maxDepth'
    );

    this.bytesRead = 0;
    this.closed = false;
  }

  ensureOpen() {
    if (this.closed) {
      throw new ReadOnlyError(
        'Read-only repository instance is closed.',
        { code: 'READER_CLOSED' }
      );
    }
  }

  resolve(candidate) {
    this.ensureOpen();

    try {
      const target = resolveInsideRoot(this.root, candidate, {
        operation: 'read',
        protectSensitive: true
      });

      if (!isInsideRoot(this.root, target) || target === this.root) {
        throw new ReadOnlyError(
          'Requested path is outside the repository root.',
          {
            code: 'PATH_OUTSIDE_ROOT',
            path: candidate
          }
        );
      }

      return target;
    } catch (error) {
      if (error instanceof ReadOnlyError) {
        throw error;
      }

      throw new ReadOnlyError(
        'Repository path failed safety validation.',
        {
          code: error.code || 'PATH_REJECTED',
          path: candidate
        }
      );
    }
  }

  readFile(candidate, options = {}) {
    this.ensureOpen();

    const target = this.resolve(candidate);

    let stat;

    try {
      stat = fs.lstatSync(target);
    } catch (error) {
      throw new ReadOnlyError(
        error.code === 'ENOENT'
          ? 'Requested file does not exist.'
          : 'Unable to inspect requested file.',
        {
          code: error.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_INSPECTION_FAILED',
          path: candidate
        }
      );
    }

    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new ReadOnlyError(
        'Only regular files can be read.',
        {
          code: 'UNSAFE_READ_TARGET',
          path: candidate
        }
      );
    }

    const requestedLimit = options.maxBytes ?? this.maxFileBytes;

    if (
      !Number.isSafeInteger(requestedLimit) ||
      requestedLimit <= 0
    ) {
      throw new TypeError('maxBytes must be a positive safe integer.');
    }

    const effectiveLimit = Math.min(requestedLimit, this.maxFileBytes);

    if (stat.size > effectiveLimit) {
      throw new ReadOnlyError(
        'File exceeds the configured read-size limit.',
        {
          code: 'FILE_TOO_LARGE',
          path: candidate
        }
      );
    }

    if (this.bytesRead + stat.size > this.maxTotalBytes) {
      throw new ReadOnlyError(
        'Total read budget would be exceeded.',
        {
          code: 'READ_BUDGET_EXCEEDED',
          path: candidate
        }
      );
    }

    let content;

    try {
      content = fs.readFileSync(target);
    } catch {
      throw new ReadOnlyError(
        'Failed to read requested file.',
        {
          code: 'FILE_READ_FAILED',
          path: candidate
        }
      );
    }

    // Account for actual bytes read, not only the earlier stat size.
    if (this.bytesRead + content.length > this.maxTotalBytes) {
      throw new ReadOnlyError(
        'Total read budget exceeded while reading.',
        {
          code: 'READ_BUDGET_EXCEEDED',
          path: candidate
        }
      );
    }

    this.bytesRead += content.length;

    if (options.encoding === null) {
      return content;
    }

    return content.toString(options.encoding || 'utf8');
  }

  readJson(candidate) {
    const contents = this.readFile(candidate, {
      encoding: 'utf8'
    });

    try {
      return JSON.parse(contents);
    } catch {
      throw new ReadOnlyError(
        'Requested file contains invalid JSON.',
        {
          code: 'INVALID_JSON',
          path: candidate
        }
      );
    }
  }

  listDirectory(candidate = '.', options = {}) {
    this.ensureOpen();

    let directory;

    if (candidate === '.') {
      directory = this.root;
    } else {
      directory = this.resolve(candidate);
    }

    let stat;

    try {
      stat = fs.lstatSync(directory);
    } catch {
      throw new ReadOnlyError(
        'Directory does not exist or cannot be inspected.',
        {
          code: 'DIRECTORY_NOT_FOUND',
          path: candidate
        }
      );
    }

    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new ReadOnlyError(
        'Requested path is not a safe directory.',
        {
          code: 'UNSAFE_DIRECTORY',
          path: candidate
        }
      );
    }

    const limit = positiveInteger(
      options.limit,
      this.maxDirectoryEntries,
      'limit'
    );

    let entries;

    try {
      entries = fs.readdirSync(directory, {
        withFileTypes: true
      });
    } catch {
      throw new ReadOnlyError(
        'Unable to list directory.',
        {
          code: 'DIRECTORY_READ_FAILED',
          path: candidate
        }
      );
    }

    const truncated = entries.length > limit;

    return {
      path: path.relative(this.root, directory) || '.',
      totalEntries: entries.length,
      truncated,
      entries: entries.slice(0, limit).map((entry) => ({
        name: entry.name,
        type: entry.isDirectory()
          ? 'directory'
          : entry.isFile()
            ? 'file'
            : entry.isSymbolicLink()
              ? 'symlink'
              : 'other'
      }))
    };
  }

  inspect(candidate) {
    this.ensureOpen();

    const target = this.resolve(candidate);

    let stat;

    try {
      stat = fs.lstatSync(target);
    } catch (error) {
      throw new ReadOnlyError(
        error.code === 'ENOENT'
          ? 'Requested path does not exist.'
          : 'Unable to inspect requested path.',
        {
          code: error.code === 'ENOENT' ? 'PATH_NOT_FOUND' : 'PATH_INSPECTION_FAILED',
          path: candidate
        }
      );
    }

    if (stat.isSymbolicLink()) {
      throw new ReadOnlyError(
        'Symbolic links cannot be inspected as regular targets.',
        {
          code: 'UNSAFE_PATH',
          path: candidate
        }
      );
    }

    return {
      path: path.relative(this.root, target),
      type: stat.isFile()
        ? 'file'
        : stat.isDirectory()
          ? 'directory'
          : 'other',
      size: stat.isFile() ? stat.size : null,
      modifiedAt: stat.mtime.toISOString(),
      readable: true,
      writable: false
    };
  }

  /**
   * Return a bounded, read-only file inventory.
   */
  inventory(candidate = '.', options = {}) {
    this.ensureOpen();

    const maxDepth = positiveInteger(
      options.maxDepth,
      this.maxDepth,
      'maxDepth'
    );

    const maxEntries = positiveInteger(
      options.maxEntries,
      this.maxDirectoryEntries,
      'maxEntries'
    );

    const start = candidate === '.' ? this.root : this.resolve(candidate);
    const results = [];
    const visited = new Set();
    let truncated = false;

    const walk = (directory, depth) => {
      if (results.length >= maxEntries) {
        truncated = true;
        return;
      }

      let realDirectory;

      try {
        realDirectory = fs.realpathSync.native(directory);
      } catch {
        return;
      }

      if (
        !isInsideRoot(this.root, realDirectory) ||
        visited.has(realDirectory)
      ) {
        return;
      }

      visited.add(realDirectory);

      let entries;

      try {
        entries = fs.readdirSync(directory, {
          withFileTypes: true
        });
      } catch {
        results.push({
          path: path.relative(this.root, directory),
          type: 'directory',
          error: 'DIRECTORY_READ_FAILED'
        });
        return;
      }

      for (const entry of entries) {
        if (results.length >= maxEntries) {
          truncated = true;
          return;
        }

        const fullPath = path.join(directory, entry.name);
        const relative = path.relative(this.root, fullPath);

        let type = 'other';

        if (entry.isSymbolicLink()) {
          type = 'symlink';
        } else if (entry.isDirectory()) {
          type = 'directory';
        } else if (entry.isFile()) {
          type = 'file';
        }

        results.push({
          path: relative,
          type
        });

        if (type === 'directory' && depth < maxDepth) {
          walk(fullPath, depth + 1);
        }
      }
    };

    let startStat;

    try {
      startStat = fs.lstatSync(start);
    } catch {
      throw new ReadOnlyError(
        'Inventory target does not exist.',
        {
          code: 'PATH_NOT_FOUND',
          path: candidate
        }
      );
    }

    if (startStat.isSymbolicLink() || !startStat.isDirectory()) {
      throw new ReadOnlyError(
        'Inventory target must be a regular directory.',
        {
          code: 'UNSAFE_DIRECTORY',
          path: candidate
        }
      );
    }

    walk(start, 0);

    return {
      root: this.root,
      directory: path.relative(this.root, start) || '.',
      count: results.length,
      truncated,
      entries: results
    };
  }

  getStatus() {
    return {
      version: READ_ONLY_VERSION,
      root: this.root,
      mode: 'read-only',
      closed: this.closed,
      bytesRead: this.bytesRead,
      maxFileBytes: this.maxFileBytes,
      maxTotalBytes: this.maxTotalBytes
    };
  }

  close() {
    this.closed = true;
  }
}

function createReadOnlyRepository(options = {}) {
  return new ReadOnlyRepository(options);
}

module.exports = {
  READ_ONLY_VERSION,
  ReadOnlyError,
  ReadOnlyRepository,
  createReadOnlyRepository
};
