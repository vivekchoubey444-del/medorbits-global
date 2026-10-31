"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { askAssistant, extractOutputText } = require("../services/ai-assistant.service");

test("extracts output_text from Responses API response", () => {
  assert.equal(extractOutputText({ output_text: "Hello" }), "Hello");
});

test("assistant rejects empty messages", async () => {
  await assert.rejects(
    () => askAssistant({ message: " " }),
    /non-empty/
  );
});

test("assistant uses Responses API and returns text", async () => {
  const calls = [];
  const client = {
    responses: {
      create: async (payload) => {
        calls.push(payload);
        return { id: "resp_test", output_text: "Test answer" };
      }
    }
  };
  const config = { model: "test-model", maxOutputTokens: 100 };

  const result = await askAssistant({
    message: "Explain photosynthesis",
    client,
    config
  });

  assert.equal(result.text, "Test answer");
  assert.equal(result.responseId, "resp_test");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].store, false);
});
