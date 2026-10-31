"use strict";

function validateBody(schema) {
  if (!schema || typeof schema !== "object") {
    throw new TypeError("A JSON Schema object is required.");
  }

  let ajv;
  try {
    const Ajv2020 = require("ajv/dist/2020");
    const addFormats = require("ajv-formats");
    ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
  } catch (error) {
    throw new Error(`Validation dependencies are unavailable: ${error.message}`);
  }

  const validate = ajv.compile(schema);

  return function aiValidationMiddleware(req, res, next) {
    if (!validate(req.body)) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: (validate.errors || []).map((item) => ({
          path: item.instancePath,
          message: item.message
        }))
      });
    }
    return next();
  };
}

module.exports = { validateBody };
