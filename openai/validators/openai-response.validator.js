"use strict";

function validateTextResponse(response) {
  if (!response || typeof response !== "object") {
    throw new TypeError("OpenAI response must be an object.");
  }

  if (typeof response.text !== "string" || !response.text.trim()) {
    throw new TypeError("OpenAI response text is missing or empty.");
  }

  if (response.text.length > 100000) {
    throw new RangeError("OpenAI response exceeds the permitted length.");
  }

  return {
    text: response.text.trim(),
    responseId: typeof response.responseId === "string" ? response.responseId : null
  };
}

module.exports = { validateTextResponse };
