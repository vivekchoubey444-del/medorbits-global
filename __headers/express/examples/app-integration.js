"use strict";

// Example only: adapt paths and route modules to your actual application.
const express = require("express");
const { securityHeaders } = require("../middleware/security-headers");

const app = express();

// Register security middleware before routes and error handlers.
app.disable("x-powered-by");
app.use(securityHeaders());

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "medorbits-api"
  });
});

// Mount real application routes here.
// app.use("/api", require("../../routes"));

const PORT = Number(process.env.PORT || 3000);

if (require.main === module) {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`MedOrbits example server listening on 127.0.0.1:${PORT}`);
  });
}

module.exports = app;
