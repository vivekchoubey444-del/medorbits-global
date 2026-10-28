
'use strict';

/**
 * MedOrbits Local Agent -- Ollama Service
 * -------------------------------------
 * Node.js 20+
 *
 * Provides:
 * - Ollama connectivity and model discovery
 * - Chat and text generation
 * - Streaming chat responses
 * - Request timeouts and cancellation
 * - Model availability checks
 * - Structured error handling
 * - Safe defaults for a local-first agent
 *
 * No external npm dependencies required.
 */

const OLLAMA_SERVICE_VERSION = '1.0.0';

const DEFAULT_HOST = 'http://127.0.0.1:11434';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_KEEP_ALIVE = '5m';
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 1_000_000;
const MAX_MODEL_NAME_LENGTH = 200;

class OllamaServiceError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);

    this.name = 'OllamaServiceError';
    this.code = options.code || 'OLLAMA_ERROR';
    this.status = options.status ?? null;
    this.retryable = Boolean(options.retryable);
  }
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }

  return number;
}

function normalizeHost(value = DEFAULT_HOST) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Ollama host must be a non-empty string.');
  }

  let parsed;

  try {
    parsed = new URL(value.trim());
  } catch {
    throw new TypeError('Ollama host must be a valid URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError('Ollama host must use HTTP or HTTPS.');
  }

  if (parsed.username || parsed.password) {
    throw new TypeError('Credentials must not be embedded in the Ollama URL.');
  }

  if (parsed.search || parsed.hash) {
    throw new TypeError('Ollama host must not contain a query or fragment.');
  }

  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new TypeError('Ollama host must contain only the origin.');
  }

  const hostname = parsed.hostname.toLowerCase();

  const isLocalHost = [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]'
  ].includes(hostname);

  if (parsed.protocol === 'http:' && !isLocalHost) {
    throw new TypeError(
      'Plain HTTP is permitted only for loopback hosts. Use HTTPS for remote hosts.'
    );
  }

  return parsed.origin;
}

function validateModelName(model) {
  if (typeof model !== 'string') {
    throw new TypeError('Model name must be a string.');
  }

  const value = model.trim();

  if (
    !value ||
    value.length > MAX_MODEL_NAME_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError('Model name is empty, too long, or contains control characters.');
  }

  return value;
}

function validatePrompt(prompt, name = 'prompt') {
  if (typeof prompt !== 'string') {
    throw new TypeError(`${name} must be a string.`);
  }

  if (!prompt.trim()) {
    throw new TypeError(`${name} must not be empty.`);
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new TypeError(`${name} exceeds the maximum allowed length.`);
  }

  return prompt;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError('messages must be a non-empty array.');
  }

  return messages.map((message, index) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new TypeError(`messages[${index}] must be an object.`);
    }

    const allowedRoles = new Set(['system', 'user', 'assistant']);

    if (!allowedRoles.has(message.role)) {
      throw new TypeError(`messages[${index}].role is invalid.`);
    }

    return {
      role: message.role,
      content: validatePrompt(message.content, `messages[${index}].content`)
    };
  });
}

function sanitizeErrorMessage(message) {
  return String(message || 'Unknown Ollama error')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 1000);
}

class OllamaService {
  constructor(options = {}) {
    this.host = normalizeHost(
      options.host || process.env.OLLAMA_HOST || DEFAULT_HOST
    );

    this.timeoutMs = positiveInteger(
      options.timeoutMs,
      DEFAULT_TIMEOUT_MS,
      'timeoutMs'
    );

    this.connectTimeoutMs = positiveInteger(
      options.connectTimeoutMs,
      DEFAULT_CONNECT_TIMEOUT_MS,
      'connectTimeoutMs'
    );

    this.keepAlive = options.keepAlive || DEFAULT_KEEP_ALIVE;

    if (typeof this.keepAlive !== 'string' || !this.keepAlive.trim()) {
      throw new TypeError('keepAlive must be a non-empty string.');
    }

    this.fetch = options.fetch || globalThis.fetch;

    if (typeof this.fetch !== 'function') {
      throw new Error(
        'A Fetch API implementation is required. Use Node.js 20 or newer.'
      );
    }

    this.defaultModel = options.model
      ? validateModelName(options.model)
      : process.env.OLLAMA_MODEL
        ? validateModelName(process.env.OLLAMA_MODEL)
        : null;

    this.closed = false;
  }

  ensureOpen() {
    if (this.closed) {
      throw new OllamaServiceError('Ollama service is closed.', {
        code: 'SERVICE_CLOSED'
      });
    }
  }

  buildUrl(endpoint) {
    const normalized = String(endpoint).replace(/^\/+/, '');

    if (normalized.includes('..')) {
      throw new TypeError('Invalid Ollama endpoint.');
    }

    return new URL(normalized, `${this.host}/`).toString();
  }

  async request(endpoint, options = {}) {
    this.ensureOpen();

    const timeoutMs = positiveInteger(
      options.timeoutMs,
      this.timeoutMs,
      'timeoutMs'
    );

    const externalSignal = options.signal;
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort(
        new OllamaServiceError('Ollama request timed out.', {
          code: 'REQUEST_TIMEOUT',
          retryable: true
        })
      );
    }, timeoutMs);

    timeout.unref?.();

    const onAbort = () => {
      controller.abort(externalSignal.reason);
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeout);

        throw new OllamaServiceError('Ollama request was cancelled.', {
          code: 'REQUEST_ABORTED'
        });
      }

      externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const response = await this.fetch(this.buildUrl(endpoint), {
        method: options.method || 'GET',
        headers: {
          Accept: options.stream ? 'application/x-ndjson' : 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        redirect: 'error'
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;

        try {
          const text = await response.text();
          detail = sanitizeErrorMessage(text || detail);
        } catch {
          // Preserve the HTTP status if the response body cannot be read.
        }

        throw new OllamaServiceError(`Ollama request failed: ${detail}`, {
          code: 'HTTP_ERROR',
          status: response.status,
          retryable: response.status === 429 || response.status >= 500
        });
      }

      return response;
    } catch (error) {
      if (error instanceof OllamaServiceError) {
        throw error;
      }

      if (controller.signal.aborted) {
        const timedOut = controller.signal.reason?.code === 'REQUEST_TIMEOUT';

        throw new OllamaServiceError(
          timedOut ? 'Ollama request timed out.' : 'Ollama request was cancelled.',
          {
            code: timedOut ? 'REQUEST_TIMEOUT' : 'REQUEST_ABORTED',
            retryable: timedOut
          }
        );
      }

      throw new OllamaServiceError('Unable to reach the Ollama service.', {
        code: 'CONNECTION_ERROR',
        retryable: true,
        cause: error
      });
    } finally {
      clearTimeout(timeout);

      if (externalSignal) {
        externalSignal.removeEventListener('abort', onAbort);
      }
    }
  }

  async readJson(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);

    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new OllamaServiceError('Ollama response exceeds the size limit.', {
        code: 'RESPONSE_TOO_LARGE'
      });
    }

    const text = await response.text();

    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new OllamaServiceError('Ollama response exceeds the size limit.', {
        code: 'RESPONSE_TOO_LARGE'
      });
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new OllamaServiceError('Ollama returned invalid JSON.', {
        code: 'INVALID_RESPONSE',
        cause: error
      });
    }
  }

  async health(options = {}) {
    try {
      const response = await this.request('api/version', {
        timeoutMs: options.timeoutMs || this.connectTimeoutMs,
        signal: options.signal
      });

      const data = await this.readJson(response);

      return {
        ok: true,
        service: 'ollama',
        host: this.host,
        version: typeof data.version === 'string' ? data.version : null
      };
    } catch (error) {
      return {
        ok: false,
        service: 'ollama',
        host: this.host,
        error: {
          code: error.code || 'OLLAMA_ERROR',
          message: error.message
        }
      };
    }
  }

  async listModels(options = {}) {
    const response = await this.request('api/tags', {
      signal: options.signal,
      timeoutMs: options.timeoutMs
    });

    const data = await this.readJson(response);

    if (!Array.isArray(data.models)) {
      throw new OllamaServiceError('Ollama returned an invalid model list.', {
        code: 'INVALID_RESPONSE'
      });
    }

    return data.models.map((model) => ({
      name: String(model.name || ''),
      model: String(model.model || model.name || ''),
      size: Number.isFinite(model.size) ? model.size : null,
      digest: typeof model.digest === 'string' ? model.digest : null,
      modifiedAt: typeof model.modified_at === 'string'
        ? model.modified_at
        : null
    }));
  }

  async hasModel(model, options = {}) {
    const expected = validateModelName(model);
    const models = await this.listModels(options);

    return models.some(
      (item) => item.name === expected || item.model === expected
    );
  }

  async ensureModel(model, options = {}) {
    const expected = validateModelName(model);
    const available = await this.hasModel(expected, options);

    if (!available) {
      throw new OllamaServiceError(
        `Required Ollama model is not installed: ${expected}`,
        { code: 'MODEL_NOT_FOUND' }
      );
    }

    return expected;
  }

  async chat(options = {}) {
    const model = validateModelName(
      options.model || this.defaultModel || ''
    );

    const messages = validateMessages(options.messages);

    const response = await this.request('api/chat', {
      method: 'POST',
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      body: {
        model,
        messages,
        stream: false,
        keep_alive: options.keepAlive || this.keepAlive,
        ...(options.format ? { format: options.format } : {}),
        ...(options.options ? { options: options.options } : {})
      }
    });

    const data = await this.readJson(response);

    if (!data.message || typeof data.message.content !== 'string') {
      throw new OllamaServiceError('Ollama returned an invalid chat response.', {
        code: 'INVALID_RESPONSE'
      });
    }

    return {
      model: String(data.model || model),
      message: {
        role: String(data.message.role || 'assistant'),
        content: data.message.content
      },
      done: data.done === true,
      totalDuration: data.total_duration ?? null,
      promptEvalCount: data.prompt_eval_count ?? null,
      evalCount: data.eval_count ?? null
    };
  }

  async generate(options = {}) {
    const model = validateModelName(
      options.model || this.defaultModel || ''
    );

    const prompt = validatePrompt(options.prompt);

    const response = await this.request('api/generate', {
      method: 'POST',
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      body: {
        model,
        prompt,
        stream: false,
        keep_alive: options.keepAlive || this.keepAlive,
        ...(options.system ? {
          system: validatePrompt(options.system, 'system')
        } : {}),
        ...(options.format ? { format: options.format } : {}),
        ...(options.options ? { options: options.options } : {})
      }
    });

    const data = await this.readJson(response);

    if (typeof data.response !== 'string') {
      throw new OllamaServiceError('Ollama returned an invalid generation response.', {
        code: 'INVALID_RESPONSE'
      });
    }

    return {
      model: String(data.model || model),
      response: data.response,
      done: data.done === true,
      totalDuration: data.total_duration ?? null,
      promptEvalCount: data.prompt_eval_count ?? null,
      evalCount: data.eval_count ?? null
    };
  }

  async *streamChat(options = {}) {
    const model = validateModelName(
      options.model || this.defaultModel || ''
    );

    const messages = validateMessages(options.messages);

    const response = await this.request('api/chat', {
      method: 'POST',
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      stream: true,
      body: {
        model,
        messages,
        stream: true,
        keep_alive: options.keepAlive || this.keepAlive,
        ...(options.options ? { options: options.options } : {})
      }
    });

    if (!response.body) {
      throw new OllamaServiceError('Ollama response has no readable body.', {
        code: 'INVALID_RESPONSE'
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalBytes += value.byteLength;

        if (totalBytes > MAX_RESPONSE_BYTES) {
          throw new OllamaServiceError('Ollama stream exceeds the size limit.', {
            code: 'RESPONSE_TOO_LARGE'
          });
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;

        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;

          let item;

          try {
            item = JSON.parse(line);
          } catch (error) {
            throw new OllamaServiceError('Ollama stream returned invalid JSON.', {
              code: 'INVALID_RESPONSE',
              cause: error
            });
          }

          if (item.error) {
            throw new OllamaServiceError(
              sanitizeErrorMessage(item.error),
              { code: 'OLLAMA_STREAM_ERROR' }
            );
          }

          yield item;

          if (item.done === true) {
            return;
          }
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        let item;

        try {
          item = JSON.parse(buffer);
        } catch (error) {
          throw new OllamaServiceError('Ollama stream ended with invalid JSON.', {
            code: 'INVALID_RESPONSE',
            cause: error
          });
        }

        if (item.error) {
          throw new OllamaServiceError(
            sanitizeErrorMessage(item.error),
            { code: 'OLLAMA_STREAM_ERROR' }
          );
        }

        yield item;
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // The stream may already be closed.
      }

      reader.releaseLock();
    }
  }

  close() {
    this.closed = true;
  }
}

function createOllamaService(options = {}) {
  return new OllamaService(options);
}

module.exports = {
  OLLAMA_SERVICE_VERSION,
  OllamaService,
  OllamaServiceError,
  createOllamaService,
  normalizeHost,
  validateModelName,
  validatePrompt,
  validateMessages
};
