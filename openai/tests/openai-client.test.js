"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createOpenAIClient } = require("../clients/openai.client");

test("client rejects disabled configuration", () => {
  assert.throws(
    () => createOpenAIClient({
      config: {
        enabled: false,
        apiKey: "",
        model: "",
        baseURL: "https://api.openai.com/v1",
        timeoutMs: 1000,
        maxRetries: 0
      }
    }),
    /disabled/
  );
});

test("client constructs SDK with configured options", () => {
  class FakeOpenAI {
    constructor(options) {
      this.options = options;
    }
  }

  const client = createOpenAIClient({
    OpenAI: FakeOpenAI,
    config: {
      enabled: true,
      apiKey: "test-key",
      model: "test-model",
      baseURL: "https://api.openai.com/v1",
      timeoutMs: 5000,
      maxRetries: 1
    }
  });

  assert.equal(client.options.apiKey, "test-key");
  assert.equal(client.options.timeout, 5000);
});
