
'use strict';

/**
 * MedOrbits Local Agent
 * File: /local-agent/src/agent/agent.js
 * Version: 1.0.0
 *
 * Coordinates repository inspection, safe file operations, command dispatch,
 * and optional local Ollama inference.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins and local-agent modules.
 *
 * Safety defaults:
 * - Read-only repository access.
 * - No shell execution or automatic package installation.
 * - File paths must remain inside the repository root.
 * - Task failures are isolated and recorded.
 * - No automatic deletion or unrestricted overwrite.
 */

const path = require('node:path');
const crypto = require('node:crypto');

const AGENT_VERSION = '1.0.0';

const DEFAULTS = Object.freeze({
  maxTasks: 100,
  maxConcurrentTasks: 2,
  taskTimeoutMs: 60_000,
  stopOnError: false,
  readOnly: true
});

class AgentError extends Error {
  constructor(message, code = 'AGENT_ERROR', options = {}) {
    super(message, options);
    this.name = 'AgentError';
    this.code = code;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateOptions(options = {}) {
  if (!isPlainObject(options)) {
    throw new AgentError('Agent options must be an object.', 'INVALID_OPTIONS');
  }

  const config = { ...DEFAULTS, ...options };

  for (const key of ['maxTasks', 'maxConcurrentTasks', 'taskTimeoutMs']) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 1) {
      throw new AgentError(`${key} must be a positive integer.`, 'INVALID_OPTIONS');
    }
  }

  if (config.maxTasks > 10_000) {
    throw new AgentError('maxTasks cannot exceed 10000.', 'INVALID_OPTIONS');
  }

  if (config.maxConcurrentTasks > 32) {
    throw new AgentError(
      'maxConcurrentTasks cannot exceed 32.',
      'INVALID_OPTIONS'
    );
  }

  if (config.taskTimeoutMs > 600_000) {
    throw new AgentError(
      'taskTimeoutMs cannot exceed 600000 ms.',
      'INVALID_OPTIONS'
    );
  }

  if (typeof config.readOnly !== 'boolean' ||
      typeof config.stopOnError !== 'boolean') {
    throw new AgentError(
      'readOnly and stopOnError must be booleans.',
      'INVALID_OPTIONS'
    );
  }

  return config;
}

function createTaskId() {
  return `task_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
}

function normalizeTask(task, index) {
  if (!isPlainObject(task)) {
    throw new AgentError(`Task ${index + 1} must be an object.`, 'INVALID_TASK');
  }

  const type = typeof task.type === 'string' ? task.type.trim().toLowerCase() : '';
  const name = typeof task.name === 'string' ? task.name.trim() : type;

  if (!type || !/^[a-z][a-z0-9-]{0,63}$/.test(type)) {
    throw new AgentError(
      `Task ${index + 1} has an invalid type.`,
      'INVALID_TASK'
    );
  }

  if (name.length > 160) {
    throw new AgentError(
      `Task ${index + 1} has a name that is too long.`,
      'INVALID_TASK'
    );
  }

  if (task.args !== undefined && !isPlainObject(task.args)) {
    throw new AgentError(
      `Task ${index + 1} args must be an object.`,
      'INVALID_TASK'
    );
  }

  return Object.freeze({
    id: typeof task.id === 'string' && task.id.trim()
      ? task.id.trim().slice(0, 128)
      : createTaskId(),
    type,
    name: name || type,
    args: Object.freeze({ ...(task.args || {}) }),
    required: task.required === true
  });
}

function safeError(error) {
  return {
    code: typeof error?.code === 'string' ? error.code : 'TASK_FAILED',
    message: String(error?.message || 'Unknown error').slice(0, 500)
  };
}

function createAgent(options = {}) {
  const config = validateOptions(options);

  const repository = options.repository || null;
  const router = options.router || null;
  const provider = options.provider || null;
  const logger = options.logger || console;

  const handlers = new Map();
  const history = [];
  const activeControllers = new Map();

  let closed = false;
  let running = false;

  function assertOpen() {
    if (closed) {
      throw new AgentError('Agent is closed.', 'AGENT_CLOSED');
    }
  }

  function log(level, message, metadata = {}) {
    const method = typeof logger[level] === 'function'
      ? logger[level]
      : logger.log;

    if (typeof method !== 'function') return;

    // Do not log task arguments, file contents, prompts, or credentials.
    method.call(logger, `[local-agent] ${message}`, {
      agentVersion: AGENT_VERSION,
      ...metadata
    });
  }

  function registerHandler(type, handler) {
    assertOpen();

    if (typeof type !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(type)) {
      throw new AgentError('Invalid handler type.', 'INVALID_HANDLER');
    }

    if (typeof handler !== 'function') {
      throw new AgentError('Handler must be a function.', 'INVALID_HANDLER');
    }

    if (handlers.has(type)) {
      throw new AgentError(
        `A handler is already registered for "${type}".`,
        'DUPLICATE_HANDLER'
      );
    }

    handlers.set(type, handler);
    return this;
  }

  function listHandlers() {
    return [...handlers.keys()].sort();
  }

  function getHistory() {
    return history.map((item) => ({ ...item }));
  }

  function recordResult(result) {
    history.push(Object.freeze({ ...result }));

    if (history.length > config.maxTasks * 5) {
      history.splice(0, history.length - config.maxTasks * 5);
    }
  }

  async function executeTask(task, batchSignal) {
    assertOpen();

    const handler = handlers.get(task.type);

    if (!handler) {
      if (task.type === 'command' && router) {
        return executeCommandTask(task, batchSignal);
      }

      if (task.type === 'repository-inventory' && repository &&
          typeof repository.inventory === 'function') {
        return executeInventoryTask(task, batchSignal);
      }

      if (task.type === 'repository-status' && repository &&
          typeof repository.getStatus === 'function') {
        return executeRepositoryStatusTask(task, batchSignal);
      }

      if (task.type === 'provider-health' && provider &&
          typeof provider.health === 'function') {
        return executeProviderHealthTask(task, batchSignal);
      }

      throw new AgentError(
        `No handler registered for task type "${task.type}".`,
        'HANDLER_NOT_FOUND'
      );
    }

    return runWithTimeout(task, batchSignal, (signal) =>
      handler(task.args, createTaskContext(task, signal))
    );
  }

  function createTaskContext(task, signal) {
    return Object.freeze({
      taskId: task.id,
      taskType: task.type,
      readOnly: config.readOnly,
      signal,
      repository,
      provider,
      logger: Object.freeze({
        info: (message) => log('info', String(message).slice(0, 300), {
          taskId: task.id
        }),
        warn: (message) => log('warn', String(message).slice(0, 300), {
          taskId: task.id
        }),
        error: (message) => log('error', String(message).slice(0, 300), {
          taskId: task.id
        })
      })
    });
  }

  async function runWithTimeout(task, batchSignal, operation) {
    const controller = new AbortController();
    activeControllers.set(task.id, controller);

    const abortFromBatch = () => controller.abort(
      new AgentError('Batch cancelled.', 'CANCELLED')
    );

    if (batchSignal) {
      if (batchSignal.aborted) abortFromBatch();
      else batchSignal.addEventListener('abort', abortFromBatch, { once: true });
    }

    let timeoutHandle;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const error = new AgentError(
          `Task "${task.name}" exceeded its timeout.`,
          'TASK_TIMEOUT'
        );

        controller.abort(error);
        reject(error);
      }, config.taskTimeoutMs);
    });

    try {
      if (controller.signal.aborted) {
        throw new AgentError('Task cancelled before execution.', 'CANCELLED');
      }

      return await Promise.race([
        Promise.resolve().then(() => operation(controller.signal)),
        timeoutPromise
      ]);
    } finally {
      clearTimeout(timeoutHandle);
      activeControllers.delete(task.id);

      if (batchSignal) {
        batchSignal.removeEventListener('abort', abortFromBatch);
      }
    }
  }

  async function executeCommandTask(task, signal) {
    const command = task.args.command;
    const args = task.args.args || [];

    if (typeof command !== 'string') {
      throw new AgentError(
        'Command task requires args.command.',
        'INVALID_TASK'
      );
    }

    if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
      throw new AgentError(
        'Command arguments must be an array of strings.',
        'INVALID_TASK'
      );
    }

    return runWithTimeout(task, signal, (taskSignal) =>
      router.dispatch(command, args, {
        signal: taskSignal,
        requestId: task.id,
        logger
      })
    );
  }

  async function executeInventoryTask(task, signal) {
    return runWithTimeout(task, signal, async (taskSignal) => {
      if (taskSignal.aborted) {
        throw new AgentError('Task cancelled.', 'CANCELLED');
      }

      const relativePath = task.args.path || '.';

      if (typeof relativePath !== 'string') {
        throw new AgentError('Inventory path must be a string.', 'INVALID_PATH');
      }

      return repository.inventory(relativePath, {
        maxDepth: task.args.maxDepth,
        maxEntries: task.args.maxEntries
      });
    });
  }

  async function executeRepositoryStatusTask(task, signal) {
    return runWithTimeout(task, signal, async (taskSignal) => {
      if (taskSignal.aborted) {
        throw new AgentError('Task cancelled.', 'CANCELLED');
      }

      return repository.getStatus();
    });
  }

  async function executeProviderHealthTask(task, signal) {
    return runWithTimeout(task, signal, async (taskSignal) => {
      if (taskSignal.aborted) {
        throw new AgentError('Task cancelled.', 'CANCELLED');
      }

      return provider.health({
        signal: taskSignal,
        timeoutMs: task.args.timeoutMs
      });
    });
  }

  async function runBatch(inputTasks, batchOptions = {}) {
    assertOpen();

    if (running) {
      throw new AgentError(
        'This agent is already running a batch.',
        'BATCH_ALREADY_RUNNING'
      );
    }

    if (!Array.isArray(inputTasks)) {
      throw new AgentError('Tasks must be an array.', 'INVALID_TASKS');
    }

    if (inputTasks.length > config.maxTasks) {
      throw new AgentError(
        `Batch exceeds the ${config.maxTasks}-task limit.`,
        'TOO_MANY_TASKS'
      );
    }

    if (!isPlainObject(batchOptions)) {
      throw new AgentError('Batch options must be an object.', 'INVALID_OPTIONS');
    }

    const tasks = inputTasks.map(normalizeTask);
    const seenIds = new Set();

    for (const task of tasks) {
      if (seenIds.has(task.id)) {
        throw new AgentError(`Duplicate task id "${task.id}".`, 'DUPLICATE_TASK_ID');
      }
      seenIds.add(task.id);
    }

    const controller = new AbortController();
    let stopOnError = batchOptions.stopOnError === undefined
      ? config.stopOnError
      : batchOptions.stopOnError;

    if (typeof stopOnError !== 'boolean') {
      throw new AgentError('stopOnError must be a boolean.', 'INVALID_OPTIONS');
    }

    running = true;

    const results = new Array(tasks.length);
    let nextIndex = 0;
    let stopped = false;

    async function worker() {
      while (true) {
        if (closed || controller.signal.aborted || stopped) return;

        const index = nextIndex;
        nextIndex += 1;

        if (index >= tasks.length) return;

        const task = tasks[index];
        const startedAt = new Date().toISOString();

        try {
          const value = await executeTask(task, controller.signal);

          results[index] = {
            taskId: task.id,
            type: task.type,
            name: task.name,
            status: 'success',
            startedAt,
            completedAt: new Date().toISOString(),
            result: value === undefined ? null : value
          };

          recordResult({
            taskId: task.id,
            type: task.type,
            status: 'success',
            completedAt: results[index].completedAt
          });
        } catch (error) {
          const failure = safeError(error);

          results[index] = {
            taskId: task.id,
            type: task.type,
            name: task.name,
            status: 'failed',
            startedAt,
            completedAt: new Date().toISOString(),
            error: failure
          };

          recordResult({
            taskId: task.id,
            type: task.type,
            status: 'failed',
            errorCode: failure.code,
            completedAt: results[index].completedAt
          });

          log('error', `Task "${task.name}" failed.`, {
            taskId: task.id,
            errorCode: failure.code
          });

          if (stopOnError || task.required) {
            stopped = true;
          }
        }
      }
    }

    try {
      const workers = Array.from(
        { length: Math.min(config.maxConcurrentTasks, tasks.length || 1) },
        () => worker()
      );

      await Promise.all(workers);

      for (let index = 0; index < tasks.length; index += 1) {
        if (!results[index]) {
          results[index] = {
            taskId: tasks[index].id,
            type: tasks[index].type,
            name: tasks[index].name,
            status: 'skipped',
            completedAt: new Date().toISOString(),
            reason: closed
              ? 'Agent closed before task execution.'
              : 'Batch stopped after an earlier failure or cancellation.'
          };
        }
      }

      const summary = {
        total: results.length,
        success: results.filter((item) => item.status === 'success').length,
        failed: results.filter((item) => item.status === 'failed').length,
        skipped: results.filter((item) => item.status === 'skipped').length
      };

      return {
        version: AGENT_VERSION,
        batchId: createTaskId(),
        startedAt: results.find((item) => item.startedAt)?.startedAt || null,
        completedAt: new Date().toISOString(),
        mode: config.readOnly ? 'read-only' : 'configured',
        summary,
        results
      };
    } finally {
      running = false;
    }
  }

  async function runTask(inputTask, batchOptions = {}) {
    const report = await runBatch([inputTask], batchOptions);
    return report.results[0];
  }

  async function askProvider(prompt, options = {}) {
    assertOpen();

    if (!provider) {
      throw new AgentError('No AI provider is configured.', 'PROVIDER_UNAVAILABLE');
    }

    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new AgentError('Prompt must be a non-empty string.', 'INVALID_PROMPT');
    }

    if (prompt.length > 100_000) {
      throw new AgentError('Prompt exceeds the size limit.', 'PROMPT_TOO_LARGE');
    }

    if (!isPlainObject(options)) {
      throw new AgentError('Provider options must be an object.', 'INVALID_OPTIONS');
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs === undefined
      ? config.taskTimeoutMs
      : options.timeoutMs;

    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) {
      throw new AgentError('Invalid provider timeout.', 'INVALID_TIMEOUT');
    }

    let timeoutHandle;

    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          if (typeof provider.generate === 'function') {
            return provider.generate(prompt, {
              ...options,
              signal: controller.signal,
              readOnly: config.readOnly
            });
          }

          if (typeof provider.runGenerate === 'function') {
            return provider.runGenerate(prompt, {
              ...options,
              signal: controller.signal,
              readOnly: config.readOnly
            });
          }

          throw new AgentError(
            'Configured provider does not support generation.',
            'PROVIDER_UNSUPPORTED'
          );
        }),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            const error = new AgentError(
              'Provider request timed out.',
              'PROVIDER_TIMEOUT'
            );

            controller.abort(error);
            reject(error);
          }, timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async function close() {
    if (closed) return;

    closed = true;

    for (const controller of activeControllers.values()) {
      if (!controller.signal.aborted) {
        controller.abort(new AgentError('Agent is closing.', 'AGENT_CLOSED'));
      }
    }

    if (provider && typeof provider.close === 'function') {
      try {
        await provider.close();
      } catch (error) {
        log('warn', 'Provider close operation failed.', {
          errorCode: error?.code || 'PROVIDER_CLOSE_FAILED'
        });
      }
    }

    if (repository && typeof repository.close === 'function') {
      try {
        await repository.close();
      } catch (error) {
        log('warn', 'Repository close operation failed.', {
          errorCode: error?.code || 'REPOSITORY_CLOSE_FAILED'
        });
      }
    }

    log('info', 'Agent closed.');
  }

  function getStatus() {
    return {
      version: AGENT_VERSION,
      closed,
      running,
      readOnly: config.readOnly,
      registeredHandlers: listHandlers(),
      activeTasks: activeControllers.size,
      completedHistoryEntries: history.length
    };
  }

  return Object.freeze({
    version: AGENT_VERSION,
    config: Object.freeze({
      maxTasks: config.maxTasks,
      maxConcurrentTasks: config.maxConcurrentTasks,
      taskTimeoutMs: config.taskTimeoutMs,
      readOnly: config.readOnly,
      stopOnError: config.stopOnError
    }),
    registerHandler,
    listHandlers,
    runTask,
    runBatch,
    askProvider,
    getHistory,
    getStatus,
    close
  });
}

module.exports = {
  AGENT_VERSION,
  DEFAULTS,
  AgentError,
  createAgent,
  normalizeTask,
  validateOptions
};
