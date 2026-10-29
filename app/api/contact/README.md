
# MedOrbits Contact API

**File:** `app/api/contact/README.md`  
**Runtime:** Next.js App Router with Node.js  
**Version:** 2.1.1

## Overview

The Contact API accepts contact enquiries, validates the submitted fields, and stores accepted submissions in PostgreSQL.

**Endpoint:** `/api/contact`

| Method | Purpose |
|—|—|
| `POST` | Validate and submit a contact enquiry |
| `GET` | Return `405 Method Not Allowed` |
| `PUT` | Return `405 Method Not Allowed` |
| `PATCH` | Return `405 Method Not Allowed` |
| `DELETE` | Return `405 Method Not Allowed` |

## Request format

Send a JSON object with `Content-Type: application/json`.

```json
{
  “name”: “Example User”,
  “email”: “user@example.com”,
  “subject”: “Admission enquiry”,
  “message”: “Please provide information about your services.”,
  “website”: “”
}
```

The `website` field is an optional honeypot field. Legitimate users should leave it empty.

### Validation rules

| Field | Requirement |
|—|—|
| `name` | Required; maximum 120 characters |
| `email` | Required; maximum 254 characters; basic email-format validation |
| `subject` | Required; maximum 180 characters |
| `message` | Required; maximum 5,000 characters |
| Request body | Maximum 16 KiB |

Fields are trimmed before storage. Email addresses are converted to lowercase.

## Responses

### `201 Created`

The enquiry was accepted and stored, or the honeypot response was returned.

```json
{
  “success”: true,
  “message”: “Your contact request has been received.”,
  “id”: “123”
}
```

The `id` is returned for successfully stored enquiries. Honeypot submissions do not create a database record.

### Error responses

| Status | Meaning |
|—|—|
| `400` | Invalid JSON or missing/invalid fields |
| `403` | Browser origin rejected by the configured allowlist |
| `405` | Unsupported HTTP method |
| `413` | Request body exceeds the size limit |
| `415` | Request content type is not JSON |
| `503` | Database configuration or submission failure |

Responses use `Cache-Control: no-store`.

## Environment configuration

Configure these variables in the deployment environment:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
ALLOWED_ORIGINS=https://your-domain.example,https://www.your-domain.example
```

- `DATABASE_URL` must point to the intended PostgreSQL database.
- `ALLOWED_ORIGINS` is a comma-separated list of allowed browser origins.
- Do not commit credentials or real `.env` files to Git.
- Use a restricted database account with only the permissions required by the application.

When `ALLOWED_ORIGINS` is empty, the current route does not enforce an origin allowlist. Origin checks are not a replacement for authentication, rate limiting, or abuse prevention.

## Database setup

The route expects a `contact_messages` table.

```sql
CREATE TABLE IF NOT EXISTS contact_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    subject VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
    ON contact_messages (created_at DESC);
```

Apply this SQL through the project’s database migration process where one exists. Avoid maintaining a separate schema definition that conflicts with existing migrations.

## Dependencies

The route uses the `pg` PostgreSQL client.

```bash
npm install pg
```

Ensure the installed version is compatible with the project’s Node.js runtime and lockfile.

## Local testing

Start the Next.js application:

```bash
npm run dev
```

Submit a test enquiry:

```bash
curl -i -X POST http://localhost:3000/api/contact \
  -H ‘Content-Type: application/json’ \
  -d ‘{
    “name”: “Example User”,
    “email”: “user@example.com”,
    “subject”: “Test enquiry”,
    “message”: “Testing the contact endpoint.”,
    “website”: “”
  }’
```

Verify that the request returns `201 Created` and that exactly one corresponding row appears in `contact_messages`.

Also test malformed JSON, missing fields, invalid email, oversized payloads, disallowed origins, database unavailability, and unsupported methods.

## Security and operational notes

- The route uses parameterized SQL queries to avoid SQL injection through submitted values.
- Database error details are logged server-side and should never be returned to clients.
- Configure rate limiting at the application, reverse-proxy, or hosting layer.
- Consider a CAPTCHA or equivalent abuse control for publicly accessible forms.
- Validate and escape user-provided content when displaying stored enquiries in administrative interfaces.
- Restrict database access to authorized personnel and establish an appropriate retention policy.
- Do not expose stored contact submissions through a public read endpoint.
- Configure monitoring and alerting for repeated database failures and abuse.

## Limitations

This route does not implement email notifications, administrative listing, authentication, CAPTCHA verification, or built-in rate limiting. Those features require separate, deliberately configured components.

Successful syntax validation alone does not prove that the database, deployment environment, or production integrations work correctly.
