# MedOrbits API — consolidated repair package

Node.js 20+ / Express / PostgreSQL-oriented API package assembled from the uploaded `api.zip`.

## Start

```bash
cp .env.example .env
npm install
npm run check
npm start
```

Health endpoint: `GET /api/health` (see the health router for its supported probes).

## Included

- Original schemas, documentation, worker and existing service implementations.
- Existing middleware retained under `middlerware/` and mirrored under the correctly spelled `middleware/`.
- Express entry point and syntax/JSON validation script.
- Missing route service adapters that fail closed with HTTP 503 until real business/database integrations are configured.
- Applications router corrected to use the existing application-service contract rather than duplicate document endpoints.

## Important production integration

This package is not a claim that a live production backend is fully configured. Before production use:

1. Configure `DATABASE_URL` and verify table/column names against your database.
2. Create a PostgreSQL pool and inject configured services into `app.locals` as needed.
3. Implement the missing document, admission, user, support, and jobs service integrations; the included adapters deliberately return 503 rather than fake successful results.
4. Set a strong `JWT_SECRET`, issuer/audience settings, and trusted CORS origins.
5. Configure Express proxy trust only for your actual hosting topology.
6. Add integration tests against a staging database and verify authentication, authorization, rate limits, and audit behavior.

No secrets are included. Do not commit `.env`.
