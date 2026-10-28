# Feature Module Boundaries

## Proposed modules

### `core`
Shared configuration, API client, error model, logging redaction, secure storage interfaces, and common UI primitives.

### `auth`
Sign-in, sign-out, session state, token lifecycle integration, and account recovery if supported.

### `profile`
Current-user profile and preferences.

### `admissions`
Admission search, filters, admission details, verified sources, courses, and institutions.

### `eligibility`
Informational assessments, assessment history if supported, and explanation of uncertainty.

### `applications`
Drafts, application detail, submission, status history, action-required workflow, and withdrawal if supported.

### `documents`
Requirements, upload, progress, private download, review status, and replacement workflow.

### `payments`
Fee display, payment initiation, payment status, and refund request status, only when the backend/provider integration exists.

### `notifications`
In-app notification list, read state, device registration, and push routing.

### `settings`
Language, notification preferences, accessibility preferences, and privacy options.

## Boundary rules

- Feature modules call shared repositories/use cases through public interfaces.
- Shared core must not contain feature-specific business logic.
- UI modules must not call raw HTTP directly.
- Do not duplicate authentication, retry, or error parsing logic in each feature.
- Do not allow one feature to mutate another feature's private state directly.
- Keep backend status enums centralized and synchronized with API contracts.

## Feature definition of done

- Loading, empty, success, error, and offline states defined.
- Accessibility labels and focus behavior reviewed.
- Localization keys added.
- API contract and authorization reviewed.
- Unit and integration tests included.
- Sensitive data and telemetry reviewed.
- Navigation and deep-link behavior documented.
- Analytics events, if any, are privacy-reviewed.
