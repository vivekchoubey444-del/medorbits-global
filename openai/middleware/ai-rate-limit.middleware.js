"use strict";

const rateLimit = require("express-rate-limit");

function createAiRateLimitMiddleware(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000,
    limit: options.limit || 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many AI requests. Please try again later."
    },
    keyGenerator: options.keyGenerator,
    skip: options.skip
  });
}

module.exports = { createAiRateLimitMiddleware };
