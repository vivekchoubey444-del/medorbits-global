
# MedOrbits Mobile Application

**Path:** `/mobile/README.md`  
**Status:** Starter scaffold. Verify all backend endpoints and production settings before release.

MedOrbits Mobile is a proposed React Native + Expo + TypeScript client for education and medical-admission guidance, student applications, documents, notifications, career resources, and support.

## Requirements
- Node.js version supported by the selected Expo SDK.
- npm (or the package manager already adopted by the repository).
- Android Studio and/or Xcode for native builds.
- A verified MedOrbits API base URL for backend-dependent features.

## Setup
1. Review `package.json` and `.env.example`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to a verified API URL.
3. Install dependencies with `npm install` (commit and use the generated lockfile).
4. Start Expo with `npm run start`.

Do not use placeholder endpoints in production. `EXPO_PUBLIC_*` values are bundled into the client and must never contain secrets.

## Project structure
- `app/`: file-based routes and screens.
- `src/api/`: shared HTTP client and error handling.
- `src/features/`: domain-oriented feature modules.
- `src/components/`: reusable UI.
- `src/config/`: runtime configuration.
- `src/storage/`: local persistence abstractions.
- `assets/`: image, icon, font, and animation assets.
- `architecture/`: design and operational guidance.
- `api-contracts/`: proposed API contracts; reconcile against the actual backend.
- `tests/`: unit, integration, and end-to-end test locations.
- `scripts/`: local validation utilities.

## Important limitations
This scaffold does not prove that any backend route, payment flow, document upload, notification provider, or production authentication flow exists. Implement and test those integrations against the real service before enabling them.
