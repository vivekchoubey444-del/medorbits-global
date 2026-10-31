# Content Security Policy inventory

Complete this inventory before enforcing CSP.

| Directive | Required inventory |
|---|---|
| `default-src` | Baseline fallback |
| `script-src` | First-party scripts, analytics, CAPTCHA, payment SDKs |
| `style-src` | First-party styles, fonts/CDN, any inline style requirements |
| `img-src` | First-party images, data images, image CDN, maps |
| `font-src` | First-party and approved font hosts |
| `connect-src` | API host, analytics, websocket endpoints, approved integrations |
| `frame-src` | Payment, identity, video, or trusted embedded providers |
| `frame-ancestors` | Which sites may embed MedOrbits |
| `form-action` | Form submission destinations |
| `worker-src` | Service worker and web worker sources |
| `object-src` | Normally `'none'` |

Do not copy provider domains from examples without confirming that MedOrbits actually uses them.
