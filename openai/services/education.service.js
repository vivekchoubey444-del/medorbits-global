"use strict";

const { askAssistant } = require("./ai-assistant.service");

async function answerEducationQuery({ query, course, location, client, config } = {}) {
  if (typeof query !== "string" || !query.trim()) {
    throw new TypeError("query must be a non-empty string.");
  }

  const details = [
    course ? `Course context: ${String(course).slice(0, 200)}` : "",
    location ? `Location context: ${String(location).slice(0, 200)}` : ""
  ].filter(Boolean).join("\n");

  return askAssistant({
    message: `${details}\nEducation question: ${query}`.trim(),
    client,
    config
  });
}

module.exports = { answerEducationQuery };
