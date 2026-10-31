"use strict";

const OpenAI = require("openai");
const { getOpenAIConfig } = require("../config/openai.config");

let singleton;

function createOpenAIClient(options = {}) {
  const config = options.config || getOpenAIConfig();
  if (!config.enabled) {
    throw new Error("OpenAI integration is disabled. Set OPENAI_ENABLED=true to enable it.");
  }

  const Client = options.OpenAI || OpenAI;
  return new Client({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: config.timeoutMs,
    maxRetries: config.maxRetries
  });
}

function getOpenAIClient() {
  if (!singleton) singleton = createOpenAIClient();
  return singleton;
}

function resetOpenAIClientForTests() {
  singleton = undefined;
}

module.exports = { createOpenAIClient, getOpenAIClient, resetOpenAIClientForTests };
