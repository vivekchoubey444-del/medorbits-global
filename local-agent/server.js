
'use strict';

/**
 * MedOrbits Local Agent -- Local HTTP Server
 * File: /local-agent/server.mjs
 * Version: 1.0.0
 * Runtime: Node.js 20+
 *
 * Provides:
 *   GET  /api/agent/status
 *   GET  /api/agent/tasks
 *   GET  /api/agent/config
 *   POST /api/agent/tasks
 *   POST /api/agent/audit
 *   POST /api/agent/check
 *   POST /api/agent/cancel
 *
 * Security:
 *   - Loopback-only by default.
 *   - Optional bearer-token authentication.
 *   - Non-loopback binding requires an API token.
 *   - Fixed allowlist of Python utility scripts.
 *   - No shell execution or arbitrary command execution.
 *   - Bounded request bodies, task history, concurrency, and timeouts.
 *   - Static files are restricted to the public directory.
 *
 * Dependencies: Node.js standard library only.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawn } = require('node:child_process');

const VERSION = '1.0.0';
const APP_NAME = 'MedOrbits Local Agent';

const AGENT_DIR = __dirname;
const PUBLIC_DIR = path.join(AGENT_DIR, 'public');

const REPOSITORY_ROOT = path.resolve(
  process.env.MEDORBITS_REPO_ROOT || path.join(AGENT_DIR, '..')
);

const HOST = process.env.API_HOST || process.env.HOST || '127.0.0.1';
const PORT = parseInteger(process.env.API_PORT || process.env.PORT, 4173, 1, 65535);

const MAX_BODY_BYTES = parseInteger(
  process.env.MAX_REQUEST_BODY_BYTES, 1024 * 1024, 1024, 5 * 1024 * 1024
);

const MAX_TASKS = parseInteger(
  process.env.TASK_MAX_HISTORY, 500, 20, 5000
);

const MAX_CONCURRENT_TASKS = parseInteger(
  process.env.MAX_CONCURRENT_TASKS, 2, 1, 4
);

const TASK_TIMEOUT_MS = parseInteger(
  process.env.TASK_TIMEOUT_MS, 120000, 1000, 600000
);

const REQUEST_TIMEOUT_MS = parseInteger(
  process.env.REQUEST_TIMEOUT_MS, 30000, 1000, 120000
);

const READ_ONLY = parseBoolean(process.env.MEDORBITS_READ_ONLY, true);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const PYTHON = process.env.PYTHON_EXECUTABLE ||
  (process.platform === 'win32' ? 'python' : 'python3');

const API_TOKEN = process.env.API_TOKEN || '';

const CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);

const ALLOWED_TASKS = Object.freeze({
  validate: {
    label: 'Repository validation',
    script: 'tools/validate_repository.py',
    args: [],
  },
  audit: {
    label: 'Security audit',
    script: 'tools/security_audit.py',
    args: [],
  },
  check: {
    label: 'Syntax check',
    script: 'tools/syntax_check.py',
    args: [],
  },
  catalog: {
    label: 'File catalog',
    script: 'tools/file_catalog.py',
    args: [],
  },
});

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
});

const tasks = new Map();
const runningChildren = new Map();
const taskQueue = [];

let activeTasks = 0;
let stopping = false;
let server;

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

function parseInteger(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Configuration integer must be between ${min} and ${max}.`);
  }

  return parsed;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function now() {
  return new Date().toISOString();
}

function log(level, message, details) {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  const configured = levels[String(LOG_LEVEL).toLowerCase()] ?? 2;

  if ((levels[level] ?? 2) > configured) {
    return;
  }

  const suffix = details ? ` ${JSON.stringify(details)}` : '';
  const line = `[${now()}] [${level.toUpperCase()}] ${message}${suffix}`;

  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function isLoopback(host) {
  const value = String(host).toLowerCase();

  return value === 'localhost' ||
    value === '127.0.0.1' ||
    value === '::1' ||
    value === '::ffff:127.0.0.1';
}

function jsonResponse(res, status, data, extraHeaders = {}) {
  if (res.headersSent || res.destroyed) {
    return;
  }

  const body = JSON.stringify(data);

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extraHeaders,
  });

  res.end(body);
}

function errorResponse(res, status, message) {
  return jsonResponse(res, status, {
    error: message,
    version: VERSION,
    timestamp: now(),
  });
}

function getUrl(req) {
  try {
    return new URL(req.url, `http://${HOST}:${PORT}`);
  } catch {
    return null;
  }
}

function getClientAddress(req) {
  // Do not trust forwarded headers unless operating behind a configured,
  // trusted reverse proxy. This server does not enable proxy trust.
  return req.socket.remoteAddress || 'unknown';
}

function trimTaskHistory() {
  if (tasks.size <= MAX_TASKS) {
    return;
  }

  const removable = [...tasks.values()]
    .filter(task => !['queued', 'running'].includes(task.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  while (tasks.size > MAX_TASKS && removable.length) {
    const task = removable.shift();
    tasks.delete(task.id);
  }
}

function serializeTask(task) {
  return {
    id: task.id,
    type: task.type,
    label: task.label,
    description: task.description,
    status: task.status,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    durationMs: task.durationMs,
    exitCode: task.exitCode,
    message: task.message,
    output: task.output,
  };
}

function listTasks() {
  return [...tasks.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(serializeTask);
}

function countStatuses() {
  const result = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };

  for (const task of tasks.values()) {
    if (Object.hasOwn(result, task.status)) {
      result[task.status] += 1;
    }
  }

  return result;
}

function normalizeTaskType(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  const aliases = {
    validate: 'validate',
    validation: 'validate',
    'validate repository': 'validate',
    'repository validation': 'validate',

    audit: 'audit',
    security: 'audit',
    'security audit': 'audit',

    check: 'check',
    syntax: 'check',
    'syntax check': 'check',

    catalog: 'catalog',
    catalogue: 'catalog',
    inventory: 'catalog',
    'file catalog': 'catalog',
  };

  return aliases[normalized] || null;
}

function normalizeDescription(value) {
  if (typeof value !== 'string') {
    throw new Error('Task description must be a string.');
  }

  const description = value.trim().replace(/\s+/g, ' ');

  if (!description || description.length > 2000) {
    throw new Error('Task description must contain 1–2000 characters.');
  }

  return description;
}

function createTask(type, description) {
  const definition = ALLOWED_TASKS[type];

  if (!definition) {
    throw new Error('Unsupported task type. Allowed types: validate, audit, check, catalog.');
  }

  const task = {
    id: crypto.randomUUID(),
    type,
    label: definition.label,
    description,
    status: 'queued',
    createdAt: now(),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    exitCode: null,
    message: 'Task queued.',
    output: '',
    internalStartedAt: null,
  };

  tasks.set(task.id, task);
  taskQueue.push(task.id);

  trimTaskHistory();
  scheduleQueue();

  return task;
}

/* -------------------------------------------------------------------------- */
/* Authentication and CORS                                                    */
/* -------------------------------------------------------------------------- */

function applyCors(req, res) {
  const origin = req.headers.origin;

  if (!origin) {
    return true;
  }

  if (!CORS_ORIGINS.has(origin)) {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '600');

  return true;
}

function authorized(req) {
  if (isLoopback(HOST) && !API_TOKEN) {
    return true;
  }

  if (!API_TOKEN) {
    return false;
  }

  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return Boolean(match && safeEqual(match[1], API_TOKEN));
}

/* -------------------------------------------------------------------------- */
/* Request parsing                                                            */
/* -------------------------------------------------------------------------- */

async function readJsonBody(req) {
  const contentType = String(req.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (contentType !== 'application/json') {
    throw Object.assign(
      new Error('Content-Type must be application/json.'),
      { statusCode: 415 }
    );
  }

  const contentLength = Number(req.headers['content-length'] || 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Request body is too large.'), {
      statusCode: 413,
    });
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > MAX_BODY_BYTES) {
      throw Object.assign(new Error('Request body is too large.'), {
        statusCode: 413,
      });
    }

    chunks.push(chunk);
  }

  if (total === 0) {
    return {};
  }

  let value;

  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON request body.'), {
      statusCode: 400,
    });
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), {
      statusCode: 400,
    });
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* Fixed allowlisted task execution                                           */
/* -------------------------------------------------------------------------- */

function finishTask(task, status, message, exitCode = null, output = '') {
  if (!task || ['completed', 'failed', 'cancelled'].includes(task.status)) {
    return;
  }

  task.status = status;
  task.completedAt = now();
  task.durationMs = task.internalStartedAt
    ? Date.now() - task.internalStartedAt
    : 0;
  task.exitCode = exitCode;
  task.message = message;
  task.output = String(output).slice(-12000);

  runningChildren.delete(task.id);

  log(status === 'failed' ? 'warn' : 'info', 'Task finished', {
    id: task.id,
    type: task.type,
    status,
  });

  trimTaskHistory();
}

function executeTask(task) {
  return new Promise(resolve => {
    if (!task || task.status !== 'queued' || stopping) {
      resolve();
      return;
    }

    const definition = ALLOWED_TASKS[task.type];

    if (!definition) {
      finishTask(task, 'failed', 'Task type is not allowlisted.');
      resolve();
      return;
    }

    const scriptPath = path.resolve(AGENT_DIR, definition.script);

    if (!scriptPath.startsWith(`${AGENT_DIR}${path.sep}`) ||
        !fs.existsSync(scriptPath) ||
        !fs.statSync(scriptPath).isFile()) {
      finishTask(task, 'failed', 'Required utility script is unavailable.');
      resolve();
      return;
    }

    task.status = 'running';
    task.startedAt = now();
    task.internalStartedAt = Date.now();
    task.message = 'Task started.';

    let output = '';
    let settled = false;
    let timeout;
    let child;

    const settle = (status, message, exitCode = null) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (task.status !== 'cancelled') {
        finishTask(task, status, message, exitCode, output);
      }

      resolve();
    };

    try {
      // The command is a fixed Python executable plus a known script and
      // repository root. No shell is used, and user text is never an argument
      // to a command interpreter.
      child = spawn(
        PYTHON,
        [scriptPath, REPOSITORY_ROOT, ...definition.args],
        {
          cwd: REPOSITORY_ROOT,
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            PATH: process.env.PATH || '',
            SYSTEMROOT: process.env.SYSTEMROOT || '',
            WINDIR: process.env.WINDIR || '',
            LANG: process.env.LANG || 'C.UTF-8',
            PYTHONIOENCODING: 'utf-8',
            PYTHONDONTWRITEBYTECODE: '1',
            MEDORBITS_REPO_ROOT: REPOSITORY_ROOT,
          },
        }
      );

      runningChildren.set(task.id, child);

      const append = chunk => {
        output += chunk.toString('utf8');

        if (output.length > 16000) {
          output = output.slice(-12000);
        }
      };

      child.stdout.on('data', append);
      child.stderr.on('data', append);

      timeout = setTimeout(() => {
        if (task.status === 'running') {
          task.message = 'Task timed out; terminating the utility process.';
          try {
            child.kill('SIGTERM');
          } catch {
            // The process may already have exited.
          }

          const forceKill = setTimeout(() => {
            if (child && child.exitCode === null && !child.killed) {
              try {
                child.kill('SIGKILL');
              } catch {
                // Best-effort termination only.
              }
            }
          }, 1500);

          forceKill.unref();
          settle('failed', 'Task timed out.', null);
        }
      }, TASK_TIMEOUT_MS);

      timeout.unref();

      child.on('error', error => {
        settle('failed', `Could not start utility: ${error.message}`);
      });

      child.on('close', (code, signal) => {
        if (task.status === 'cancelled') {
          settle('cancelled', 'Task cancelled.', code);
          return;
        }

        if (code === 0) {
          settle('completed', 'Task completed successfully.', code);
        } else {
          settle(
            'failed',
            signal ? `Utility terminated by ${signal}.` : 'Task failed.',
            code
          );
        }
      });
    } catch (error) {
      settle('failed', `Task execution failed: ${error.message}`);
    }
  });
}

function scheduleQueue() {
  if (stopping) {
    return;
  }

  while (activeTasks < MAX_CONCURRENT_TASKS && taskQueue.length > 0) {
    const id = taskQueue.shift();
    const task = tasks.get(id);

    if (!task || task.status !== 'queued') {
      continue;
    }

    activeTasks += 1;

    executeTask(task)
      .catch(error => {
        log('error', 'Task executor error', { message: error.message });
      })
      .finally(() => {
        activeTasks = Math.max(0, activeTasks - 1);
        scheduleQueue();
      });
  }
}

/* -------------------------------------------------------------------------- */
/* Status and configuration                                                   */
/* -------------------------------------------------------------------------- */

function getStatus() {
  const counts = countStatuses();

  return {
    name: APP_NAME,
    version: VERSION,
    status: stopping ? 'stopping' : 'online',
    mode: READ_ONLY ? 'read-only' : 'restricted',
    readOnly: READ_ONLY,
    repository: path.basename(REPOSITORY_ROOT),
    repositoryConfigured: fs.existsSync(REPOSITORY_ROOT),
    activeTasks: counts.running,
    queuedTasks: counts.queued,
    completedTasks: counts.completed,
    failedTasks: counts.failed,
    cancelledTasks: counts.cancelled,
    totalTasks: tasks.size,
    maxConcurrentTasks: MAX_CONCURRENT_TASKS,
    lastUpdated: now(),
    platform: process.platform,
    nodeVersion: process.version,
    pythonExecutable: PYTHON,
  };
}

function getPublicConfig() {
  return {
    name: APP_NAME,
    version: VERSION,
    mode: READ_ONLY ? 'read-only' : 'restricted',
    readOnly: READ_ONLY,
    features: {
      repositoryValidation: true,
      securityAudit: true,
      syntaxCheck: true,
      fileCatalog: true,
      arbitraryShellExecution: false,
      arbitraryCodeExecution: false,
      automaticDeployment: false,
      automaticGitPush: false,
      fileMutationAPI: false,
    },
    allowedTasks: Object.keys(ALLOWED_TASKS),
    limits: {
      maxRequestBodyBytes: MAX_BODY_BYTES,
      maxConcurrentTasks: MAX_CONCURRENT_TASKS,
      taskTimeoutMs: TASK_TIMEOUT_MS,
      maxTaskHistory: MAX_TASKS,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* API routes                                                                 */
/* -------------------------------------------------------------------------- */

async function handleApi(req, res, url) {
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/agent/status') {
    jsonResponse(res, 200, getStatus());
    return;
  }

  if (req.method === 'GET' && pathname === '/api/agent/config') {
    jsonResponse(res, 200, getPublicConfig());
    return;
  }

  if (req.method === 'GET' && pathname === '/api/agent/tasks') {
    jsonResponse(res, 200, {
      tasks: listTasks(),
      counts: countStatuses(),
    });
    return;
  }

  if (req.method !== 'POST') {
    errorResponse(res, 405, 'Method not allowed.');
    return;
  }

  if (pathname === '/api/agent/tasks') {
    const body = await readJsonBody(req);

    if (body.readOnly === false) {
      errorResponse(res, 403, 'Write-enabled tasks are not supported.');
      return;
    }

    const type = normalizeTaskType(body.type || body.taskType || body.task);

    if (!type) {
      errorResponse(
        res,
        400,
        'Choose a supported task: validate, audit, check, or catalog.'
      );
      return;
    }

    let description;

    try {
      description = normalizeDescription(
        typeof body.task === 'string' ? body.task : type
      );
    } catch (error) {
      errorResponse(res, 400, error.message);
      return;
    }

    const task = createTask(type, description);

    jsonResponse(res, 202, {
      message: 'Task accepted.',
      task: serializeTask(task),
    });

    return;
  }

  if (pathname === '/api/agent/audit') {
    const task = createTask('audit', 'Security audit');
    jsonResponse(res, 202, {
      message: 'Security audit queued.',
      task: serializeTask(task),
    });
    return;
  }

  if (pathname === '/api/agent/check') {
    const task = createTask('check', 'Syntax check');
    jsonResponse(res, 202, {
      message: 'Syntax check queued.',
      task: serializeTask(task),
    });
    return;
  }

  if (pathname === '/api/agent/cancel') {
    const body = await readJsonBody(req);
    const requestedId = typeof body.taskId === 'string' ? body.taskId : null;
    let cancelled = 0;

    for (const task of tasks.values()) {
      if (requestedId && task.id !== requestedId) {
        continue;
      }

      if (task.status === 'queued') {
        task.status = 'cancelled';
        task.completedAt = now();
        task.message = 'Task cancelled before execution.';
        cancelled += 1;
        continue;
      }

      if (task.status === 'running') {
        const child = runningChildren.get(task.id);

        if (child) {
          task.status = 'cancelled';
          task.completedAt = now();
          task.message = 'Cancellation requested.';
          cancelled += 1;

          try {
            child.kill('SIGTERM');
          } catch {
            // Best-effort process termination.
          }
        }
      }
    }

    jsonResponse(res, 200, {
      message: cancelled ? 'Cancellation requested.' : 'No cancellable tasks found.',
      cancelled,
      counts: countStatuses(),
    });

    return;
  }

  errorResponse(res, 404, 'API endpoint not found.');
}

/* -------------------------------------------------------------------------- */
/* Static files                                                               */
/* -------------------------------------------------------------------------- */

function resolvePublicFile(urlPath) {
  let decoded;

  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  if (decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }

  if (decoded.split('/').some(segment => segment === '..' || segment.startsWith('.'))) {
    return null;
  }

  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(PUBLIC_DIR, relative);

  if (!target.startsWith(`${path.resolve(PUBLIC_DIR)}${path.sep}`)) {
    return null;
  }

  return target;
}

async function serveStatic(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    errorResponse(res, 405, 'Method not allowed.');
    return;
  }

  const file = resolvePublicFile(url.pathname);

  if (!file) {
    errorResponse(res, 400, 'Invalid file path.');
    return;
  }

  let stat;

  try {
    stat = await fs.promises.stat(file);
  } catch {
    errorResponse(res, 404, 'Resource not found.');
    return;
  }

  if (!stat.isFile()) {
    errorResponse(res, 404, 'Resource not found.');
    return;
  }

  const extension = path.extname(file).toLowerCase();
  const mime = MIME_TYPES[extension];

  if (!mime) {
    errorResponse(res, 403, 'File type is not served.');
    return;
  }

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
      "font-src 'self'; connect-src 'self'; object-src 'none'; " +
      "base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    if (!res.headersSent) {
      errorResponse(res, 500, 'Unable to read resource.');
    } else {
      res.destroy();
    }
  });

  stream.pipe(res);
}

/* -------------------------------------------------------------------------- */
/* HTTP server                                                                */
/* -------------------------------------------------------------------------- */

async function handleRequest(req, res) {
  const url = getUrl(req);

  if (!url) {
    errorResponse(res, 400, 'Invalid request URL.');
    return;
  }

  if (!applyCors(req, res)) {
    errorResponse(res, 403, 'Origin is not allowed.');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Cache-Control': 'no-store',
      'Content-Length': '0',
    });
    res.end();
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (!authorized(req)) {
      errorResponse(res, 401, 'Authentication required.');
      return;
    }

    await handleApi(req, res, url);
    return;
  }

  await serveStatic(req, res, url);
}

function createServer() {
  return http.createServer((req, res) => {
    res.setTimeout(REQUEST_TIMEOUT_MS, () => {
      if (!res.writableEnded) {
        errorResponse(res, 408, 'Request timed out.');
      }
    });

    handleRequest(req, res).catch(error => {
      log('error', 'Request handler failed', {
        message: error.message,
        method: req.method,
        url: req.url,
      });

      if (!res.headersSent && !res.destroyed) {
        errorResponse(res, error.statusCode || 500, 'Request failed.');
      } else if (!res.destroyed) {
        res.destroy();
      }
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Graceful shutdown                                                          */
/* -------------------------------------------------------------------------- */

function shutdown(signal) {
  if (stopping) {
    return;
  }

  stopping = true;
  log('info', 'Shutdown requested', { signal });

  for (const task of tasks.values()) {
    if (task.status === 'queued') {
      task.status = 'cancelled';
      task.completedAt = now();
      task.message = 'Cancelled during server shutdown.';
    }
  }

  for (const [id, child] of runningChildren) {
    const task = tasks.get(id);

    if (task && task.status === 'running') {
      task.status = 'cancelled';
      task.completedAt = now();
      task.message = 'Cancelled during server shutdown.';
    }

    try {
      child.kill('SIGTERM');
    } catch {
      // Best effort.
    }
  }

  if (server) {
    server.close(() => {
      log('info', 'HTTP server closed.');
      process.exitCode = 0;
    });

    const forceTimer = setTimeout(() => {
      log('warn', 'Forcing shutdown after grace period.');
      process.exit(1);
    }, 5000);

    forceTimer.unref();
  } else {
    process.exitCode = 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Startup                                                                    */
/* -------------------------------------------------------------------------- */

function start() {
  if (!fs.existsSync(REPOSITORY_ROOT) ||
      !fs.statSync(REPOSITORY_ROOT).isDirectory()) {
    throw new Error('Configured repository root does not exist or is not a directory.');
  }

  if (!fs.existsSync(PUBLIC_DIR) ||
      !fs.statSync(PUBLIC_DIR).isDirectory()) {
    throw new Error(`Dashboard public directory not found: ${PUBLIC_DIR}`);
  }

  if (!isLoopback(HOST) && !API_TOKEN) {
    throw new Error(
      'Non-loopback binding requires API_TOKEN. Refusing unsafe network exposure.'
    );
  }

  if (!isLoopback(HOST) && API_TOKEN.length < 32) {
    throw new Error(
      'For non-loopback binding, API_TOKEN must be at least 32 characters.'
    );
  }

  server = createServer();

  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = Math.min(REQUEST_TIMEOUT_MS, 15000);
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;

  server.on('clientError', (_error, socket) => {
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    }
  });

  server.on('error', error => {
    log('error', 'Server error', { message: error.message });
    process.exitCode = 1;
  });

  server.listen(PORT, HOST, () => {
    log('info', `${APP_NAME} ${VERSION} started`, {
      address: `http://${HOST}:${PORT}`,
      repository: REPOSITORY_ROOT,
      readOnly: READ_ONLY,
      python: PYTHON,
      hostname: os.hostname(),
    });
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  try {
    start();
  } catch (error) {
    console.error(`[FATAL] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  VERSION,
  ALLOWED_TASKS,
  normalizeTaskType,
  normalizeDescription,
  getStatus,
  getPublicConfig,
  createServer,
  start,
};
