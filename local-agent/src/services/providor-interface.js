
'use strict';

/**
 * MedOrbits Local Agent
 * Provider Interface
 *
 * Defines a common contract for AI providers such as Ollama and
 * remote API providers. Includes validation, timeouts, cancellation,
 * normalized responses, and provider registry support.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins only.
 */

const PROVIDER_INTERFACE_VERSION = '1.0.0';

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_PROMPT_LENGTH = 1_000_000;
const MAX_MESSAGES = 500;
const MAX_MODEL_LENGTH = 200;

class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);

    this.name = 'ProviderError';
    this.code = options.code || 'PROVIDER_ERROR';
    this.provider = options.provider || 'unknown';
    this.retryable = Boolean(options.retryable);
    this.status = options.status ?? null;
  }
}

function validateString(value, name, maxLength = MAX_PROMPT_LENGTH) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string.`);
  }

  if (!value.trim()) {
    throw new TypeError(`${name} must not be empty.`);
  }

  if (value.length > maxLength) {
    throw new TypeError(`${name} exceeds the maximum length.`);
  }

  return value;
}

function validateModel(model) {
  return validateString(model, 'model', MAX_MODEL_LENGTH).trim();
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError('messages must be a non-empty array.');
  }

  if (messages.length > MAX_MESSAGES) {
    throw new TypeError(`messages cannot exceed ${MAX_MESSAGES} items.`);
  }

  const allowedRoles = new Set(['system', 'user', 'assistant']);

  return messages.map((message, index) => {
    if (
      !message ||
      typeof message !== 'object' ||
      Array.isArray(message)
    ) {
      throw new TypeError(`messages[${index}] must be an object.`);
    }

    if (!allowedRoles.has(message.role)) {
      throw new TypeError(`messages[${index}].role is invalid.`);
    }

    return Object.freeze({
      role: message.role,
      content: validateString(
        message.content,
        `messages[${index}].content`
      )
    });
  });
}

function validateTimeout(timeoutMs) {
  const value = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('timeoutMs must be a positive safe integer.');
  }

  return value;
}

function normalizeProviderResult(provider, result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new ProviderError('Provider returned an invalid response.', {
      provider,
      code: 'INVALID_PROVIDER_RESPONSE'
    });
  }

  const content =
    typeof result.content === 'string'
      ? result.content
      : typeof result.response === 'string'
        ? result.response
        : typeof result.message?.content === 'string'
          ? result.message.content
          : null;

  if (content === null) {
    throw new ProviderError('Provider response has no text content.', {
      provider,
      code: 'INVALID_PROVIDER_RESPONSE'
    });
  }

  return Object.freeze({
    provider,
    model: typeof result.model === 'string' ? result.model : null,
    content,
    done: result.done !== false,
    usage: result.usage && typeof result.usage === 'object'
      ? result.usage
      : null,
    metadata: result.metadata && typeof result.metadata === 'object'
      ? result.metadata
      : null
  });
}

class ProviderInterface {
  constructor(options = {}) {
    if (new.target === ProviderInterface) {
      throw new TypeError(
        'ProviderInterface is abstract and cannot be instantiated directly.'
      );
    }

    this.name = validateString(
      options.name || this.constructor.providerName || this.constructor.name,
      'provider name',
      100
    );

    this.defaultModel = options.model
      ? validateModel(options.model)
      : null;

    this.timeoutMs = validateTimeout(options.timeoutMs);
    this.closed = false;
  }

  ensureOpen() {
    if (this.closed) {
      throw new ProviderError('Provider is closed.', {
        provider: this.name,
        code: 'PROVIDER_CLOSED'
      });
    }
  }

  /**
   * Required implementation:
   * async generate({ model, prompt, system, options, signal })
   */
  async generate() {
    throw new ProviderError(
      'Provider must implement generate().',
      {
        provider: this.name,
        code: 'NOT_IMPLEMENTED'
      }
    );
  }

  /**
   * Required implementation:
   * async chat({ model, messages, options, signal })
   */
  async chat() {
    throw new ProviderError(
      'Provider must implement chat().',
      {
        provider: this.name,
        code: 'NOT_IMPLEMENTED'
      }
    );
  }

  /**
   * Optional capability check.
   */
  async health() {
    this.ensureOpen();

    return {
      ok: true,
      provider: this.name,
      model: this.defaultModel
    };
  }

  /**
   * Optional capability check for installed/available models.
   */
  async listModels() {
    this.ensureOpen();

    return this.defaultModel ? [this.defaultModel] : [];
  }

  /**
   * Standardized generation wrapper.
   */
  async runGenerate(input = {}) {
    this.ensureOpen();

    const prompt = validateString(input.prompt, 'prompt');
    const model = validateModel(input.model || this.defaultModel || '');
    const timeoutMs = validateTimeout(input.timeoutMs ?? this.timeoutMs);

    const result = await executeWithTimeout(
      (signal) => this.generate({
        model,
        prompt,
        system: input.system,
        options: input.options,
        signal
      }),
      {
        timeoutMs,
        signal: input.signal,
        provider: this.name
      }
    );

    return normalizeProviderResult(this.name, result);
  }

  /**
   * Standardized chat wrapper.
   */
  async runChat(input = {}) {
    this.ensureOpen();

    const model = validateModel(input.model || this.defaultModel || '');
    const messages = validateMessages(input.messages);
    const timeoutMs = validateTimeout(input.timeoutMs ?? this.timeoutMs);

    const result = await executeWithTimeout(
      (signal) => this.chat({
        model,
        messages,
        options: input.options,
        signal
      }),
      {
        timeoutMs,
        signal: input.signal,
        provider: this.name
      }
    );

    return normalizeProviderResult(this.name, result);
  }

  /**
   * Optional resource cleanup hook.
   */
  async close() {
    this.closed = true;
  }
}

async function executeWithTimeout(operation, options = {}) {
  const timeoutMs = validateTimeout(options.timeoutMs);
  const provider = options.provider || 'unknown';
  const externalSignal = options.signal;
  const controller = new AbortController();

  if (externalSignal?.aborted) {
    throw new ProviderError('Provider request was cancelled.', {
      provider,
      code: 'REQUEST_ABORTED'
    });
  }

  let timer;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();

      reject(
        new ProviderError('Provider request timed out.', {
          provider,
          code: 'REQUEST_TIMEOUT',
          retryable: true
        })
      );
    }, timeoutMs);

    timer.unref?.();
  });

  let abortHandler;

  const abortPromise = new Promise((_, reject) => {
    if (!externalSignal) return;

    abortHandler = () => {
      controller.abort(externalSignal.reason);

      reject(
        new ProviderError('Provider request was cancelled.', {
          provider,
          code: 'REQUEST_ABORTED'
        })
      );
    };

    externalSignal.addEventListener('abort', abortHandler, { once: true });
  });

  try {
    const operationPromise = Promise.resolve().then(() =>
      operation(controller.signal)
    );

    const races = [operationPromise, timeoutPromise];

    if (externalSignal) {
      races.push(abortPromise);
    }

    return await Promise.race(races);
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    throw new ProviderError('Provider operation failed.', {
      provider,
      code: 'PROVIDER_OPERATION_FAILED',
      cause: error
    });
  } finally {
    clearTimeout(timer);

    if (externalSignal && abortHandler) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
  }
}

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(name, provider, options = {}) {
    const normalizedName = validateString(name, 'provider name', 100)
      .trim()
      .toLowerCase();

    if (
      !provider ||
      typeof provider.generate !== 'function' ||
      typeof provider.chat !== 'function'
    ) {
      throw new TypeError(
        'Provider must implement generate() and chat().'
      );
    }

    if (this.providers.has(normalizedName) && !options.replace) {
      throw new ProviderError(
        `Provider "${normalizedName}" is already registered.`,
        {
          provider: normalizedName,
          code: 'PROVIDER_ALREADY_REGISTERED'
        }
      );
    }

    this.providers.set(normalizedName, provider);

    return provider;
  }

  get(name) {
    const normalizedName = validateString(name, 'provider name', 100)
      .trim()
      .toLowerCase();

    const provider = this.providers.get(normalizedName);

    if (!provider) {
      throw new ProviderError(
        `Provider "${normalizedName}" is not registered.`,
        {
          provider: normalizedName,
          code: 'PROVIDER_NOT_FOUND'
        }
      );
    }

    return provider;
  }

  has(name) {
    return typeof name === 'string' &&
      this.providers.has(name.trim().toLowerCase());
  }

  list() {
    return [...this.providers.entries()].map(([name, provider]) => ({
      name,
      model: provider.defaultModel || null,
      closed: provider.closed === true
    }));
  }

  async healthAll() {
    const results = await Promise.all(
      [...this.providers.entries()].map(async ([name, provider]) => {
        try {
          return {
            name,
            ...(await provider.health())
          };
        } catch (error) {
          return {
            name,
            ok: false,
            error: {
              code: error.code || 'PROVIDER_ERROR',
              message: error.message
            }
          };
        }
      })
    );

    return results;
  }

  async closeAll() {
    const results = await Promise.allSettled(
      [...this.providers.values()].map((provider) =>
        typeof provider.close === 'function'
          ? provider.close()
          : undefined
      )
    );

    return results.map((result, index) => ({
      provider: [...this.providers.keys()][index],
      status: result.status,
      ...(result.status === 'rejected'
        ? { error: result.reason?.message || 'Cleanup failed.' }
        : {})
    }));
  }
}

function createProviderRegistry() {
  return new ProviderRegistry();
}

module.exports = {
  PROVIDER_INTERFACE_VERSION,
  ProviderError,
  ProviderInterface,
  ProviderRegistry,
  createProviderRegistry,
  executeWithTimeout,
  normalizeProviderResult,
  validateModel,
  validateMessages,
  validateTimeout
};
