
'use strict';

/**
 * MedOrbits Local Agent -- shared safe utilities.
 * CommonJS; Node.js 20+.
 *
 * This module does not execute commands, modify files, or access the network.
 */

const path = require('node:path');

const VERSION = '1.0.0';

function isInsideRoot(root, candidate) {
  const absoluteRoot = path.resolve(root);
  const absoluteCandidate = path.resolve(absoluteRoot, candidate);
  const relative = path.relative(absoluteRoot, absoluteCandidate);

  return relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
     relative !== '..' &&
     !path.isAbsolute(relative));
}

function validateRelativePath(root, candidate) {
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    throw new TypeError('A non-empty relative path is required.');
  }

  if (path.isAbsolute(candidate)) {
    throw new Error('Absolute paths are not allowed.');
  }

  const segments = candidate.split(/[\\/]+/);
  if (segments.includes('..')) {
    throw new Error('Parent-directory traversal is not allowed.');
  }

  const resolved = path.resolve(root, candidate);
  if (!isInsideRoot(root, resolved)) {
    throw new Error('Path escapes the repository root.');
  }

  return resolved;
}

function redactSecrets(value) {
  return String(value)
    .replace(
      /((?:api[_-]?key|secret|token|password|authorization)\s*[:=]\s*)\S+/ig,
      '$1[REDACTED]'
    )
    .replace(
      /\bBearer\s+[A-Za-z0-9._~+/=-]+/ig,
      'Bearer [REDACTED]'
    );
}

function normalizeTask(task) {
  if (typeof task !== 'string') {
    throw new TypeError('Task must be a string.');
  }

  const normalized = task.trim().replace(/\s+/g, ' ');

  if (!normalized || normalized.length > 2000) {
    throw new Error('Task must contain 1–2000 characters.');
  }

  return normalized;
}

module.exports = Object.freeze({
  VERSION,
  isInsideRoot,
  validateRelativePath,
  redactSecrets,
  normalizeTask,
});
