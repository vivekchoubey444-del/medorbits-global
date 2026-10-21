
# MedOrbits AI Integration

**Directory:** `src/integrations/ai/`  
**Runtime:** Node.js 20+  
**Status:** Implementation documentation

## 1. Purpose

The MedOrbits AI integration provides a reusable, provider-based text-generation interface for approved application features, including educational guidance, career assistance, content drafting, and administrative support.

Application services use `createAiClient()` to create a configured client and call `generateText()` to request generated text.

The current implementation uses an OpenAI-compatible Chat Completions endpoint. It supports configurable API credentials, endpoint, model, timeout, input-size limits, and output-token limits.

AI-generated content is advisory. It may be inaccurate, incomplete, outdated, biased, or misleading. Validate generated output before displaying it, storing it as authoritative information, or using it to initiate application actions.

This integration does not automatically implement retrieval-augmented generation (RAG), document indexing, agent execution, tool calling, automated fact-checking, moderation, or persistent conversation memory.

## 2. Directory Structure

```text
src/integrations/ai/
├── README.md
├── ai.client.js
├── ai.config.js
├── ai.provider.js
├── index.js
└── openai.provider.js
```

| File | Responsibility |
|—|—|
| `README.md` | Setup, usage, security, testing, and operational documentation |
| `ai.client.js` | Validates requests and delegates generation to the provider |
| `ai.config.js` | Loads and validates AI environment configuration |
| `ai.provider.js` | Defines the abstract AI provider contract |
| `index.js` | Exports the integration and constructs AI clients |
| `openai.provider.js` | Sends requests to an OpenAI-compatible Chat Completions endpoint |

## 3. Requirements

- Node.js 20 or later.
- Built-in `fetch` and `AbortController`.
- An API key for the selected AI service.
- Network access to the configured endpoint.
- Server-side environment-variable and secret management.

The implementation uses Node.js built-in networking APIs and does not require the official OpenAI SDK.

## 4. Environment Configuration

Configure these variables in the deployment environment or secret manager:

```dotenv
AI_API_KEY=
AI_API_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=20000
AI_MAX_OUTPUT_TOKENS=800
AI_MAX_INPUT_CHARS=12000
```

| Variable | Default | Purpose |
|—|—|—|
| `AI_API_KEY` | None | Server-side API credential; required for generation |
| `AI_API_URL` | `https://api.openai.com/v1` | OpenAI-compatible API base URL |
| `AI_MODEL` | `gpt-4o-mini` | Default model identifier |
| `AI_TIMEOUT_MS` | `20000` | Request timeout in milliseconds |
| `AI_MAX_OUTPUT_TOKENS` | `800` | Configured output-token budget |
| `AI_MAX_INPUT_CHARS` | `12000` | Maximum prompt length in characters |

The actual defaults and validation ranges are defined in `ai.config.js`. Keep this documentation synchronized with the source.

**Security requirements**

- Never expose `AI_API_KEY` through browser JavaScript, frontend build variables, public API responses, or source control.
- Do not log API credentials or include them in error responses.
- Use HTTPS for production API traffic.
- Keep deployment secrets separate from public configuration.
- If AI is optional for an environment, allow the application to start without a key while ensuring generation fails safely until credentials are configured.

## 5. Creating an AI Client

Create the client in the server-side application composition layer and reuse it where appropriate.

```javascript
‘use strict’;

const {
  createAiClient,
} = require(‘./src/integrations/ai’);

const aiClient = createAiClient();
```

For an injected provider:

```javascript
const aiClient = createAiClient({
  provider: customProvider,
});
```

An injected provider is not owned by the client by default. Set `ownsProvider: true` when the client should manage its lifecycle, provided the implementation of `AiClient` supports that option.

Do not create a new provider for every incoming HTTP request unless its lifecycle explicitly requires it.

Do not execute AI requests merely by importing the integration module.

## 6. Generating Text

```javascript
const result = await aiClient.generateText({
  system: ‘You are an educational guidance assistant.’,
  prompt: ‘Explain the difference between MBBS and BDS.’,
});

console.log(result.text);
```

The primary request fields are:

| Field | Required | Description |
|—|—|—|
| `prompt` | Yes | Non-empty user prompt |
| `system` | No | System instructions |
| `model` | No | Model override, if permitted by application policy |
| `maxOutputTokens` | No | Output-token limit |
| `temperature` | No | Sampling temperature from 0 to 2 |

The provider returns:

```javascript
{
  text: ‘Generated response...’,
  model: ‘gpt-4o-mini’,
  usage: null
}
```

`usage` contains provider-supplied usage metadata when available; otherwise, it is `null`.

The exact response shape must remain consistent across `openai.provider.js` and `ai.client.js`.

Model overrides, token limits, and temperature settings must be controlled by trusted application services. Never allow public clients to bypass model restrictions, output budgets, or cost policies.

## 7. OpenAI-Compatible Endpoint

The provider sends a `POST` request to:

```text
{AI_API_URL}/chat/completions
```

The request includes the model, system and user messages, output-token limit, and temperature.

A compatible endpoint must support the expected Chat Completions request and response structure. Providers using a different API format require a separate adapter.

Before enabling a custom endpoint, verify:

- Authentication requirements.
- TLS and certificate validation.
- Request and response schemas.
- Rate limits and quota behavior.
- Model capabilities and context limits.
- Data retention and logging policies.
- Provider availability and operational guarantees.

Do not assume all OpenAI-compatible services behave identically.

## 8. AI Output Is Untrusted

Treat generated content as untrusted input.

Before using generated output:

- Validate response structure and expected data types.
- Apply length, format, and content constraints.
- Verify factual claims where accuracy matters.
- Validate URLs before linking to or opening them.
- Escape output when rendering HTML.
- Sanitize permitted rich HTML using an appropriate sanitizer.
- Validate structured output against an explicit schema.
- Enforce authorization and business rules independently.
- Require human review for high-impact decisions.

Never execute generated code, SQL, shell commands, or arbitrary tool instructions without a separately designed, authorized, and security-reviewed execution system.

Prompt instructions do not replace server-side authorization.

For MedOrbits, AI must not independently make admission decisions, guarantee admission outcomes, determine authoritative eligibility, approve payments, or alter student records.

## 9. Privacy and Data Protection

Do not send personal, financial, medical, educational-record, identity-document, application-document, credential, or other sensitive information to an external AI service without appropriate authorization, disclosure, and review of applicable policies.

Before processing user data, establish:

- The processing purpose and applicable legal basis.
- Whether each data element is necessary.
- Whether required disclosures and permissions have been obtained.
- Whether provider data-handling and retention terms are acceptable.
- Whether redaction or data minimization can reduce exposure.
- Whether retention, deletion, or audit obligations apply.

Prefer anonymized or minimized prompts wherever practical.

Never include API keys, passwords, authentication tokens, database credentials, or private storage URLs in prompts.

## 10. Application Integration

Call the integration from authorized application services rather than exposing the provider directly to public controllers.

Potential use cases include:

- Educational explanations and study assistance.
- Career guidance content and drafting.
- General-purpose content assistance.
- Administrative drafting and summarization.
- Structured suggestions subject to application validation.

Use trusted database records and explicit application rules for consequential decisions. Generated text must not become authoritative application data without the required validation and authorization.

## 11. Input Validation and Resource Limits

The integration should enforce configured prompt-size and output-token limits.

Application-level controls should also include:

- Authentication and authorization.
- Per-user and per-IP rate limits where appropriate.
- Request-body size limits.
- Allowed-model restrictions.
- Usage and cost budgets.
- Request deadlines.
- Abuse detection.
- Appropriate concurrency limits.

Character limits do not equal token limits. System instructions, message overhead, and other request data also consume the model’s context window.

Validate all effective request limits against the configured model’s capabilities.

## 12. Error Handling

Use stable application error codes and safe, controlled error messages.

| Failure | Handling |
|—|—|
| Invalid request | Reject before contacting the provider |
| Authentication failure | Correct credentials or provider permissions |
| Rate limit | Apply bounded retries and backoff where appropriate |
| Timeout | Return a controlled error; do not assume the provider did no work |
| Network failure | Retry only under a bounded policy |
| Invalid response | Reject unexpected or malformed response structures |
| Provider failure | Log safe diagnostic metadata without exposing sensitive payloads |

Never return raw provider error bodies, API credentials, or internal stack traces to public clients.

Retries can increase cost and may repeat provider operations. Use bounded attempts, appropriate backoff, and request-specific controls.

## 13. Logging and Observability

Capture operational metadata where available:

- Request correlation ID.
- Selected model.
- Request duration.
- Success or failure category.
- Token usage when supplied by the provider.
- Timeout and rate-limit counts.
- Estimated usage cost when pricing data is reliable.

Avoid logging full prompts, generated content, personal records, documents, or API credentials by default.

Apply appropriate log access controls, retention limits, and redaction policies.

## 14. Testing Checklist

### Configuration

- [ ] Missing credentials are rejected before generation.
- [ ] Invalid timeout and limit values are rejected.
- [ ] Endpoint and model configuration are applied correctly.
- [ ] Secrets never appear in logs or public errors.

### Request handling

- [ ] Empty prompts are rejected.
- [ ] Oversized prompts are rejected.
- [ ] Invalid model and temperature values are rejected.
- [ ] Output-token limits are enforced.
- [ ] Timeouts and aborted requests are handled safely.

### Response handling

- [ ] Valid responses return the documented structure.
- [ ] Invalid JSON and unexpected response formats are rejected.
- [ ] Authentication, rate-limit, and server errors are handled safely.
- [ ] Oversized responses are rejected.
- [ ] Generated HTML and URLs are validated before use.

### Privacy and operations

- [ ] Sensitive data is minimized and processed only under approved conditions.
- [ ] Public endpoints enforce authentication, authorization, and rate limits.
- [ ] Usage and cost controls are enforced.
- [ ] High-impact outputs receive appropriate review.
- [ ] Provider and application shutdown behavior is tested.
- [ ] Provider lifecycle and in-flight request cancellation are tested.

## 15. Operational Boundaries

This integration provides a configurable text-generation client and an OpenAI-compatible provider adapter.

It does not automatically implement:

- Persistent conversation history or memory.
- Document retrieval or RAG.
- Embeddings or vector databases.
- Automated fact verification.
- Content moderation.
- AI agents or unrestricted tool execution.
- A durable request queue.
- Per-user billing or persistent quota enforcement.
- Human review workflows.
- Guaranteed accuracy or deterministic output.

Implement these capabilities in separate modules with explicit security, privacy, and operational controls.

## 16. Maintenance and Production Readiness

Periodically review:

- Model availability and compatibility.
- Provider pricing and cost controls.
- Data-handling and retention terms.
- Request limits and timeout behavior.
- Error rates and rate-limit frequency.
- Dependency and runtime security.
- Provider shutdown and application shutdown behavior.

Update defaults only after verifying compatibility with the selected provider and testing the integration.

### Implementation status

This README documents the intended interface and recommended safeguards. Verify every feature against the actual source code, automated tests, central environment configuration, and deployment settings before considering it implemented or production-ready.
