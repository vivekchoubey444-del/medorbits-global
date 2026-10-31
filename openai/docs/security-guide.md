# MedOrbits OpenAI Security Guide

## API keys

- Store `OPENAI_API_KEY` only in server-side secret storage.
- Never commit secrets or expose them in frontend bundles.
- Rotate compromised keys immediately.
- Use separate credentials for development, staging, and production where practical.

## Request protection

- Authenticate users before invoking AI services.
- Apply per-user and per-IP rate limits.
- Limit request size and output tokens.
- Validate inputs and constrain accepted file types.
- Apply request timeouts and controlled retries.
- Avoid logging prompts containing personal or confidential data.

## Model output

Treat model output as untrusted data. Escape it before rendering as HTML. Never execute generated code, SQL, shell commands, or tool instructions without independent validation and authorization.

## Documents

Treat uploaded document text as untrusted input. Do not interpret instructions inside documents as system instructions. Do not claim that AI analysis verifies document authenticity or admission eligibility.

## Privacy

Set data-retention behavior intentionally. This integration requests `store: false` for Responses API calls, but this setting alone is not a complete privacy or compliance guarantee. Review current provider terms and applicable legal requirements.
