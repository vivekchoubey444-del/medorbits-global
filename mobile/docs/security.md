# Mobile security baseline

- Treat all JavaScript, HTML, configuration and bundled assets as public.
- Use HTTPS; do not permit mixed content.
- Keep authorization, validation, payment verification and secrets on the server.
- Do not store long-lived bearer tokens in localStorage. Prefer secure, platform-
  appropriate session/token storage after a threat-model review.
- Validate upload types and size on the server; client checks are UX only.
- Restrict external navigation to trusted domains where possible.
- Avoid logging personal data, tokens, application documents or payment details.
- Review platform permissions and third-party SDK privacy disclosures.
- Test deep links, WebView navigation, clipboard and file handling for abuse.
