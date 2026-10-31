"use strict";

const crypto = require("node:crypto");

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createAiAuthMiddleware(options = {}) {
  const expectedToken = options.token || process.env.MEDORBITS_AI_ACCESS_TOKEN;
  const headerName = (options.headerName || "authorization").toLowerCase();

  return function aiAuthMiddleware(req, res, next) {
    if (typeof expectedToken !== "string" || expectedToken.length < 32) {
      return res.status(503).json({ error: "AI service authentication is not configured." });
    }

    const supplied = req.get(headerName) || "";
    const token = supplied.startsWith("Bearer ") ? supplied.slice(7) : "";

    if (!token || !safeEqual(token, expectedToken)) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    return next();
  };
}

module.exports = { createAiAuthMiddleware };
