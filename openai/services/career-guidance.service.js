"use strict";

const { askAssistant } = require("./ai-assistant.service");

async function getCareerGuidance({ question, education, interests, region, client, config } = {}) {
  if (typeof question !== "string" || !question.trim()) {
    throw new TypeError("question must be a non-empty string.");
  }

  const context = [
    education && `Education: ${String(education).slice(0, 200)}`,
    interests && `Interests: ${String(interests).slice(0, 300)}`,
    region && `Region: ${String(region).slice(0, 100)}`
  ].filter(Boolean).join("\n");

  return askAssistant({
    message: [
      "Provide practical career exploration guidance.",
      "Distinguish suggestions from guaranteed employment outcomes.",
      "Do not invent job openings, salaries, or recruitment commitments.",
      context,
      `Question: ${question}`
    ].filter(Boolean).join("\n"),
    client,
    config
  });
}

module.exports = { getCareerGuidance };
