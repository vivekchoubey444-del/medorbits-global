"use strict";

const { getOpenAIClient } = require("../clients/openai.client");
const { getOpenAIConfig } = require("../config/openai.config");

const SYSTEM_INSTRUCTIONS = [
  "You are the MedOrbits educational information assistant.",
  "Provide clear, factual, appropriately qualified educational guidance.",
  "Do not claim to make official admission decisions or verify institutions, fees, cutoffs, or eligibility.",
  "Distinguish current verified information from general guidance.",
  "If information may have changed, tell the user to confirm it with the relevant official authority.",
  "Do not request passwords, API keys, or unnecessary sensitive personal information."
].join(" ");

function extractOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

async function askAssistant({ message, context = [], client, config } = {}) {
  if (typeof message !== "string" || !message.trim()) {
    throw new TypeError("message must be a non-empty string.");
  }
  if (message.length > 12000) throw new RangeError("message exceeds 12000 characters.");
  if (!Array.isArray(context) || context.length > 12) {
    throw new TypeError("context must be an array containing at most 12 messages.");
  }

  const cfg = config || getOpenAIConfig();
  const api = client || getOpenAIClient();
  const input = [
    ...context.map((entry) => {
      if (!entry || !["user", "assistant"].includes(entry.role) || typeof entry.content !== "string") {
        throw new TypeError("Each context item must have role user/assistant and string content.");
      }
      return { role: entry.role, content: entry.content.slice(0, 4000) };
    }),
    { role: "user", content: message.trim() }
  ];

  const response = await api.responses.create({
    model: cfg.model,
    instructions: SYSTEM_INSTRUCTIONS,
    input,
    max_output_tokens: cfg.maxOutputTokens,
    store: false
  });

  const text = extractOutputText(response);
  if (!text) throw new Error("OpenAI returned no text output.");
  return { text, responseId: response.id || null };
}

module.exports = { askAssistant, extractOutputText, SYSTEM_INSTRUCTIONS };
