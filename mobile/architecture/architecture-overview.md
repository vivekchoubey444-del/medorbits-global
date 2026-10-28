# Architecture Overview

## 1. Proposed layers

1. **Presentation** — screens, widgets/components, navigation, accessibility, and view-specific state.
2. **Feature/application layer** — use cases such as search admissions, create application, upload document, or fetch status.
3. **Domain layer** — typed entities, value objects, business rules that are safe to enforce client-side, and repository interfaces.
4. **Data layer** — API repositories, local cache, serialization, persistence, and synchronization.
5. **Platform/infrastructure layer** — secure storage, push notifications, file picker, connectivity, telemetry, and OS integrations.

The client can improve usability but must not be the authority for admission eligibility, deadlines, payment status, application approval, or access permissions.

## 2. Data flow

Typical read flow:

Screen -> feature state/controller -> use case/repository -> API client -> backend -> typed response -> cache/state -> screen.

Typical mutation flow:

User action -> client validation -> use case -> API request -> server validation/authorization -> persisted backend result -> local state update -> user confirmation.

For mutations, update local state only when the server result is known, or label any optimistic state clearly and roll it back on failure.

## 3. Module boundaries

Feature modules should not call each other's internal UI controllers directly. Share stable domain models and public use-case interfaces. Keep networking, authentication, and storage details behind abstractions.

Avoid:
- Raw HTTP calls inside screens.
- Duplicate token refresh logic.
- Multiple competing sources of truth for application status.
- Direct database or storage access from UI components.
- Feature modules changing another feature's private cache.
- Hardcoded production URLs or secrets.

## 4. Source of truth

| Data | Authority | Client behavior |
|---|---|---|
| Published admissions and deadlines | Verified backend records | Cache for display; show verification date |
| Eligibility assessment | Backend rules and official criteria | Present as informational; explain uncertainty |
| Application status | Backend | Refresh after mutations and on relevant return paths |
| Document review status | Backend | Never infer acceptance from upload completion |
| Payment status | Verified provider event processed by backend | Never trust a client redirect alone |
| Preferences | Server or local preference store, as defined | Resolve conflicts by documented policy |
| Unsynced draft edits | Local store until synced | Show sync status and preserve recoverable edits |

## 5. Resilience

Every network-backed feature needs:
- Loading state.
- Empty state.
- Recoverable error state.
- Retry behavior appropriate to the operation.
- Cancellation or stale-response handling.
- Offline behavior where supported.
- Accessible announcements for meaningful state changes.

## 6. Dependency direction

Presentation depends on application/domain interfaces. Data implementations satisfy those interfaces. Domain rules must not depend on UI frameworks, network libraries, or device APIs.

## 7. Architecture decisions

Record consequential choices as ADRs in an `adr/` directory. Each ADR should include context, decision, alternatives, trade-offs, security implications, and status.
