
/* =========================================================
   MEDORBITS | CENTRAL CONFIGURATION
   File: assets/js/config.js
   Version: 1.0.0

   Responsibilities:
   - Central site configuration
   - API and endpoint configuration
   - Asset and page paths
   - Localization defaults
   - Feature flags
   - Validation limits
   - Environment configuration
   - Safe configuration access
   - Compatibility with static hosting

   No external dependencies.
   No secrets or credentials belong in this file.
   ========================================================= */

(function medOrbitsConfigModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_CONFIG_V1__";

  if (window[GLOBAL_KEY]) {
    window.MedOrbitsConfig = window[GLOBAL_KEY].publicAPI;
    return;
  }

  var DEFAULTS = {
    app: {
      name: "MedOrbits",
      shortName: "MedOrbits",
      description:
        "Education guidance, admissions support, career services and recruitment assistance.",
      version: "1.0.0",
      environment: "production",
      debug: false,
      countryCode: "IN",
      currency: "INR",
      locale: "en-IN",
      timeZone: "Asia/Kolkata",
      dateFormat: "YYYY-MM-DD",
      year: new Date().getFullYear()
    },

    contact: {
      supportEmail: "support@medorbits.in",
      supportPhone: "+917644987052",
      whatsappNumber: "917644987052",
      website: "https://medorbits.in"
    },

    paths: {
      home: "/index.html",
      about: "/pages/about.html",
      contact: "/pages/contact.html",
      support: "/pages/help-centre.html",
      privacy: "/pages/privacy-policy.html",
      terms: "/pages/terms-and-conditions.html",
      sitemap: "/pages/sitemap.html",
      notFound: "/404.html",

      assets: "/assets/",
      css: "/assets/css/",
      js: "/assets/js/",
      images: "/assets/images/",
      icons: "/assets/icons/",
      data: "/assets/data/",
      documents: "/assets/documents/",
      brochures: "/assets/brochures/",
      downloads: "/assets/downloads/",

      pages: "/pages/",
      admissions: "/pages/admissions/",
      colleges: "/pages/colleges/",
      universities: "/pages/universities/",
      courses: "/pages/courses/",
      careers: "/pages/careers/",
      jobs: "/pages/jobs/",
      applications: "/pages/applications/"
    },

    api: {
      enabled: false,
      baseURL: "/api",
      timeout: 15000,
      credentials: "same-origin",
      csrfTokenSelector: 'meta[name="csrf-token"]',
      csrfHeaderName: "X-CSRF-Token",

      endpoints: {
        health: "/health",
        authLogin: "/auth/login",
        authRegister: "/auth/register",
        authLogout: "/auth/logout",
        authMe: "/auth/me",
        authForgotPassword: "/auth/forgot-password",
        authResetPassword: "/auth/reset-password",

        colleges: "/colleges",
        universities: "/universities",
        courses: "/courses",
        admissions: "/admissions",
        applications: "/applications",
        documents: "/documents",
        scholarships: "/scholarships",
        entranceExams: "/entrance-exams",
        careers: "/careers",
        jobs: "/jobs",
        search: "/search",
        contact: "/contact",
        notifications: "/notifications"
      }
    },

    data: {
      format: "json",
      cache: true,
      cacheDurationMs: 300000,

      files: {
        colleges: "colleges.json",
        universities: "universities.json",
        courses: "courses.json",
        scholarships: "scholarships.json",
        entranceExams: "entrance-exams.json",
        admissionProcess: "admission-process.json",
        documents: "documents.json",
        careerOptions: "career-options.json",
        jobs: "jobs.json",
        faqs: "faqs.json",
        news: "news.json",
        notifications: "notifications.json",
        testimonials: "testimonials.json",
        services: "services.json",
        countries: "countries.json",
        hostels: "hostels.json",
        fees: "fees.json"
      },

      verification: {
        requireSourceForOfficialClaims: true,
        unknownValue: null,
        unverifiedStatus: "unverified",
        verifiedStatus: "verified",
        verificationDateField: "lastVerified",
        sourceField: "sourceUrl"
      }
    },

    localization: {
      defaultLanguage: "en",
      fallbackLanguage: "en",
      supportedLanguages: [
        "en",
        "hi",
        "bn",
        "as",
        "ne",
        "mr",
        "gu",
        "pa",
        "ur",
        "or",
        "ps",
        "fa",
        "fr",
        "de",
        "es",
        "zh",
        "ar",
        "ru",
        "ka",
        "kk",
        "uz",
        "ky"
      ],

      directionByLanguage: {
        ar: "rtl",
        fa: "rtl",
        ur: "rtl",
        en: "ltr",
        hi: "ltr",
        bn: "ltr",
        as: "ltr",
        ne: "ltr",
        mr: "ltr",
        gu: "ltr",
        pa: "ltr",
        or: "ltr",
        ps: "rtl",
        fr: "ltr",
        de: "ltr",
        es: "ltr",
        zh: "ltr",
        ru: "ltr",
        ka: "ltr",
        kk: "ltr",
        uz: "ltr",
        ky: "ltr"
      },

      languageStorageKey: "medorbits-language"
    },

    features: {
      accessibility: true,
      collegeDirectory: true,
      universityDirectory: true,
      courseDirectory: true,
      admissionsForms: true,
      documentChecklist: true,
      careerServices: true,
      jobListings: true,
      globalSearch: true,
      multilingualSupport: true,
      darkMode: true,

      /*
       * Keep backend-dependent features disabled until
       * the corresponding services are implemented.
       */
      accountRegistration: false,
      accountLogin: false,
      onlinePayments: false,
      documentUploads: false,
      aiAssistant: false,
      liveNotifications: false
    },

    validation: {
      nameMinLength: 2,
      nameMaxLength: 120,
      emailMaxLength: 254,
      phoneMinLength: 7,
      phoneMaxLength: 20,
      messageMinLength: 10,
      messageMaxLength: 5000,
      passwordMinLength: 8,
      passwordMaxLength: 128,
      fileMaxSizeBytes: 10 * 1024 * 1024,
      allowedDocumentExtensions: [
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png"
      ],
      allowedImageExtensions: [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".svg"
      ]
    },

    security: {
      /*
       * Client-side flags are not security boundaries.
       * Enforce authorization, file validation, rate limits
       * and input validation on the server as well.
       */
      allowExternalLinks: true,
      externalLinkTarget: "_blank",
      externalLinkRel: "noopener noreferrer",
      allowInsecureHttpExternalLinks: false,
      allowInlineScripts: false,
      exposeDebugDetails: false
    },

    ui: {
      animationDurationMs: 250,
      searchDebounceMs: 250,
      toastDurationMs: 4000,
      paginationPageSize: 12,
      paginationMaxPageSize: 100,
      mobileBreakpointPx: 768,
      tabletBreakpointPx: 1024,
      reducedMotionAttribute: "data-reduced-motion"
    },

    storage: {
      /*
       * Store only non-sensitive preferences here.
       * Do not store passwords, access tokens or documents
       * in localStorage through this configuration.
       */
      themeKey: "medorbits-theme",
      languageKey: "medorbits-language",
      cookieConsentKey: "medorbits-cookie-consent"
    }
  };

  var currentConfig = clone(DEFAULTS);
  var listeners = new Set();

  function clone(value) {
    if (Array.isArray(value)) {
      return value.map(clone);
    }

    if (value && typeof value === "object") {
      var result = {};

      Object.keys(value).forEach(function (key) {
        result[key] = clone(value[key]);
      });

      return result;
    }

    return value;
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") {
      return false;
    }

    var prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }

  function mergeObjects(target, source) {
    if (!isPlainObject(source)) {
      return target;
    }

    Object.keys(source).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        return;
      }

      var sourceValue = source[key];
      var targetValue = target[key];

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        mergeObjects(targetValue, sourceValue);
      } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        target[key] = sourceValue.slice();
      } else if (
        sourceValue === null ||
        ["string", "number", "boolean"].includes(typeof sourceValue)
      ) {
        target[key] = sourceValue;
      }
    });

    return target;
  }

  function getPath(object, path) {
    if (typeof path !== "string" || !path.trim()) {
      return undefined;
    }

    var segments = path.split(".");
    var value = object;

    for (var i = 0; i < segments.length; i += 1) {
      var segment = segments[i];

      if (
        !segment ||
        segment === "__proto__" ||
        segment === "prototype" ||
        segment === "constructor" ||
        value == null ||
        !Object.prototype.hasOwnProperty.call(value, segment)
      ) {
        return undefined;
      }

      value = value[segment];
    }

    return value;
  }

  function setPath(object, path, value) {
    if (typeof path !== "string" || !path.trim()) {
      return false;
    }

    var segments = path.split(".");

    if (segments.some(function (segment) {
      return !segment ||
        segment === "__proto__" ||
        segment === "prototype" ||
        segment === "constructor";
    })) {
      return false;
    }

    var target = object;

    for (var i = 0; i < segments.length - 1; i += 1) {
      var segment = segments[i];

      if (
        !target[segment] ||
        typeof target[segment] !== "object" ||
        Array.isArray(target[segment])
      ) {
        return false;
      }

      target = target[segment];
    }

    var finalKey = segments[segments.length - 1];

    if (!Object.prototype.hasOwnProperty.call(target, finalKey)) {
      return false;
    }

    var previous = target[finalKey];

    if (Array.isArray(previous)) {
      if (!Array.isArray(value)) {
        return false;
      }

      target[finalKey] = value.slice();
    } else if (isPlainObject(previous)) {
      if (!isPlainObject(value)) {
        return false;
      }

      target[finalKey] = clone(value);
    } else if (
      value === null ||
      typeof value === typeof previous
    ) {
      target[finalKey] = value;
    } else {
      return false;
    }

    return true;
  }

  function deepFreeze(object) {
    if (!object || typeof object !== "object" || Object.isFrozen(object)) {
      return object;
    }

    Object.freeze(object);

    Object.keys(object).forEach(function (key) {
      deepFreeze(object[key]);
    });

    return object;
  }

  function notifyListeners(path) {
    var snapshot = getConfig();

    listeners.forEach(function (listener) {
      try {
        listener(snapshot, path || null);
      } catch (error) {
        if (currentConfig.app.debug) {
          console.error("[MedOrbits Config] Listener failed:", error);
        }
      }
    });
  }

  function getConfig(path) {
    var snapshot = clone(currentConfig);

    if (typeof path === "string") {
      return clone(getPath(snapshot, path));
    }

    return deepFreeze(snapshot);
  }

  function configure(overrides) {
    if (!isPlainObject(overrides)) {
      return false;
    }

    currentConfig = mergeObjects(clone(currentConfig), overrides);
    notifyListeners(null);

    return true;
  }

  function set(path, value) {
    var candidate = clone(currentConfig);

    if (!setPath(candidate, path, value)) {
      return false;
    }

    currentConfig = candidate;
    notifyListeners(path);

    return true;
  }

  function reset() {
    currentConfig = clone(DEFAULTS);
    notifyListeners(null);
    return true;
  }

  function isFeatureEnabled(featureName) {
    return getPath(currentConfig, "features." + featureName) === true;
  }

  function getDataUrl(fileName) {
    if (typeof fileName !== "string" || !fileName.trim()) {
      return "";
    }

    var cleanFileName = fileName.trim();

    /*
     * Accept a filename only, not a path or URL. This prevents
     * accidental path traversal when constructing local data paths.
     */
    if (
      cleanFileName.indexOf("/") !== -1 ||
      cleanFileName.indexOf("\\") !== -1 ||
      cleanFileName.indexOf("..") !== -1
    ) {
      return "";
    }

    return currentConfig.paths.data + cleanFileName;
  }

  function getDataFile(datasetName) {
    var fileName = getPath(currentConfig, "data.files." + datasetName);

    if (typeof fileName !== "string") {
      return "";
    }

    return getDataUrl(fileName);
  }

  function getApiUrl(endpointName) {
    var endpoint = getPath(currentConfig, "api.endpoints." + endpointName);

    if (typeof endpoint !== "string" || !endpoint.trim()) {
      return "";
    }

    var base = currentConfig.api.baseURL.replace(/\/+$/, "");
    var path = endpoint.replace(/^\/+/, "");

    return base ? base + "/" + path : "/" + path;
  }

  function getLanguageDirection(language) {
    var normalized = String(
      language || currentConfig.localization.defaultLanguage
    ).toLowerCase().split("-")[0];

    return currentConfig.localization.directionByLanguage[normalized] || "ltr";
  }

  function isLanguageSupported(language) {
    var normalized = String(language || "").toLowerCase();

    return currentConfig.localization.supportedLanguages.some(function (item) {
      return item.toLowerCase() === normalized ||
        item.toLowerCase() === normalized.split("-")[0];
    });
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    listeners.add(callback);

    return function unsubscribe() {
      listeners.delete(callback);
    };
  }

  function detectEnvironment() {
    var html = document.documentElement;
    var declared = html.getAttribute("data-environment");

    if (declared && ["development", "staging", "production", "test"].includes(declared)) {
      return declared;
    }

    return currentConfig.app.environment;
  }

  function initializeFromDocument() {
    var html = document.documentElement;

    if (!html) {
      return;
    }

    var environment = html.getAttribute("data-environment");

    if (environment && ["development", "staging", "production", "test"].includes(environment)) {
      currentConfig.app.environment = environment;
      currentConfig.app.debug = environment === "development";
    }

    var language = html.getAttribute("lang");

    if (language && isLanguageSupported(language)) {
      currentConfig.localization.defaultLanguage = language.split("-")[0];
    }

    var baseURL = html.getAttribute("data-api-base-url");

    if (baseURL && baseURL.trim()) {
      currentConfig.api.baseURL = baseURL.trim();
    }

    var apiEnabled = html.getAttribute("data-api-enabled");

    if (apiEnabled !== null) {
      currentConfig.api.enabled = apiEnabled === "true";
    }
  }

  var publicAPI = {
    version: "1.0.0",
    get: getConfig,
    set: set,
    configure: configure,
    reset: reset,
    isFeatureEnabled: isFeatureEnabled,
    getDataUrl: getDataUrl,
    getDataFile: getDataFile,
    getApiUrl: getApiUrl,
    getLanguageDirection: getLanguageDirection,
    isLanguageSupported: isLanguageSupported,
    subscribe: subscribe,
    detectEnvironment: detectEnvironment,
    defaults: deepFreeze(clone(DEFAULTS))
  };

  initializeFromDocument();

  window[GLOBAL_KEY] = {
    publicAPI: publicAPI
  };

  window.MedOrbitsConfig = publicAPI;
})();
