
/* =========================================================
   MedOrbits | Main Application Bootstrap
   File: /assets/js/main.js
   Version: 2.0.0

   Responsibilities:
   - Central initialization for MedOrbits JavaScript modules
   - Dependency-aware startup
   - Safe optional-module detection
   - Online/offline status events
   - Global error handling without exposing sensitive details
   - Page lifecycle and dynamic-content refresh
   - Accessible status announcements
   - Duplicate initialization protection
   - Optional module loading when explicitly configured

   Load this file AFTER your core module scripts.
   No external dependencies.
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsMain) {
    window.MedOrbitsMain.init();
    return;
  }

  const VERSION = "2.0.0";
  const EVENT_PREFIX = "medorbits:";
  const STATE_KEY = "__medorbitsMainState";

  const state = {
    initialized: false,
    initializing: false,
    destroyed: false,
    startedAt: null,
    pageReady: false,
    online: navigator.onLine !== false,
    modules: new Map(),
    initializedModules: new Set(),
    failedModules: new Map(),
    listeners: [],
    observer: null,
    statusElement: null,
    options: {
      autoInit: true,
      debug: false,
      continueOnError: true,
      observeDynamicContent: true,
      announceNetworkChanges: true,
      loadConfiguredModules: false,
      moduleTimeout: 10000,
      statusSelector: "[data-mo-app-status]",
      moduleSelector: "[data-mo-module-src]",
      exposeDiagnostics: true
    }
  };

  const MODULES = [
    // Configuration and shared infrastructure
    {
      name: "config",
      global: "MedOrbitsConfig",
      phase: 1,
      optional: true
    },
    {
      name: "utils",
      global: "MedOrbitsUtils",
      phase: 1,
      optional: true
    },
    {
      name: "security",
      global: "MedOrbitsSecurity",
      phase: 1,
      optional: true
    },
    {
      name: "storage",
      global: "MedOrbitsStorage",
      phase: 1,
      optional: true
    },

    // Core application and API
    {
      name: "api-client",
      global: "MedOrbitsApiClient",
      phase: 2,
      optional: true
    },
    {
      name: "accessibility",
      global: "MedOrbitsAccessibility",
      phase: 2,
      optional: true
    },
    {
      name: "responsive",
      global: "MedOrbitsResponsive",
      phase: 2,
      optional: true
    },
    {
      name: "theme",
      global: "MedOrbitsTheme",
      phase: 2,
      optional: true
    },

    // Navigation and interaction
    {
      name: "navigation",
      global: "MedOrbitsNavigation",
      phase: 3,
      optional: true
    },
    {
      name: "animation",
      global: "MedOrbitsAnimation",
      phase: 3,
      optional: true
    },
    {
      name: "shifting",
      global: "MedOrbitsShifting",
      phase: 3,
      optional: true
    },
    {
      name: "modal",
      global: "MedOrbitsModal",
      phase: 3,
      optional: true
    },
    {
      name: "popup",
      global: "MedOrbitsPopup",
      phase: 3,
      optional: true
    },
    {
      name: "notifications",
      global: "MedOrbitsNotifications",
      phase: 3,
      optional: true
    },

    // Forms and user workflows
    {
      name: "validation",
      global: "MedOrbitsValidation",
      phase: 4,
      optional: true
    },
    {
      name: "form-validation",
      global: "MedOrbitsFormValidation",
      phase: 4,
      optional: true
    },
    {
      name: "form-steps",
      global: "MedOrbitsFormSteps",
      phase: 4,
      optional: true
    },
    {
      name: "forms",
      global: "MedOrbitsForms",
      phase: 4,
      optional: true
    },
    {
      name: "file-validation",
      global: "MedOrbitsFileValidation",
      phase: 4,
      optional: true
    },
    {
      name: "document-preview",
      global: "MedOrbitsDocumentPreview",
      phase: 4,
      optional: true
    },
    {
      name: "response",
      global: "MedOrbitsResponse",
      phase: 4,
      optional: true
    },

    // Page-specific features
    {
      name: "filters",
      global: "MedOrbitsFilters",
      phase: 5,
      optional: true
    },
    {
      name: "search",
      global: "MedOrbitsSearch",
      phase: 5,
      optional: true
    },
    {
      name: "pagination",
      global: "MedOrbitsPagination",
      phase: 5,
      optional: true
    },
    {
      name: "college-directory",
      global: "MedOrbitsCollegeDirectory",
      phase: 5,
      optional: true
    },
    {
      name: "admissions",
      global: "MedOrbitsAdmissions",
      phase: 5,
      optional: true
    },
    {
      name: "job-search",
      global: "MedOrbitsJobSearch",
      phase: 5,
      optional: true
    },
    {
      name: "account",
      global: "MedOrbitsAccount",
      phase: 5,
      optional: true
    },
    {
      name: "auth-ui",
      global: "MedOrbitsAuthUI",
      phase: 5,
      optional: true
    },
    {
      name: "login-logout",
      global: "MedOrbitsLoginLogout",
      phase: 5,
      optional: true
    },
    {
      name: "reset",
      global: "MedOrbitsReset",
      phase: 5,
      optional: true
    },
    {
      name: "apply",
      global: "MedOrbitsApply",
      phase: 5,
      optional: true
    },
    {
      name: "app",
      global: "MedOrbitsApp",
      phase: 6,
      optional: true
    }
  ];

  /* -------------------------------------------------------
     Helpers
     ------------------------------------------------------- */

  function emit(name, detail) {
    const eventName = name.startsWith(EVENT_PREFIX)
      ? name
      : EVENT_PREFIX + name;

    try {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          detail: detail || {}
        })
      );
    } catch (_) {
      // Keep the application running if custom events fail.
    }
  }

  function log(message, details) {
    if (!state.options.debug || !window.console) return;

    // Avoid printing credentials, form data, or API responses.
    console.info("[MedOrbits]", message, details || "");
  }

  function reportFailure(name, error) {
    const safeError = {
      module: name,
      message: "A page feature could not be initialized.",
      timestamp: new Date().toISOString()
    };

    state.failedModules.set(name, safeError);

    log("Module initialization failed: " + name);

    emit("module-error", safeError);

    if (typeof state.options.onModuleError === "function") {
      try {
        state.options.onModuleError(safeError, error);
      } catch (_) {
        // Custom error handlers must not stop application startup.
      }
    }
  }

  function whenDOMReady() {
    if (document.readyState !== "loading") {
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      document.addEventListener("DOMContentLoaded", resolve, {
        once: true
      });
    });
  }

  function getGlobal(name) {
    return name && window[name] ? window[name] : null;
  }

  function moduleExists(module) {
    return Boolean(getGlobal(module.global));
  }

  function getPageContext() {
    return {
      path: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      title: document.title,
      online: navigator.onLine !== false,
      readyState: document.readyState
    };
  }

  function getStatusElement() {
    if (state.statusElement && document.contains(state.statusElement)) {
      return state.statusElement;
    }

    state.statusElement = document.querySelector(
      state.options.statusSelector
    );

    return state.statusElement;
  }

  function announce(message) {
    const element = getStatusElement();

    if (element) {
      element.textContent = message;
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
    }

    emit("announcement", { message: message });
  }

  /* -------------------------------------------------------
     Module registration

     Modules must expose a public global API to be discovered.
     A missing optional module is skipped without crashing.
     ------------------------------------------------------- */

  function registerModule(name, api, options) {
    if (!name || !api) return false;

    const opts = options || {};

    state.modules.set(name, {
      name: name,
      api: api,
      phase: Number(opts.phase) || 99,
      optional: opts.optional !== false,
      initialized: false
    });

    emit("module-registered", { name: name });

    return true;
  }

  function discoverModules() {
    MODULES.forEach(function (definition) {
      const moduleAPI = getGlobal(definition.global);

      if (!moduleAPI) return;

      registerModule(definition.name, moduleAPI, definition);
    });

    return state.modules.size;
  }

  function invokeModule(moduleRecord) {
    const moduleAPI = moduleRecord.api;

    if (!moduleAPI || typeof moduleAPI !== "object") {
      return Promise.resolve(false);
    }

    if (
      state.initializedModules.has(moduleRecord.name) ||
      moduleRecord.initialized
    ) {
      return Promise.resolve(true);
    }

    const initializer =
      typeof moduleAPI.init === "function"
        ? moduleAPI.init
        : typeof moduleAPI.initialize === "function"
          ? moduleAPI.initialize
          : null;

    if (!initializer) {
      // Some modules are utility-only and require no initialization.
      moduleRecord.initialized = true;
      state.initializedModules.add(moduleRecord.name);
      return Promise.resolve(true);
    }

    return Promise.resolve()
      .then(function () {
        return initializer.call(moduleAPI);
      })
      .then(function () {
        moduleRecord.initialized = true;
        state.initializedModules.add(moduleRecord.name);

        emit("module-ready", {
          name: moduleRecord.name
        });

        return true;
      })
      .catch(function (error) {
        reportFailure(moduleRecord.name, error);

        if (!state.options.continueOnError) {
          throw error;
        }

        return false;
      });
  }

  async function initializeModules() {
    discoverModules();

    const modules = Array.from(state.modules.values()).sort(function (a, b) {
      return a.phase - b.phase;
    });

    const phases = Array.from(
      new Set(modules.map(function (module) {
        return module.phase;
      }))
    ).sort(function (a, b) {
      return a - b;
    });

    for (const phase of phases) {
      const phaseModules = modules.filter(function (module) {
        return module.phase === phase;
      });

      for (const moduleRecord of phaseModules) {
        await invokeModule(moduleRecord);
      }
    }

    return getDiagnostics();
  }

  /* -------------------------------------------------------
     Optional configured module loading

     Add data-mo-module-src="/assets/js/example.js" to a
     script element or element in HTML to explicitly load it.

     This feature is disabled by default. Only load trusted
     first-party files. It is not a security boundary.
     ------------------------------------------------------- */

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      let url;

      try {
        url = new URL(src, window.location.origin);
      } catch (_) {
        reject(new Error("Invalid module URL."));
        return;
      }

      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith("/assets/js/")
      ) {
        reject(new Error("Module must be a same-origin assets/js file."));
        return;
      }

      const existing = Array.from(document.scripts).find(function (script) {
        try {
          return new URL(script.src).href === url.href;
        } catch (_) {
          return false;
        }
      });

      if (existing && existing.dataset.moLoaded === "true") {
        resolve(existing);
        return;
      }

      const script = existing || document.createElement("script");

      if (!existing) {
        script.src = url.href;
        script.async = false;
        script.dataset.moMainLoaded = "true";
      }

      script.addEventListener("load", function () {
        script.dataset.moLoaded = "true";
        resolve(script);
      }, { once: true });

      script.addEventListener("error", function () {
        reject(new Error("Could not load configured module."));
      }, { once: true });

      if (!existing) {
        document.head.appendChild(script);
      }
    });
  }

  async function loadConfiguredModules() {
    if (!state.options.loadConfiguredModules) return 0;

    const elements = document.querySelectorAll(
      state.options.moduleSelector
    );

    let loaded = 0;

    for (const element of elements) {
      const src = element.getAttribute("data-mo-module-src");

      if (!src) continue;

      try {
        await loadScript(src);
        loaded += 1;
      } catch (error) {
        reportFailure("configured-module", error);
      }
    }

    return loaded;
  }

  /* -------------------------------------------------------
     Network status
     ------------------------------------------------------- */

  function handleOnline() {
    state.online = true;

    emit("online", {
      online: true,
      context: getPageContext()
    });

    if (state.options.announceNetworkChanges) {
      announce("Connection restored.");
    }

    refreshPageModules();
  }

  function handleOffline() {
    state.online = false;

    emit("offline", {
      online: false,
      context: getPageContext()
    });

    if (state.options.announceNetworkChanges) {
      announce("You are offline. Some online features may be unavailable.");
    }
  }

  function addListener(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);

    state.listeners.push(function () {
      target.removeEventListener(eventName, handler, options);
    });
  }

  /* -------------------------------------------------------
     Dynamic content

     Call MedOrbitsMain.refresh(container) after adding new
     HTML dynamically. Existing modules decide what they
     need to bind to that content.
     ------------------------------------------------------- */

  function refreshPageModules(root) {
    const container = root || document;

    state.modules.forEach(function (record) {
      const moduleAPI = record.api;

      if (!moduleAPI) return;

      try {
        if (typeof moduleAPI.refresh === "function") {
          moduleAPI.refresh(container);
        } else if (typeof moduleAPI.bindForms === "function") {
          moduleAPI.bindForms(container);
        } else if (typeof moduleAPI.refreshPage === "function") {
          moduleAPI.refreshPage(container);
        }
      } catch (error) {
        reportFailure(record.name + ":refresh", error);
      }
    });

    emit("content-refreshed", {
      path: window.location.pathname
    });
  }

  function observeDynamicContent() {
    if (
      !state.options.observeDynamicContent ||
      typeof MutationObserver !== "function" ||
      !document.body
    ) {
      return;
    }

    let scheduled = false;

    state.observer = new MutationObserver(function (mutations) {
      const hasNewContent = mutations.some(function (mutation) {
        return mutation.addedNodes && mutation.addedNodes.length > 0;
      });

      if (!hasNewContent || scheduled) return;

      scheduled = true;

      Promise.resolve().then(function () {
        scheduled = false;
        refreshPageModules(document);
      });
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /* -------------------------------------------------------
     Page lifecycle
     ------------------------------------------------------- */

  function handlePageShow() {
    emit("pageshow", {
      context: getPageContext()
    });

    refreshPageModules();
  }

  function handlePageHide() {
    emit("pagehide", {
      context: getPageContext()
    });
  }

  /* -------------------------------------------------------
     Diagnostics
     ------------------------------------------------------- */

  function getDiagnostics() {
    return {
      version: VERSION,
      initialized: state.initialized,
      initializing: state.initializing,
      online: state.online,
      startedAt: state.startedAt,
      pageReady: state.pageReady,
      page: getPageContext(),
      registeredModules: Array.from(state.modules.keys()),
      initializedModules: Array.from(state.initializedModules),
      failedModules: Array.from(state.failedModules.values())
    };
  }

  /* -------------------------------------------------------
     Start and stop
     ------------------------------------------------------- */

  async function init(options) {
    if (options && typeof options === "object") {
      Object.keys(state.options).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(options, key)) {
          state.options[key] = options[key];
        }
      });
    }

    if (state.initialized || state.initializing) {
      return api;
    }

    state.initializing = true;
    state.destroyed = false;

    try {
      await whenDOMReady();

      state.pageReady = true;
      state.startedAt = new Date().toISOString();

      await loadConfiguredModules();
      await initializeModules();

      addListener(window, "online", handleOnline);
      addListener(window, "offline", handleOffline);
      addListener(window, "pageshow", handlePageShow);
      addListener(window, "pagehide", handlePageHide);

      observeDynamicContent();

      state.initialized = true;

      document.documentElement.dataset.moAppReady = "true";

      emit("ready", {
        version: VERSION,
        context: getPageContext(),
        modules: Array.from(state.initializedModules)
      });

      log("Application initialized.", getDiagnostics());

      return api;
    } finally {
      state.initializing = false;
    }
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (_) {
        // Continue cleanup.
      }
    });

    state.listeners = [];

    state.initialized = false;
    state.initializing = false;
    state.destroyed = true;

    delete document.documentElement.dataset.moAppReady;

    emit("destroyed", { version: VERSION });

    return true;
  }

  const api = {
    version: VERSION,

    init: init,
    destroy: destroy,

    registerModule: registerModule,
    discoverModules: discoverModules,
    initializeModules: initializeModules,

    refresh: refreshPageModules,
    announce: announce,

    getDiagnostics: getDiagnostics,
    getPageContext: getPageContext
  };

  window.MedOrbitsMain = api;

  // Initialize automatically unless explicitly disabled.
  if (state.options.autoInit) {
    init().catch(function () {
      // Never display internal stack traces to site visitors.
      emit("startup-error", {
        message: "Some application features may be unavailable."
      });
    });
  }

})(window, document);
