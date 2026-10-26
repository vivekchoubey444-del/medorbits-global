
/**
 * MedOrbits Local Agent
 * Ollama Provider
 *
 * Connects to a locally hosted Ollama API.
 * This provider only generates text and lists models.
 * It never executes commands or writes repository files.
 */

import config from "../config/env.js";
import {
  ProviderError,
  ProviderInterface
} from "./provider.interface.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_PROMPT_LENGTH = 100_000;
const MAX_SYSTEM_LENGTH = 30_000;
const MAX_RESPONSE_LENGTH = 2_000_000;

function normalizeBaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError("The Ollama base URL is invalid.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("The Ollama URL must use HTTP or HTTPS.");
  }

  if (url.username || url.password) {
    throw new TypeError(
      "Credentials must not be embedded in the Ollama URL."
    );
  }

  if (url.search || url.hash) {
    throw new TypeError(
      "The Ollama base URL must not contain a query or fragment."
    );
  }

  const hostname = url.hostname.toLowerCase();
  const localHosts = new Set([
    "localhost",
    "127.0.0.1",
    "[::1]",
    "::1"
  ]);

  // Prevent accidental connections to remote hosts by default.
  if (!localHosts.has(hostname)) {
    throw new TypeError(
      "Ollama must use a loopback address unless remote access is explicitly configured."
    );
  }

  return url.origin + url.pathname.replace(/\/+$/, "");
}

function validateTimeout(timeoutMs) {
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new TypeError(
      `timeoutMs must be between 1 and ${MAX_TIMEOUT_MS}.`
    );
  }

  return timeoutMs;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ProviderError(
      "Ollama returned a response that was not JSON.",
      {
        code: "INVALID_CONTENT_TYPE",
        statusCode: response.status,
        retryable: false
      }
    );
  }

  const text = await response.text();

  if (text.length > MAX_RESPONSE_LENGTH) {
    throw new ProviderError(
      "The Ollama response exceeded the allowed size.",
      {
        code: "RESPONSE_TOO_LARGE",
        statusCode: response.status,
        retryable: false
      }
    );
  }

  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new ProviderError(
      "Ollama returned malformed JSON.",
      {
        code: "INVALID_JSON",
        statusCode: response.status,
        retryable: false,
        cause
      }
    );
  }
}

export class OllamaProvider extends ProviderInterface {
  constructor({
    baseUrl = config.ollamaBaseUrl,
    model = config.ollamaModel,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}) {
    super({ name: "ollama" });

    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.model = this.validateModel(model);
    this.timeoutMs = validateTimeout(timeoutMs);
  }

  validateModel(model) {
    if (
      typeof model !== "string" ||
      !model.trim() ||
      model.length > 200
    ) {
      throw new TypeError("A valid Ollama model name is required.");
    }

    return model.trim();
  }

  async requestJson(endpoint, {
    method = "GET",
    body,
    signal,
    timeoutMs = this.timeoutMs
  } = {}) {
    validateTimeout(timeoutMs);

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(
        new DOMException("Request timed out.", "TimeoutError")
      ),
      timeoutMs
    );

    const onAbort = () => controller.abort(signal.reason);

    if (signal?.aborted) {
      clearTimeout(timer);
      throw new ProviderError("The request was cancelled.", {
        code: "REQUEST_ABORTED",
        retryable: false
      });
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const response = await fetch(
        `${this.baseUrl}${endpoint}`,
        {
          method,
          headers: {
            Accept: "application/json",
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {})
          },
          ...(body !== undefined
            ? { body: JSON.stringify(body) }
            : {}),
          signal: controller.signal,
          redirect: "error"
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new ProviderError(
          "The Ollama server rejected the request.",
          {
            code: "OLLAMA_HTTP_ERROR",
            statusCode: response.status,
            retryable: response.status >= 500
          }
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if (controller.signal.aborted) {
        const timedOut = controller.signal.reason?.name === "TimeoutError";

        throw new ProviderError(
          timedOut
            ? "The Ollama request timed out."
            : "The Ollama request was cancelled.",
          {
            code: timedOut ? "REQUEST_TIMEOUT" : "REQUEST_ABORTED",
            retryable: timedOut
          }
        );
      }

      throw new ProviderError(
        "Unable to connect to the local Ollama server.",
        {
          code: "OLLAMA_CONNECTION_ERROR",
          retryable: true
        }
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async generate(options = {}) {
    const validated = this.validateGenerateOptions(options);

    if (validated.prompt.length > MAX_PROMPT_LENGTH) {
      throw new ProviderError("The prompt is too long.", {
        code: "PROMPT_TOO_LARGE"
      });
    }

    if (
      validated.system !== undefined &&
      validated.system.length > MAX_SYSTEM_LENGTH
    ) {
      throw new ProviderError("The system prompt is too long.", {
        code: "SYSTEM_PROMPT_TOO_LARGE"
      });
    }

    const timeoutMs = validateTimeout(
      validated.timeoutMs ?? this.timeoutMs
    );

    const payload = {
      model: this.model,
      prompt: validated.prompt,
      stream: false,
      options: {
        temperature: 0.2
      },
      ...(validated.system !== undefined
        ? { system: validated.system }
        : {})
    };

    const data = await this.requestJson("/api/generate", {
      method: "POST",
      body: payload,
      signal: validated.signal,
      timeoutMs
    });

    if (typeof data.response !== "string") {
      throw new ProviderError(
        "Ollama returned an unexpected generation response.",
        {
          code: "INVALID_GENERATION_RESPONSE"
        }
      );
    }

    return {
      text: data.response,
      model: typeof data.model === "string"
        ? data.model
        : this.model,
      done: data.done === true
    };
  }

  async healthCheck() {
    try {
      await this.requestJson("/api/tags", {
        method: "GET",
        timeoutMs: Math.min(this.timeoutMs, 10_000)
      });

      return {
        available: true,
        provider: this.name,
        message: "The local Ollama API is responding."
      };
    } catch {
      return {
        available: false,
        provider: this.name,
        message: "The local Ollama API is unavailable."
      };
    }
  }

  async listModels() {
    const data = await this.requestJson("/api/tags", {
      method: "GET"
    });

    if (!Array.isArray(data.models)) {
      throw new ProviderError(
        "Ollama returned an invalid model list.",
        {
          code: "INVALID_MODEL_LIST"
        }
      );
    }

    return data.models
      .filter((item) =>
        item &&
        typeof item.name === "string" &&
        item.name.length > 0
      )
      .map((item) => ({
        name: item.name,
        ...(Number.isFinite(item.size)
          ? { size: item.size }
          : {}),
        ...(typeof item.modified_at === "string"
          ? { modifiedAt: item.modified_at }
          : {})
      }));
  }
}

export default OllamaProvider;
