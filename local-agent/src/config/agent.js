
'use strict';

/**
 * MedOrbits Local Agent -- Agent Configuration
 * -------------------------------------------
 * Combines environment and path configuration into one immutable config.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins only.
 */

const path = require('node:path');

const {
  parseConfiguration,
  EnvironmentConfigError
} = require('./env');

const {
  createPathConfiguration
} = require('./path');

const AGENT_CONFIG_VERSION = '1.0.0';

class AgentConfigurationError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'AgentConfigurationError';
    this.code = options.code || 'AGENT_CONFIG_ERROR';
    this.key = options.key || null;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function createAgentConfiguration(options = {}) {
  const environment = options.environment || process.env;

  if (
    !environment ||
    typeof environment !== 'object' ||
    Array.isArray(environment)
  ) {
    throw new AgentConfigurationError(
      'Environment configuration must be an object.',
      { code: 'INVALID_ENVIRONMENT' }
    );
  }

  let envConfig;

  try {
    envConfig = parseConfiguration(environment, {
      cwd: options.cwd || process.cwd()
    });
  } catch (error) {
    throw new AgentConfigurationError(
      'Unable to create agent configuration.',
      {
        code: error.code || 'INVALID_ENV_CONFIG',
        key: error.key || null,
        cause: error
      }
    );
  }

  const requestedRoot = options.root
    ? path.resolve(options.cwd || process.cwd(), options.root)
    : envConfig.root;

  let paths;

  try {
    paths = createPathConfiguration({
      root: requestedRoot,
      agentRelativePath: options.agentRelativePath || 'local-agent',
      directoryNames: options.directoryNames,
      excludedDirectories: options.excludedDirectories
    });
  } catch (error) {
    throw new AgentConfigurationError(
      'Unable to initialize agent paths.',
      {
        code: error.code || 'INVALID_PATH_CONFIG',
        cause: error
      }
    );
  }

  const config = {
    version: AGENT_CONFIG_VERSION,
    environment: envConfig.nodeEnv,
    root: paths.root,

    agent: {
      ...envConfig.agent,
      name: 'MedOrbits Local Agent',
      enabled: envConfig.agent.enabled,
      readOnly: envConfig.agent.readOnly
    },

    logging: {
      ...envConfig.logging,
      directory: paths.directories.logs
    },

    backup: {
      directory: paths.directories.backups,
      retention: envConfig.agent.backupRetention
    },

    limits: {
      maxFileBytes: envConfig.agent.maxFileBytes,
      maxTotalReadBytes: envConfig.agent.maxTotalReadBytes,
      maxFiles: envConfig.agent.maxFiles,
      taskTimeoutMs: envConfig.agent.taskTimeoutMs,
      maxConcurrentTasks: envConfig.agent.maxConcurrentTasks
    },

    ollama: { ...envConfig.ollama },

    paths: paths.getStatus()
  };

  if (
    config.environment === 'production' &&
    config.agent.readOnly === false
  ) {
    throw new AgentConfigurationError(
      'Write-enabled agent mode is disabled in production by default.',
      {
        code: 'UNSAFE_PRODUCTION_SETTING',
        key: 'MEDORBITS_AGENT_READ_ONLY'
      }
    );
  }

  return deepFreeze(config);
}

function getSafeConfigSummary(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('A valid agent configuration is required.');
  }

  return {
    version: config.version,
    environment: config.environment,
    root: config.root,
    agent: {
      name: config.agent.name,
      enabled: config.agent.enabled,
      readOnly: config.agent.readOnly,
      allowExternalPaths: config.agent.allowExternalPaths
    },
    logging: config.logging,
    backup: config.backup,
    limits: config.limits,
    ollama: {
      host: config.ollama.host,
      model: config.ollama.model,
      timeoutMs: config.ollama.timeoutMs
    }
  };
}

module.exports = {
  AGENT_CONFIG_VERSION,
  AgentConfigurationError,
  createAgentConfiguration,
  getSafeConfigSummary
};
