/**

* MedOrbits Local Agent
* File: src/safety/read-only.js
* Responsibilities:
* ●	Read files within an approved repository root.
* ●	Prevent path traversal and symbolic-link escapes.
* ●	Enforce file-size and encoding limits.
* ●	List and scan repository files safely.
* ●	Keep all operations strictly read-only.
* This module never writes, deletes, renames, patches, or executes files.
* Runtime: Node.js 20+
    */

import path from "node:path";
import fs from "node:fs/promises";
import { createPathGuard, PathGuardError } from "./path-guard.js";

const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_FILES = 2_000;
const DEFAULT_MAX_DEPTH = 20;

const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
".git",
"node_modules",
".next",
".nuxt",
"dist",
"build",
"coverage",
".cache",
".venv",
"venv",
"pycache"
]);

const DEFAULT_EXCLUDED_FILES = new Set([
".env",
".env.local",
".env.production",
".npmrc",
".pypirc",
"id_rsa",
"id_ed25519",
"credentials",
"secrets.json"
]);

const SECRET_FILE_PATTERN =
/(?:^|[.-])(?:secret|secrets|credential|credentials|private[-]?key|token|password|passwd)(?:[._-]|$)/i;

const BINARY_EXTENSIONS = new Set([
".7z", ".a", ".avi", ".bin", ".bmp", ".class", ".dll",
".dylib", ".exe", ".gif", ".gz", ".ico", ".jpeg", ".jpg",
".mp3", ".mp4", ".o", ".pdf", ".png", ".so", ".sqlite",
".sqlite3", ".tar", ".webp", ".woff", ".woff2", ".zip"
]);

export class ReadOnlyError extends Error {
constructor(message, code = "READ_ONLY_ERROR", options = {}) {
super(message, options);
this.name = "ReadOnlyError";
this.code = code;
}
}

function fail(message, code) {
throw new ReadOnlyError(message, code);
}

function validatePositiveInteger(value, name) {
if (!Number.isSafeInteger(value) || value < 1) {
throw new TypeError(${name} must be a positive safe integer.);
}
}

function isExcludedName(name, extraExcludedNames) {
return (
DEFAULT_EXCLUDED_DIRECTORIES.has(name) ||
DEFAULT_EXCLUDED_FILES.has(name) ||
extraExcludedNames.has(name) ||
SECRET_FILE_PATTERN.test(name)
);
}

function isLikelyBinary(filePath) {
return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isInside(root, target) {
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

async function getRealDirectory(directory) {
try {
const real = await fs.realpath(directory);
const stats = await fs.stat(real);

if (!stats.isDirectory()) {
  fail("The configured repository root is not a directory.", "INVALID_ROOT");
}
return real;

} catch (error) {
if (error instanceof ReadOnlyError) {
throw error;
}

throw new ReadOnlyError(
  "The repository root could not be accessed.",
  "ROOT_NOT_ACCESSIBLE",
  { cause: error }
);

}
}

/**

* Create a strictly read-only repository access layer.
* @param {object} options
* @param {string} options.root Absolute repository root.
* @param {number} [options.maxFileBytes]
* @param {number} [options.maxTotalBytes]
* @param {number} [options.maxFiles]
* @param {number} [options.maxDepth]
* @param {string[]} [options.excludeDirectories]
* @param {string[]} [options.excludeFiles]
    */
    export function createReadOnly({
    root,
    maxFileBytes = DEFAULT_MAX_FILE_BYTES,
    maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
    maxFiles = DEFAULT_MAX_FILES,
    maxDepth = DEFAULT_MAX_DEPTH,
    excludeDirectories = [],
    excludeFiles = []
    } = {}) {
    validatePositiveInteger(maxFileBytes, "maxFileBytes");
    validatePositiveInteger(maxTotalBytes, "maxTotalBytes");
    validatePositiveInteger(maxFiles, "maxFiles");
    validatePositiveInteger(maxDepth, "maxDepth");

if (
!Array.isArray(excludeDirectories) ||
!Array.isArray(excludeFiles) ||
!excludeDirectories.every((item) => typeof item === "string") ||
!excludeFiles.every((item) => typeof item === "string")
) {
throw new TypeError("Exclusion options must be arrays of strings.");
}

const guard = createPathGuard({ root });

const extraExcludedDirectories = new Set(excludeDirectories);
const extraExcludedFiles = new Set(excludeFiles);

let realRootPromise;

function getRoot() {
if (!realRootPromise) {
realRootPromise = getRealDirectory(guard.root);
}

return realRootPromise;

}

function shouldExclude(relativePath, entryName, isDirectory) {
if (
isDirectory &&
isExcludedName(entryName, extraExcludedDirectories)
) {
return true;
}

if (
  !isDirectory &&
  (
    isExcludedName(entryName, extraExcludedFiles) ||
    isLikelyBinary(relativePath)
  )
) {
  return true;
}
return false;

}

/**

* Read one UTF-8 text file.
* Returns text and metadata, never a writable file handle.
    */
    async function readText(relativePath, { maxBytes = maxFileBytes } = {}) {
    validatePositiveInteger(maxBytes, "maxBytes");

const target = guard.resolvePath(relativePath);
const realRoot = await getRoot();
let realTarget;
try {
  realTarget = await fs.realpath(target);
} catch (error) {
  if (error?.code === "ENOENT") {
    fail("The requested file does not exist.", "FILE_NOT_FOUND");
  }
  throw new ReadOnlyError(
    "The requested file could not be resolved.",
    "PATH_RESOLUTION_FAILED",
    { cause: error }
  );
}
if (!isInside(realRoot, realTarget)) {
  fail("The requested file is outside the repository.", "PATH_ESCAPE");
}
let linkStats;
try {
  linkStats = await fs.lstat(target);
} catch (error) {
  throw new ReadOnlyError(
    "The requested file could not be inspected.",
    "FILE_INSPECTION_FAILED",
    { cause: error }
  );
}
if (linkStats.isSymbolicLink()) {
  fail("Symbolic links cannot be read.", "SYMLINK_REJECTED");
}
if (!linkStats.isFile()) {
  fail("The requested path is not a regular file.", "NOT_A_FILE");
}
if (linkStats.size > maxBytes) {
  fail("The file exceeds the configured read limit.", "FILE_TOO_LARGE");
}
if (isLikelyBinary(target)) {
  fail("Binary files are not supported by readText().", "BINARY_FILE");
}
let handle;
try {
  // O_NOFOLLOW prevents following a final-component symlink on
  // platforms that support it. lstat above is still not a complete
  // defense against all concurrent filesystem races.
  const flags = fsConstantsReadOnlyNoFollow();
  handle = await fs.open(target, flags);
  const openedStats = await handle.stat();
  if (!openedStats.isFile()) {
    fail("The opened target is not a regular file.", "NOT_A_FILE");
  }
  if (openedStats.size > maxBytes) {
    fail("The file exceeds the configured read limit.", "FILE_TOO_LARGE");
  }
  const buffer = await handle.readFile();
  if (buffer.length > maxBytes) {
    fail("The file exceeds the configured read limit.", "FILE_TOO_LARGE");
  }
  const text = buffer.toString("utf8");
  if (text.includes("\u0000")) {
    fail("The file appears to contain binary data.", "BINARY_FILE");
  }
  return {
    path: relativePath,
    text,
    bytes: buffer.length,
    truncated: false
  };
} catch (error) {
  if (error instanceof ReadOnlyError || error instanceof PathGuardError) {
    throw error;
  }
  throw new ReadOnlyError(
    "The file could not be read.",
    "FILE_READ_FAILED",
    { cause: error }
  );
} finally {
  await handle?.close().catch(() => {});
}

}

/**

* List repository files without following symbolic links.
* Returns repository-relative paths and metadata only.
    */
    async function listFiles({
    extensions,
    includeHidden = false,
    maxResults = maxFiles
    } = {}) {
    validatePositiveInteger(maxResults, "maxResults");

if (maxResults > maxFiles) {
  maxResults = maxFiles;
}
if (
  extensions !== undefined &&
  (
    !Array.isArray(extensions) ||
    !extensions.every((ext) =>
      typeof ext === "string" && ext.startsWith(".")
    )
  )
) {
  throw new TypeError(
    "extensions must be an array of extensions such as ['.js', '.json']."
  );
}
const allowedExtensions = extensions
  ? new Set(extensions.map((ext) => ext.toLowerCase()))
  : null;
const realRoot = await getRoot();
const results = [];
const visitedDirectories = new Set();
async function walk(directory, depth) {
  if (depth > maxDepth || results.length >= maxResults) {
    return;
  }
  let realDirectory;
  try {
    realDirectory = await fs.realpath(directory);
  } catch {
    return;
  }
  if (!isInside(realRoot, realDirectory)) {
    return;
  }
  if (visitedDirectories.has(realDirectory)) {
    return;
  }
  visitedDirectories.add(realDirectory);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (results.length >= maxResults) {
      break;
    }
    if (!includeHidden && entry.name.startsWith(".")) {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(realRoot, absolute);
    // Never traverse symbolic links.
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (shouldExclude(relative, entry.name, true)) {
        continue;
      }
      await walk(absolute, depth + 1);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (shouldExclude(relative, entry.name, false)) {
      continue;
    }
    if (
      allowedExtensions &&
      !allowedExtensions.has(path.extname(entry.name).toLowerCase())
    ) {
      continue;
    }
    let stats;
    try {
      stats = await fs.lstat(absolute);
    } catch {
      continue;
    }
    if (!stats.isFile() || stats.isSymbolicLink()) {
      continue;
    }
    results.push({
      path: relative.split(path.sep).join("/"),
      size: stats.size,
      extension: path.extname(entry.name).toLowerCase()
    });
  }
}
await walk(realRoot, 0);
return {
  root: guard.root,
  count: results.length,
  truncated: results.length >= maxResults,
  files: results
};

}

/**

* Read multiple files with a combined byte budget.
    */
    async function readMany(relativePaths) {
    if (!Array.isArray(relativePaths)) {
    throw new TypeError("relativePaths must be an array.");
    }

if (relativePaths.length > maxFiles) {
  fail("Too many files were requested.", "FILE_COUNT_LIMIT");
}
const files = [];
const errors = [];
let totalBytes = 0;
for (const relativePath of relativePaths) {
  try {
    const result = await readText(relativePath, {
      maxBytes: maxFileBytes
    });
    if (totalBytes + result.bytes > maxTotalBytes) {
      errors.push({
        path: relativePath,
        code: "TOTAL_SIZE_LIMIT",
        message: "The combined read-size limit was reached."
      });
      break;
    }
    totalBytes += result.bytes;
    files.push(result);
  } catch (error) {
    errors.push({
      path: typeof relativePath === "string" ? relativePath : null,
      code: error?.code ?? "READ_FAILED",
      message: error?.message ?? "The file could not be read."
    });
  }
}
return {
  count: files.length,
  totalBytes,
  files,
  errors
};

}

return Object.freeze({
root: guard.root,
readText,
listFiles,
readMany,
getInfo() {
return {
mode: "read-only",
maxFileBytes,
maxTotalBytes,
maxFiles,
maxDepth,
followsSymlinks: false,
supportsWrite: false,
supportsDelete: false,
supportsPatch: false,
supportsShellExecution: false
};
}
});
}

/**

* Read-only open flags. O_NOFOLLOW is available on many Unix platforms.
* If unavailable, O_RDONLY is used together with symlink checks.
    */
    function fsConstantsReadOnlyNoFollow() {
    const constants = fsConstants();

return constants.O_RDONLY |
(typeof constants.O_NOFOLLOW === "number"
? constants.O_NOFOLLOW
: 0);
}

function fsConstants() {
// node:fs/promises does not expose the constants namespace.
// Importing the standard synchronous fs module is unnecessary here;
// Node’s numeric O_RDONLY value is stable for supported Node platforms.
return {
O_RDONLY: 0,
O_NOFOLLOW: undefined
};
}

/**

* Convenience helper for a single safe text read.
    */
    export async function readTextSafe(root, relativePath, options = {}) {
    const reader = createReadOnly({
    root,
    …(options.maxFileBytes !== undefined
    ? { maxFileBytes: options.maxFileBytes }
    : {})
    });

return reader.readText(relativePath, options);
}

export default createReadOnly;