# MedOrbits Payments and Billing
**File:** `/docs/PAYMENTS.md`
**Document Version:** 1.0.0
**Status:** Implementation Standard
**Scope:** Payment processing, subscriptions, invoices, refunds, reconciliation, and payment security
**Applies To:** MedOrbits web application, backend APIs, workers, administrative tools, and payment-provider integrations
—
## 1. Purpose
This document defines the requirements for implementing and maintaining secure, reliable, auditable payment processing across MedOrbits.
The payment system must support applicable services such as:
- Consultancy and admission guidance fees.
- Course, application, and service charges.
- Subscription plans and recurring billing, where enabled.
- Invoices, receipts, refunds, and payment confirmations.
- Payment reconciliation and administrative reporting.
- Payment-provider webhooks and asynchronous processing.
Only payment methods and commercial services approved for the relevant jurisdiction may be enabled.
This document defines the required behavior. It does not establish that a feature is implemented or that a payment integration has been independently audited.
## 2. Core Security Principles
All payment implementations MUST follow these principles:
1. **Provider-hosted payment collection:** Use a reputable payment provider and its hosted checkout or approved tokenization flow wherever practical.
2. **No sensitive card storage:** Never store raw card numbers, CVV/CVC values, PINs, or payment authentication secrets.
3. **Server-side pricing:** Calculate prices, discounts, taxes, and payable amounts on the server.
4. **Verified payment status:** Treat a payment as successful only after trusted server-side verification.
5. **Idempotency:** Repeated requests and webhook deliveries must not create duplicate charges, refunds, invoices, or subscription actions.
6. **Least privilege:** Restrict payment operations and administrative access by role.
7. **Immutable financial history:** Preserve auditable transaction records and record corrections as new events.
8. **Fail safely:** Uncertain payment outcomes must remain pending until reconciled.
9. **Data minimization:** Store only the payment information required for legitimate business, accounting, security, and legal purposes.
10. **No client-side trust:** Browser redirects, query parameters, screenshots, and client-submitted payment statuses are not proof of payment.
## 3. System Architecture
A recommended payment flow is:
```text
Customer
   |
   v
MedOrbits Frontend
   |
   v
Authenticated Payment API
   |
   +—> Load service and server-side price
   |
   +—> Create local payment order
   |
   +—> Create provider checkout session
   |
   v
Payment Provider
   |
   +—> Customer completes or abandons payment
   |
   +—> Signed webhook to MedOrbits
   |
   v
Webhook Verification
   |
   v
Idempotent Payment State Transition
   |
   +—> Update payment and order records
   +—> Activate eligible service or subscription
   +—> Queue receipt/notification
   +—> Record audit event
   |
   v
Reconciliation and Reporting
```
The payment provider is responsible for handling sensitive payment credentials. MedOrbits is responsible for order integrity, authorization, payment verification, business state transitions, and records.
## 4. Supported Payment Provider
Before enabling a provider in production, the project owner MUST verify:
- Provider legitimacy and suitability for the operating jurisdiction.
- Supported currencies and payment methods.
- Merchant account verification and settlement configuration.
- API authentication and webhook-signature verification.
- Idempotency support and payment-status query capabilities.
- Refund, dispute, chargeback, and recurring-payment capabilities, where applicable.
- Provider security documentation and applicable compliance obligations.
- Production credentials, notification endpoints, and operational support procedures.
Provider-specific implementation details belong in the integration module and its configuration documentation.
Do not assume that a test-mode integration is production-ready.
### 4.1 Provider integration requirements
- Use HTTPS for all payment API communication.
- Keep secret API credentials exclusively on the server.
- Use separate test and production credentials.
- Verify TLS certificates; never disable certificate validation.
- Apply connection and response timeouts.
- Handle provider outages and rate limits.
- Avoid automatic retries for non-idempotent charge or refund operations unless the provider supports safe idempotency.
- Store provider identifiers needed for reconciliation without storing unnecessary customer payment data.
- Never expose secret credentials in browser JavaScript or public configuration files.
## 5. Payment Data Classification
| Data | Storage requirement |
|—|—|
| Internal order ID | Store |
| Provider payment/order ID | Store when required |
| Amount and currency | Store |
| Payment status and timestamps | Store |
| Provider event ID | Store for idempotency |
| Invoice and receipt references | Store |
| Refund amount and status | Store |
| Card brand and last four digits | Optional; only if needed and permitted |
| Provider-issued payment token | Store only when necessary, securely, and according to provider requirements |
| Full card number | Never store |
| CVV/CVC | Never store |
| Card PIN or banking authentication secret | Never store |
| Provider API secret | Secret manager or protected server environment |
| Webhook signing secret | Secret manager or protected server environment |
| Full payment authentication payload | Do not log or retain unless specifically required and approved |
Tokenization does not automatically remove every PCI DSS obligation. Determine the applicable scope with the payment provider and qualified compliance professionals.
## 6. Order Creation and Pricing
The server MUST determine the payable amount from trusted service, pricing, and promotion records.
The server MUST NOT accept the following as authoritative from the browser:
- Final amount.
- Currency.
- Discount amount.
- Tax amount.
- Service entitlement.
- Payment status.
- Refund eligibility.
- Subscription activation state.
### 6.1 Required order validation
Before creating a payment order, verify:
1. The user is authenticated when authentication is required.
2. The requested service or plan exists and is currently available.
3. The user is authorized to purchase the service.
4. The price and currency are retrieved from trusted server-side configuration or database records.
5. Discounts and coupons satisfy their eligibility rules.
6. Taxes and additional charges are calculated according to applicable rules.
7. The total is a valid positive amount, unless a specifically approved zero-value workflow applies.
8. The amount complies with provider limits and currency precision.
9. The request has a valid idempotency key or equivalent duplicate-request protection.
10. The order is persisted before initiating the external payment flow.
Use integer minor currency units where appropriate, or a decimal type with explicit currency precision. Do not use binary floating-point arithmetic for financial calculations.
Example: represent INR 1,250.00 as `125000` paise when the selected provider’s API expects integer minor units.
Never assume that every currency has two decimal places.
## 7. Payment State Model
Use explicit payment states with controlled transitions.
Recommended payment states:
- `created`
- `pending`
- `requires_action`
- `authorized`
- `succeeded`
- `failed`
- `cancelled`
- `expired`
- `partially_refunded`
- `refunded`
- `disputed`
Only implement states supported by the selected provider and required business flows.
### 7.1 Transition rules
- A new order begins in `created`.
- A provider checkout session may move the order to `pending` or `requires_action`.
- A provider-authorized payment may move to `authorized` where applicable.
- A payment becomes `succeeded` only after verified provider confirmation.
- A failed or cancelled payment must not grant paid entitlements.
- A refund must be represented separately or through a controlled refund record.
- A partial refund must not be represented as a full refund.
- A dispute must not silently erase the original successful payment.
- Terminal states must not be overwritten by stale or conflicting events without a validated transition.
- Unknown provider states must be handled conservatively and reviewed or reconciled.
Subscription status, order status, payment status, and service-entitlement status are related but distinct records.
## 8. Payment API Requirements
Suggested API routes:
```text
POST /api/payments/orders
GET  /api/payments/orders/:orderId
POST /api/payments/orders/:orderId/checkout
POST /api/payments/orders/:orderId/cancel
GET  /api/payments/orders/:orderId/receipt
POST /api/payments/orders/:orderId/refund
GET  /api/payments/subscriptions
POST /api/payments/subscriptions
POST /api/payments/subscriptions/:subscriptionId/cancel
POST /api/webhooks/payments/:provider
```
These are proposed route names, not confirmation that the routes already exist.
### 8.1 API authorization
- Require authentication for customer payment history and checkout initiation.
- Verify order ownership on every customer-facing read or write.
- Restrict refunds, manual payment adjustments, and reconciliation controls to authorized staff.
- Apply rate limits to order creation, checkout initiation, and refund requests.
- Validate request bodies with schemas.
- Reject unexpected fields and invalid identifiers.
- Do not disclose another customer’s payment records.
- Use CSRF protection for cookie-authenticated state-changing requests.
- Avoid placing sensitive information in URLs.
Return consistent, non-sensitive error messages. Do not expose provider secrets, stack traces, raw webhook payloads, or internal database errors.
## 9. Webhook Security
Webhooks are a critical payment-security boundary.
Every payment webhook handler MUST:
1. Receive the original request body in the format required by the provider’s signature scheme.
2. Verify the provider signature using the correct endpoint secret and documented algorithm.
3. Enforce any provider-required timestamp or replay-protection checks.
4. Reject invalid signatures.
5. Validate the provider account, event type, and relevant identifiers.
6. Verify that the referenced order belongs to the expected merchant account.
7. Compare the provider-confirmed amount and currency against the stored order.
8. Record the provider event ID with a uniqueness constraint.
9. Process the event idempotently.
10. Apply only valid state transitions.
11. Acknowledge accepted events promptly and process longer tasks asynchronously.
12. Log a safe audit record without logging secrets or sensitive authentication payloads.
Do not trust the webhook merely because it contains a plausible payment ID or a status of `succeeded`.
### 9.1 Duplicate and out-of-order events
Webhook providers may retry delivery or send events out of order.
The handler MUST:
- Prevent the same event from producing duplicate business effects.
- Avoid downgrading a verified successful payment because of a stale event.
- Use provider-side payment retrieval when event details are insufficient or conflicting.
- Persist processing status and failure details.
- Support safe retries of transient processing failures.
- Reconcile unresolved or contradictory payment states.
A duplicate event should be acknowledged after the system has safely identified it as already processed or durably queued.
## 10. Idempotency and Concurrency
Use idempotency for all financial operations that may be retried.
Operations include:
- Creating payment orders.
- Initiating provider payment requests.
- Processing webhook events.
- Issuing refunds.
- Creating subscriptions.
- Recording subscription renewals.
- Issuing invoices or receipts.
- Activating paid entitlements.
Recommended controls:
- Unique internal order IDs.
- Unique provider transaction identifiers where supported.
- Unique webhook event IDs per provider.
- Unique refund request IDs.
- Database transactions around state changes.
- Row locking or optimistic concurrency controls where needed.
- Durable queues for asynchronous work.
- Explicit retry limits and dead-letter handling.
A timeout does not prove that a payment failed. If the provider’s result is uncertain, query the provider using a stable transaction identifier before initiating another charge.
## 11. Refunds and Cancellations
Refunds MUST be authorized, traceable, and idempotent.
Before issuing a refund:
1. Confirm the original payment is eligible for refund.
2. Confirm the requesting user or staff member has permission.
3. Validate the refund amount against the remaining refundable amount.
4. Verify the order currency.
5. Check for duplicate or conflicting refund requests.
6. Record the reason and the requesting actor.
7. Submit the request through the provider’s supported refund API.
8. Verify the provider response and final refund status.
9. Update local records without deleting the original payment.
10. Issue a notification or receipt when appropriate.
Partial refunds must be supported only when the provider and business rules permit them.
A cancellation request is not equivalent to a refund. Subscription cancellation, order cancellation, and reversal of a settled payment require distinct workflows.
Do not promise a refund date or settlement time unless supported by the provider’s documented process.
## 12. Subscriptions and Recurring Billing
If subscriptions are enabled, the implementation MUST:
- Clearly disclose the billing amount, currency, billing frequency, renewal terms, and cancellation procedure before purchase.
- Obtain the required customer consent.
- Store provider subscription references and the minimum necessary billing metadata.
- Verify renewal events through authenticated provider webhooks.
- Prevent duplicate renewal processing.
- Handle failed renewals, retries, grace periods, and cancellation according to documented policy.
- Stop future billing when cancellation is confirmed under the applicable provider workflow.
- Preserve invoices and historical payment records after cancellation.
- Avoid representing an unpaid renewal as a successful payment.
- Follow applicable recurring-payment mandates and jurisdiction-specific requirements.
Subscription entitlements must follow verified subscription and payment state, not a browser redirect.
## 13. Invoices and Receipts
Invoices and receipts MUST be generated from trusted transaction records.
Where applicable, include:
- Unique invoice or receipt number.
- Merchant’s legal name and required business details.
- Customer information permitted and necessary for invoicing.
- Service description.
- Invoice date and transaction date.
- Amount, currency, taxes, discounts, and total.
- Payment status.
- Provider transaction reference or a safe partial identifier.
- Refund or credit-note references when applicable.
Use consistent numbering and access controls. Apply relevant Indian tax, invoicing, record-retention, and consumer-protection requirements where applicable.
Do not expose invoices or receipts to users who are not authorized to access them.
PDF invoices must be generated from trusted data. User-supplied values must be escaped or safely rendered to prevent injection into HTML or PDF-generation processes.
## 14. Database and Recordkeeping
Payment records should be separated from general profile data and protected by restrictive access controls.
A suggested logical model is:
```text
medorbits.payment_orders
medorbits.payment_transactions
medorbits.payment_webhook_events
medorbits.payment_refunds
medorbits.subscriptions
medorbits.payment_invoices
medorbits.payment_audit_logs
```
These are recommended names. Add tables only after reviewing the existing database schema and migration strategy.
### 14.1 Suggested payment order fields
- Internal order ID.
- User ID or customer reference.
- Service or plan reference.
- Amount in minor units or an appropriate exact decimal representation.
- Currency.
- Current status.
- Provider name.
- Provider order and payment references.
- Idempotency key or safe request reference.
- Creation, update, and completion timestamps.
- Refund totals where needed.
- Metadata required for reconciliation.
### 14.2 Database controls
- Use foreign keys where appropriate.
- Apply unique constraints to provider identifiers and event IDs.
- Index fields used for payment lookup and reconciliation.
- Use transactions for financial state changes.
- Restrict database roles by least privilege.
- Do not grant application roles unnecessary schema-wide privileges.
- Preserve an audit trail of material changes.
- Avoid deleting settled financial records.
- Use controlled migrations for schema changes.
- Do not assume `CREATE TABLE IF NOT EXISTS` upgrades an existing schema.
If the project uses the `medorbits` PostgreSQL schema, payment migrations and queries must explicitly follow that convention.
## 15. Payment Audit Logging
Record relevant financial events, including:
- Order creation.
- Checkout initiation.
- Verified success or failure.
- Webhook acceptance or rejection.
- Refund request and result.
- Subscription creation, renewal, and cancellation.
- Administrative adjustments.
- Reconciliation discrepancies.
- Changes to provider configuration.
Each event should contain, as applicable:
- Event type.
- Timestamp.
- Actor or service identity.
- Internal order or transaction reference.
- Provider reference.
- Previous and resulting states.
- Outcome.
- Correlation or request ID.
- Safe reason or failure category.
Never log card data, authentication secrets, API keys, webhook signing secrets, session cookies, or complete payment credentials.
Audit logs should be append-only for ordinary application roles. Corrections must be recorded as additional events rather than silently rewriting history.
## 16. Access Control and Administrative Operations
Apply role-based access control to payment functions.
| Role | Permitted access |
|—|—|
| Customer | Own orders, payment status, invoices, and eligible cancellation or refund requests |
| Support staff | Limited customer-payment lookup and permitted support actions |
| Finance staff | Authorized reconciliation, invoices, refunds, and financial reporting |
| Administrator | Operational configuration within explicitly granted permissions |
| Background worker | Only the records and operations required for its assigned task |
| Unauthenticated visitor | Public pricing and general payment instructions only |
Administrative access MUST be authenticated and audited. High-impact actions should require step-up authentication or a second approval where the business risk warrants it.
Do not allow a general administrator to bypass financial controls without a documented and audited authorization path.
## 17. Security Configuration and Secrets
Store secrets in the deployment platform’s protected environment or an approved secrets manager.
Example environment-variable names:
```dotenv
PAYMENT_PROVIDER=
PAYMENT_PUBLIC_KEY=
PAYMENT_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=
PAYMENT_API_BASE_URL=
PAYMENT_REQUEST_TIMEOUT_MS=10000
PAYMENT_RECONCILIATION_ENABLED=false
```
These names are illustrative. Use the selected provider’s actual configuration requirements.
Requirements:
- Never commit real credentials to Git.
- Keep `.env` files out of version control.
- Provide placeholders only in `.env.example`.
- Rotate credentials after suspected exposure.
- Separate test and production environments.
- Limit secret access to the services that need it.
- Redact secrets from error reports and CI logs.
- Avoid exposing private provider configuration through frontend build variables.
- Do not enable payment processing until required production secrets and webhook endpoints have been verified.
## 18. Reconciliation and Monitoring
Payment reconciliation compares MedOrbits records against provider transaction reports and settlement records.
The reconciliation process should detect:
- Provider payments missing from local records.
- Local successful payments not confirmed by the provider.
- Amount or currency mismatches.
- Duplicate transaction references.
- Refund discrepancies.
- Subscription-renewal discrepancies.
- Unprocessed webhook events.
- Long-running pending payments.
- Settlement differences and chargebacks.
Reconciliation should use a scheduled job or an explicitly operated administrative workflow.
For each discrepancy:
1. Record the discrepancy.
2. Preserve the relevant transaction references.
3. Avoid automatically granting additional entitlements.
4. Query authoritative provider data where available.
5. Retry only operations that are safe to retry.
6. Escalate unresolved financial differences.
7. Record the resolution and responsible actor.
Monitor payment success rates, provider errors, webhook verification failures, pending-payment age, refund failures, and reconciliation discrepancies.
Alert thresholds must be configured for the actual traffic and provider behavior.
## 19. Error Handling and Availability
Payment failures must not cause silent data corruption or duplicate charges.
The system should:
- Apply bounded timeouts to external requests.
- Distinguish provider errors from internal application errors.
- Use safe retry policies with backoff.
- Persist work before acknowledging asynchronous processing.
- Keep unresolved transactions in a recoverable state.
- Use dead-letter queues or equivalent failure handling where available.
- Avoid retrying non-idempotent requests blindly.
- Provide customers with a clear way to check payment status.
- Avoid exposing stack traces, SQL errors, provider credentials, or internal infrastructure details.
If the provider is unavailable, disable or pause affected checkout operations rather than pretending a payment succeeded.
## 20. Privacy and Data Retention
Collect only payment data needed to provide the service and satisfy legal, accounting, fraud-prevention, and dispute-resolution requirements.
Define retention periods for:
- Payment orders and transaction records.
- Invoices and receipts.
- Refunds and disputes.
- Webhook event metadata.
- Security audit logs.
- Reconciliation reports.
- Support records.
Retention periods must be documented and approved based on applicable legal and business requirements. Do not invent a universal retention period for all record types.
When deletion is legally permitted, remove or anonymize unnecessary personal data while preserving records that must lawfully be retained.
Protect payment-related personal information in backups, exports, logs, and administrative reports.
## 21. Testing Requirements
Before production release, test the following.
### 21.1 Functional tests
- Successful payment.
- Failed payment.
- Abandoned checkout.
- Pending payment and delayed confirmation.
- Duplicate checkout requests.
- Duplicate webhook delivery.
- Out-of-order webhook events.
- Invalid webhook signature.
- Amount mismatch.
- Currency mismatch.
- Unknown provider payment reference.
- Refund and partial refund.
- Duplicate refund request.
- Subscription renewal and cancellation, if enabled.
- Invoice and receipt generation.
- Customer access to their own payment history.
- Denial of access to another customer’s payment records.
### 21.2 Security tests
- Client-side amount manipulation.
- Unauthorized payment and refund requests.
- IDOR and order-ownership bypass attempts.
- Replay of old webhook events.
- Invalid or missing webhook signatures.
- CSRF protection for cookie-authenticated actions.
- Rate-limit enforcement.
- Secret leakage through logs, responses, and frontend bundles.
- SQL injection and request-schema validation.
- Concurrent requests causing duplicate financial effects.
- Stale events attempting to reverse a successful payment.
- Administrative privilege escalation.
- Exposure of invoices through predictable or public URLs.
### 21.3 Reliability tests
- Provider timeout after a request may have succeeded.
- Provider rate limiting.
- Database transaction failure.
- Worker restart during event processing.
- Queue retry and dead-letter handling.
- Reconciliation after delayed webhooks.
- Recovery after temporary provider unavailability.
Use provider sandbox environments and official test credentials. Never test using real customer payment data unless an explicitly approved production test procedure exists.
## 22. Production Release Checklist
- [ ] Provider and merchant account approved.
- [ ] Production and sandbox credentials separated.
- [ ] Hosted checkout or approved tokenization configured.
- [ ] Server-side pricing and currency validation implemented.
- [ ] Payment orders persisted before external processing.
- [ ] Webhook signatures verified against the raw request body as required.
- [ ] Webhook event deduplication implemented.
- [ ] Idempotency and concurrency controls tested.
- [ ] Refund authorization and duplicate prevention tested.
- [ ] Payment records protected by ownership and role-based access controls.
- [ ] Financial state transitions validated.
- [ ] Receipts and invoices access-controlled.
- [ ] Audit logging and sensitive-data redaction enabled.
- [ ] Reconciliation and operational alerts configured.
- [ ] Database migrations reviewed and applied safely.
- [ ] Backup and recovery procedures tested.
- [ ] Privacy, tax, consumer-protection, and applicable compliance requirements reviewed.
- [ ] Security and functional tests passed.
- [ ] Incident-response contacts and escalation procedures documented.
- [ ] Production checkout verified using the provider’s approved test procedure.
## 23. Incident Response
If unauthorized payments, suspicious refunds, compromised credentials, or payment-data exposure are suspected:
1. Escalate to the designated security and payment owners.
2. Preserve relevant logs, event identifiers, and transaction references.
3. Disable affected payment operations or revoke compromised credentials when necessary.
4. Contact the provider using its official incident process.
5. Prevent unsafe retries and duplicate financial actions.
6. Review affected transactions and reconcile provider records.
7. Determine applicable notification and reporting obligations.
8. Restore service only after the cause has been addressed and recovery has been validated.
9. Document the incident, impact, remediation, and preventive actions.
Do not delete evidence or modify transaction history to conceal a discrepancy.
## 24. Ownership and Maintenance
The engineering owner is responsible for implementation and technical testing. The designated finance or operations owner is responsible for commercial payment rules, refund policy, and reconciliation procedures. The security owner is responsible for reviewing payment-specific risks and incident readiness.
Review this document whenever:
- The payment provider changes.
- New payment methods are enabled.
- Subscriptions or recurring billing are introduced.
- Refund or settlement workflows change.
- The payment database schema changes.
- New jurisdictions or currencies are supported.
- A significant payment-security incident occurs.
## 25. Related Documentation
- [`/docs/security/README.md`](security/README.md)
- [`/docs/security/authentication.md`](security/authentication.md)
- [`/docs/security/authorization.md`](security/authorization.md)
- [`/docs/security/document-security.md`](security/document-security.md)
- [`/docs/security/payment-security.md`](security/payment-security.md)
- [`/docs/`](./)
Update links if the repository’s actual directory structure differs.
—
**End of document.**