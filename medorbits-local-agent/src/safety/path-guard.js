/**

* MedOrbits Local Agent
* File: src/safety/path-guard.js
* Security responsibilities:
* ●	Keep file operations inside an approved repository root.
* ●	Prevent path traversal and absolute-path escapes.
* ●	Detect symbolic-link escapes.
* ●	Reject invalid and unsafe path inputs.
* ●	Provide safe path-resolution helpers for file operations.
* This module does not read, write, delete, or modify file contents.
* Runtime: Node.js 20+
    */

import path from "node:path";
import fs from "node:fs";
import { realpath, lstat } from "node:fs/promises";

const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\/]/;
const WINDOWS_UNC_PATH = /^(?:\\|//)/;
const NULL_BYTE = /\0/;

export class PathGuardError extends Error {
constructor(message, code = "PATH_GUARD_REJECTED", options = {}) {
super(message, options);
this.name = "PathGuardError";
this.code = code;
}
}

function reject(message, code) {
throw new PathGuardError(message, code);
}

function validatePathInput(value, label = "path") {
if (typeof value !== "string" || value.length === 0) {
reject(${label} must be a non-empty string., "INVALID_PATH");
}

if (value.trim() !== value) {
reject(${label} must not contain surrounding whitespace., "INVALID_PATH");
}

if (NULL_BYTE.test(value)) {
reject(${label} contains a null byte., "INVALID_PATH");
}

if (value.includes("\n") || value.includes("\r")) {
reject(${label} contains a newline., "INVALID_PATH");
}

if (WINDOWS_UNC_PATH.test(value)) {
reject("UNC paths are not allowed.", "ABSOLUTE_PATH_REJECTED");
}
}

function isWithinRoot(root, target) {
const relative = path.relative(root, target);

return (
relative === "" ||
(
relative !== ".." &&
!relative.startsWith(..${path.sep}) &&
!path.isAbsolute(relative)
)
);
}

function normalizeRootInput(root) {
validatePathInput(root, "repository root");

if (
WINDOWS_ABSOLUTE_PATH.test(root) &&
path.sep !== "\"
) {
reject(
"A Windows absolute root cannot be used on this platform.",
"INVALID_ROOT"
);
}

return path.resolve(root);
}

/**

* Create a path guard for one repository root.
* @param {object} options
* @param {string} options.root Repository root.
* @param {boolean} [options.allowRoot=true] Whether the root itself is valid.
* @returns {object} Path-guard API.
    */
    export function createPathGuard({
    root,
    allowRoot = true
    } = {}) {
    const configuredRoot = normalizeRootInput(root);

if (typeof allowRoot !== "boolean") {
throw new TypeError("allowRoot must be a boolean.");
}

/**

* Resolve a repository-relative path lexically.
* Absolute paths are rejected by default, including paths that happen
* to point inside the repository. Callers should pass relative paths.
    */
    function resolvePath(input) {
    validatePathInput(input);

if (
  path.isAbsolute(input) ||
  WINDOWS_ABSOLUTE_PATH.test(input) ||
  WINDOWS_UNC_PATH.test(input)
) {
  reject(
    "Absolute paths are not allowed; provide a repository-relative path.",
    "ABSOLUTE_PATH_REJECTED"
  );
}
const normalizedInput = input.replace(/[\\/]+/g, path.sep);
const target = path.resolve(configuredRoot, normalizedInput);
if (!isWithinRoot(configuredRoot, target)) {
  reject(
    "The requested path escapes the repository root.",
    "PATH_TRAVERSAL_REJECTED"
  );
}
if (!allowRoot && target === configuredRoot) {
  reject(
    "Operations on the repository root itself are not allowed.",
    "ROOT_OPERATION_REJECTED"
  );
}
return target;

}

/**

* Resolve a relative path and verify that existing symlinks do not
* lead outside the real repository root.
* For a path that does not exist yet, existing ancestors are checked.
* This reduces risk but cannot eliminate time-of-check/time-of-use
* races if another process changes filesystem entries concurrently.
    */
    async function resolveExistingSafePath(input) {
    const target = resolvePath(input);

let realRoot;
try {
  realRoot = await realpath(configuredRoot);
} catch (error) {
  throw new PathGuardError(
    "The repository root could not be resolved.",
    "ROOT_NOT_ACCESSIBLE",
    { cause: error }
  );
}
let current = target;
const unresolvedSegments = [];
while (true) {
  try {
    await lstat(current);
    break;
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new PathGuardError(
        "The requested path could not be inspected.",
        "PATH_INSPECTION_FAILED",
        { cause: error }
      );
    }
    const parent = path.dirname(current);
    if (parent === current) {
      reject(
        "No existing ancestor was found for the requested path.",
        "PATH_NOT_RESOLVABLE"
      );
    }
    unresolvedSegments.unshift(path.basename(current));
    current = parent;
  }
}
let realAncestor;
try {
  realAncestor = await realpath(current);
} catch (error) {
  throw new PathGuardError(
    "The requested path ancestor could not be resolved.",
    "PATH_RESOLUTION_FAILED",
    { cause: error }
  );
}
if (!isWithinRoot(realRoot, realAncestor)) {
  reject(
    "The requested path resolves outside the repository root.",
    "SYMLINK_ESCAPE_REJECTED"
  );
}
// If an existing target is itself a symlink, realpath resolves it.
// For a nonexistent target, rebuild the path from its verified ancestor.
const resolvedTarget = path.resolve(
  realAncestor,
  ...unresolvedSegments
);
if (!isWithinRoot(realRoot, resolvedTarget)) {
  reject(
    "The resolved path escapes the repository root.",
    "PATH_TRAVERSAL_REJECTED"
  );
}
return resolvedTarget;

}

/**

* Inspect an existing target and reject symlinks when requested.
* This is useful for file-write workflows where replacing a symlink
* or following one is not permitted.
    */
    async function inspectSafePath(input, { rejectSymlinks = true } = {}) {
    const target = await resolveExistingSafePath(input);

let stats;
try {
  stats = await lstat(target);
} catch (error) {
  if (error?.code === "ENOENT") {
    return {
      path: target,
      exists: false,
      isSymbolicLink: false,
      isFile: false,
      isDirectory: false
    };
  }
  throw new PathGuardError(
    "The requested path could not be inspected.",
    "PATH_INSPECTION_FAILED",
    { cause: error }
  );
}
if (rejectSymlinks && stats.isSymbolicLink()) {
  reject(
    "Symbolic links are not permitted for this operation.",
    "SYMLINK_REJECTED"
  );
}
return {
  path: target,
  exists: true,
  isSymbolicLink: stats.isSymbolicLink(),
  isFile: stats.isFile(),
  isDirectory: stats.isDirectory()
};

}

return Object.freeze({
root: configuredRoot,
resolvePath,
resolveExistingSafePath,
inspectSafePath,
isWithinRoot: (target) =>
typeof target === "string" &&
path.isAbsolute(target) &&
isWithinRoot(configuredRoot, path.resolve(target))
});
}

/**

* Resolve a path relative to a repository root.
* This synchronous helper performs lexical containment checks only.
* Use createPathGuard().resolveExistingSafePath() for asynchronous
* filesystem-aware checks.
    */
    export function resolveSafePath(root, input) {
    const guard = createPathGuard({ root });
    return guard.resolvePath(input);
    }

/**

* Resolve and inspect a path asynchronously.
    */
    export async function resolveExistingSafePath(root, input) {
    const guard = createPathGuard({ root });
    return guard.resolveExistingSafePath(input);
    }

export default createPathGuard;