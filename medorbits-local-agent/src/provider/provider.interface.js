
/**
 * MedOrbits Local Agent
 * AI Provider Interface
 *
 * Defines the contract that every AI provider must implement.
 * This module does not connect to a model or make network requests.
 */

export const PROVIDER_CAPABILITIES = Object.freeze({
  chat: "chat",
  health: "health",
  models: "models"
});

export class ProviderError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code]
   * @param {number} [options.statusCode]
   * @param {boolean} [options.retryable]
   * @param {Error} [options.cause]
   */
  constructor(
    message,
    {
      code = "PROVIDER_ERROR",
      statusCode = null,
      retryable = false,
      cause
    } = {}
  ) {
    super(message, cause ? { cause } : undefined);

    this.name = "ProviderError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export class ProviderInterface {
  constructor({ name = "base-provider" } = {}) {
    if (new.target === ProviderInterface) {
      throw new TypeError(
        "ProviderInterface is abstract and cannot be instantiated directly."
      );
    }

    this.name = name;
  }

  /**
   * Generate a response from the configured AI model.
   *
   * @param {object} options
   * @param {string} options.prompt
   * @param {string} [options.system]
   * @param {AbortSignal} [options.signal]
   * @param {number} [options.timeoutMs]
   * @returns {Promise<{text: string, model?: string, done?: boolean}>}
   */
  async generate(_options) {
    throw new Error(
      `${this.name}.generate() must be implemented by the provider.`
    );
  }

  /**
   * Check whether the provider endpoint is reachable.
   *
   * @returns {Promise<{available: boolean, provider: string, message?: string}>}
   */
  async healthCheck() {
    throw new Error(
      `${this.name}.healthCheck() must be implemented by the provider.`
    );
  }

  /**
   * Return models available from the provider.
   *
   * @returns {Promise<Array<{name: string, size?: number, modifiedAt?: string}>>}
   */
  async listModels() {
    throw new Error(
      `${this.name}.listModels() must be implemented by the provider.`
    );
  }

  /**
   * Validate the minimum request requirements before calling a provider.
   *
   * @param {object} options
   * @returns {{prompt: string, system?: string, signal?: AbortSignal, timeoutMs?: number}}
   */
  validateGenerateOptions(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Generate options must be an object.");
    }

    if (typeof options.prompt !== "string" || !options.prompt.trim()) {
      throw new TypeError("A non-empty prompt string is required.");
    }

    if (
      options.system !== undefined &&
      typeof options.system !== "string"
    ) {
      throw new TypeError("The system prompt must be a string.");
    }

    if (
      options.timeoutMs !== undefined &&
      (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1)
    ) {
      throw new TypeError("timeoutMs must be a positive integer.");
    }

    if (
      options.signal !== undefined &&
      (
        typeof options.signal !== "object" ||
        typeof options.signal.aborted !== "boolean"
      )
    ) {
      throw new TypeError("signal must be a valid AbortSignal.");
    }

    return {
      prompt: options.prompt.trim(),
      ...(options.system !== undefined
        ? { system: options.system }
        : {}),
      ...(options.signal !== undefined
        ? { signal: options.signal }
        : {}),
      ...(options.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : {})
    };
  }

  /**
   * Normalize an error without exposing secrets or request contents.
   *
   * @param {unknown} error
   * @returns {ProviderError}
   */
  normalizeError(error) {
    if (error instanceof ProviderError) {
      return error;
    }

    if (error?.name === "AbortError") {
      return new ProviderError("The provider request was cancelled.", {
        code: "REQUEST_ABORTED",
        retryable: false,
        cause: error
      });
    }

    if (error?.name === "TimeoutError") {
      return new ProviderError("The provider request timed out.", {
        code: "REQUEST_TIMEOUT",
        retryable: true,
        cause: error
      });
    }

    return new ProviderError("The AI provider request failed.", {
      code: "PROVIDER_ERROR",
      retryable: false,
      cause: error instanceof Error ? error : undefined
    });
  }
}

export default ProviderInterface;
