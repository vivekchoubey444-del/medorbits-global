
'use strict';

/**
 * MedOrbits Local Agent -- Path Guard
 * ----------------------------------
 * Restricts filesystem operations to an explicitly configured repository root.
 *
 * Features:
 * - Path traversal protection
 * - Absolute-path rejection by default
 * - Symlink escape detection
 * - Existing and non-existing target support
 * - Protected sensitive files and directories
 * - Read/write operation policies
 * - No third-party dependencies
 *
 * Runtime: Node.js 20+
 */

const fs = require('node:fs');
const path = require('node:path');

const PATH_GUARD_VERSION = '1.0.0';

const DEFAULT_PROTECTED_DIRECTORIES = [
  '.git',
  'node_modules',
  '.ssh',
  '.aws',
  '.config',
  '.local',
  'secrets',
  'credentials',
  'private'
];

const DEFAULT_PROTECTED_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  'id_rsa',
  'id_ed25519',
  'known_hosts',
  'authorized_keys'
];

const SENSITIVE_EXTENSIONS = new Set([
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.keystore'
]);

class PathGuardError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'PathGuardError';
    this.code = options.code || 'PATH_GUARD_ERROR';
    this.path = options.path || null;
  }
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

function isSubPath(root, target) {
  return path.relative(root, target) !== '';
}

function normalizeRelativePath(input) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new PathGuardError(
      'A non-empty relative path is required.',
      { code: 'INVALID_PATH', path: String(input) }
    );
  }

  if (input.includes('\0')) {
    throw new PathGuardError(
      'Null bytes are not allowed in paths.',
      { code: 'INVALID_PATH' }
    );
  }

  if (input !== input.trim()) {
    throw new PathGuardError(
      'Leading or trailing whitespace in paths is not allowed.',
      { code: 'INVALID_PATH', path: input }
    );
  }

  if (path.isAbsolute(input) || path.win32.isAbsolute(input)) {
    throw new PathGuardError(
      'Absolute paths are not allowed.',
      { code: 'ABSOLUTE_PATH_DENIED', path: input }
    );
  }

  // Reject Windows drive and UNC forms even when running on POSIX.
  if (/^[a-zA-Z]:/.test(input) || input.startsWith('\\\\')) {
    throw new PathGuardError(
      'Windows drive and UNC paths are not allowed.',
      { code: 'ABSOLUTE_PATH_DENIED', path: input }
    );
  }

  const segments = input.split(/[\\/]+/);

  if (segments.some((segment) => segment === '..')) {
    throw new PathGuardError(
      'Parent-directory traversal is not allowed.',
      { code: 'PATH_TRAVERSAL_DENIED', path: input }
    );
  }

  const normalized = path.normalize(input);

  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    throw new PathGuardError(
      'The path does not identify an allowed target.',
      { code: 'PATH_TRAVERSAL_DENIED', path: input }
    );
  }

  return normalized;
}

function getExistingAncestor(target) {
  let current = target;

  while (true) {
    try {
      fs.lstatSync(current);
      return current;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw new PathGuardError(
          'Unable to inspect the target path.',
          {
            code: 'PATH_INSPECTION_FAILED',
            path: current
          }
        );
      }

      const parent = path.dirname(current);

      if (parent === current) {
        throw new PathGuardError(
          'No existing ancestor was found.',
          {
            code: 'PATH_INSPECTION_FAILED',
            path: target
          }
        );
      }

      current = parent;
    }
  }
}

function canonicalizeExistingPath(target) {
  try {
    return fs.realpathSync.native(target);
  } catch (error) {
    throw new PathGuardError(
      'Unable to resolve the canonical filesystem path.',
      {
        code: 'PATH_RESOLUTION_FAILED',
        path: target
      }
    );
  }
}

function validateRoot(root) {
  if (typeof root !== 'string' || !root.trim()) {
    throw new PathGuardError(
      'A valid repository root is required.',
      { code: 'INVALID_ROOT' }
    );
  }

  let canonicalRoot;

  try {
    canonicalRoot = fs.realpathSync.native(path.resolve(root));
  } catch {
    throw new PathGuardError(
      'Repository root must exist and be accessible.',
      {
        code: 'INVALID_ROOT',
        path: root
      }
    );
  }

  let stat;

  try {
    stat = fs.statSync(canonicalRoot);
  } catch {
    throw new PathGuardError(
      'Unable to inspect repository root.',
      {
        code: 'INVALID_ROOT',
        path: root
      }
    );
  }

  if (!stat.isDirectory()) {
    throw new PathGuardError(
      'Repository root must be a directory.',
      {
        code: 'INVALID_ROOT',
        path: root
      }
    );
  }

  return canonicalRoot;
}

function matchesProtectedPath(relativePath, options) {
  const segments = relativePath.split(path.sep).filter(Boolean);

  const protectedDirectories = new Set([
    ...DEFAULT_PROTECTED_DIRECTORIES,
    ...(options.protectedDirectories || [])
  ].map((item) => String(item).toLowerCase()));

  const protectedFiles = new Set([
    ...DEFAULT_PROTECTED_FILES,
    ...(options.protectedFiles || [])
  ].map((item) => String(item).toLowerCase()));

  for (const segment of segments) {
    if (protectedDirectories.has(segment.toLowerCase())) {
      return true;
    }
  }

  const basename = path.basename(relativePath).toLowerCase();

  if (protectedFiles.has(basename)) {
    return true;
  }

  if (
    basename.startsWith('.env.') &&
    basename !== '.env.example' &&
    basename !== '.env.sample' &&
    basename !== '.env.template'
  ) {
    return true;
  }

  if (SENSITIVE_EXTENSIONS.has(path.extname(basename).toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Resolve a target strictly inside root.
 *
 * @param {string} root Existing repository root.
 * @param {string} candidate Relative target path.
 * @param {object} options Optional operation and policy configuration.
 * @returns {string} Canonical absolute target path.
 */
function resolveInsideRoot(root, candidate, options = {}) {
  const canonicalRoot = validateRoot(root);
  const relativePath = normalizeRelativePath(candidate);
  const target = path.resolve(canonicalRoot, relativePath);

  if (!isInsideRoot(canonicalRoot, target) || target === canonicalRoot) {
    throw new PathGuardError(
      'Target escapes the repository root or identifies the root itself.',
      {
        code: 'PATH_OUTSIDE_ROOT',
        path: candidate
      }
    );
  }

  const operation = options.operation || 'read';

  if (!['read', 'write', 'create', 'delete', 'inspect'].includes(operation)) {
    throw new PathGuardError(
      'Unsupported filesystem operation.',
      { code: 'INVALID_OPERATION', path: candidate }
    );
  }

  const relative = path.relative(canonicalRoot, target);

  if (
    options.protectSensitive !== false &&
    matchesProtectedPath(relative, options)
  ) {
    throw new PathGuardError(
      'Access to this protected path is denied.',
      {
        code: 'PROTECTED_PATH',
        path: relative
      }
    );
  }

  const ancestor = getExistingAncestor(target);
  const canonicalAncestor = canonicalizeExistingPath(ancestor);

  if (!isInsideRoot(canonicalRoot, canonicalAncestor)) {
    throw new PathGuardError(
      'A symlink or parent directory resolves outside the repository root.',
      {
        code: 'SYMLINK_ESCAPE',
        path: candidate
      }
    );
  }

  // Inspect each existing component to detect symlink escapes.
  let current = canonicalRoot;

  for (const segment of relative.split(path.sep)) {
    if (!segment) continue;

    current = path.join(current, segment);

    let stat;

    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        break;
      }

      throw new PathGuardError(
        'Unable to inspect a path component.',
        {
          code: 'PATH_INSPECTION_FAILED',
          path: current
        }
      );
    }

    if (stat.isSymbolicLink()) {
      const realTarget = canonicalizeExistingPath(current);

      if (!isInsideRoot(canonicalRoot, realTarget)) {
        throw new PathGuardError(
          'Symbolic links pointing outside the repository are denied.',
          {
            code: 'SYMLINK_ESCAPE',
            path: current
          }
        );
      }

      current = realTarget;
    }
  }

  if (operation === 'write' || operation === 'create') {
    if (fs.existsSync(target)) {
      let stat;

      try {
        stat = fs.lstatSync(target);
      } catch {
        throw new PathGuardError(
          'Unable to inspect existing write target.',
          {
            code: 'PATH_INSPECTION_FAILED',
            path: target
          }
        );
      }

      if (stat.isSymbolicLink()) {
        throw new PathGuardError(
          'Writing through a symbolic link is denied.',
          {
            code: 'SYMLINK_WRITE_DENIED',
            path: target
          }
        );
      }

      if (!stat.isFile()) {
        throw new PathGuardError(
          'Write target must be a regular file.',
          {
            code: 'INVALID_WRITE_TARGET',
            path: target
          }
        );
      }
    } else if (operation === 'create' && options.createDirectories !== true) {
      const parent = path.dirname(target);

      if (!fs.existsSync(parent)) {
        throw new PathGuardError(
          'Parent directory does not exist.',
          {
            code: 'PARENT_NOT_FOUND',
            path: parent
          }
        );
      }
    }
  }

  if (operation === 'delete' && fs.existsSync(target)) {
    const stat = fs.lstatSync(target);

    if (stat.isSymbolicLink() || stat.isDirectory()) {
      throw new PathGuardError(
        'Deleting symlinks and directories is denied by default.',
        {
          code: 'UNSAFE_DELETE_TARGET',
          path: target
        }
      );
    }
  }

  return target;
}

function safeReadFile(root, candidate, options = {}) {
  const target = resolveInsideRoot(root, candidate, {
    ...options,
    operation: 'read'
  });

  const stat = fs.lstatSync(target);

  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new PathGuardError(
      'Read target must be a regular file, not a symbolic link.',
      {
        code: 'UNSAFE_READ_TARGET',
        path: target
      }
    );
  }

  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;

  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer.');
  }

  if (stat.size > maxBytes) {
    throw new PathGuardError(
      'File exceeds the configured read-size limit.',
      {
        code: 'FILE_TOO_LARGE',
        path: target
      }
    );
  }

  return fs.readFileSync(target, options.encoding || null);
}

function safeWriteFile(root, candidate, content, options = {}) {
  if (!Buffer.isBuffer(content) && typeof content !== 'string') {
    throw new TypeError('Content must be a string or Buffer.');
  }

  const target = resolveInsideRoot(root, candidate, {
    ...options,
    operation: options.create ? 'create' : 'write'
  });

  const parent = path.dirname(target);

  if (!fs.existsSync(parent)) {
    if (options.createDirectories === true) {
      fs.mkdirSync(parent, {
        recursive: true,
        mode: 0o750
      });
    } else {
      throw new PathGuardError(
        'Parent directory does not exist.',
        {
          code: 'PARENT_NOT_FOUND',
          path: parent
        }
      );
    }
  }

  // Re-check after directory creation. This reduces risk but does not
  // eliminate races caused by concurrent filesystem modifications.
  const checkedTarget = resolveInsideRoot(root, candidate, {
    ...options,
    operation: options.create ? 'create' : 'write'
  });

  if (checkedTarget !== target) {
    throw new PathGuardError(
      'Target changed during validation.',
      {
        code: 'PATH_CHANGED',
        path: candidate
      }
    );
  }

  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const size = Buffer.byteLength(content);

  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer.');
  }

  if (size > maxBytes) {
    throw new PathGuardError(
      'Content exceeds the configured write-size limit.',
      {
        code: 'CONTENT_TOO_LARGE',
        path: target
      }
    );
  }

  if (options.overwrite === false && fs.existsSync(target)) {
    throw new PathGuardError(
      'Target already exists and overwrite is disabled.',
      {
        code: 'OVERWRITE_DENIED',
        path: target
      }
    );
  }

  const flags = options.overwrite === false ? 'wx' : 'w';

  try {
    fs.writeFileSync(target, content, {
      encoding: options.encoding || 'utf8',
      flag: flags,
      mode: 0o640
    });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new PathGuardError(
        'Target already exists and overwrite is disabled.',
        {
          code: 'OVERWRITE_DENIED',
          path: target
        }
      );
    }

    throw new PathGuardError(
      'Failed to write the requested file.',
      {
        code: 'WRITE_FAILED',
        path: target
      }
    );
  }

  return {
    path: target,
    bytesWritten: size
  };
}

function safeDeleteFile(root, candidate, options = {}) {
  const target = resolveInsideRoot(root, candidate, {
    ...options,
    operation: 'delete'
  });

  const stat = fs.lstatSync(target);

  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new PathGuardError(
      'Only regular files can be deleted.',
      {
        code: 'UNSAFE_DELETE_TARGET',
        path: target
      }
    );
  }

  fs.unlinkSync(target);

  return {
    path: target,
    deleted: true
  };
}

module.exports = {
  PATH_GUARD_VERSION,
  PathGuardError,
  isInsideRoot,
  normalizeRelativePath,
  validateRoot,
  resolveInsideRoot,
  safeReadFile,
  safeWriteFile,
  safeDeleteFile
};
