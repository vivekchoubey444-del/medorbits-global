# MedOrbits Express Security Headers

**Path:** `__headers/express/`  
**Version:** 1.0.0

Express middleware and integration templates for applying HTTP security
headers to MedOrbits Node.js/Express responses.

## Contents

- `middleware/security-headers.js` — configurable Express middleware.
- `config/security-headers.json` — documented policy defaults.
- `examples/app-integration.js` — example Express integration.
- `scripts/validate-config.js` — validates the local JSON configuration.
- `tests/security-headers.test.js` — dependency-free tests for middleware behavior.
- `package.json` — package metadata and commands.

## Installation

From this directory:

```bash
npm install
npm test
npm run validate
```

The middleware itself uses Node.js built-ins and does not require Helmet.
If the main application already uses Helmet, avoid configuring overlapping
headers twice. Choose one authoritative header configuration and test the
final response headers.

## Integration

Copy the middleware into the Express application or import it from this
directory, then register it before routes:

```js
const express = require(“express”);
const { securityHeaders } = require(“./middleware/security-headers”);

const app = express();

app.use(securityHeaders());
app.use(express.json());

// Register application routes after security middleware.
```

Adjust the relative path to match the real repository structure.

## Important deployment notes

- This is Express middleware; it only affects responses handled by the
  Express application. It does not configure Cloudflare, Vercel, Netlify
  or Nginx.
- If a reverse proxy or hosting platform also sets headers, inspect the
  final response and remove duplicate/conflicting rules.
- CSP is not enabled by default. Build an application-specific policy
  after inventorying scripts, styles, fonts, images, APIs, frames and
  third-party integrations. Consider report-only mode first.
- HSTS is disabled by default. Enable it only after HTTPS is confirmed
  for every affected hostname. Do not enable `includeSubDomains` or
  `preload` without a separate domain review.
- `X-Frame-Options: SAMEORIGIN` can break cross-origin iframe integrations.
- The default Permissions-Policy disables camera, microphone and
  geolocation. Change it only when a documented feature requires them.
- Do not publicly cache authenticated, personalized, application,
  payment or sensitive API responses.
- These headers do not replace authentication, authorization, CSRF
  protection, input validation, secure cookies or API rate limiting.
