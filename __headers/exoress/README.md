# Express integration

In `src/app.js`, mount the middleware before routes:

```js
const { securityHeaders } = require('./__headers/express/security-headers');
// or copy this module to src/middleware/security-headers.js
app.use(securityHeaders);
```

Adjust the relative import for your actual repository layout. If TLS terminates at Render, Cloudflare, or another proxy, configure `trust proxy` only for the trusted proxy topology and ensure HTTPS is correctly represented to Express. Prefer configuring HSTS at the HTTPS edge.
