MedOrbits JavaScript Modules

Directory: /assets/js/
Project: MedOrbits
Purpose: Shared frontend functionality, form processing, browser storage, accessibility, security utilities, and page initialization.

⸻

1. Overview

The /assets/js/ directory contains reusable JavaScript modules for MedOrbits pages. Modules should have clearly defined responsibilities and communicate through documented public APIs and custom events.

The primary entry point is:

* main.js — coordinates application startup and shared frontend behavior.

The application can continue to display cached or locally saved information when the server is unavailable, where supported. Server-dependent actions such as authentication, payment processing, authoritative admission information, and application submission still require the appropriate backend services.

2. Directory structure

assets/
└── js/
    ├── main.js
    ├── accessibility.js
    ├── account.js
    ├── admissions.js
    ├── animation.js
    ├── api-client.js
    ├── app.js
    ├── apply.js
    ├── auth-ui.js
    ├── college-directory.js
    ├── config.js
    ├── document-preview.js
    ├── file-validation.js
    ├── filters.js
    ├── form-steps.js
    ├── form-validation.js
    ├── forms.js
    ├── job-search.js
    ├── login-logout.js
    ├── modal.js
    ├── navigation.js
    ├── notifications.js
    ├── pagination.js
    ├── popup.js
    ├── reset.js
    ├── response.js
    ├── responsive.js
    ├── search.js
    ├── security.js
    ├── shifting.js
    ├── storage.js
    ├── theme.js
    ├── utils.js
    ├── validation.js
    └── README.md

This structure documents the files currently intended for the directory. A file must exist at the specified path before it can be loaded by a page.

3. Module responsibilities

Module	Responsibility
main.js	Application bootstrap, module discovery, lifecycle events, and network status
accessibility.js	Accessibility enhancements, keyboard support, and assistive-technology utilities
account.js	Account-related frontend workflows
admissions.js	Admission information and admission-related interactions
animation.js	Scroll animations, reveal effects, counters, and motion behavior
api-client.js	Shared HTTP requests and backend communication
app.js	General page application behavior
apply.js	Application forms, draft handling, and submission workflows
auth-ui.js	Authentication interface behavior
college-directory.js	College listings and directory interactions
config.js	Shared frontend configuration and application constants
document-preview.js	Local document previews and preview interactions
file-validation.js	Client-side file type, size, and selection checks
filters.js	Filtering and sorting of displayed records
form-steps.js	Multi-step form navigation and conditional fields
form-validation.js	Form-specific validation behavior
forms.js	Shared form interactions and submission helpers
job-search.js	Job listings, job searches, and related filters
login-logout.js	Login, logout, and session-interface workflows
modal.js	Dialogs, modal windows, focus handling, and confirmations
navigation.js	Menus, dropdowns, navigation state, and active links
notifications.js	Toast notifications and notification UI
pagination.js	Pagination controls and page navigation
popup.js	Optional enquiry and promotional popup interactions
reset.js	Password recovery and reset interface workflows
response.js	Form feedback, request responses, and field-level errors
responsive.js	Responsive interface helpers and mobile-specific behavior
search.js	Shared site search and suggestions
security.js	Safe rendering helpers, URL checks, field filtering, and request safeguards
shifting.js	Optional draggable or movable interface elements
storage.js	Browser-side storage, local data, and form draft persistence
theme.js	Theme and appearance preferences
utils.js	Shared utility functions
validation.js	General-purpose validation helpers

Important: this table describes intended responsibilities, not a guarantee that every listed function exists in every implementation. Check each module’s exported API before integrating it.

4. Recommended script loading order

For classic browser scripts, use defer consistently and load dependencies before modules that use them.

<!— Shared infrastructure —>
<script src=“/assets/js/config.js” defer></script>
<script src=“/assets/js/utils.js” defer></script>
<script src=“/assets/js/security.js” defer></script>
<script src=“/assets/js/storage.js” defer></script>
<script src=“/assets/js/api-client.js” defer></script>
<!— Core interface —>
<script src=“/assets/js/accessibility.js” defer></script>
<script src=“/assets/js/responsive.js” defer></script>
<script src=“/assets/js/theme.js” defer></script>
<script src=“/assets/js/navigation.js” defer></script>
<script src=“/assets/js/animation.js” defer></script>
<!— Shared interactions —>
<script src=“/assets/js/modal.js” defer></script>
<script src=“/assets/js/notifications.js” defer></script>
<script src=“/assets/js/response.js” defer></script>
<script src=“/assets/js/shifting.js” defer></script>
<!— Forms and validation —>
<script src=“/assets/js/validation.js” defer></script>
<script src=“/assets/js/form-validation.js” defer></script>
<script src=“/assets/js/file-validation.js” defer></script>
<script src=“/assets/js/form-steps.js” defer></script>
<script src=“/assets/js/document-preview.js” defer></script>
<script src=“/assets/js/forms.js” defer></script>
<!— Search and data views —>
<script src=“/assets/js/search.js” defer></script>
<script src=“/assets/js/filters.js” defer></script>
<script src=“/assets/js/pagination.js” defer></script>
<script src=“/assets/js/college-directory.js” defer></script>
<script src=“/assets/js/job-search.js” defer></script>
<script src=“/assets/js/admissions.js” defer></script>
<!— User workflows —>
<script src=“/assets/js/auth-ui.js” defer></script>
<script src=“/assets/js/login-logout.js” defer></script>
<script src=“/assets/js/account.js” defer></script>
<script src=“/assets/js/reset.js” defer></script>
<script src=“/assets/js/apply.js” defer></script>
<script src=“/assets/js/popup.js” defer></script>
<!— Main bootstrap: load last —>
<script src=“/assets/js/app.js” defer></script>
<script src=“/assets/js/main.js” defer></script>

Adjust this list to match the actual dependencies and initialization APIs of your files. Do not include nonexistent files or load modules that are not required by a page.

Why defer is recommended

Deferred classic scripts execute after HTML parsing and preserve their document order. This helps ensure that dependencies loaded earlier are available before later scripts execute.

Do not combine async with dependency-sensitive classic scripts because execution order is not guaranteed.

5. Main application entry point

main.js is responsible for coordinating startup. It should not duplicate the work of other modules.

Expected responsibilities include:

1. Wait until the DOM is ready.
2. Discover available modules.
3. Initialize modules in a predictable dependency order.
4. Handle optional modules without crashing the whole page.
5. expose application lifecycle events.
6. Notify the interface when network connectivity changes.
7. Refresh compatible modules when new page content is inserted.
8. provide safe diagnostics for development.

Example:

document.addEventListener(“medorbits:ready”, function (event) {
  console.info(“MedOrbits initialized:”, event.detail.version);
});
document.addEventListener(“medorbits:offline”, function () {
  const notice = document.querySelector(“[data-offline-notice]”);
  if (notice) {
    notice.hidden = false;
    notice.textContent =
      “You are offline. Some services may be unavailable.”;
  }
});
document.addEventListener(“medorbits:online”, function () {
  const notice = document.querySelector(“[data-offline-notice]”);
  if (notice) {
    notice.hidden = true;
  }
});

Only use lifecycle event names that the installed implementation actually emits.

6. Browser storage and offline behavior

storage.js provides browser-side persistence for supported application data.

Example:

async function saveDraft() {
  await MedOrbitsStorage.set(
    “admission-draft”,
    {
      course: “MBBS”,
      applicantName: “Example Applicant”
    },
    {
      store: “form-drafts”
    }
  );
}
async function readDraft() {
  return MedOrbitsStorage.get(“admission-draft”, {
    store: “form-drafts”
  });
}

Storage rules

* Use unique keys for different forms and pages.
* Save only the fields required to restore a draft.
* Avoid storing passwords, authentication tokens, payment data, or sensitive identity-document contents.
* Handle storage quota errors and unavailable browser storage.
* Clearly tell users when their data is stored only on their current device.
* Provide a way to discard drafts where appropriate.
* Do not treat a saved draft as a submitted application.

Offline limitations

Browser storage can support local drafts and cached public content. It cannot guarantee that all pages or services will work offline.

Features that require the backend, such as login, payment verification, final submission, permission checks, or up-to-date admission data, must display an appropriate connection or service message.

For offline submission queues, use an explicit synchronization mechanism with server-side validation, authorization, duplicate protection, and clear submission status.

7. Security and public database data

security.js contains client-side safeguards. It is not a replacement for backend security.

Required server-side controls

* Keep database credentials and private API keys on the server.
* Authenticate users before returning private records.
* Authorize each operation and verify record ownership.
* Apply database access controls and row-level security where supported.
* Return only approved fields in public API responses.
* Validate and normalize incoming data on the server.
* Apply request limits and suitable security headers.
* Use HTTPS in production.
* Protect state-changing requests against CSRF where applicable.
* Avoid logging passwords, tokens, personal documents, or sensitive form contents.

Never send private database fields to the browser and rely on JavaScript to hide them. Anyone can inspect frontend source code and data returned over the network.

8. Forms and validation

A typical form workflow can use these modules:

1. forms.js for shared form behavior.
2. form-validation.js and validation.js for validation.
3. form-steps.js for multi-step forms.
4. file-validation.js for client-side file checks.
5. document-preview.js for local previews.
6. storage.js for optional drafts.
7. api-client.js for backend requests.
8. response.js for user-facing feedback.
9. apply.js for application-specific behavior.

Client-side validation improves usability but can be bypassed. Repeat all important validation, file checks, authorization, and business rules on the server.

For file uploads, verify file content, size, permitted formats, authorization, and storage handling on the backend. Do not trust a filename or browser-provided MIME type alone.

9. Search, filters, and pagination

Use the relevant modules together where necessary:

* search.js handles search input and suggestions.
* filters.js applies filters and sorting.
* pagination.js manages page navigation.
* college-directory.js and job-search.js provide domain-specific interfaces.

For large datasets, use server-side search and pagination where appropriate. Avoid downloading an entire private or large database into the browser.

If search uses local JSON files, ensure that those files contain only information intended to be public.

10. Dynamic content

When a page inserts HTML dynamically, compatible modules may need to refresh their event bindings.

Example:

const container = document.querySelector(“#results”);
container.innerHTML = “”; // Use safe DOM construction for untrusted data.
// After inserting validated, safely constructed elements:
if (window.MedOrbitsMain) {
  window.MedOrbitsMain.refresh(container);
}

Do not insert untrusted data with innerHTML. Prefer textContent, DOM element creation, and the project’s approved sanitization helpers.

Call refresh methods only when the relevant module implements them.

11. Error handling

Errors should be understandable to users and useful to developers without exposing internal details.

User-facing message:

We could not complete your request. Please check your connection and try again.

Development diagnostics may record module names and non-sensitive status information. Do not expose stack traces, SQL errors, internal file paths, database connection strings, or authentication details to public users.

Do not silently mark an operation successful merely because a browser-side function ran. Confirm success from the relevant service before displaying a final submission confirmation.

12. Performance guidelines

* Load only modules required by the current page.
* Avoid duplicate script tags and repeated event listeners.
* Use deferred scripts for dependency-sensitive classic scripts.
* Debounce live search and autosave handlers.
* Paginate large result sets.
* Lazy-load noncritical resources.
* Respect reduced-motion preferences.
* Clean up observers, event listeners, and timers when modules are destroyed.
* Avoid unnecessary API requests and large browser-storage records.

13. Accessibility guidelines

* Support keyboard navigation and visible focus.
* Associate labels with form controls.
* Provide useful error messages and validation feedback.
* Use appropriate ARIA attributes only when needed.
* Announce important status changes accessibly.
* Ensure sufficient color contrast.
* Do not communicate a status by color alone.
* Respect reduced-motion preferences.
* Test forms, menus, dialogs, and search with keyboard-only navigation.

14. Development and testing checklist

Before publishing a change:

* [ ]	Confirm the file path and filename.
* [ ]	Check the browser console for syntax errors.
* [ ]	Confirm script load order and module API names.
* [ ]	Test pages with optional modules absent.
* [ ]	Test form validation and submission failure.
* [ ]	Test draft restoration and deletion.
* [ ]	Test offline and reconnection behavior.
* [ ]	Verify that unauthorized fields never appear in API responses.
* [ ]	Test URL handling and untrusted text rendering.
* [ ]	Test keyboard navigation and mobile layouts.
* [ ]	Check duplicate event listeners after repeated initialization.
* [ ]	Test on current iOS Safari, Android browsers, and desktop browsers.
* [ ]	Verify production security controls on the backend.

15. Maintenance rules

1. Give each module one clear primary responsibility.
2. Use a consistent window.MedOrbits... public API only when using classic scripts.
3. Document public methods and configuration options.
4. Avoid hidden dependencies on unrelated modules.
5. Make initialization safe to repeat, where practical.
6. Clean up listeners and observers in lifecycle cleanup methods.
7. Keep secrets and authorization decisions out of frontend JavaScript.
8. Keep this README updated when files are added, removed, renamed, or redesigned.

16. Important limitation

This README documents the intended architecture and integration approach. It does not certify that all modules are fully implemented, mutually compatible, or production-secure. Verify each file’s actual API and test the complete application before deployment.

⸻

Maintainer: MedOrbits Project
Directory: /assets/js/
Document: README.md