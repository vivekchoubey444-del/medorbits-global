
'use strict';

/**
 * MedOrbits Local Agent
 * File: /local-agent/src/commands/routes.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Central registry and dispatcher for local-agent commands.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins and local-agent command modules.
 *
 * Security:
 *   - Explicit command allowlist.
 *   - No dynamic module paths from user input.
 *   - No shell execution.
 *   - Read-only audit by default.
 *   - Validates arguments before dispatch.
 */

const path = require('node:path');

const ROUTES_VERSION = '1.0.0';

class RouteError extends Error {
  constructor(message, code = 'ROUTE_ERROR', options = {}) {
    super(message, options);
    this.name = 'RouteError';
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_ARGUMENTS = 100;
const MAX_ARGUMENT_LENGTH = 4096;

const ROUTE_DEFINITIONS = Object.freeze({
  audit: Object.freeze({
    description: 'Audit repository structure, references, and common risks.',
    module: './audit',
    exportName: 'runAuditCommand',
    readOnly: true,
    aliases: Object.freeze(['inspect', 'check'])
  })
});

function normalizeCommandName(value) {
  if (typeof value !== 'string') {
    throw new RouteError('Command name must be a string.', 'INVALID_COMMAND');
  }

  const name = value.trim().toLowerCase();

  if (!name || name.length > 64) {
    throw new RouteError('Command name is empty or too long.', 'INVALID_COMMAND');
  }

  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new RouteError(
      'Command name may contain only letters, numbers, and hyphens.',
      'INVALID_COMMAND'
    );
  }

  return name;
}

function validateArguments(args) {
  if (args === undefined) return [];

  if (!Array.isArray(args)) {
    throw new RouteError('Command arguments must be an array.', 'INVALID_ARGUMENTS');
  }

  if (args.length > MAX_ARGUMENTS) {
    throw new RouteError(
      `A maximum of ${MAX_ARGUMENTS} arguments is permitted.`,
      'TOO_MANY_ARGUMENTS'
    );
  }

  return args.map((arg, index) => {
    if (typeof arg !== 'string') {
      throw new RouteError(
        `Argument ${index + 1} must be a string.`,
        'INVALID_ARGUMENT'
      );
    }

    if (arg.length > MAX_ARGUMENT_LENGTH) {
      throw new RouteError(
        `Argument ${index + 1} exceeds the maximum length.`,
        'ARGUMENT_TOO_LONG'
      );
    }

    if (arg.includes('\0')) {
      throw new RouteError(
        `Argument ${index + 1} contains a null byte.`,
        'INVALID_ARGUMENT'
      );
    }

    return arg;
  });
}

function buildRouteIndex(definitions = ROUTE_DEFINITIONS) {
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) {
    throw new RouteError('Route definitions must be an object.', 'INVALID_REGISTRY');
  }

  const index = new Map();

  for (const [canonicalName, definition] of Object.entries(definitions)) {
    if (!/^[a-z][a-z0-9-]*$/.test(canonicalName)) {
      throw new RouteError(
        `Invalid canonical command name: ${canonicalName}`,
        'INVALID_REGISTRY'
      );
    }

    if (!definition || typeof definition !== 'object') {
      throw new RouteError(
        `Invalid definition for command "${canonicalName}".`,
        'INVALID_REGISTRY'
      );
    }

    if (typeof definition.module !== 'string' ||
        !definition.module.startsWith('./')) {
      throw new RouteError(
        `Command "${canonicalName}" has an invalid module path.`,
        'INVALID_REGISTRY'
      );
    }

    if (typeof definition.exportName !== 'string' ||
        !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(definition.exportName)) {
      throw new RouteError(
        `Command "${canonicalName}" has an invalid export name.`,
        'INVALID_REGISTRY'
      );
    }

    const names = [canonicalName, ...(definition.aliases || [])];

    for (const item of names) {
      const normalized = normalizeCommandName(item);

      if (index.has(normalized)) {
        throw new RouteError(
          `Duplicate command or alias: "${normalized}".`,
          'DUPLICATE_ROUTE'
        );
      }

      index.set(normalized, canonicalName);
    }
  }

  return index;
}

function createCommandRouter(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RouteError('Router options must be an object.', 'INVALID_OPTIONS');
  }

  const definitions = options.definitions || ROUTE_DEFINITIONS;
  const routeIndex = buildRouteIndex(definitions);
  const baseDirectory = path.resolve(options.baseDirectory || __dirname);

  const timeoutMs = options.timeoutMs === undefined
    ? DEFAULT_TIMEOUT_MS
    : options.timeoutMs;

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) {
    throw new RouteError(
      'timeoutMs must be an integer between 1 and 600000.',
      'INVALID_TIMEOUT'
    );
  }

  const loader = options.loader || require;
  const logger = options.logger || console;

  if (typeof loader !== 'function') {
    throw new RouteError('loader must be a function.', 'INVALID_OPTIONS');
  }

  function getCanonicalName(command) {
    const normalized = normalizeCommandName(command);
    const canonicalName = routeIndex.get(normalized);

    if (!canonicalName) {
      throw new RouteError(
        `Unknown command "${normalized}". Use listCommands() to view available commands.`,
        'UNKNOWN_COMMAND'
      );
    }

    return canonicalName;
  }

  function loadHandler(canonicalName) {
    const definition = definitions[canonicalName];

    // The module comes only from the trusted route registry.
    const absoluteModulePath = path.resolve(baseDirectory, definition.module);

    if (!absoluteModulePath.startsWith(`${baseDirectory}${path.sep}`)) {
      throw new RouteError(
        `Command "${canonicalName}" resolves outside the command directory.`,
        'MODULE_PATH_ESCAPE'
      );
    }

    let commandModule;

    try {
      commandModule = loader(absoluteModulePath);
    } catch (error) {
      throw new RouteError(
        `Unable to load command "${canonicalName}".`,
        'COMMAND_LOAD_FAILED',
        { cause: error }
      );
    }

    const handler = commandModule && commandModule[definition.exportName];

    if (typeof handler !== 'function') {
      throw new RouteError(
        `Command "${canonicalName}" does not export "${definition.exportName}".`,
        'COMMAND_HANDLER_MISSING'
      );
    }

    return handler;
  }

  function listCommands() {
    const commands = [];

    for (const [name, definition] of Object.entries(definitions)) {
      commands.push({
        name,
        aliases: [...(definition.aliases || [])],
        description: definition.description || '',
        readOnly: definition.readOnly !== false
      });
    }

    return commands;
  }

  async function dispatch(command, rawArgs = [], context = {}) {
    const canonicalName = getCanonicalName(command);
    const args = validateArguments(rawArgs);
    const definition = definitions[canonicalName];

    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      throw new RouteError('Command context must be an object.', 'INVALID_CONTEXT');
    }

    if (context.signal !== undefined &&
        (!context.signal || typeof context.signal.aborted !== 'boolean')) {
      throw new RouteError(
        'context.signal must be an AbortSignal.',
        'INVALID_CONTEXT'
      );
    }

    if (context.signal && context.signal.aborted) {
      throw new RouteError('Command was cancelled before execution.', 'CANCELLED');
    }

    const handler = loadHandler(canonicalName);

    const commandContext = Object.freeze({
      command: canonicalName,
      readOnly: definition.readOnly !== false,
      signal: context.signal,
      requestId: typeof context.requestId === 'string'
        ? context.requestId.slice(0, 128)
        : undefined,
      logger: context.logger || logger,
      services: context.services || Object.freeze({})
    });

    let timeoutHandle;
    let abortListener;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new RouteError(
          `Command "${canonicalName}" exceeded ${timeoutMs} ms.`,
          'COMMAND_TIMEOUT'
        ));
      }, timeoutMs);

      if (context.signal) {
        abortListener = () => {
          reject(new RouteError(
            `Command "${canonicalName}" was cancelled.`,
            'CANCELLED'
          ));
        };

        context.signal.addEventListener('abort', abortListener, { once: true });
      }
    });

    try {
      return await Promise.race([
        Promise.resolve().then(() => handler(args, commandContext)),
        timeoutPromise
      ]);
    } catch (error) {
      if (error instanceof RouteError) throw error;

      throw new RouteError(
        `Command "${canonicalName}" failed.`,
        'COMMAND_FAILED',
        { cause: error }
      );
    } finally {
      clearTimeout(timeoutHandle);

      if (context.signal && abortListener) {
        context.signal.removeEventListener('abort', abortListener);
      }
    }
  }

  return Object.freeze({
    version: ROUTES_VERSION,
    dispatch,
    listCommands,
    resolveCommand: getCanonicalName
  });
}

function createDefaultRouter(options = {}) {
  return createCommandRouter({
    ...options,
    definitions: options.definitions || ROUTE_DEFINITIONS,
    baseDirectory: options.baseDirectory || __dirname
  });
}

function runCli(argv = process.argv.slice(2), options = {}) {
  const logger = options.logger || console;

  if (!Array.isArray(argv) || argv.some((item) => typeof item !== 'string')) {
    throw new RouteError('CLI arguments must be strings.', 'INVALID_ARGUMENTS');
  }

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    logger.log([
      'MedOrbits Local Agent Commands',
      '',
      'Usage:',
      '  node local-agent/src/commands/routes.js <command> [arguments]',
      '',
      'Available commands:',
      ...ROUTE_DEFINITIONS &&
        Object.entries(ROUTE_DEFINITIONS).map(([name, item]) =>
          `  ${name.padEnd(12)} ${item.description}`
        ),
      '',
      'Examples:',
      '  node local-agent/src/commands/routes.js audit --root .',
      '  node local-agent/src/commands/routes.js audit --root . --json'
    ].join('\n'));

    return Promise.resolve({ exitCode: 0, help: true });
  }

  const [command, ...args] = argv;
  const router = createDefaultRouter({
    logger,
    timeoutMs: options.timeoutMs
  });

  return router.dispatch(command, args, {
    requestId: options.requestId,
    signal: options.signal,
    logger,
    services: options.services
  }).then((result) => {
    if (result && typeof result === 'object' &&
        Object.prototype.hasOwnProperty.call(result, 'exitCode')) {
      return result;
    }

    return { exitCode: 0, result };
  });
}

if (require.main === module) {
  runCli().then((result) => {
    process.exitCode = result.exitCode || 0;
  }).catch((error) => {
    console.error(
      `[routes] ${error.code || 'ERROR'}: ${error.message}`
    );
    process.exitCode = error.code === 'UNKNOWN_COMMAND' ? 2 : 1;
  });
}

module.exports = {
  ROUTES_VERSION,
  ROUTE_DEFINITIONS,
  DEFAULT_TIMEOUT_MS,
  RouteError,
  normalizeCommandName,
  validateArguments,
  buildRouteIndex,
  createCommandRouter,
  createDefaultRouter,
  runCli
};
