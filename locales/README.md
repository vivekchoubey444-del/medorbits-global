MedOrbits — Localization & Internationalization (i18n)

Directory: /locales/
Purpose: Centralized multilingual content and language configuration
Default language: English (en)
Fallback language: English (en)
Encoding: UTF-8
Format: JSON

⸻

1. Overview

The /locales/ directory contains translation files used throughout the MedOrbits website and application.

The localization system supports:

* Multilingual website navigation.
* Translated page headings and descriptions.
* Course and college information labels.
* Admission and counselling terminology.
* Student registration and application forms.
* Career guidance and recruitment content.
* Notifications and system messages.
* Form validation and accessibility labels.
* Search, filters and dynamic interface content.

All translations must preserve the same JSON structure and key names across supported languages.

2. Directory Structure

/locales/
│
├── README.md
├── index.json
│
├── en.json
├── hi.json
├── bn.json
├── as.json
├── ne.json
├── mr.json
├── gu.json
├── pa.json
├── ur.json
├── or.json
├── ps.json
├── fa.json
├── fr.json
├── de.json
├── es.json
├── zh.json
├── ar.json
├── ru.json
├── ka.json
├── kk.json
├── uz.json
├── ky.json
└── id.json

Only include files that actually exist in the repository. The locale registry should not advertise missing translation files as production-ready.

3. Supported Languages

Code	Language	Native name	Direction
en	English	English	LTR
hi	Hindi	हिन्दी	LTR
bn	Bengali	বাংলা	LTR
as	Assamese	অসমীয়া	LTR
ne	Nepali	नेपाली	LTR
mr	Marathi	मराठी	LTR
gu	Gujarati	ગુજરાતી	LTR
pa	Punjabi	ਪੰਜਾਬੀ	LTR
ur	Urdu	اردو	RTL
or	Odia	ଓଡ଼ିଆ	LTR
ps	Pashto	پښتو	RTL
fa	Persian	فارسی	RTL
fr	French	Français	LTR
de	German	Deutsch	LTR
es	Spanish	Español	LTR
zh	Chinese	中文	LTR
ar	Arabic	العربية	RTL
ru	Russian	Русский	LTR
ka	Georgian	ქართული	LTR
kk	Kazakh	Қазақша	LTR
uz	Uzbek	O‘zbekcha	LTR
ky	Kyrgyz	Кыргызча	LTR
id	Indonesian	Bahasa Indonesia	LTR

Important: Use id.json for Indonesian. Do not use i18.json; i18n is the common abbreviation for internationalization, not a language code.

4. Translation File Structure

Every locale JSON file must follow the same root structure.

{
  “locale”: “en”,
  “language”: “English”,
  “nativeName”: “English”,
  “direction”: “ltr”,
  “metadata”: {},
  “common”: {},
  “navigation”: {},
  “home”: {},
  “about”: {},
  “courses”: {},
  “colleges”: {},
  “universities”: {},
  “admissions”: {},
  “exams”: {},
  “scholarships”: {},
  “hostels”: {},
  “fees”: {},
  “documents”: {},
  “careers”: {},
  “jobs”: {},
  “services”: {},
  “forms”: {},
  “auth”: {},
  “contact”: {},
  “support”: {},
  “news”: {},
  “notifications”: {},
  “footer”: {},
  “validation”: {},
  “messages”: {},
  “accessibility”: {},
  “seo”: {},
  “dateTime”: {}
}

This is a structural reference. Use the complete /locales/en.json as the authoritative translation-key schema.

5. Language Configuration

The /locales/index.json file acts as the central language registry.

It should define:

* Default locale.
* Fallback locale.
* Supported locale codes.
* Native language names.
* Translation file paths.
* Text direction.
* Language availability.
* Browser-language detection.
* User language preference storage.

Example:

{
  “defaultLocale”: “en”,
  “fallbackLocale”: “en”,
  “settings”: {
    “persistPreference”: true,
    “storageKey”: “medorbits_locale”,
    “detectBrowserLanguage”: true,
    “fallbackOnMissingTranslation”: true,
    “hideUnavailableLocales”: false,
    “loadStrategy”: “on-demand”
  }
}

6. Translation Rules

All contributors must follow these rules.

1. Preserve every existing translation key.
2. Never rename keys without updating all locale files and application references.
3. Do not add comments to JSON files.
4. Use UTF-8 encoding.
5. Use valid JSON syntax.
6. Preserve dynamic placeholders such as {name}, {year}, {min} and {max}.
7. Keep URLs, API endpoints and file paths unchanged.
8. Preserve course abbreviations such as MBBS, BDS, BAMS, BUMS and NEET.
9. Translate naturally rather than translating word-for-word.
10. Use consistent education and admission terminology.
11. Never translate programming identifiers or JSON property names.
12. Do not insert sensitive personal information into translation files.

7. RTL Language Support

The following languages require right-to-left layout:

* Arabic (ar)
* Persian (fa)
* Urdu (ur)
* Pashto (ps)

The application should read the direction property and apply it to the document.

Example:

document.documentElement.lang = locale.locale;
document.documentElement.dir = locale.direction || “ltr”;

CSS should support logical properties:

[dir=“rtl”] {
  text-align: right;
}
[dir=“rtl”] .navigation {
  direction: rtl;
}
[dir=“rtl”] .form-control {
  text-align: right;
}

Prefer CSS logical properties such as margin-inline-start, padding-inline-end and border-inline-start instead of hard-coded left and right positioning.

8. Translation Loading

Use on-demand loading to avoid downloading every translation file when the application starts.

Example JavaScript:

const DEFAULT_LOCALE = “en”;
const LOCALE_STORAGE_KEY = “medorbits_locale”;
async function loadLocale(localeCode) {
  const safeCode = /^[a-z]{2,3}$/.test(localeCode)
    ? localeCode
    : DEFAULT_LOCALE;
  try {
    const response = await fetch(`/locales/${safeCode}.json`);
    if (!response.ok) {
      throw new Error(`Locale unavailable: ${safeCode}`);
    }
    const translations = await response.json();
    document.documentElement.lang = translations.locale;
    document.documentElement.dir = translations.direction || “ltr”;
    localStorage.setItem(LOCALE_STORAGE_KEY, translations.locale);
    return translations;
  } catch (error) {
    if (safeCode !== DEFAULT_LOCALE) {
      return loadLocale(DEFAULT_LOCALE);
    }
    throw error;
  }
}

The locale code must also be checked against the enabled entries in /locales/index.json before loading. Do not treat an arbitrary user-supplied code as an authorized locale.

9. Translation Lookup

Use a safe nested-key lookup with fallback support.

Example:

function translate(dictionary, key, fallback = key) {
  const value = key.split(“.”).reduce((current, part) => {
    if (
      current &&
      typeof current === “object” &&
      Object.prototype.hasOwnProperty.call(current, part)
    ) {
      return current[part];
    }
    return undefined;
  }, dictionary);
  return typeof value === “string” ? value : fallback;
}

Example:

translate(translations, “navigation.studentZone”);
translate(translations, “admissions.importantDates”);
translate(translations, “careers.jobAssistance”);

For missing translations, use the English fallback dictionary.

10. Validation Requirements

Every translation file must pass:

* JSON syntax validation.
* Root structure validation.
* Missing-key detection.
* Extra-key detection.
* Placeholder consistency checks.
* Locale code validation.
* Text direction validation.
* UTF-8 encoding validation.

A translation file must not be considered complete merely because it parses as valid JSON.

Recommended checks:

python scripts/validate-json.py
npm run validate

If the project uses a dedicated localization validator, include it in the repository validation workflow.

11. Security and Performance

* Never insert untrusted translation content using innerHTML.
* Use textContent for ordinary translated text.
* Validate locale codes against the registry.
* Cache translation files with appropriate versioning.
* Do not cache private user data as translation content.
* Keep translation files free of API keys and secrets.
* Ensure the service worker refreshes changed locale assets.
* Use a content security policy appropriate to the application.

12. Contribution Workflow

When adding a new language:

1. Confirm its ISO 639 language code.
2. Add its metadata to /locales/index.json.
3. Copy the key structure from /locales/en.json.
4. Translate every value.
5. Preserve all placeholders.
6. Set the correct text direction.
7. Validate JSON syntax.
8. Compare translation keys against English.
9. Test language switching.
10. Test desktop and mobile layouts.
11. Test RTL rendering where applicable.
12. Add the language to production only after validation.

13. Completion Checklist

* [ ]	English fallback available.
* [ ]	Locale registry valid.
* [ ]	Locale filenames use correct language codes.
* [ ]	Translation keys are consistent.
* [ ]	All JSON files parse successfully.
* [ ]	Dynamic placeholders are preserved.
* [ ]	Language selector displays native names.
* [ ]	Browser language detection works.
* [ ]	User language preference persists.
* [ ]	RTL layouts render correctly.
* [ ]	Missing translations fall back to English.
* [ ]	PWA caching supports locale updates.
* [ ]	Accessibility labels are translated.
* [ ]	SEO metadata is localized appropriately.

⸻

MedOrbits Localization Standard

All language files are part of the same application-wide localization system. Maintain consistent structure, terminology, accessibility and translation quality across the entire website and future PWA, Android and iOS applications.