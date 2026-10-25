
/* =========================================================
   MEDORBITS | THEME MANAGER
   File: assets/js/theme.js
   Version: 1.0.0
   Dependencies: None
   ========================================================= */

(function MedOrbitsTheme() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_THEME_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var CONFIG = {
    storageKey: "medorbits:theme:v1",
    defaultTheme: "system",
    themes: ["light", "dark", "system"],
    rootSelector: "[data-mo-theme]",
    toggleSelector: "[data-theme-toggle]",
    selectSelector: "[data-theme-select]",
    labelSelector: "[data-theme-label]"
  };

  var state = {
    preference: CONFIG.defaultTheme,
    activeTheme: "light",
    listeners: [],
    mediaQuery: null,
    observer: null,
    initialized: false,
    destroyed: false,
    storageAvailable: true
  };

  function listen(element, eventName, handler, options) {
    element.addEventListener(eventName, handler, options || false);

    state.listeners.push(function () {
      element.removeEventListener(eventName, handler, options || false);
    });
  }

  function validTheme(theme) {
    return CONFIG.themes.includes(String(theme).toLowerCase());
  }

  function readPreference() {
    try {
      var saved = window.localStorage.getItem(CONFIG.storageKey);

      if (validTheme(saved)) {
        return saved;
      }
    } catch (error) {
      state.storageAvailable = false;
    }

    return CONFIG.defaultTheme;
  }

  function savePreference(theme) {
    try {
      window.localStorage.setItem(CONFIG.storageKey, theme);
      state.storageAvailable = true;
      return true;
    } catch (error) {
      state.storageAvailable = false;
      return false;
    }
  }

  function resolveTheme(preference) {
    if (preference === "light" || preference === "dark") {
      return preference;
    }

    if (
      state.mediaQuery &&
      typeof state.mediaQuery.matches === "boolean"
    ) {
      return state.mediaQuery.matches ? "dark" : "light";
    }

    return "light";
  }

  function updateColorScheme(theme) {
    if (!document.documentElement) return;

    document.documentElement.style.colorScheme = theme;
  }

  function applyTheme(preference, options) {
    options = options || {};

    if (!validTheme(preference)) {
      preference = CONFIG.defaultTheme;
    }

    state.preference = preference;

    var theme = resolveTheme(preference);
    state.activeTheme = theme;

    var root = document.documentElement;

    root.setAttribute("data-theme", theme);
    root.setAttribute("data-theme-preference", preference);
    root.classList.toggle("theme-light", theme === "light");
    root.classList.toggle("theme-dark", theme === "dark");

    updateColorScheme(theme);
    updateControls();

    if (options.persist) {
      savePreference(preference);
    }

    if (!options.silent) {
      document.dispatchEvent(new CustomEvent("medorbits:themechange", {
        detail: {
          preference: state.preference,
          theme: state.activeTheme
        }
      }));
    }

    return theme;
  }

  function updateControls() {
    document.querySelectorAll(CONFIG.toggleSelector).forEach(function (button) {
      var nextTheme = state.activeTheme === "dark" ? "light" : "dark";

      button.setAttribute("aria-pressed", String(state.activeTheme === "dark"));
      button.setAttribute(
        "aria-label",
        "Switch to " + nextTheme + " theme"
      );

      var icon = button.querySelector("[data-theme-icon]");

      if (icon) {
        icon.textContent = state.activeTheme === "dark" ? "☀" : "☾";
        icon.setAttribute(
          "aria-hidden",
          "true"
        );
      }

      var text = button.querySelector("[data-theme-toggle-label]");

      if (text) {
        text.textContent = state.activeTheme === "dark"
          ? "Light mode"
          : "Dark mode";
      }
    });

    document.querySelectorAll(CONFIG.selectSelector).forEach(function (select) {
      select.value = state.preference;
    });

    document.querySelectorAll(CONFIG.labelSelector).forEach(function (label) {
      label.textContent = state.preference === "system"
        ? "System theme (" + state.activeTheme + ")"
        : state.activeTheme.charAt(0).toUpperCase() +
          state.activeTheme.slice(1) + " theme";
    });
  }

  function setTheme(theme, options) {
    if (!validTheme(theme)) return false;

    options = options || {};

    applyTheme(theme, {
      persist: options.persist !== false,
      silent: Boolean(options.silent)
    });

    return true;
  }

  function toggleTheme() {
    var nextTheme = state.activeTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    return state.activeTheme;
  }

  function handleClick(event) {
    var target = event.target;

    if (!(target instanceof Element)) return;

    var button = target.closest(CONFIG.toggleSelector);

    if (button) {
      event.preventDefault();
      toggleTheme();
    }
  }

  function handleChange(event) {
    var target = event.target;

    if (!(target instanceof Element)) return;

    if (target.matches(CONFIG.selectSelector)) {
      setTheme(target.value);
    }
  }

  function handleSystemChange() {
    if (state.preference === "system") {
      applyTheme("system");
    }
  }

  function handleStorage(event) {
    if (event.key !== CONFIG.storageKey) return;

    if (validTheme(event.newValue)) {
      applyTheme(event.newValue, { silent: false });
    } else if (event.newValue === null) {
      applyTheme(CONFIG.defaultTheme, { silent: false });
    }
  }

  function refresh() {
    if (state.destroyed) return;

    updateControls();
  }

  function init() {
    if (state.initialized || state.destroyed) return;

    state.initialized = true;

    if (typeof window.matchMedia === "function") {
      state.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      if (typeof state.mediaQuery.addEventListener === "function") {
        listen(state.mediaQuery, "change", handleSystemChange);
      } else if (typeof state.mediaQuery.addListener === "function") {
        state.mediaQuery.addListener(handleSystemChange);

        state.listeners.push(function () {
          state.mediaQuery.removeListener(handleSystemChange);
        });
      }
    }

    state.preference = readPreference();

    // Apply the stored/system theme before updating theme controls.
    applyTheme(state.preference, { silent: true });

    listen(document, "click", handleClick);
    listen(document, "change", handleChange);
    listen(window, "storage", handleStorage);

    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var needsRefresh = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && (
                  node.matches(CONFIG.toggleSelector) ||
                  node.matches(CONFIG.selectSelector) ||
                  node.matches(CONFIG.labelSelector)
                )) ||
                (node.querySelector && (
                  node.querySelector(CONFIG.toggleSelector) ||
                  node.querySelector(CONFIG.selectSelector) ||
                  node.querySelector(CONFIG.labelSelector)
                ))
              );
          });
        });

        if (needsRefresh) refresh();
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function destroy() {
    if (state.destroyed) return;

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.listeners = [];
    state.destroyed = true;
  }

  var api = {
    version: "1.0.0",

    setTheme: setTheme,

    toggle: toggleTheme,

    getTheme: function () {
      return state.activeTheme;
    },

    getPreference: function () {
      return state.preference;
    },

    refresh: refresh,

    configure: function (options) {
      options = options || {};

      if (typeof options.storageKey === "string" && options.storageKey.trim()) {
        CONFIG.storageKey = options.storageKey.trim();
      }

      if (validTheme(options.defaultTheme)) {
        CONFIG.defaultTheme = options.defaultTheme;
      }

      if (options.persist === false) {
        state.storageAvailable = false;
      }
    },

    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsTheme = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
