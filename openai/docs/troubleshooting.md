# MedOrbits OpenAI Troubleshooting

## OPENAI_API_KEY is missing

Confirm the secret is configured in the backend environment. Do not put it in frontend code or commit it to Git.

## OPENAI_MODEL is missing

Set `OPENAI_MODEL` to a model available to the account and supported by the integration.

## 401 authentication errors

Check that the API key is valid, active, and associated with the intended project.

## 429 rate-limit or quota errors

Review project limits and billing. Apply user-level rate limiting and bounded retry behavior. Do not retry indefinitely.

## Request timeout

Review `OPENAI_TIMEOUT_MS`, network connectivity, request size, and upstream service status.

## Empty model response

Inspect the response status and structured output safely. Do not log sensitive prompt contents. Confirm the selected model supports the Responses API.

## Invalid request schema

Validate request bodies against the JSON schemas in `schemas/` before invoking the service.

## YAML validation failure

Refresh `openapi.yaml` from the official upstream repository and run the OpenAPI validation script. Review upstream changes before committing.
