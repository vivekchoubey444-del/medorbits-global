# MedOrbits API functions — repaired baseline

This archive turns the five empty API folders into Vercel-compatible Node.js serverless functions.

## Endpoints

- `GET /api/health` — basic health and configuration status (does not test DB connectivity).
- `POST /api/contact` — validates and stores a contact form submission in PostgreSQL.
- `POST /api/lead` — validates and stores a lead/enquiry in PostgreSQL.
- `POST /api/payment` — creates a Stripe Checkout Session using one configured Stripe Price ID. It never accepts or stores card details.
- `GET /api/download?file=<id>` — serves only files listed in `DOWNLOAD_FILES_JSON`; arbitrary filesystem paths are rejected.

## Setup

1. Use Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Configure environment variables from `.env.example` in your hosting provider; never commit `.env` or real secrets.
4. Apply `database/schema.sql` to PostgreSQL using your normal migration process.
5. Set `DATABASE_URL`, `ALLOWED_ORIGINS`, and Stripe variables as needed.
6. Configure `DOWNLOAD_FILES_JSON` with stable IDs and absolute file paths that actually exist in the deployment runtime.
7. Run `npm run check` before deployment.

## Request examples

Contact:
```json
{“name”:”Example User”,”email”:”person@example.com”,”phone”:”+91 9876543210”,”message”:”I need admission guidance.”}
```

Lead:
```json
{“name”:”Example User”,”email”:”person@example.com”,”phone”:”+91 9876543210”,”course”:”MBBS”,”city”:”Kolkata”,”message”:”Please contact me.”}
```

Payment:
```json
{“email”:”person@example.com”}
```

## Important deployment notes

- PostgreSQL submissions fail with HTTP 503 until `DATABASE_URL` is configured and the schema is applied.
- Payment creation fails with HTTP 503 until Stripe server-side environment variables are configured.
- `GET /api/health` checks that the API responds; it does not claim the database is reachable.
- Configure rate limiting at the hosting platform/API gateway. In-memory rate limits are not reliable across serverless instances.
- Add authentication/authorization to any private downloads before deploying them. The download endpoint is suitable only for files you intentionally make available through the allowlist.
- Review privacy, consent, retention, and applicable legal requirements before collecting personal information.
