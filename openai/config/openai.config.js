"use strict";

const { loadEnvironment } = require("./environment.config");

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function createOpenAIConfig(env = process.env) {
  const enabled = String(env.OPENAI_ENABLED ?? "false").toLowerCase() === "true";

  const config = {
    enabled,
    apiKey: env.OPENAI_API_KEY || "",
    model: env.OPENAI_MODEL || "",
    baseURL: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    timeoutMs: parsePositiveInteger(env.OPENAI_TIMEOUT_MS, 60000, "OPENAI_TIMEOUT_MS"),
    maxRetries: parsePositiveInteger(env.OPENAI_MAX_RETRIES, 2, "OPENAI_MAX_RETRIES"),
    maxOutputTokens: parsePositiveInteger(env.OPENAI_MAX_OUTPUT_TOKENS, 1200, "OPENAI_MAX_OUTPUT_TOKENS")
  };

  let parsed;
  try {
    parsed = new URL(config.baseURL);
  } catch {
    throw new Error("OPENAI_BASE_URL must be a valid URL.");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("OPENAI_BASE_URL must use HTTP or HTTPS.");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("Non-local OpenAI endpoints must use HTTPS.");
  }

  if (enabled) {
    if (!config.apiKey) throw new Error("OPENAI_API_KEY is required when OPENAI_ENABLED=true.");
    if (!config.model) throw new Error("OPENAI_MODEL is required when OPENAI_ENABLED=true.");
  }

  return Object.freeze(config);
}

function getOpenAIConfig() {
  loadEnvironment();
  return createOpenAIConfig();
}

module.exports = { createOpenAIConfig, getOpenAIConfig };
