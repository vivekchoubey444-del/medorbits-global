# Mobile source modules

- `config.js`: validates the API origin and timeout.
- `api-client.js`: timeout-aware JSON API client with structured errors.
- `platform.js`: web/Android/iOS detection.
- `app-lifecycle.js`: resume, pause and back-button listeners.
- `network.js`: connectivity status and change listener.
- `external-navigation.js`: validated HTTP(S) external browser navigation.
- `mobile-bridge.js`: retained compatibility helper from the initial package.

Use these modules from the existing frontend build. Do not duplicate authentication
or authorization rules in the app; enforce access on the backend.
