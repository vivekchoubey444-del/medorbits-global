
/* =========================================================
   MedOrbits -- assets/js/accessibility.js
   Accessibility enhancements and WCAG-friendly interactions
   ========================================================= */
(function (window, document) {
  "use strict";

  const STORAGE_KEY = "medorbits-accessibility";
  const ROOT = document.documentElement;
  const STYLE_ID = "medorbits-accessibility-styles";
  const PANEL_ID = "medorbits-accessibility-panel";
  const TRIGGER_ID = "medorbits-accessibility-trigger";
  const MAIN_SELECTOR = "main, #main-content, [role='main']";

  const DEFAULT_SETTINGS = Object.freeze({
    fontSize: "normal",
    contrast: false,
    grayscale: false,
    highlightLinks: false,
    readableFont: false,
    reduceMotion: false,
    underlineLinks: false,
    textSpacing: false,
    cursor: "normal"
  });

  const FONT_SIZES = Object.freeze({
    small: 0.9,
    normal: 1,
    large: 1.15,
    "extra-large": 1.3
  });

  const BOOLEAN_SETTINGS = [
    "contrast",
    "grayscale",
    "highlightLinks",
    "readableFont",
    "reduceMotion",
    "underlineLinks",
    "textSpacing"
  ];

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    initialized: false,
    panel: null,
    trigger: null,
    previousFocus: null,
    listenersBound: false
  };

  function sanitizeSettings(settings) {
    const result = {};

    if (
      !settings ||
      typeof settings !== "object" ||
      Array.isArray(settings)
    ) {
      return result;
    }

    if (
      Object.prototype.hasOwnProperty.call(FONT_SIZES, settings.fontSize)
    ) {
      result.fontSize = settings.fontSize;
    }

    BOOLEAN_SETTINGS.forEach(key => {
      if (typeof settings[key] === "boolean") {
        result[key] = settings[key];
      }
    });

    if (settings.cursor === "normal" || settings.cursor === "large") {
      result.cursor = settings.cursor;
    }

    return result;
  }

  function loadSettings() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return { ...DEFAULT_SETTINGS };
      }

      const parsed = JSON.parse(stored);

      return {
        ...DEFAULT_SETTINGS,
        ...sanitizeSettings(parsed)
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.settings)
      );
    } catch {
      // Settings continue to work for the current session.
    }
  }

  function getSettings() {
    return { ...state.settings };
  }

  function updateSetting(key, value) {
    if (
      !Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)
    ) {
      return false;
    }

    const sanitized = sanitizeSettings({ [key]: value });

    if (!Object.prototype.hasOwnProperty.call(sanitized, key)) {
      return false;
    }

    if (state.settings[key] === sanitized[key]) {
      return true;
    }

    state.settings[key] = sanitized[key];
    applySettings();
    saveSettings();

    return true;
  }

  function resetSettings() {
    state.settings = { ...DEFAULT_SETTINGS };
    applySettings();
    saveSettings();
  }

  function applySettings() {
    const settings = state.settings;

    ROOT.style.setProperty(
      "--mo-accessibility-font-scale",
      String(FONT_SIZES[settings.fontSize] || 1)
    );

    const classes = {
      "mo-a11y-high-contrast": settings.contrast,
      "mo-a11y-grayscale": settings.grayscale,
      "mo-a11y-highlight-links": settings.highlightLinks,
      "mo-a11y-readable-font": settings.readableFont,
      "mo-a11y-reduce-motion": settings.reduceMotion,
      "mo-a11y-underline-links": settings.underlineLinks,
      "mo-a11y-text-spacing": settings.textSpacing,
      "mo-a11y-large-cursor": settings.cursor === "large"
    };

    Object.entries(classes).forEach(([className, enabled]) => {
      ROOT.classList.toggle(className, enabled);
    });

    document.dispatchEvent(
      new window.CustomEvent("medorbits:accessibility-changed", {
        detail: getSettings()
      })
    );

    updateControls();
  }

  function createStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      :root {
        --mo-accessibility-font-scale: 1;
      }

      html {
        font-size: calc(100% * var(--mo-accessibility-font-scale, 1));
      }

      html.mo-a11y-high-contrast {
        filter: contrast(1.3);
      }

      html.mo-a11y-grayscale {
        filter: grayscale(1);
      }

      html.mo-a11y-high-contrast.mo-a11y-grayscale {
        filter: grayscale(1) contrast(1.3);
      }

      html.mo-a11y-highlight-links a {
        outline: 2px solid currentColor !important;
        outline-offset: 3px !important;
        background-color: rgba(255, 220, 100, 0.16) !important;
      }

      html.mo-a11y-underline-links a {
        text-decoration: underline !important;
        text-decoration-thickness: 2px !important;
        text-underline-offset: 3px !important;
      }

      html.mo-a11y-readable-font,
      html.mo-a11y-readable-font body,
      html.mo-a11y-readable-font button,
      html.mo-a11y-readable-font input,
      html.mo-a11y-readable-font textarea,
      html.mo-a11y-readable-font select {
        font-family: Arial, Helvetica, sans-serif !important;
        letter-spacing: 0.025em;
      }

      html.mo-a11y-text-spacing body,
      html.mo-a11y-text-spacing p,
      html.mo-a11y-text-spacing li,
      html.mo-a11y-text-spacing label {
        line-height: 1.8 !important;
        letter-spacing: 0.04em !important;
        word-spacing: 0.12em !important;
      }

      html.mo-a11y-reduce-motion *,
      html.mo-a11y-reduce-motion *::before,
      html.mo-a11y-reduce-motion *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }

      html.mo-a11y-large-cursor,
      html.mo-a11y-large-cursor body,
      html.mo-a11y-large-cursor a,
      html.mo-a11y-large-cursor button,
      html.mo-a11y-large-cursor input,
      html.mo-a11y-large-cursor select,
      html.mo-a11y-large-cursor textarea,
      html.mo-a11y-large-cursor [role="button"] {
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M4 2 L4 25 L10 19 L15 29 L20 26 L15 16 L24 16 Z' fill='black' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 4 2, auto !important;
      }

      .mo-a11y-skip-link {
        position: fixed !important;
        top: 8px !important;
        left: 8px !important;
        z-index: 2147483647 !important;
        padding: 12px 18px !important;
        background: #f5e4b8 !important;
        color: #21160f !important;
        border: 2px solid #6e2338 !important;
        border-radius: 8px !important;
        transform: translateY(calc(-100% - 16px));
        transition: transform 0.15s ease;
      }

      .mo-a11y-skip-link:focus {
        transform: translateY(0);
      }

      .mo-a11y-trigger {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 99990;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-width: 48px;
        min-height: 48px;
        padding: 12px 16px;
        border: 2px solid #d4b56d;
        border-radius: 999px;
        background: #361321;
        color: #fff5dc;
        font: 600 14px/1.3 Arial, sans-serif;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
        cursor: pointer;
      }

      .mo-a11y-trigger:focus-visible,
      .mo-a11y-panel button:focus-visible,
      .mo-a11y-panel select:focus-visible,
      .mo-a11y-panel input:focus-visible {
        outline: 3px solid #d4b56d;
        outline-offset: 3px;
      }

      .mo-a11y-panel {
        position: fixed;
        right: 18px;
        bottom: 78px;
        z-index: 99991;
        box-sizing: border-box;
        width: min(360px, calc(100vw - 28px));
        max-height: min(75vh, 650px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 20px;
        border: 1px solid #d4b56d;
        border-radius: 16px;
        background: #21131b;
        color: #f8eddc;
        box-shadow: 0 16px 50px rgba(0, 0, 0, 0.3);
        font: 14px/1.5 Arial, sans-serif;
      }

      .mo-a11y-panel[hidden] {
        display: none !important;
      }

      .mo-a11y-panel__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .mo-a11y-panel__header h2 {
        margin: 0;
        font-size: 19px;
      }

      .mo-a11y-panel__close,
      .mo-a11y-panel__reset {
        min-height: 38px;
        padding: 8px 12px;
        border: 1px solid #8c6b5c;
        border-radius: 8px;
        background: #39232e;
        color: inherit;
        cursor: pointer;
      }

      .mo-a11y-control {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(248, 237, 220, 0.16);
      }

      .mo-a11y-control label {
        flex: 1;
      }

      .mo-a11y-control select {
        max-width: 145px;
        min-height: 38px;
        padding: 6px;
        border-radius: 7px;
        border: 1px solid #8c6b5c;
        background: #39232e;
        color: inherit;
      }

      .mo-a11y-control input[type="checkbox"] {
        width: 20px;
        height: 20px;
        accent-color: #d4b56d;
      }

      .mo-a11y-panel__footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 16px;
      }

      @media (max-width: 480px) {
        .mo-a11y-trigger {
          right: 12px;
          bottom: 12px;
        }

        .mo-a11y-panel {
          right: 10px;
          bottom: 72px;
          width: calc(100vw - 20px);
          max-height: 70vh;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mo-a11y-skip-link {
          transition: none;
        }
      }
    `;

    (document.head || ROOT).appendChild(style);
  }

  function createSkipLink() {
    if (document.querySelector(".mo-a11y-skip-link")) {
      return;
    }

    const link = document.createElement("a");
    link.className = "mo-a11y-skip-link";
    link.href = "#main-content";
    link.textContent = "Skip to main content";

    link.addEventListener("click", event => {
      const target = document.querySelector(MAIN_SELECTOR);

      if (!target) {
        return;
      }

      event.preventDefault();

      if (!target.id) {
        target.id = "main-content";
      }

      const hadTabindex = target.hasAttribute("tabindex");

      if (!hadTabindex) {
        target.setAttribute("tabindex", "-1");
      }

      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "auto", block: "start" });

      if (!hadTabindex) {
        target.addEventListener(
          "blur",
          () => target.removeAttribute("tabindex"),
          { once: true }
        );
      }

      if (window.location.hash !== `#${target.id}`) {
        try {
          window.history.replaceState(null, "", `#${target.id}`);
        } catch {
          // Navigation remains usable if history updates are unavailable.
        }
      }
    });

    document.body.prepend(link);
  }

  function createControl(id, label, type, options) {
    const wrapper = document.createElement("div");
    wrapper.className = "mo-a11y-control";

    const labelElement = document.createElement("label");
    labelElement.htmlFor = id;
    labelElement.textContent = label;

    let control;

    if (type === "select") {
      control = document.createElement("select");
      control.id = id;
      control.dataset.a11ySetting = options.setting;

      options.choices.forEach(choice => {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        control.appendChild(option);
      });
    } else {
      control = document.createElement("input");
      control.type = "checkbox";
      control.id = id;
      control.dataset.a11ySetting = options.setting;
    }

    wrapper.append(labelElement, control);

    return wrapper;
  }

  function updateControls() {
    if (!state.panel) {
      return;
    }

    state.panel.querySelectorAll("[data-a11y-setting]").forEach(control => {
      const key = control.dataset.a11ySetting;

      if (!Object.prototype.hasOwnProperty.call(state.settings, key)) {
        return;
      }

      if (control.type === "checkbox") {
        control.checked = Boolean(state.settings[key]);
      } else {
        control.value = state.settings[key];
      }
    });
  }

  function createPanel() {
    if (state.panel && state.panel.isConnected) {
      return state.panel;
    }

    const existing = document.getElementById(PANEL_ID);

    if (existing) {
      existing.remove();
    }

    const panel = document.createElement("section");
    panel.className = "mo-a11y-panel";
    panel.id = PANEL_ID;
    panel.setAttribute("aria-labelledby", "mo-a11y-title");
    panel.setAttribute("role", "region");
    panel.hidden = true;

    const header = document.createElement("div");
    header.className = "mo-a11y-panel__header";

    const title = document.createElement("h2");
    title.id = "mo-a11y-title";
    title.textContent = "Accessibility Settings";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "mo-a11y-panel__close";
    closeButton.dataset.a11yClose = "";
    closeButton.textContent = "Close";
    closeButton.setAttribute("aria-label", "Close accessibility settings");

    header.append(title, closeButton);
    panel.appendChild(header);

    const controls = [
      createControl("mo-a11y-font-size", "Text size", "select", {
        setting: "fontSize",
        choices: [
          { value: "small", label: "Small" },
          { value: "normal", label: "Normal" },
          { value: "large", label: "Large" },
          { value: "extra-large", label: "Extra large" }
        ]
      }),
      createControl("mo-a11y-contrast", "High contrast", "checkbox", {
        setting: "contrast"
      }),
      createControl("mo-a11y-grayscale", "Grayscale", "checkbox", {
        setting: "grayscale"
      }),
      createControl("mo-a11y-highlight-links", "Highlight links", "checkbox", {
        setting: "highlightLinks"
      }),
      createControl("mo-a11y-readable-font", "Readable font", "checkbox", {
        setting: "readableFont"
      }),
      createControl("mo-a11y-reduce-motion", "Reduce motion", "checkbox", {
        setting: "reduceMotion"
      }),
      createControl("mo-a11y-underline-links", "Underline links", "checkbox", {
        setting: "underlineLinks"
      }),
      createControl("mo-a11y-text-spacing", "Increase text spacing", "checkbox", {
        setting: "textSpacing"
      }),
      createControl("mo-a11y-cursor", "Cursor size", "select", {
        setting: "cursor",
        choices: [
          { value: "normal", label: "Normal" },
          { value: "large", label: "Large" }
        ]
      })
    ];

    controls.forEach(control => panel.appendChild(control));

    const footer = document.createElement("div");
    footer.className = "mo-a11y-panel__footer";

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "mo-a11y-panel__reset";
    resetButton.dataset.a11yReset = "";
    resetButton.textContent = "Reset settings";

    footer.appendChild(resetButton);
    panel.appendChild(footer);
    document.body.appendChild(panel);

    state.panel = panel;
    updateControls();

    return panel;
  }

  function createTrigger() {
    if (state.trigger && state.trigger.isConnected) {
      return state.trigger;
    }

    const existing = document.getElementById(TRIGGER_ID);

    if (existing) {
      existing.remove();
    }

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "mo-a11y-trigger";
    trigger.id = TRIGGER_ID;
    trigger.setAttribute("aria-controls", PANEL_ID);
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Open accessibility settings");

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "◉";

    const label = document.createElement("span");
    label.textContent = "Accessibility";

    trigger.append(icon, label);
    trigger.addEventListener("click", togglePanel);

    document.body.appendChild(trigger);
    state.trigger = trigger;

    return trigger;
  }

  function openPanel() {
    if (!document.body) {
      return;
    }

    createTrigger();
    createPanel();

    state.previousFocus =
      document.activeElement instanceof window.HTMLElement
        ? document.activeElement
        : null;

    state.panel.hidden = false;
    state.trigger.setAttribute("aria-expanded", "true");
    state.trigger.setAttribute("aria-label", "Close accessibility settings");

    const closeButton = state.panel.querySelector("[data-a11y-close]");
    closeButton?.focus();
  }

  function closePanel(restoreFocus = true) {
    if (!state.panel || state.panel.hidden) {
      return;
    }

    state.panel.hidden = true;

    state.trigger?.setAttribute("aria-expanded", "false");
    state.trigger?.setAttribute("aria-label", "Open accessibility settings");

    if (restoreFocus) {
      const target =
        state.previousFocus && state.previousFocus.isConnected
          ? state.previousFocus
          : state.trigger;

      target?.focus();
    }

    state.previousFocus = null;
  }

  function togglePanel() {
    if (!state.panel || state.panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  }

  function bindEvents() {
    if (state.listenersBound) {
      return;
    }

    state.listenersBound = true;

    document.addEventListener("change", event => {
      const target = event.target;

      if (!(target instanceof window.Element)) {
        return;
      }

      const control = target.closest("[data-a11y-setting]");

      if (!control) {
        return;
      }

      const key = control.dataset.a11ySetting;
      const value = control.type === "checkbox"
        ? control.checked
        : control.value;

      updateSetting(key, value);
    });

    document.addEventListener("click", event => {
      const target = event.target;

      if (!(target instanceof window.Element)) {
        return;
      }

      if (target.closest("[data-a11y-close]")) {
        closePanel();
        return;
      }

      if (target.closest("[data-a11y-reset]")) {
        resetSettings();
        return;
      }

      if (
        state.panel &&
        !state.panel.hidden &&
        !state.panel.contains(target) &&
        !state.trigger?.contains(target)
      ) {
        closePanel(false);
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && state.panel && !state.panel.hidden) {
        event.preventDefault();
        closePanel();
      }
    });

    document.addEventListener("DOMContentLoaded", () => {
      if (document.body) {
        createSkipLink();
      }
    }, { once: true });
  }

  function init(options = {}) {
    if (state.initialized) {
      return api;
    }

    state.settings = {
      ...DEFAULT_SETTINGS,
      ...loadSettings(),
      ...sanitizeSettings(options.settings)
    };

    createStyles();

    if (document.body) {
      createSkipLink();

      if (options.showWidget !== false) {
        createTrigger();
        createPanel();
      }
    }

    applySettings();
    bindEvents();

    state.initialized = true;

    return api;
  }

  const api = Object.freeze({
    init,
    getSettings,
    updateSetting,
    resetSettings,
    applySettings,
    openPanel,
    closePanel,
    togglePanel
  });

  window.MedOrbitsAccessibility = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), {
      once: true
    });
  } else {
    init();
  }
})(window, document);
