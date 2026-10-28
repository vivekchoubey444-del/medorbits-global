
'use strict';

/**
 * MedOrbits Local Agent -- Path Configuration
 * -------------------------------------------
 * Centralizes repository paths, application directories, path validation,
 * and safe resolution for files used by the local agent.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins only.
 *
 * Security:
 * - Repository root must exist.
 * - Relative paths are confined to the configured root by default.
 * - Sensitive directories are excluded from automatic discovery.
 * - No directory creation or file mutation occurs during initialization.
 */

const fs = require('node:fs');
const path = require('node:path');

const PATH_CONFIG_VERSION = '1.0.0';

const DEFAULT_DIRECTORY_NAMES = Object.freeze({
  agent: 'local-agent',
  source: 'src',
  config: 'config',
  logs: 'logs',
  backups: 'backups',
  temp: 'tmp',
  reports: 'reports',
  schemas: 'schemas',
  tests: 'tests',
  examples: 'examples',
  services: 'services',
  providers: 'providor',
  safety: 'safety',
  docs: 'docs'
});

const DEFAULT_EXCLUDED_DIRECTORIES = Object.freeze([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.venv',
  'venv',
  '.ssh',
  '.aws',
  'secrets',
  'credentials'
]);

class PathConfigurationError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'PathConfigurationError';
    this.code = options.code || 'PATH_CONFIG_ERROR';
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

function requireDirectory(directory, label) {
  let canonical;

  try {
    canonical = fs.realpathSync.native(directory);
  } catch {
    throw new PathConfigurationError(
      `${label} must exist and be accessible.`,
      {
        code: 'DIRECTORY_NOT_FOUND',
        path: directory
      }
    );
  }

  let stat;

  try {
    stat = fs.statSync(canonical);
  } catch {
    throw new PathConfigurationError(
      `Unable to inspect ${label}.`,
      {
        code: 'DIRECTORY_INSPECTION_FAILED',
        path: directory
      }
    );
  }

  if (!stat.isDirectory()) {
    throw new PathConfigurationError(
      `${label} must be a directory.`,
      {
        code: 'NOT_A_DIRECTORY',
        path: directory
      }
    );
  }

  return canonical;
}

function validateRelativePath(candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new PathConfigurationError(
      'A non-empty relative path is required.',
      { code: 'INVALID_PATH' }
    );
  }

  if (candidate.includes('\0')) {
    throw new PathConfigurationError(
      'Null bytes are not allowed in paths.',
      { code: 'INVALID_PATH' }
    );
  }

  if (candidate !== candidate.trim()) {
    throw new PathConfigurationError(
      'Leading or trailing whitespace is not allowed in paths.',
      { code: 'INVALID_PATH', path: candidate }
    );
  }

  if (
    path.isAbsolute(candidate) ||
    path.win32.isAbsolute(candidate) ||
    /^[a-zA-Z]:/.test(candidate) ||
    candidate.startsWith('\\\\')
  ) {
    throw new PathConfigurationError(
      'Absolute paths are not allowed.',
      {
        code: 'ABSOLUTE_PATH_DENIED',
        path: candidate
      }
    );
  }

  const segments = candidate.split(/[\\/]+/);

  if (segments.some((segment) => segment === '..')) {
    throw new PathConfigurationError(
      'Parent-directory traversal is not allowed.',
      {
        code: 'PATH_TRAVERSAL_DENIED',
        path: candidate
      }
    );
  }

  const normalized = path.normalize(candidate);

  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    throw new PathConfigurationError(
      'Path does not identify an allowed child.',
      {
        code: 'PATH_TRAVERSAL_DENIED',
        path: candidate
      }
    );
  }

  return normalized;
}

function resolveContainedPath(root, candidate, options = {}) {
  const relative = validateRelativePath(candidate);
  const target = path.resolve(root, relative);

  if (!isInsideRoot(root, target) || target === root) {
    throw new PathConfigurationError(
      'Resolved path is outside the configured root.',
      {
        code: 'PATH_OUTSIDE_ROOT',
        path: candidate
      }
    );
  }

  const existingAncestor = findExistingAncestor(target);

  let canonicalAncestor;

  try {
    canonicalAncestor = fs.realpathSync.native(existingAncestor);
  } catch {
    throw new PathConfigurationError(
      'Unable to resolve an existing path ancestor.',
      {
        code: 'PATH_RESOLUTION_FAILED',
        path: candidate
      }
    );
  }

  if (!isInsideRoot(root, canonicalAncestor)) {
    throw new PathConfigurationError(
      'A symbolic link resolves outside the configured root.',
      {
        code: 'SYMLINK_ESCAPE',
        path: candidate
      }
    );
  }

  if (options.mustExist) {
    try {
      fs.lstatSync(target);
    } catch {
      throw new PathConfigurationError(
        'Requested path does not exist.',
        {
          code: 'PATH_NOT_FOUND',
          path: candidate
        }
      );
    }
  }

  if (fs.existsSync(target)) {
    let realTarget;

    try {
      realTarget = fs.realpathSync.native(target);
    } catch {
      throw new PathConfigurationError(
        'Unable to resolve the requested path.',
        {
          code: 'PATH_RESOLUTION_FAILED',
          path: candidate
        }
      );
    }

    if (!isInsideRoot(root, realTarget)) {
      throw new PathConfigurationError(
        'Resolved target is outside the configured root.',
        {
          code: 'SYMLINK_ESCAPE',
          path: candidate
        }
      );
    }

    if (options.rejectSymlink) {
      const stat = fs.lstatSync(target);

      if (stat.isSymbolicLink()) {
        throw new PathConfigurationError(
          'Symbolic-link targets are not allowed.',
          {
            code: 'SYMLINK_DENIED',
            path: candidate
          }
        );
      }
    }
  }

  return target;
}

function findExistingAncestor(target) {
  let current = target;

  while (true) {
    try {
      fs.lstatSync(current);
      return current;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw new PathConfigurationError(
          'Unable to inspect path ancestor.',
          {
            code: 'PATH_INSPECTION_FAILED',
            path: current
          }
        );
      }

      const parent = path.dirname(current);

      if (parent === current) {
        throw new PathConfigurationError(
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

function validateDirectoryNames(names) {
  if (!names || typeof names !== 'object' || Array.isArray(names)) {
    throw new TypeError('directoryNames must be an object.');
  }

  const result = {};

  for (const [key, value] of Object.entries(names)) {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.includes('/') ||
      value.includes('\\') ||
      value === '.' ||
      value === '..' ||
      value.includes('\0')
    ) {
      throw new PathConfigurationError(
        `Invalid directory name for "${key}".`,
        {
          code: 'INVALID_DIRECTORY_NAME',
          path: String(value)
        }
      );
    }

    result[key] = value;
  }

  return result;
}

class PathConfiguration {
  constructor(options = {}) {
    const requestedRoot =
      options.root ||
      process.env.MEDORBITS_REPO_ROOT ||
      process.cwd();

    if (typeof requestedRoot !== 'string' || !requestedRoot.trim()) {
      throw new PathConfigurationError(
        'Repository root must be a non-empty string.',
        { code: 'INVALID_ROOT' }
      );
    }

    this.root = requireDirectory(
      path.resolve(requestedRoot),
      'Repository root'
    );

    this.directoryNames = Object.freeze({
      ...DEFAULT_DIRECTORY_NAMES,
      ...validateDirectoryNames(options.directoryNames || {})
    });

    this.excludedDirectories = Object.freeze([
      ...new Set([
        ...DEFAULT_EXCLUDED_DIRECTORIES,
        ...(options.excludedDirectories || [])
      ])
    ]);

    this.agentRoot = this.resolve(
      options.agentRelativePath || 'local-agent'
    );

    this.sourceRoot = this.resolve(
      path.posix.join(
        path.relative(this.root, this.agentRoot).split(path.sep).join('/'),
        this.directoryNames.source
      )
    );

    this.directories = Object.freeze({
      agent: this.agentRoot,
      source: this.sourceRoot,
      config: this.resolveWithin(this.sourceRoot, this.directoryNames.config),
      logs: this.resolveWithin(this.agentRoot, this.directoryNames.logs),
      backups: this.resolveWithin(this.agentRoot, this.directoryNames.backups),
      temp: this.resolveWithin(this.agentRoot, this.directoryNames.temp),
      reports: this.resolveWithin(this.agentRoot, this.directoryNames.reports),
      schemas: this.resolveWithin(this.agentRoot, this.directoryNames.schemas),
      tests: this.resolveWithin(this.sourceRoot, this.directoryNames.tests),
      examples: this.resolveWithin(this.sourceRoot, this.directoryNames.examples),
      services: this.resolveWithin(this.sourceRoot, this.directoryNames.services),
      providers: this.resolveWithin(this.sourceRoot, this.directoryNames.providers),
      safety: this.resolveWithin(this.sourceRoot, this.directoryNames.safety),
      docs: this.resolveWithin(this.agentRoot, this.directoryNames.docs)
    });
  }

  resolve(candidate, options = {}) {
    return resolveContainedPath(this.root, candidate, options);
  }

  resolveWithin(baseDirectory, candidate, options = {}) {
    const canonicalBase = path.resolve(baseDirectory);

    if (!isInsideRoot(this.root, canonicalBase)) {
      throw new PathConfigurationError(
        'Base directory is outside the repository root.',
        {
          code: 'PATH_OUTSIDE_ROOT',
          path: baseDirectory
        }
      );
    }

    const baseRelative = path.relative(this.root, canonicalBase);

    if (!baseRelative) {
      return this.resolve(candidate, options);
    }

    const normalizedCandidate = validateRelativePath(candidate);

    return this.resolve(
      path.join(baseRelative, normalizedCandidate),
      options
    );
  }

  isExcludedDirectory(name) {
    return this.excludedDirectories.includes(name);
  }

  getStatus() {
    return {
      version: PATH_CONFIG_VERSION,
      root: this.root,
      agentRoot: this.agentRoot,
      sourceRoot: this.sourceRoot,
      directories: { ...this.directories },
      excludedDirectories: [...this.excludedDirectories]
    };
  }
}

function createPathConfiguration(options = {}) {
  return new PathConfiguration(options);
}

module.exports = {
  PATH_CONFIG_VERSION,
  DEFAULT_DIRECTORY_NAMES,
  DEFAULT_EXCLUDED_DIRECTORIES,
  PathConfigurationError,
  isInsideRoot,
  validateRelativePath,
  resolveContainedPath,
  createPathConfiguration,
  PathConfiguration
};
