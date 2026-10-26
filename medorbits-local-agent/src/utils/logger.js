/**

* MedOrbits Local Coding Agent
* File: src/utils/logger.js
* Structured logger for local development and production diagnostics.
* Features:
* ●	debug, info, warn, error, and fatal levels
* ●	Human-readable or JSON output
* ●	Timestamped log records
* ●	Error object serialization
* ●	Optional file logging
* ●	Secret redaction
* ●	Configurable log level
* Environment:
* LOG_LEVEL=debug|info|warn|error|fatal|silent
* LOG_FORMAT=pretty|json
* LOG_FILE=/absolute/path/to/agent.log
* LOG_TO_CONSOLE=true|false
    */

import fs from "node:fs";
import path from "node:path";
import { inspect } from "node:util";

const LEVELS = Object.freeze({
debug: 10,
info: 20,
warn: 30,
error: 40,
fatal: 50,
silent: Infinity,
});

const SENSITIVE_KEY_PATTERN =
/password|passwd|secret|token|authorization|api[-]?key|private[-]?key|credential|cookie/i;

const SENSITIVE_VALUE_PATTERNS = [
/\bBearer\s+[A-Za-z0-9.~+/=-]+/gi,
/\bsk-[A-Za-z0-9-]{12,}\b/g,
];

const MAX_DEPTH = 8;
const MAX_STRING_LENGTH = 12000;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 100;

function normalizeLevel(level, fallback = "info") {
if (typeof level !== "string") {
return fallback;
}

const normalized = level.trim().toLowerCase();

return Object.hasOwn(LEVELS, normalized)
? normalized
: fallback;
}

function normalizeFormat(format) {
return format === "json" ? "json" : "pretty";
}

function redactString(value) {
let result = value;

for (const pattern of SENSITIVE_VALUE_PATTERNS) {
result = result.replace(pattern, "[REDACTED]");
}

return result.length > MAX_STRING_LENGTH
? ${result.slice(0, MAX_STRING_LENGTH)}… [truncated]
: result;
}

function serializeError(error, depth = 0) {
if (depth > MAX_DEPTH) {
return { message: "[Maximum error serialization depth reached]" };
}

if (!(error instanceof Error)) {
return redactValue(error, depth + 1);
}

const result = {
name: error.name,
message: redactString(error.message || ""),
};

if (error.stack) {
result.stack = redactString(error.stack);
}

if (error.code !== undefined) {
result.code = error.code;
}

if (error.cause !== undefined) {
result.cause = serializeError(error.cause, depth + 1);
}

// Include useful enumerable properties without exposing sensitive keys.
for (const key of Object.keys(error).slice(0, MAX_OBJECT_KEYS)) {
if (SENSITIVE_KEY_PATTERN.test(key)) {
result[key] = "[REDACTED]";
continue;
}

try {
  result[key] = redactValue(error[key], depth + 1);
} catch {
  result[key] = "[Unserializable property]";
}

}

return result;
}

function redactValue(value, depth = 0, seen = new WeakSet()) {
if (depth > MAX_DEPTH) {
return "[Maximum serialization depth reached]";
}

if (value === null || value === undefined) {
return value;
}

if (typeof value === "string") {
return redactString(value);
}

if (
typeof value === "number" ||
typeof value === "boolean"
) {
return value;
}

if (typeof value === "bigint") {
return value.toString();
}

if (typeof value === "function") {
return [Function ${value.name || "anonymous"}];
}

if (typeof value === "symbol") {
return value.toString();
}

if (value instanceof Error) {
return serializeError(value, depth + 1);
}

if (typeof value !== "object") {
return String(value);
}

if (seen.has(value)) {
return "[Circular]";
}

seen.add(value);

if (Array.isArray(value)) {
const result = value
.slice(0, MAX_ARRAY_ITEMS)
.map((item) => redactValue(item, depth + 1, seen));

if (value.length > MAX_ARRAY_ITEMS) {
  result.push(`[${value.length - MAX_ARRAY_ITEMS} more items]`);
}
seen.delete(value);
return result;

}

if (value instanceof Date) {
seen.delete(value);
return Number.isNaN(value.getTime())
? "Invalid Date"
: value.toISOString();
}

if (value instanceof URL) {
// URLs can contain credentials or query tokens.
const safeUrl = new URL(value.href);

if (safeUrl.username) safeUrl.username = "[REDACTED]";
if (safeUrl.password) safeUrl.password = "[REDACTED]";
for (const key of safeUrl.searchParams.keys()) {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    safeUrl.searchParams.set(key, "[REDACTED]");
  }
}
seen.delete(value);
return redactString(safeUrl.toString());

}

const result = {};
const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);

for (const [key, item] of entries) {
if (SENSITIVE_KEY_PATTERN.test(key)) {
result[key] = "[REDACTED]";
continue;
}

try {
  result[key] = redactValue(item, depth + 1, seen);
} catch {
  result[key] = "[Unserializable value]";
}

}

if (Object.keys(value).length > MAX_OBJECT_KEYS) {
result.__truncatedKeys = Object.keys(value).length - MAX_OBJECT_KEYS;
}

seen.delete(value);
return result;
}

function extractArguments(args) {
const result = {
message: "",
context: {},
};

const values = […args];

if (values.length === 0) {
return result;
}

const first = values.shift();

if (first instanceof Error) {
result.message = first.message || first.name;
result.context.error = serializeError(first);
} else if (typeof first === "string") {
result.message = first;
} else if (first !== undefined) {
result.context = {
data: redactValue(first),
};
}

for (const value of values) {
if (value instanceof Error) {
result.context.error = serializeError(value);
} else if (
value &&
typeof value === "object" &&
!Array.isArray(value)
) {
result.context = {
…result.context,
…redactValue(value),
};
} else if (value !== undefined) {
const existing = result.context.details;

  result.context.details = existing === undefined
    ? [redactValue(value)]
    : [...existing, redactValue(value)];
}

}

result.message = redactString(result.message);

return result;
}

function formatPretty(record) {
const timestamp = record.timestamp;
const level = record.level.toUpperCase().padEnd(5);
const scope = record.scope ?  [${record.scope}] : "";
const message = record.message || "(no message)";

let output = ${timestamp} ${level}${scope} ${message};

if (Object.keys(record.context).length > 0) {
output += \n${inspect(record.context, { colors: false, depth: MAX_DEPTH, compact: false, breakLength: 100, })};
}

return output;
}

function resolveLogFile(filePath) {
if (!filePath || typeof filePath !== "string") {
return null;
}

const resolved = path.resolve(filePath);

if (resolved.includes("\0")) {
throw new Error("Log file path contains a null byte.");
}

return resolved;
}

function createFileWriter(filePath) {
if (!filePath) {
return null;
}

const resolved = resolveLogFile(filePath);

// Do not create directories or open files at module import time.
// The stream is initialized only when a log entry is written.
let stream = null;
let streamFailed = false;

function write(line) {
if (streamFailed) {
return;
}

if (!stream) {
  try {
    stream = fs.createWriteStream(resolved, {
      flags: "a",
      encoding: "utf8",
      mode: 0o600,
    });
    stream.on("error", () => {
      streamFailed = true;
    });
  } catch {
    streamFailed = true;
    return;
  }
}
try {
  stream.write(`${line}\n`);
} catch {
  streamFailed = true;
}

}

function close() {
if (!stream) {
return Promise.resolve();
}

return new Promise((resolve) => {
  stream.end(resolve);
});

}

return { write, close };
}

function createLogger(options = {}) {
const configuredLevel = normalizeLevel(
options.level ?? process.env.LOG_LEVEL,
"info"
);

const format = normalizeFormat(
options.format ?? process.env.LOG_FORMAT
);

const scope = options.scope
? String(options.scope)
: "MedOrbits";

const consoleEnabled =
options.consoleEnabled ??
process.env.LOG_TO_CONSOLE !== "false";

const filePath = options.filePath ?? process.env.LOG_FILE ?? "";
const fileWriter = createFileWriter(filePath);

function shouldLog(level) {
return (
LEVELS[level] >= LEVELS[configuredLevel] &&
configuredLevel !== "silent"
);
}

function write(level, …args) {
if (!shouldLog(level)) {
return null;
}

const extracted = extractArguments(args);
const record = {
  timestamp: new Date().toISOString(),
  level,
  scope,
  message: extracted.message,
  context: extracted.context,
};
let serialized;
try {
  serialized = JSON.stringify(record);
} catch {
  serialized = JSON.stringify({
    timestamp: record.timestamp,
    level,
    scope,
    message: "[Log serialization failed]",
    context: {},
  });
}
const output = format === "json"
  ? serialized
  : formatPretty(record);
if (consoleEnabled) {
  if (level === "error" || level === "fatal") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}
fileWriter?.write(serialized);
return record;

}

const logger = {
debug: (…args) => write("debug", …args),
info: (…args) => write("info", …args),
warn: (…args) => write("warn", …args),
error: (…args) => write("error", …args),
fatal: (…args) => write("fatal", …args),

child(childScope, childOptions = {}) {
  const combinedScope = [scope, childScope]
    .filter(Boolean)
    .join(":");
  return createLogger({
    level: childOptions.level ?? configuredLevel,
    format: childOptions.format ?? format,
    scope: combinedScope,
    consoleEnabled: childOptions.consoleEnabled ?? consoleEnabled,
    filePath: childOptions.filePath ?? filePath,
  });
},
isLevelEnabled(level) {
  const normalized = normalizeLevel(level, "silent");
  return shouldLog(normalized);
},
async close() {
  await fileWriter?.close();
},

};

return Object.freeze(logger);
}

const logger = createLogger();

export { createLogger, redactValue, serializeError };
export default logger;