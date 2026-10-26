
'use strict';

/**
 * MedOrbits -- OpenAI-Compatible Text Generation Provider
 *
 * File: src/integrations/ai/openai.provider.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Generate text using OpenAI-compatible chat completion APIs.
 * - Enforce input, output, timeout, and request validation.
 * - Normalize provider errors without exposing credentials or raw responses.
 * - Support graceful closure and injected configuration.
 *
 * Response contract:
 * {
 *   text: string,
 *   model: string,
 *   usage: object | null
 * }
 */

const { AiProvider } = require('./ai.provider');
const { loadAiConfig } = require('./ai.config');

const MAX_SYSTEM_PROMPT_CHARS = 4_000;
const MAX_MODEL_LENGTH = 128;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_TEMPERATURE = 0.2;
const MAX_TIMEOUT_MS = 120_000;

function validatePositiveInteger(value, name, maximum) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    throw new TypeError(
      `${name} must be an integer between 1 and ${maximum}.`,
    );
  }

  return value;
}

function validateTemperature(value) {
  if (value == null) {
    return DEFAULT_TEMPERATURE;
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 2
  ) {
    throw new TypeError(
      'temperature must be a finite number between 0 and 2.',
    );
  }

  return value;
}

function validateModel(value, fallback) {
  const model = value == null ? fallback : value;

  if (
    typeof model !== 'string' ||
    !model.trim() ||
    model.length > MAX_MODEL_LENGTH ||
    /[\u0000-\u001F\u007F]/u.test(model)
  ) {
    throw new TypeError('Invalid AI model name.');
  }

  return model.trim();
}

function createProviderError(message, code, status) {
  const error = new Error(message);
  error.name = 'AiProviderError';
  error.code = code;

  if (status != null) {
    error.status = status;
  }

  return error;
}

function validateConfig(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config)
  ) {
    throw new TypeError('AI configuration must be an object.');
  }

  if (
    typeof config.apiKey !== 'string' ||
    !config.apiKey.trim()
  ) {
    throw new Error('AI_API_KEY is required.');
  }

  if (
    typeof config.baseUrl !== 'string' ||
    !config.baseUrl.trim()
  ) {
    throw new TypeError('A valid AI API base URL is required.');
  }

  let baseUrl;

  try {
    baseUrl = new URL(config.baseUrl);
  } catch {
    throw new TypeError('AI API base URL must be a valid URL.');
  }

  if (
    !['https:', 'http:'].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new TypeError('AI API base URL is invalid.');
  }

  if (
    baseUrl.protocol !== 'https:' &&
    process.env.NODE_ENV === 'production'
  ) {
    throw new TypeError(
      'HTTPS is required for the AI API in production.',
    );
  }

  if (
    typeof config.model !== 'string' ||
    !config.model.trim()
  ) {
    throw new TypeError('An AI model must be configured.');
  }

  validateModel(config.model);

  validatePositiveInteger(
    config.timeoutMs,
    'timeoutMs',
    MAX_TIMEOUT_MS,
  );

  validatePositiveInteger(
    config.maxOutputTokens,
    'maxOutputTokens',
    8000,
  );

  validatePositiveInteger(
    config.maxInputChars,
    'maxInputChars',
    100_000,
  );

  return {
    ...config,
    apiKey: config.apiKey.trim(),
    baseUrl: baseUrl.toString().replace(/\/+$/, ''),
    model: config.model.trim(),
  };
}

class OpenAiProvider extends AiProvider {
  constructor(config = loadAiConfig()) {
    super();

    if (
      typeof fetch !== 'function' ||
      typeof AbortController !== 'function'
    ) {
      throw new Error(
        'OpenAiProvider requires Node.js built-in fetch and AbortController.',
      );
    }

    this.config = Object.freeze(validateConfig(config));
    this.closed = false;
    this.activeRequests = new Set();
  }

  async generateText(request) {
    if (this.closed) {
      throw createProviderError(
        'AI provider is closed.',
        'AI_PROVIDER_CLOSED',
        503,
      );
    }

    if (
      !request ||
      typeof request !== 'object' ||
      Array.isArray(request)
    ) {
      throw new TypeError(
        'AI generation request must be an object.',
      );
    }

    if (
      typeof request.prompt !== 'string' ||
      !request.prompt.trim()
    ) {
      throw new TypeError('A non-empty prompt is required.');
    }

    if (request.prompt.length > this.config.maxInputChars) {
      throw new RangeError(
        'Prompt exceeds the configured input limit.',
      );
    }

    const prompt = request.prompt.trim();

    let systemMessage;

    if (request.system != null) {
      if (typeof request.system !== 'string') {
        throw new TypeError(
          'System instructions must be a string.',
        );
      }

      systemMessage = request.system
        .slice(0, MAX_SYSTEM_PROMPT_CHARS)
        .trim();
    }

    const model = validateModel(
      request.model,
      this.config.model,
    );

    const maxOutputTokens = validatePositiveInteger(
      request.maxOutputTokens == null
        ? this.config.maxOutputTokens
        : request.maxOutputTokens,
      'maxOutputTokens',
      this.config.maxOutputTokens,
    );

    const temperature = validateTemperature(
      request.temperature,
    );

    const timeoutMs = validatePositiveInteger(
      this.config.timeoutMs,
      'timeoutMs',
      MAX_TIMEOUT_MS,
    );

    const controller = new AbortController();
    this.activeRequests.add(controller);

    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    try {
      const messages = [];

      if (systemMessage) {
        messages.push({
          role: 'system',
          content: systemMessage,
        });
      }

      messages.push({
        role: 'user',
        content: prompt,
      });

      const response = await fetch(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          signal: controller.signal,
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxOutputTokens,
            temperature,
          }),
        },
      );

      if (!response.ok) {
        const status = response.status;

        try {
          await response.body?.cancel();
        } catch {
          // Preserve the sanitized provider error.
        }

        if (status === 401 || status === 403) {
          throw createProviderError(
            'AI provider authentication or permission failed.',
            'AI_AUTH_ERROR',
            502,
          );
        }

        if (status === 429) {
          throw createProviderError(
            'AI provider rate limit or quota restriction was reached.',
            'AI_RATE_LIMIT',
            503,
          );
        }

        if (status >= 500) {
          throw createProviderError(
            'AI provider is temporarily unavailable.',
            'AI_PROVIDER_ERROR',
            502,
          );
        }

        throw createProviderError(
          'AI provider rejected the generation request.',
          'AI_REQUEST_ERROR',
          502,
        );
      }

      const contentLengthHeader =
        response.headers.get('content-length');

      if (contentLengthHeader !== null) {
        if (!/^\d+$/u.test(contentLengthHeader)) {
          await response.body?.cancel();

          throw createProviderError(
            'AI provider returned an invalid response length.',
            'AI_INVALID_RESPONSE',
            502,
          );
        }

        if (Number(contentLengthHeader) > MAX_RESPONSE_BYTES) {
          await response.body?.cancel();

          throw createProviderError(
            'AI provider response exceeded the permitted size.',
            'AI_RESPONSE_TOO_LARGE',
            502,
          );
        }
      }

      const body = await this.readResponseBody(
        response,
        controller.signal,
      );

      let data;

      try {
        data = JSON.parse(body);
      } catch {
        throw createProviderError(
          'AI provider returned an invalid JSON response.',
          'AI_INVALID_RESPONSE',
          502,
        );
      }

      const choice = data?.choices?.[0];
      const text = choice?.message?.content;

      if (typeof text !== 'string') {
        throw createProviderError(
          'AI provider returned an unexpected response structure.',
          'AI_INVALID_RESPONSE',
          502,
        );
      }

      if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
        throw createProviderError(
          'AI generated text exceeded the permitted size.',
          'AI_RESPONSE_TOO_LARGE',
          502,
        );
      }

      const responseModel =
        typeof data.model === 'string' && data.model.trim()
          ? data.model
          : model;

      return {
        text,
        model: responseModel,
        usage:
          data.usage &&
          typeof data.usage === 'object' &&
          !Array.isArray(data.usage)
            ? data.usage
            : null,
      };
    } catch (error) {
      if (error?.code) {
        throw error;
      }

      if (timedOut || error?.name === 'AbortError') {
        throw createProviderError(
          'AI request timed out.',
          'AI_TIMEOUT',
          504,
        );
      }

      throw createProviderError(
        'AI provider request failed.',
        'AI_NETWORK_ERROR',
        502,
      );
    } finally {
      clearTimeout(timer);
      this.activeRequests.delete(controller);
    }
  }

  async readResponseBody(response, signal) {
    if (!response.body) {
      throw createProviderError(
        'AI provider returned an empty response.',
        'AI_INVALID_RESPONSE',
        502,
      );
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
      while (true) {
        if (signal.aborted) {
          throw createProviderError(
            'AI request was aborted.',
            'AI_REQUEST_ABORTED',
            503,
          );
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        totalBytes += value.byteLength;

        if (totalBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel().catch(() => {});

          throw createProviderError(
            'AI provider response exceeded the permitted size.',
            'AI_RESPONSE_TOO_LARGE',
            502,
          );
        }

        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(chunks, totalBytes).toString('utf8');
  }

  async close() {
    if (this.closed) {
      return;
    }

    this.closed = true;

    for (const controller of this.activeRequests) {
      controller.abort();
    }
  }
}

module.exports = {
  OpenAiProvider,
  validatePositiveInteger,
  validateTemperature,
  validateModel,
  validateConfig,
  createProviderError,
};
