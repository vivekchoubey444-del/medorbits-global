# Architecture and integration

```text
Existing MedOrbits website
        |
        | stage-web.mjs (public files only; review output)
        v
mobile/www
        |
        | Capacitor sync
        +-------------------+
        v                   v
   Android WebView      iOS WKWebView
        |                   |
        +-------- HTTPS -----+
                 |
          Existing MedOrbits API
                 |
          Existing PostgreSQL DB
```

Keep business rules, credentials and authorization on the server. The mobile
bundle is public client code and can be inspected by users. Use HTTPS for APIs.
Do not put private upload storage paths or privileged API tokens in `www/`.
