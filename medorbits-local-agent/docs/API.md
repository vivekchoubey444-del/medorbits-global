# Local Agent API

All API responses are JSON. Keep the server bound to `127.0.0.1`.

## `GET /api/status`
Returns local Ollama connection status, selected model, and available model names.

## `GET /api/proposals`
Returns IDs, summaries, expiration times, and file paths for pending proposals. It does not return full proposed file contents.

## `POST /api/propose`
Body:
```json
{“request”:”Review the navigation and propose an accessibility improvement”}
```
Creates a temporary proposal. The model does not execute tests.

## `POST /api/reject`
Body:
```json
{“id”:”proposal-id”}
```

## `POST /api/approve`
Body:
```json
{“id”:”proposal-id”,”confirm”:”APPROVE FILE CHANGES”,”approvalToken”:”local-token”}
```
Applying is disabled by default and requires `AGENT_ALLOW_FILE_WRITES=true`. If an approval token is configured, the matching token is required too.
