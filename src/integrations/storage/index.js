
'use strict';

/**
 * MedOrbits -- Storage Integration Factory
 *
 * File: src/integrations/storage/index.js
 * Runtime: Node.js >= 20
 *
 * Supports local filesystem and S3-compatible storage.
 * Supports dependency injection for unit tests and custom providers.
 */

const {
  StorageClient,
} = require('./storage.client');

const {
  LocalStorageProvider,
} = require('./local.provider');

const {
  S3StorageProvider,
} = require('./s3.provider');

const {
  loadStorageConfig,
} = require('./storage.config');

const SUPPORTED_DRIVERS = Object.freeze(['local', 's3']);
const SUPPORTED_DRIVER_SET = new Set(SUPPORTED_DRIVERS);

function assertOptions(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError(
      'Storage options must be an object.',
    );
  }
}

function assertStorageProvider(provider) {
  if (
    !provider ||
    typeof provider !== 'object' ||
    Array.isArray(provider)
  ) {
    throw new TypeError(
      'A valid storage provider is required.',
    );
  }

  for (const method of ['put', 'get', 'delete']) {
    if (typeof provider[method] !== 'function') {
      throw new TypeError(
        `Storage provider must implement ${method}().`,
      );
    }
  }

  if (
    provider.close !== undefined &&
    typeof provider.close !== 'function'
  ) {
    throw new TypeError(
      'Storage provider close, when provided, must be a function.',
    );
  }

  return provider;
}

function assertStorageConfig(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config)
  ) {
    throw new TypeError(
      'Storage configuration is invalid.',
    );
  }

  if (!SUPPORTED_DRIVER_SET.has(config.driver)) {
    throw new Error(
      `Unsupported storage driver: ${String(config.driver)}`,
    );
  }

  return config;
}

function createStorageClient(options = {}) {
  assertOptions(options);

  const {
    provider: injectedProvider,
    config: suppliedConfig,
    env = process.env,
    clientOptions = {},
  } = options;

  if (
    !clientOptions ||
    typeof clientOptions !== 'object' ||
    Array.isArray(clientOptions)
  ) {
    throw new TypeError(
      'clientOptions must be an object.',
    );
  }

  if (injectedProvider !== undefined) {
    const provider = assertStorageProvider(injectedProvider);

    return new StorageClient(provider, {
      ...clientOptions,
      // Injected providers remain caller-owned unless explicitly
      // marked as owned by the client.
      ownsProvider: clientOptions.ownsProvider === true,
    });
  }

  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    throw new TypeError(
      'Storage environment must be an object.',
    );
  }

  const config = assertStorageConfig(
    suppliedConfig || loadStorageConfig(env),
  );

  let provider;

  switch (config.driver) {
    case 'local':
      provider = new LocalStorageProvider(config);
      break;

    case 's3':
      // Use the supplied configuration when supported by the
      // provider; otherwise build the provider from the same env.
      provider = suppliedConfig
        ? new S3StorageProvider(config)
        : S3StorageProvider.fromEnv(env);
      break;

    default:
      throw new Error(
        'No supported storage provider is configured.',
      );
  }

  return new StorageClient(provider, {
    ...clientOptions,
    // Providers constructed by this factory are owned by the client.
    ownsProvider: true,
  });
}

module.exports = {
  createStorageClient,
  assertStorageProvider,
  assertStorageConfig,
  SUPPORTED_DRIVERS,
  StorageClient,
  LocalStorageProvider,
  S3StorageProvider,
  loadStorageConfig,
};
