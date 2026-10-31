# Mobile release checklist

- [ ] Stage from the intended public website root.
- [ ] Inspect every staged file; remove secrets, admin-only files and private uploads.
- [ ] Confirm API URLs use HTTPS and production CORS/origin policy is correct.
- [ ] Test login/logout, session expiry and password reset.
- [ ] Test admissions forms, document upload/download and validation errors.
- [ ] Test payment gateway redirect and server-side payment verification.
- [ ] Test deep links and external links.
- [ ] Test offline mode and service-worker cache updates.
- [ ] Test keyboard, screen reader, font scaling and safe areas.
- [ ] Check Android manifest and iOS privacy declarations.
- [ ] Configure app icon, splash screen, app identifiers and signing.
- [ ] Run security and dependency audits.
- [ ] Test release builds on physical devices.
- [ ] Prepare store listing, privacy policy and support contact.
