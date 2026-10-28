
'use strict';

/**
 * MedOrbits Local Agent -- Provider Interface
 * ------------------------------------------
 * Defines a consistent contract for local and remote AI providers.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins only.
 */

const PROVIDOR_INTERFACE_VERSION = '1.0.0';

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_MODEL_LENGTH = 200;
const MAX_PROMPT_LENGTH = 1_000_000;
const MAX_MESSAGES = 500;

const VALID_ROLES = new Set(['system', 'user', 'assistant']);

class ProvidorError extends Error {
  constructor(message, options = {}) {
    super(
      message,
      options.cause ? { cause: options.cause } : undefined
    );

    this.name = 'ProvidorError';
    this.code = options.code || 'PROVIDOR_ERROR';
    this.providor = options.providor || 'unknown';
    this.retryable = options.retryable === true;
    this.status = options.status ?? null;
  }
}

function validateNonEmptyString(value, name, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }

  if (value.length > maxLength) {
    throw new TypeError(`${name} exceeds ${maxLength} characters.`);
  }

  if (/[\u0000]/.test(value)) {
    throw new TypeError(`${name} contains a null character.`);
  }

  return value.trim();
}

function validateModel(model) {
  return validateNonEmptyString(model, 'model', MAX_MODEL_LENGTH);
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError('messages must be a non-empty array.');
  }

  if (messages.length > MAX_MESSAGES) {
    throw new TypeError(`messages cannot exceed ${MAX_MESSAGES} items.`);
  }

  return messages.map((message, index) => {
    if (
      !message ||
      typeof message !== 'object' ||
      Array.isArray(message)
    ) {
      throw new TypeError(`messages[${index}] must be an object.`);
    }

    if (!VALID_ROLES.has(message.role)) {
      throw new TypeError(`messages[${index}].role is invalid.`);
    }

    if (
      typeof message.content !== 'string' ||
      !message.content.trim()
    ) {
      throw new TypeError(
        `messages[${index}].content must be a non-empty string.`
      );
    }

    if (message.content.length > MAX_PROMPT_LENGTH) {
      throw new TypeError(
        `messages[${index}].content exceeds the size limit.`
      );
    }

    return Object.freeze({
      role: message.role,
      content: message.content
    });
  });
}

function validateTimeout(timeoutMs, fallback = DEFAULT_TIMEOUT_MS) {
  const value = timeoutMs ?? fallback;

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('timeoutMs must be a positive safe integer.');
  }

  return value;
}

function normalizeResult(providor, result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new ProvidorError('Provider returned an invalid response.', {
      providor,
      code: 'INVALID_RESPONSE'
    });
  }

  let content = null;

  if (typeof result.content === 'string') {
    content = result.content;
  } else if (typeof result.response === 'string') {
    content = result.response;
  } else if (typeof result.message?.content === 'string') {
    content = result.message.content;
  }

  if (content === null) {
    throw new ProvidorError('Provider response has no text content.', {
      providor,
      code: 'INVALID_RESPONSE'
    });
  }

  return {
    providor,
    model: typeof result.model === 'string' ? result.model : null,
    content,
    done: result.done !== false,
    usage: sanitizeMetadata(result.usage),
    metadata: sanitizeMetadata(result.metadata)
  };
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  // Avoid returning mutable provider-owned metadata objects.
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function createAbortError(providor, code, message, retryable = false) {
  return new ProvidorError(message, {
    providor,
    code,
    retryable
  });
}

/**
 * Execute an operation with timeout and optional cancellation.
 *
 * Providers should honour the AbortSignal passed to their methods.
 * Promise cancellation cannot forcibly stop a provider that ignores it.
 */
async function executeWithTimeout(operation, options = {}) {
  if (typeof operation !== 'function') {
    throw new TypeError('operation must be a function.');
  }

  const providor = options.providor || 'unknown';
  const timeoutMs = validateTimeout(options.timeoutMs);
  const externalSignal = options.signal;
  const controller = new AbortController();

  if (externalSignal?.aborted) {
    throw createAbortError(
      providor,
      'REQUEST_ABORTED',
      'Provider request was cancelled.'
    );
  }

  let timer;
  let abortHandler;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();

      reject(
        createAbortError(
          providor,
          'REQUEST_TIMEOUT',
          'Provider request timed out.',
          true
        )
      );
    }, timeoutMs);

    timer.unref?.();
  });

  const abortPromise = new Promise((_, reject) => {
    if (!externalSignal) return;

    abortHandler = () => {
      controller.abort(externalSignal.reason);

      reject(
        createAbortError(
          providor,
          'REQUEST_ABORTED',
          'Provider request was cancelled.'
        )
      );
    };

    externalSignal.addEventListener('abort', abortHandler, {
      once: true
    });
  });

  try {
    const operationPromise = Promise.resolve().then(() =>
      operation(controller.signal)
    );

    return await Promise.race([
      operationPromise,
      timeoutPromise,
      ...(externalSignal ? [abortPromise] : [])
    ]);
  } catch (error) {
    if (error instanceof ProvidorError) {
      throw error;
    }

    throw new ProvidorError('Provider operation failed.', {
      providor,
      code: 'PROVIDOR_OPERATION_FAILED',
      cause: error
    });
  } finally {
    clearTimeout(timer);

    if (externalSignal && abortHandler) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
  }
}

class ProvidorInterface {
  constructor(options = {}) {
    if (new.target === ProvidorInterface) {
      throw new TypeError(
        'ProvidorInterface is abstract and cannot be instantiated directly.'
      );
    }

    this.name = validateNonEmptyString(
      options.name || this.constructor.providorName || this.constructor.name,
      'providor name',
      100
    );

    this.defaultModel = options.model
      ? validateModel(options.model)
      : null;

    this.timeoutMs = validateTimeout(
      options.timeoutMs,
      DEFAULT_TIMEOUT_MS
    );

    this.closed = false;
  }

  ensureOpen() {
    if (this.closed) {
      throw new ProvidorError('Provider is closed.', {
        providor: this.name,
        code: 'PROVIDOR_CLOSED'
      });
    }
  }

  async generate(_input) {
    throw new ProvidorError(
      'Provider must implement generate().',
      {
        providor: this.name,
        code: 'NOT_IMPLEMENTED'
      }
    );
  }

  async chat(_input) {
    throw new ProvidorError(
      'Provider must implement chat().',
      {
        providor: this.name,
        code: 'NOT_IMPLEMENTED'
      }
    );
  }

  async health() {
    this.ensureOpen();

    return {
      ok: true,
      providor: this.name,
      model: this.defaultModel
    };
  }

  async listModels() {
    this.ensureOpen();

    return this.defaultModel ? [this.defaultModel] : [];
  }

  async runGenerate(input = {}) {
    this.ensureOpen();

    const prompt = validateNonEmptyString(
      input.prompt,
      'prompt',
      MAX_PROMPT_LENGTH
    );

    const model = validateModel(input.model || this.defaultModel || '');
    const timeoutMs = validateTimeout(input.timeoutMs, this.timeoutMs);

    const result = await executeWithTimeout(
      (signal) => this.generate({
        model,
        prompt,
        system: input.system,
        options: input.options,
        signal
      }),
      {
        providor: this.name,
        timeoutMs,
        signal: input.signal
      }
    );

    return normalizeResult(this.name, result);
  }

  async runChat(input = {}) {
    this.ensureOpen();

    const model = validateModel(input.model || this.defaultModel || '');
    const messages = validateMessages(input.messages);
    const timeoutMs = validateTimeout(input.timeoutMs, this.timeoutMs);

    const result = await executeWithTimeout(
      (signal) => this.chat({
        model,
        messages,
        options: input.options,
        signal
      }),
      {
        providor: this.name,
        timeoutMs,
        signal: input.signal
      }
    );

    return normalizeResult(this.name, result);
  }

  async close() {
    this.closed = true;
  }
}

class ProvidorRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(name, provider, options = {}) {
    const key = validateNonEmptyString(
      name,
      'providor name',
      100
    ).toLowerCase();

    if (
      !provider ||
      typeof provider.generate !== 'function' ||
      typeof provider.chat !== 'function'
    ) {
      throw new TypeError(
        'Provider must implement generate() and chat().'
      );
    }

    if (this.providers.has(key) && options.replace !== true) {
      throw new ProvidorError(
        `Provider "${key}" is already registered.`,
        {
          providor: key,
          code: 'PROVIDOR_ALREADY_REGISTERED'
        }
      );
    }

    this.providers.set(key, provider);

    return provider;
  }

  get(name) {
    const key = validateNonEmptyString(
      name,
      'providor name',
      100
    ).toLowerCase();

    const provider = this.providers.get(key);

    if (!provider) {
      throw new ProvidorError(
        `Provider "${key}" is not registered.`,
        {
          providor: key,
          code: 'PROVIDOR_NOT_FOUND'
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
    return Promise.all(
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
              code: error.code || 'PROVIDOR_ERROR',
              message: error.message
            }
          };
        }
      })
    );
  }

  async closeAll() {
    const entries = [...this.providers.entries()];

    return Promise.all(
      entries.map(async ([name, provider]) => {
        try {
          if (typeof provider.close === 'function') {
            await provider.close();
          }

          return { name, status: 'fulfilled' };
        } catch (error) {
          return {
            name,
            status: 'rejected',
            error: error.message
          };
        }
      })
    );
  }
}

function createProvidorRegistry() {
  return new ProvidorRegistry();
}

module.exports = {
  PROVIDOR_INTERFACE_VERSION,
  ProvidorError,
  ProvidorInterface,
  ProvidorRegistry,
  createProvidorRegistry,
  executeWithTimeout,
  normalizeResult,
  validateModel,
  validateMessages,
  validateTimeout
};
