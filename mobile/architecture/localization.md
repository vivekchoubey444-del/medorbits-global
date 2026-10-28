# Localization and Internationalization

## 1. Principles

- Keep user-facing text out of source-code logic where practical.
- Use stable translation keys.
- Support locale-specific dates, numbers, currency, and plural rules.
- Avoid concatenating translated sentence fragments.
- Design layouts for text expansion and different scripts.
- Do not assume all users use English or a single date format.

## 2. Locale selection

Define a documented fallback order, for example:
1. Explicit user preference.
2. Supported device locale.
3. Product default locale.

Persist the chosen preference according to product policy and synchronize it if user settings are server-backed.

## 3. Dates and time zones

- Store timestamps with explicit timezone information.
- Render dates in the user's selected locale.
- Distinguish date-only deadlines from timestamped events.
- Do not convert a date-only deadline into a different calendar day through timezone conversion.
- Display the applicable timezone when an exact cutoff time matters.

## 4. Currency and numbers

Use locale-aware formatting libraries. The server-provided currency code is authoritative. Do not infer currency solely from locale or device region.

## 5. Right-to-left support

If RTL locales are supported:
- Use direction-aware layouts.
- Avoid hard-coded left/right positioning when start/end semantics are available.
- Verify icons that imply direction.
- Test mixed-script names, numbers, IDs, and URLs.

## 6. Translation quality

Admission, fee, eligibility, legal, and consent language must be reviewed for meaning and jurisdictional accuracy. Machine translation alone should not be treated as authoritative for legal or high-impact instructions.

## 7. Testing

Test long strings, missing keys, plural forms, RTL layouts, localized dates, currency, and fallback behavior.
