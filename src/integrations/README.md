
# MedOrbits — Integrations

**Directory:** `src/integrations/`

## 1. Overview

The integrations layer provides provider adapters for AI services, email delivery, payment processing, and file storage.

It isolates vendor-specific SDKs and external API communication behind dedicated interfaces, allowing MedOrbits application services to interact with providers without becoming tightly coupled to individual vendors.

The integrations layer is responsible for external communication, provider-specific validation, credential handling, bounded resource usage, and safe error translation. Application services remain responsible for business rules, authorization, persistence, and workflow orchestration.

## 2. Directory Structure

```text
src/integrations/
├── README.md
├── ai/
│   ├── README.md
│   ├── ai.client.js
│   ├── ai.config.js
│   ├── ai.provider.js
│   ├── index.js
│   └── openai.provider.js
├── email/
│   ├── README.md
│   ├── email.client.js
│   ├── email.provider.js
│   ├── index.js
│   └── smtp.provider.js
├── payment/
│   ├── README.md
│   ├── index.js
│   ├── payment.client.js
│   ├── payment.config.js
│   ├── payment.provider.js
│   ├── razorpay.provider.js
│   ├── stripe.provider.js
│   └── webhook-verifier.js
└── storage/
    ├── README.md
    ├── index.js
    ├── local.provider.js
    ├── s3.provider.js
    ├── storage.client.js
    └── storage.config.js
```

This structure represents the intended architecture. Verify actual filenames, exports, dependencies, and factory signatures against the repository before relying on this tree.

| Module | Primary responsibility |
|—|—|
| `ai/` | AI client configuration and provider communication. |
| `email/` | Email delivery through the configured provider. |
| `payment/` | Payment operations, provider selection, and webhook verification. |
| `storage/` | Local or S3-compatible storage operations for application files. |

Each module’s `index.js` should expose its intended public interface. Application services should import public interfaces rather than provider implementations directly, except where explicit provider-specific behavior is required.

## 3. Core Responsibilities

The integrations layer must:

- Encapsulate provider-specific SDKs and API operations.
- Expose consistent interfaces through module entry points.
- Validate input data before sending requests to external services.
- Enforce request, response, file-size, and payload limits.
- Configure connection timeouts and bounded retry behavior where supported.
- Handle provider errors without exposing sensitive information.
- Keep credentials and signing secrets server-side.
- Initialize only integrations enabled in the deployment environment.
- Support safe resource cleanup and graceful shutdown where required.
- Document provider-specific limitations and actual implementation status.

An interface is not considered production-ready merely because its methods exist. Its validation, error handling, lifecycle, and security behavior must also be tested.

## 4. Configuration and Secrets

Keep shared application configuration in `src/config/` and provider-specific implementation in `src/integrations/`.

Use environment variables or an approved secrets manager for:

- AI provider API keys and model settings.
- SMTP credentials and sender configuration.
- Payment API credentials and webhook signing secrets.
- Object-storage credentials, bucket names, and endpoint settings.

Requirements:

- Never commit real secrets or production `.env` files.
- Keep `.env.example` limited to variable names and safe placeholders.
- Validate required settings when an enabled integration initializes.
- Do not require credentials for integrations that are intentionally disabled.
- Avoid duplicated credentials or conflicting configuration sources.
- Redact secrets from logs, exceptions, and diagnostic output.
- Separate development, test, staging, and production credentials.

### Configuration ownership

Use one authoritative configuration source per integration. If both `src/config/` and an integration-specific configuration module exist, define which module owns environment parsing and validation. Avoid independently parsing the same settings in multiple places.

Provider factories should accept explicit configuration or environment dependencies where practical, enabling deterministic unit tests without modifying global environment state.

## 5. AI Integration

**Directory:** `src/integrations/ai/`

The AI integration contains the client, configuration, provider interface, and OpenAI provider adapter.

### Security and reliability requirements

- Validate prompts, input types, model names, and request payload sizes.
- Apply request timeouts and bounded retries where appropriate.
- Respect provider rate limits and usage limits.
- Handle unavailable providers and malformed responses safely.
- Avoid transmitting unnecessary personal or confidential information.
- Keep API credentials on the server.
- Treat model output as untrusted input and validate it before downstream use.
- Avoid logging sensitive prompts or responses.
- Enforce output limits and validate expected response structures.
- Avoid automatically retrying operations where retries could cause duplicate charges or unintended effects.

AI output must not bypass authorization, business validation, or security controls. For consequential actions, require application-side validation and appropriate human review.

Provider-specific configuration must remain separate from application business logic.

See `src/integrations/ai/README.md` for module-specific configuration, usage, testing, and limitations.

## 6. Email Integration

**Directory:** `src/integrations/email/`

The email integration contains the client, provider interface, and SMTP adapter.

### Requirements

- Validate recipient addresses and message inputs.
- Prevent untrusted input from controlling message headers.
- Enforce attachment and message-size limits if attachments are supported.
- Use authenticated, encrypted transport where supported and required.
- Configure connection and delivery timeouts.
- Handle provider errors without exposing SMTP credentials.
- Avoid logging sensitive message content.
- Keep sender identities and reply-to addresses under application control.
- Apply appropriate rate limits to prevent abuse.
- Prevent user-controlled content from becoming unintended HTML or header injection.

Document unsupported message features explicitly. If the current provider rejects attachments, do not advertise attachment support until it is implemented and tested.

Delivery success should mean only what the configured provider can actually confirm. An accepted message is not guaranteed to reach the recipient’s inbox.

See `src/integrations/email/README.md` for module-specific setup and limitations.

## 7. Payment Integration

**Directory:** `src/integrations/payment/`

The payment integration contains provider configuration, a shared client and interface, Razorpay and Stripe adapters, and webhook verification.

### Security requirements

- Keep payment credentials and webhook signing secrets private.
- Validate amounts, currency, payment references, and permitted operations.
- Calculate prices on the server using authoritative pricing data.
- Do not trust client-submitted payment status.
- Verify webhook signatures using the exact raw request bytes required by the provider.
- Use the correct provider-specific signature algorithm and secret.
- Validate event structure and supported event types.
- Process events idempotently to prevent duplicate financial operations.
- Persist payment state transitions through the application’s authoritative data layer.
- Prevent duplicate processing and handle out-of-order events.
- Never log secrets or sensitive payment metadata.
- Reconcile ambiguous payment outcomes with the provider.

Payment creation and webhook processing must fail closed until the relevant provider adapter, signature verification, and idempotent event-processing mechanisms are implemented.

The presence of `webhook-verifier.js` alone does not establish that verification or event processing is complete or correct.

### Responsibility boundaries

The integration handles provider operations. Application services must handle local orders, pricing, authorization, payment-state transitions, refunds, subscriptions, and fulfillment.

A successful checkout creation response is not proof of payment. A valid webhook signature establishes payload authenticity but does not, by itself, authorize fulfillment.

See `src/integrations/payment/README.md` for the payment-specific lifecycle, configuration, and production-readiness requirements.

## 8. Storage Integration

**Directory:** `src/integrations/storage/`

The storage integration contains shared storage interfaces, configuration, and local and S3-compatible provider implementations.

### Storage requirements

- Keep private documents outside publicly served web roots.
- Authorize every download against the authenticated identity, resource ownership, and applicable permissions.
- Validate file size, permitted file types, and file contents.
- Generate safe server-controlled storage identifiers instead of trusting user-provided paths.
- Prevent path traversal and unauthorized overwrites.
- Avoid exposing local filesystem paths, private object keys, or storage credentials.
- Apply least-privilege permissions to storage accounts and buckets.
- Define retention, temporary-file cleanup, and deletion policies.
- Handle missing objects and provider failures consistently.
- Keep uploads private until required validation and malware scanning are complete.

If signed URLs are used by a separate application component, keep their lifetime limited and restrict access to the intended object and operation. This must not be assumed to exist in the storage adapter.

Local and S3-compatible storage should implement a consistent interface while retaining provider-specific security controls.

See `src/integrations/storage/README.md` for configuration, provider selection, storage contracts, and security requirements.

## 9. Initialization and Lifecycle

Initialize only integrations enabled by the current deployment configuration.

Recommended lifecycle:

1. Load and validate environment configuration.
2. Determine which integrations are enabled.
3. Initialize the required clients and provider adapters.
4. Validate essential credentials and configuration.
5. Expose the intended public interfaces to application services.
6. Handle provider failures through established error handling.
7. Close owned connections and release resources during graceful shutdown where applicable.

Disabled integrations should not create unnecessary connections or require unrelated credentials.

Avoid initializing the same provider repeatedly when a reusable client is intended.

### Resource ownership

Define whether each client owns its provider. Injected providers should remain caller-owned by default unless ownership is explicitly transferred. Only close resources owned by the relevant client or application lifecycle manager.

Shutdown should be idempotent, and initialization failures should release any resources already allocated.

### Startup policy

Distinguish between optional and required integrations:

- **Required integration:** Missing or invalid configuration should prevent application startup.
- **Optional integration:** The application may start without it, provided dependent features remain disabled or unavailable safely.
- **Payment integration:** Payment endpoints and fulfillment workflows must remain unavailable when payment configuration or required security controls are invalid.

Do not silently fall back to a different provider or insecure configuration.

## 10. Error Handling and Observability

Integrations should distinguish among:

- Configuration errors.
- Input validation failures.
- Authentication or authorization failures.
- Provider timeouts.
- Rate-limit responses.
- Network failures.
- Invalid provider responses.
- Signature verification failures.
- Duplicate webhook events.
- Storage permission and missing-object errors.
- Resource lifecycle errors.

Use the centralized application logger, redact sensitive information, and return safe application-level errors to callers.

Do not expose raw provider responses, credentials, private document paths, internal stack traces, or sensitive payloads through public endpoints.

### Logging

Use structured logging with appropriate correlation identifiers. Record operational metadata such as provider, operation, duration, outcome, and safe error code.

Do not log:

- API keys or passwords.
- Webhook signing secrets or raw signatures.
- Authentication tokens.
- Unnecessary personal information.
- Full prompts, email bodies, or private file contents.
- Sensitive payment payloads.

### Retries

Retries must be bounded and operation-aware. Apply exponential backoff with jitter where appropriate, respect provider retry instructions, and avoid retrying permanent validation or authentication failures.

For payment operations with ambiguous outcomes, reconcile with the provider before initiating a new logical payment attempt.

## 11. Testing Requirements

Use mocked providers, sandbox credentials, or isolated test environments as appropriate.

Test at least:

- Valid and invalid inputs.
- Missing or invalid configuration.
- Disabled integration behavior.
- Request timeouts and provider failures.
- Payload and file-size limits.
- Rate limiting and retry behavior.
- Sensitive-data redaction.
- Payment signature verification and duplicate-event handling.
- Unauthorized document downloads.
- Storage path and object-access restrictions.
- Resource cleanup and graceful shutdown.
- Invalid provider responses.
- Initialization failure after partial resource allocation.

Never use live production credentials or real production documents in routine automated tests.

Unit tests should mock external dependencies. Integration tests should use sandbox accounts or isolated services and must be explicitly configured to avoid production resources.

## 12. Module Documentation

Maintain a README inside each integration directory:

- `src/integrations/ai/README.md`
- `src/integrations/email/README.md`
- `src/integrations/payment/README.md`
- `src/integrations/storage/README.md`

Each module README should document:

- Supported providers.
- Public interface and exports.
- Required environment variables.
- Initialization and resource ownership.
- Validation and payload limits.
- Security controls.
- Error handling and retry behavior.
- Testing instructions.
- Supported and unsupported features.
- Known limitations and production-readiness status.

Documentation must describe the actual implementation rather than intended future capabilities.

## 13. Implementation Checklist

Before marking an integration production-ready:

- [ ] Its public interface and exports are documented.
- [ ] Configuration is validated.
- [ ] Credentials are stored securely.
- [ ] Inputs and payload sizes are bounded.
- [ ] Timeouts and retry limits are configured where appropriate.
- [ ] Errors are handled without leaking sensitive information.
- [ ] Provider-specific security requirements are implemented.
- [ ] Automated tests cover failure and abuse scenarios.
- [ ] Startup and shutdown behavior are verified.
- [ ] Resource ownership is explicit.
- [ ] Provider and SDK versions are documented and maintained.
- [ ] Documentation reflects actual implementation status.
- [ ] Required application-level authorization and persistence are in place.
- [ ] Production readiness has been verified against the deployed configuration.

## 14. Related Documentation

- `src/config/README.md` — Centralized application configuration.
- `src/controllers/README.md` — HTTP controller responsibilities.
- `docs/security/` — Security policies and implementation guidance.
- `infrastructure/monitoring/` — Health checks and alerting.

—

**MedOrbits — Study · Work · Grow**

Secure, modular provider integrations for a maintainable application architecture.
