
'use strict';

/**
 * MedOrbits Local Agent
 * File: /local-agent/src/index.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Initialize the local agent, validate configuration, register approved
 *   tasks, and coordinate repository checks and backup operations.
 *
 * Security:
 *   - No arbitrary shell-command execution.
 *   - No automatic deletion or overwriting of existing files.
 *   - Repository operations must remain within the configured root.
 *   - Optional tasks must fail independently where safe.
 *
 * Runtime: Node.js 20+
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const VERSION = '1.0.0';
const SERVICE_NAME = 'medorbits-local-agent';

const DEFAULT_CONFIG = Object.freeze({
  repositoryRoot: process.cwd(),
  logLevel: 'info',
  taskTimeoutMs: 300000,
  maxConcurrentTasks: 2,
  continueOnIndependentFailure: true,
  backupScript: 'local-agent/agent-backup/agent-backup.sh',
  allowExternalPaths: false
});

const VALID_LOG_LEVELS = new Set([
  'debug',
  'info',
  'warn',
  'error'
]);

const VALID_TASK_STATES = new Set([
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'cancelled',
  'timed_out'
]);

const LOG_PRIORITY = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

class AgentError extends Error {
  constructor(message, code = 'AGENT_ERROR', options = {}) {
    super(message, options);
    this.name = 'AgentError';
    this.code = code;
  }
}

function createLogger(level = 'info') {
  const threshold = LOG_PRIORITY[level] ?? LOG_PRIORITY.info;

  function write(severity, message, metadata = {}) {
    if (LOG_PRIORITY[severity] < threshold) return;

    const entry = {
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      severity,
      message: String(message),
      ...sanitizeMetadata(metadata)
    };

    const output = JSON.stringify(entry);

    if (severity === 'error') {
      process.stderr.write(`${output}\n`);
    } else {
      process.stdout.write(`${output}\n`);
    }
  }

  return Object.freeze({
    debug: (message, metadata) => write('debug', message, metadata),
    info: (message, metadata) => write('info', message, metadata),
    warn: (message, metadata) => write('warn', message, metadata),
    error: (message, metadata) => write('error', message, metadata)
  });
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};

  const result = {};
  const sensitivePattern =
    /token|password|secret|credential|authorization|private.?key|api.?key/i;

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitivePattern.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 50).map((item) => {
        if (
          item === null ||
          ['string', 'number', 'boolean'].includes(typeof item)
        ) {
          return item;
        }
        return '[NON-PRIMITIVE]';
      });
    } else {
      result[key] = '[NON-PRIMITIVE]';
    }
  }

  return result;
}

function loadConfiguration(environment = process.env) {
  const repositoryRoot = path.resolve(
    environment.MEDORBITS_REPO_ROOT || DEFAULT_CONFIG.repositoryRoot
  );

  const logLevel = String(
    environment.MEDORBITS_AGENT_LOG_LEVEL ||
    DEFAULT_CONFIG.logLevel
  ).toLowerCase();

  const timeoutRaw = environment.MEDORBITS_AGENT_TIMEOUT_MS;
  const concurrencyRaw = environment.MEDORBITS_AGENT_MAX_CONCURRENCY;

  const taskTimeoutMs = timeoutRaw === undefined
    ? DEFAULT_CONFIG.taskTimeoutMs
    : Number(timeoutRaw);

  const maxConcurrentTasks = concurrencyRaw === undefined
    ? DEFAULT_CONFIG.maxConcurrentTasks
    : Number(concurrencyRaw);

  if (!VALID_LOG_LEVELS.has(logLevel)) {
    throw new AgentError(
      `Unsupported log level: ${logLevel}`,
      'INVALID_CONFIGURATION'
    );
  }

  if (
    !Number.isSafeInteger(taskTimeoutMs) ||
    taskTimeoutMs < 1000 ||
    taskTimeoutMs > 3600000
  ) {
    throw new AgentError(
      'Task timeout must be between 1000 and 3600000 milliseconds.',
      'INVALID_CONFIGURATION'
    );
  }

  if (
    !Number.isSafeInteger(maxConcurrentTasks) ||
    maxConcurrentTasks < 1 ||
    maxConcurrentTasks > 16
  ) {
    throw new AgentError(
      'Maximum concurrency must be between 1 and 16.',
      'INVALID_CONFIGURATION'
    );
  }

  if (!fs.existsSync(repositoryRoot)) {
    throw new AgentError(
      'Configured repository root does not exist.',
      'REPOSITORY_NOT_FOUND'
    );
  }

  if (!fs.statSync(repositoryRoot).isDirectory()) {
    throw new AgentError(
      'Configured repository root is not a directory.',
      'INVALID_REPOSITORY_ROOT'
    );
  }

  return Object.freeze({
    ...DEFAULT_CONFIG,
    repositoryRoot: fs.realpathSync(repositoryRoot),
    logLevel,
    taskTimeoutMs,
    maxConcurrentTasks,
    allowExternalPaths:
      environment.MEDORBITS_AGENT_ALLOW_EXTERNAL_PATHS === 'true'
  });
}

function resolveInsideRoot(root, requestedPath) {
  if (typeof requestedPath !== 'string' || requestedPath.trim() === '') {
    throw new AgentError(
      'A non-empty relative path is required.',
      'INVALID_PATH'
    );
  }

  if (path.isAbsolute(requestedPath)) {
    throw new AgentError(
      'Absolute paths are not permitted.',
      'PATH_NOT_ALLOWED'
    );
  }

  const resolvedRoot = fs.realpathSync(root);
  const candidate = path.resolve(resolvedRoot, requestedPath);
  const relative = path.relative(resolvedRoot, candidate);

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new AgentError(
      'Path escapes the configured repository root.',
      'PATH_NOT_ALLOWED'
    );
  }

  // Existing paths must resolve to a location inside the root.
  // For nonexistent paths, inspect the nearest existing parent.
  let existing = candidate;

  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);

    if (parent === existing) {
      throw new AgentError(
        'Unable to resolve requested path.',
        'INVALID_PATH'
      );
    }

    existing = parent;
  }

  const realExisting = fs.realpathSync(existing);
  const realRelative = path.relative(resolvedRoot, realExisting);

  if (
    realRelative === '..' ||
    realRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(realRelative)
  ) {
    throw new AgentError(
      'Path resolves outside the configured repository root.',
      'PATH_NOT_ALLOWED'
    );
  }

  return candidate;
}

function getRepositoryMetadata(config) {
  const root = config.repositoryRoot;
  const packagePath = path.join(root, 'package.json');

  let packageInfo = null;

  if (fs.existsSync(packagePath)) {
    try {
      const stat = fs.lstatSync(packagePath);

      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new AgentError(
          'package.json must be a regular file.',
          'UNSAFE_FILE'
        );
      }

      packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    } catch (error) {
      if (error instanceof AgentError) throw error;

      throw new AgentError(
        'Unable to read valid package metadata.',
        'INVALID_PACKAGE_METADATA',
        { cause: error }
      );
    }
  }

  return {
    root,
    packageName:
      packageInfo && typeof packageInfo.name === 'string'
        ? packageInfo.name
        : null,
    packageVersion:
      packageInfo && typeof packageInfo.version === 'string'
        ? packageInfo.version
        : null,
    packageJsonFound: packageInfo !== null,
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch
  };
}

class TaskRunner {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.handlers = new Map();
    this.activeTasks = new Map();
  }

  register(taskType, handler, options = {}) {
    if (
      typeof taskType !== 'string' ||
      !/^[a-z][a-z0-9.-]{1,79}$/.test(taskType)
    ) {
      throw new AgentError(
        'Invalid task type identifier.',
        'INVALID_TASK_TYPE'
      );
    }

    if (typeof handler !== 'function') {
      throw new AgentError(
        'Task handler must be a function.',
        'INVALID_TASK_HANDLER'
      );
    }

    if (this.handlers.has(taskType)) {
      throw new AgentError(
        `Task handler already registered: ${taskType}`,
        'DUPLICATE_TASK_HANDLER'
      );
    }

    this.handlers.set(taskType, Object.freeze({
      handler,
      timeoutMs: options.timeoutMs || this.config.taskTimeoutMs
    }));
  }

  async run(taskType, parameters = {}) {
    const taskId = crypto.randomUUID();
    const registered = this.handlers.get(taskType);

    const result = {
      taskId,
      taskType,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      error: null,
      data: null
    };

    if (!registered) {
      result.status = 'failed';
      result.error = {
        code: 'UNKNOWN_TASK_TYPE',
        message: 'The requested task is not registered.'
      };
      return result;
    }

    if (
      !parameters ||
      typeof parameters !== 'object' ||
      Array.isArray(parameters)
    ) {
      result.status = 'failed';
      result.error = {
        code: 'INVALID_TASK_PARAMETERS',
        message: 'Task parameters must be a JSON object.'
      };
      return result;
    }

    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      result.status = 'skipped';
      result.error = {
        code: 'CONCURRENCY_LIMIT',
        message: 'The configured task concurrency limit was reached.'
      };
      return result;
    }

    result.status = 'running';
    result.startedAt = new Date().toISOString();

    const controller = new AbortController();

    this.activeTasks.set(taskId, {
      taskType,
      controller,
      startedAt: Date.now()
    });

    this.logger.info('Task started.', { taskId, taskType });

    let timeout;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();

          reject(new AgentError(
            'Task exceeded its execution time limit.',
            'TASK_TIMEOUT'
          ));
        }, registered.timeoutMs);
      });

      const handlerPromise = Promise.resolve().then(() =>
        registered.handler({
          taskId,
          parameters,
          config: this.config,
          signal: controller.signal
        })
      );

      result.data = await Promise.race([
        handlerPromise,
        timeoutPromise
      ]);

      result.status = 'succeeded';
    } catch (error) {
      result.status = error.code === 'TASK_TIMEOUT'
        ? 'timed_out'
        : 'failed';

      result.error = {
        code: error.code || 'TASK_FAILED',
        message: error.code
          ? error.message
          : 'Task failed. See sanitized logs for diagnostics.'
      };

      this.logger.error('Task failed.', {
        taskId,
        taskType,
        errorCode: result.error.code
      });
    } finally {
      clearTimeout(timeout);
      this.activeTasks.delete(taskId);
      result.finishedAt = new Date().toISOString();

      this.logger.info('Task finished.', {
        taskId,
        taskType,
        status: result.status
      });
    }

    return result;
  }

  getStatus() {
    return {
      registeredTaskTypes: [...this.handlers.keys()].sort(),
      activeTasks: [...this.activeTasks.entries()].map(([taskId, task]) => ({
        taskId,
        taskType: task.taskType,
        runningForMs: Date.now() - task.startedAt
      }))
    };
  }

  async cancel(taskId) {
    const task = this.activeTasks.get(taskId);

    if (!task) {
      return false;
    }

    task.controller.abort();
    return true;
  }
}

function createAgent(options = {}) {
  const config = options.config || loadConfiguration();
  const logger = options.logger || createLogger(config.logLevel);
  const runner = new TaskRunner(config, logger);

  runner.register('agent.status', async () => ({
    service: SERVICE_NAME,
    version: VERSION,
    status: 'running',
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    tasks: runner.getStatus()
  }));

  runner.register('repository.status', async () => {
    const metadata = getRepositoryMetadata(config);

    let gitAvailable = false;

    try {
      const gitDirectory = path.join(config.repositoryRoot, '.git');
      gitAvailable = fs.existsSync(gitDirectory);
    } catch {
      gitAvailable = false;
    }

    return {
      ...metadata,
      gitMetadataFound: gitAvailable
    };
  });

  runner.register('repository.inspect-file', async ({ parameters }) => {
    if (typeof parameters.path !== 'string') {
      throw new AgentError(
        'Provide a relative file path.',
        'INVALID_PARAMETERS'
      );
    }

    const filePath = resolveInsideRoot(
      config.repositoryRoot,
      parameters.path
    );

    const stat = fs.lstatSync(filePath);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new AgentError(
        'Only regular, non-symlink files can be inspected.',
        'UNSAFE_FILE'
      );
    }

    const maxBytes = 1024 * 1024;

    if (stat.size > maxBytes) {
      throw new AgentError(
        'File exceeds the 1 MiB inspection limit.',
        'FILE_TOO_LARGE'
      );
    }

    return {
      path: path.relative(config.repositoryRoot, filePath),
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      extension: path.extname(filePath),
      sha256: crypto
        .createHash('sha256')
        .update(fs.readFileSync(filePath))
        .digest('hex')
    };
  });

  runner.register('repository.validate-json', async ({ parameters }) => {
    const requestedPaths = parameters.paths;

    if (
      !Array.isArray(requestedPaths) ||
      requestedPaths.length === 0 ||
      requestedPaths.length > 100
    ) {
      throw new AgentError(
        'Provide between 1 and 100 JSON file paths.',
        'INVALID_PARAMETERS'
      );
    }

    const results = [];

    for (const relativePath of requestedPaths) {
      try {
        const filePath = resolveInsideRoot(
          config.repositoryRoot,
          relativePath
        );

        const stat = fs.lstatSync(filePath);

        if (!stat.isFile() || stat.isSymbolicLink()) {
          throw new AgentError(
            'Target must be a regular, non-symlink file.',
            'UNSAFE_FILE'
          );
        }

        if (stat.size > 5 * 1024 * 1024) {
          throw new AgentError(
            'JSON file exceeds the 5 MiB validation limit.',
            'FILE_TOO_LARGE'
          );
        }

        JSON.parse(fs.readFileSync(filePath, 'utf8'));

        results.push({
          path: relativePath,
          valid: true
        });
      } catch (error) {
        results.push({
          path: String(relativePath),
          valid: false,
          errorCode: error.code || 'INVALID_JSON',
          message: error.code
            ? error.message
            : 'JSON parsing failed.'
        });
      }
    }

    const passed = results.filter((item) => item.valid).length;
    const failed = results.length - passed;

    return {
      status: failed === 0 ? 'passed' : 'failed',
      total: results.length,
      passed,
      failed,
      results
    };
  });

  runner.register('backup.create', async ({ parameters, signal }) => {
    const scope = parameters.scope || 'local-agent';

    if (!['local-agent', 'repository'].includes(scope)) {
      throw new AgentError(
        'Backup scope must be local-agent or repository.',
        'INVALID_BACKUP_SCOPE'
      );
    }

    const scriptPath = resolveInsideRoot(
      config.repositoryRoot,
      config.backupScript
    );

    const stat = fs.lstatSync(scriptPath);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new AgentError(
        'Backup script must be a regular, non-symlink file.',
        'UNSAFE_BACKUP_SCRIPT'
      );
    }

    const args = scope === 'repository'
      ? ['backup', '--full']
      : ['backup'];

    return await new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new AgentError('Backup cancelled.', 'TASK_CANCELLED'));
        return;
      }

      const child = spawn('/bin/bash', [scriptPath, ...args], {
        cwd: config.repositoryRoot,
        env: {
          PATH: process.env.PATH || '/usr/bin:/bin',
          HOME: os.homedir(),
          MEDORBITS_REPO_ROOT: config.repositoryRoot
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      const maxOutput = 64 * 1024;

      const onAbort = () => {
        child.kill('SIGTERM');
      };

      signal.addEventListener('abort', onAbort, { once: true });

      child.stdout.on('data', (chunk) => {
        if (stdout.length < maxOutput) {
          stdout += chunk.toString().slice(0, maxOutput - stdout.length);
        }
      });

      child.stderr.on('data', (chunk) => {
        if (stderr.length < maxOutput) {
          stderr += chunk.toString().slice(0, maxOutput - stderr.length);
        }
      });

      child.on('error', (error) => {
        signal.removeEventListener('abort', onAbort);

        reject(new AgentError(
          'Unable to launch the backup process.',
          'BACKUP_PROCESS_ERROR',
          { cause: error }
        ));
      });

      child.on('close', (code) => {
        signal.removeEventListener('abort', onAbort);

        if (signal.aborted) {
          reject(new AgentError(
            'Backup operation was interrupted.',
            'TASK_CANCELLED'
          ));
          return;
        }

        if (code !== 0) {
          reject(new AgentError(
            `Backup process failed with exit code ${code}.`,
            'BACKUP_FAILED'
          ));
          return;
        }

        resolve({
          status: 'completed',
          scope,
          exitCode: code,
          output: stdout.trim(),
          diagnostic: stderr.trim()
        });
      });
    });
  });

  return Object.freeze({
    config,
    logger,
    runner,

    async execute(taskType, parameters = {}) {
      return runner.run(taskType, parameters);
    },

    getStatus() {
      return {
        service: SERVICE_NAME,
        version: VERSION,
        repositoryRoot: config.repositoryRoot,
        tasks: runner.getStatus()
      };
    }
  });
}

async function main() {
  let agent;

  try {
    const config = loadConfiguration();
    const logger = createLogger(config.logLevel);

    agent = createAgent({ config, logger });

    const command = process.argv[2] || 'status';

    logger.info('Local agent initialized.', {
      version: VERSION,
      nodeVersion: process.version,
      repositoryRoot: config.repositoryRoot
    });

    let result;

    switch (command) {
      case 'status':
        result = await agent.execute('agent.status');
        break;

      case 'inspect': {
        const requestedPath = process.argv[3];

        if (!requestedPath) {
          throw new AgentError(
            'Usage: node local-agent/src/index.js inspect RELATIVE_PATH',
            'INVALID_ARGUMENTS'
          );
        }

        result = await agent.execute('repository.inspect-file', {
          path: requestedPath
        });
        break;
      }

      case 'validate-json': {
        const requestedPaths = process.argv.slice(3);

        if (requestedPaths.length === 0) {
          throw new AgentError(
            'Usage: node local-agent/src/index.js validate-json FILE.json [...]',
            'INVALID_ARGUMENTS'
          );
        }

        result = await agent.execute('repository.validate-json', {
          paths: requestedPaths
        });
        break;
      }

      case 'backup': {
        const scope = process.argv[3] || 'local-agent';

        result = await agent.execute('backup.create', { scope });
        break;
      }

      case 'help':
      case '--help':
      case '-h':
        process.stdout.write(
          [
            'MedOrbits Local Agent',
            '',
            'Commands:',
            '  node local-agent/src/index.js status',
            '  node local-agent/src/index.js inspect RELATIVE_PATH',
            '  node local-agent/src/index.js validate-json FILE.json [...]',
            '  node local-agent/src/index.js backup [local-agent|repository]',
            '  node local-agent/src/index.js help',
            ''
          ].join('\n')
        );
        return;

      default:
        throw new AgentError(
          `Unknown command: ${command}`,
          'UNKNOWN_COMMAND'
        );
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    if (result.status === 'failed' || result.status === 'timed_out') {
      process.exitCode = 1;
    }

    if (
      result.data &&
      result.data.status === 'failed'
    ) {
      process.exitCode = 1;
    }
  } catch (error) {
    const safeError = {
      service: SERVICE_NAME,
      status: 'failed',
      error: {
        code: error.code || 'STARTUP_ERROR',
        message: error.code
          ? error.message
          : 'Unexpected error. Review local diagnostics.'
      }
    };

    process.stderr.write(`${JSON.stringify(safeError, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  VERSION,
  SERVICE_NAME,
  AgentError,
  createLogger,
  loadConfiguration,
  resolveInsideRoot,
  getRepositoryMetadata,
  TaskRunner,
  createAgent
};
