
/* =========================================================
   MEDORBITS | ACCESSIBILITY ENHANCEMENT LAYER
   File: assets/js/accessibility.js
   Version: 2.0.0

   Features:
   - CSS-safe, dependency-free initialization
   - Keyboard-visible focus indicators
   - Skip-to-main-content navigation
   - Accessible, opt-in disclosure controls
   - System-aware and manually configurable reduced motion
   - Optional text scaling through a CSS custom property
   - Optional enhanced focus indicators
   - Live announcements for assistive technologies
   - Dynamic-content support
   - Duplicate-load protection
   - Public API for application integration

   Load once, preferably with defer:
   <script src="/assets/js/accessibility.js" defer></script>

   IMPORTANT:
   This script does not impose widths, heights, grids, flex layouts,
   page backgrounds, or fixed positioning on existing components.
   ========================================================= */

(function medOrbitsAccessibility() {
  "use strict";

  const GLOBAL_KEY = "__MEDORBITS_ACCESSIBILITY_V2__";

  if (window[GLOBAL_KEY]) {
    return;
  }

  const CONFIG = Object.freeze({
    mainSelectors: [
      "main",
      '[role="main"]',
      "#main-content",
      "#main",
      "#content"
    ],

    skipLinkText: "Skip to main content",
    skipLinkClass: "mo-a11y-skip-link",
    focusClass: "mo-a11y-focus",
    managedHiddenClass: "mo-a11y-managed-hidden",
    styleId: "medorbits-accessibility-styles",
    liveRegionId: "mo-a11y-announcements",

    motionAttribute: "data-mo-reduced-motion",
    motionActiveAttribute: "data-mo-motion-active",
    contrastAttribute: "data-mo-high-contrast",
    textScaleAttribute: "data-mo-text-scale",

    defaultTextScale: 1,
    minimumTextScale: 1,
    maximumTextScale: 1.25,
    textScaleStep: 0.05,

    announcementDelay: 40
  });

  const state = {
    initialized: false,
    destroyed: false,
    observer: null,
    mediaQuery: null,
    announcementTimer: null,
    announcementRegion: null,
    skipLink: null,
    injectedStyle: null,
    motionPreferenceHandler: null
  };

  /* ---------------------------------------------------------
     1. SAFE DOM HELPERS
     --------------------------------------------------------- */

  function isHTMLElement(value) {
    return value instanceof HTMLElement;
  }

  function getRoot() {
    return document.documentElement;
  }

  function getMainContent() {
    for (const selector of CONFIG.mainSelectors) {
      try {
        const element = document.querySelector(selector);

        if (isHTMLElement(element)) {
          return element;
        }
      } catch (error) {
        // Ignore invalid selectors without interrupting the page.
      }
    }

    return null;
  }

  function isVisible(element) {
    if (!isHTMLElement(element)) {
      return false;
    }

    if (
      element.hidden ||
      element.closest("[hidden], [inert]")
    ) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.visibility !== "collapse" &&
      element.getClientRects().length > 0
    );
  }

  function safeFocus(element) {
    if (!isHTMLElement(element) || !isVisible(element)) {
      return false;
    }

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      try {
        element.focus();
      } catch (fallbackError) {
        return false;
      }
    }

    return document.activeElement === element;
  }

  function getControlTarget(control) {
    if (!isHTMLElement(control)) {
      return null;
    }

    const targetId =
      control.getAttribute("data-a11y-toggle") ||
      control.getAttribute("aria-controls");

    if (!targetId) {
      return null;
    }

    // Accept an ID, optionally prefixed with "#".
    return document.getElementById(
      targetId.replace(/^#/, "")
    );
  }

  function isDisabled(control) {
    return (
      !isHTMLElement(control) ||
      control.matches(":disabled") ||
      control.getAttribute("aria-disabled") === "true"
    );
  }

  /* ---------------------------------------------------------
     2. SCOPED ACCESSIBILITY STYLES
     --------------------------------------------------------- */

  function installStyles() {
    const existing = document.getElementById(CONFIG.styleId);

    if (existing) {
      state.injectedStyle = existing;
      return;
    }

    const style = document.createElement("style");

    style.id = CONFIG.styleId;

    style.textContent = `
      /*
       * These rules are limited to accessibility utilities.
       * They do not define the site's grids, widths, heights,
       * flex containers, page colors, or typography.
       */

      .${CONFIG.skipLinkClass} {
        position: fixed;
        top: 12px;
        left: 12px;
        z-index: 2147483000;
        display: block;
        width: auto;
        max-width: calc(100vw - 24px);
        padding: 12px 16px;
        border: 2px solid currentColor;
        border-radius: 8px;
        background: #162d25;
        color: #ffffff;
        font: inherit;
        font-weight: 600;
        line-height: 1.5;
        text-decoration: none;
        overflow-wrap: anywhere;
        transform: translateY(calc(-100% - 24px));
        transition: transform 120ms ease;
      }

      .${CONFIG.skipLinkClass}:focus {
        transform: translateY(0);
        outline: 3px solid #d8b56d;
        outline-offset: 3px;
      }

      .${CONFIG.focusClass}:focus-visible {
        outline: 3px solid #b78b36;
        outline-offset: 3px;
      }

      .${CONFIG.managedHiddenClass}[hidden] {
        display: none !important;
      }

      html[${CONFIG.contrastAttribute}="true"]
        :focus-visible {
        outline: 3px solid currentColor;
        outline-offset: 3px;
      }

      /*
       * Reduced motion is activated only when the user or
       * operating system requests it. Existing layout rules
       * remain untouched.
       */
      html[${CONFIG.motionActiveAttribute}="true"],
      html[${CONFIG.motionActiveAttribute}="true"] *,
      html[${CONFIG.motionActiveAttribute}="true"] *::before,
      html[${CONFIG.motionActiveAttribute}="true"] *::after {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        transition-delay: 0ms !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .${CONFIG.skipLinkClass} {
          transition: none;
        }
      }

      @media (forced-colors: active) {
        .${CONFIG.skipLinkClass} {
          border: 2px solid ButtonText;
          background: Canvas;
          color: CanvasText;
        }

        .${CONFIG.focusClass}:focus-visible {
          outline: 3px solid Highlight;
        }
      }
    `;

    (document.head || document.documentElement)
      .appendChild(style);

    state.injectedStyle = style;
  }

  /* ---------------------------------------------------------
     3. SKIP-TO-CONTENT NAVIGATION
     --------------------------------------------------------- */

  function ensureMainTarget() {
    const main = getMainContent();

    if (!main) {
      return null;
    }

    if (!main.id) {
      main.id = "mo-main-content";
    }

    // Preserve existing author-defined keyboard behavior.
    if (!main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
    }

    return main;
  }

  function handleSkipLinkClick(event) {
    const link = event.currentTarget;
    const main = ensureMainTarget();

    if (!main) {
      // Preserve normal anchor behavior if no main target exists.
      return;
    }

    event.preventDefault();

    link.href = "#" + main.id;

    safeFocus(main);

    try {
      if (window.location.hash !== "#" + main.id) {
        window.history.replaceState(
          null,
          "",
          "#" + main.id
        );
      }
    } catch (error) {
      // Focusing the main content remains the primary action.
    }
  }

  function createSkipLink() {
    const existing = document.querySelector(
      "." + CONFIG.skipLinkClass + ", [data-mo-skip-link]"
    );

    if (existing) {
      state.skipLink = existing;

      // Attach behavior only if this instance created the link.
      if (existing.hasAttribute("data-mo-skip-link-created")) {
        existing.addEventListener(
          "click",
          handleSkipLinkClick
        );
      }

      return existing;
    }

    const main = ensureMainTarget();

    if (!main || !document.body) {
      return null;
    }

    const link = document.createElement("a");

    link.className = CONFIG.skipLinkClass;
    link.href = "#" + main.id;
    link.textContent = CONFIG.skipLinkText;
    link.setAttribute("data-mo-skip-link", "");
    link.setAttribute("data-mo-skip-link-created", "");

    link.addEventListener("click", handleSkipLinkClick);

    document.body.prepend(link);

    state.skipLink = link;

    return link;
  }

  /* ---------------------------------------------------------
     4. SCREEN-READER ANNOUNCEMENTS
     --------------------------------------------------------- */

  function ensureAnnouncementRegion() {
    if (
      state.announcementRegion &&
      state.announcementRegion.isConnected
    ) {
      return state.announcementRegion;
    }

    let region = document.getElementById(
      CONFIG.liveRegionId
    );

    if (!region) {
      region = document.createElement("div");

      region.id = CONFIG.liveRegionId;
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");

      Object.assign(region.style, {
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: "0",
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: "0"
      });

      (document.body || document.documentElement)
        .appendChild(region);
    }

    state.announcementRegion = region;

    return region;
  }

  function announce(message) {
    if (
      typeof message !== "string" ||
      !message.trim() ||
      state.destroyed
    ) {
      return;
    }

    const region = ensureAnnouncementRegion();

    if (!region) {
      return;
    }

    region.textContent = "";

    if (state.announcementTimer !== null) {
      window.clearTimeout(state.announcementTimer);
    }

    state.announcementTimer = window.setTimeout(function () {
      region.textContent = message.trim();
      state.announcementTimer = null;
    }, CONFIG.announcementDelay);
  }

  /* ---------------------------------------------------------
     5. REDUCED-MOTION PREFERENCE
     --------------------------------------------------------- */

  function systemRequestsReducedMotion() {
    return Boolean(
      state.mediaQuery &&
      state.mediaQuery.matches
    );
  }

  function applyMotionPreference() {
    const root = getRoot();

    if (!root) {
      return;
    }

    const explicitSetting = root.getAttribute(
      CONFIG.motionAttribute
    );

    const reduceMotion =
      explicitSetting === "true" ||
      (
        explicitSetting !== "false" &&
        systemRequestsReducedMotion()
      );

    if (reduceMotion) {
      root.setAttribute(
        CONFIG.motionActiveAttribute,
        "true"
      );
    } else {
      root.removeAttribute(
        CONFIG.motionActiveAttribute
      );
    }
  }

  function setReducedMotion(enabled) {
    getRoot().setAttribute(
      CONFIG.motionAttribute,
      String(Boolean(enabled))
    );

    applyMotionPreference();

    announce(
      enabled
        ? "Reduced motion enabled."
        : "Reduced motion disabled."
    );
  }

  function useSystemMotionPreference() {
    getRoot().removeAttribute(CONFIG.motionAttribute);
    applyMotionPreference();

    announce("System motion preference restored.");
  }

  function initializeMotionPreference() {
    if (typeof window.matchMedia === "function") {
      state.mediaQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

      state.motionPreferenceHandler = applyMotionPreference;

      if (
        typeof state.mediaQuery.addEventListener === "function"
      ) {
        state.mediaQuery.addEventListener(
          "change",
          state.motionPreferenceHandler
        );
      } else if (
        typeof state.mediaQuery.addListener === "function"
      ) {
        state.mediaQuery.addListener(
          state.motionPreferenceHandler
        );
      }
    }

    applyMotionPreference();
  }

  /* ---------------------------------------------------------
     6. OPTIONAL TEXT SCALING
     --------------------------------------------------------- */

  function readTextScale() {
    const raw = getRoot().getAttribute(
      CONFIG.textScaleAttribute
    );

    if (raw === null || raw.trim() === "") {
      return CONFIG.defaultTextScale;
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
      return CONFIG.defaultTextScale;
    }

    return Math.min(
      CONFIG.maximumTextScale,
      Math.max(CONFIG.minimumTextScale, value)
    );
  }

  function setTextScale(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    const scale = Math.round(
      Math.min(
        CONFIG.maximumTextScale,
        Math.max(CONFIG.minimumTextScale, numericValue)
      ) * 100
    ) / 100;

    const root = getRoot();

    root.setAttribute(
      CONFIG.textScaleAttribute,
      String(scale)
    );

    root.style.setProperty(
      "--mo-a11y-text-scale",
      String(scale)
    );

    announce(
      scale === CONFIG.defaultTextScale
        ? "Default text scale restored."
        : "Text scale setting updated."
    );
  }

  function resetTextScale() {
    getRoot().removeAttribute(CONFIG.textScaleAttribute);
    getRoot().style.removeProperty("--mo-a11y-text-scale");

    announce("Default text scale restored.");
  }

  /* ---------------------------------------------------------
     7. FOCUS-INDICATOR EMPHASIS
     --------------------------------------------------------- */

  function setHighContrast(enabled) {
    getRoot().setAttribute(
      CONFIG.contrastAttribute,
      String(Boolean(enabled))
    );

    announce(
      enabled
        ? "Enhanced focus indicators enabled."
        : "Enhanced focus indicators disabled."
    );
  }

  /* ---------------------------------------------------------
     8. OPT-IN DISCLOSURES
     --------------------------------------------------------- */

  function setDisclosureState(control, target, expanded) {
    if (
      !isHTMLElement(control) ||
      !isHTMLElement(target)
    ) {
      return false;
    }

    control.setAttribute(
      "aria-expanded",
      String(Boolean(expanded))
    );

    target.classList.add(CONFIG.managedHiddenClass);
    target.hidden = !expanded;

    return true;
  }

  function toggleDisclosure(control) {
    const target = getControlTarget(control);

    if (!target || isDisabled(control)) {
      return;
    }

    const expanded =
      control.getAttribute("aria-expanded") !== "true";

    setDisclosureState(control, target, expanded);

    if (
      !expanded &&
      target.contains(document.activeElement)
    ) {
      safeFocus(control);
    }

    announce(
      expanded
        ? "Content expanded."
        : "Content collapsed."
    );
  }

  function closeDisclosure(control) {
    const target = getControlTarget(control);

    if (
      !target ||
      control.getAttribute("aria-expanded") !== "true"
    ) {
      return false;
    }

    setDisclosureState(control, target, false);

    if (target.contains(document.activeElement)) {
      safeFocus(control);
    }

    return true;
  }

  function initializeToggle(control) {
    if (!isHTMLElement(control)) {
      return;
    }

    const target = getControlTarget(control);

    if (!target) {
      return;
    }

    if (!control.hasAttribute("aria-controls") && target.id) {
      control.setAttribute("aria-controls", target.id);
    }

    if (!control.hasAttribute("aria-expanded")) {
      control.setAttribute(
        "aria-expanded",
        String(!target.hidden)
      );
    }

    // Respect the initial aria-expanded value when provided.
    const expanded =
      control.getAttribute("aria-expanded") === "true";

    setDisclosureState(control, target, expanded);
  }

  function initializeTogglesWithin(scope) {
    if (!scope || !scope.querySelectorAll) {
      return;
    }

    if (
      isHTMLElement(scope) &&
      scope.matches("[data-a11y-toggle]")
    ) {
      initializeToggle(scope);
    }

    scope.querySelectorAll("[data-a11y-toggle]")
      .forEach(initializeToggle);
  }

  /* ---------------------------------------------------------
     9. ACCESSIBILITY ACTION CONTROLS
     --------------------------------------------------------- */

  function handleAccessibilityAction(control) {
    const action = control.getAttribute(
      "data-accessibility-action"
    );

    if (!action || isDisabled(control)) {
      return false;
    }

    switch (action) {
      case "reduce-motion":
        setReducedMotion(true);
        return true;

      case "allow-motion":
        setReducedMotion(false);
        return true;

      case "use-system-motion":
        useSystemMotionPreference();
        return true;

      case "toggle-motion": {
        const currentlyReduced =
          getRoot().getAttribute(CONFIG.motionAttribute) === "true";

        setReducedMotion(!currentlyReduced);
        return true;
      }

      case "increase-text":
        setTextScale(
          readTextScale() + CONFIG.textScaleStep
        );
        return true;

      case "decrease-text":
        setTextScale(
          readTextScale() - CONFIG.textScaleStep
        );
        return true;

      case "reset-text":
        resetTextScale();
        return true;

      case "toggle-contrast": {
        const enabled =
          getRoot().getAttribute(CONFIG.contrastAttribute) === "true";

        setHighContrast(!enabled);
        return true;
      }

      case "reset-all":
        resetAccessibilitySettings();
        return true;

      default:
        return false;
    }
  }

  function resetAccessibilitySettings() {
    const root = getRoot();

    root.removeAttribute(CONFIG.motionAttribute);
    root.removeAttribute(CONFIG.contrastAttribute);
    root.removeAttribute(CONFIG.textScaleAttribute);
    root.style.removeProperty("--mo-a11y-text-scale");

    applyMotionPreference();

    announce("Accessibility settings reset.");
  }

  /* ---------------------------------------------------------
     10. EVENT HANDLERS
     --------------------------------------------------------- */

  function handleClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const actionControl = event.target.closest(
      "[data-accessibility-action]"
    );

    if (
      actionControl instanceof HTMLElement &&
      handleAccessibilityAction(actionControl)
    ) {
      return;
    }

    const toggleControl = event.target.closest(
      "[data-a11y-toggle]"
    );

    if (
      toggleControl instanceof HTMLElement &&
      !isDisabled(toggleControl)
    ) {
      toggleDisclosure(toggleControl);
    }
  }

  function handleKeydown(event) {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.key !== "Escape"
    ) {
      return;
    }

    const active = document.activeElement;

    const controls = document.querySelectorAll(
      '[data-a11y-toggle][aria-expanded="true"]'
    );

    // Close only the disclosure containing the current focus.
    for (const control of controls) {
      const target = getControlTarget(control);

      if (
        target &&
        active instanceof Node &&
        target.contains(active)
      ) {
        if (closeDisclosure(control)) {
          event.stopPropagation();
        }

        return;
      }
    }
  }

  /* ---------------------------------------------------------
     11. KEYBOARD FOCUS ENHANCEMENT
     --------------------------------------------------------- */

  function enhanceFocusTarget(element) {
    if (!isHTMLElement(element)) {
      return;
    }

    if (
      element.matches(
        "a, button, input, select, textarea, " +
        "[tabindex], summary, [contenteditable='true']"
      )
    ) {
      element.classList.add(CONFIG.focusClass);
    }
  }

  function enhanceFocusTargets(scope) {
    if (!scope || !scope.querySelectorAll) {
      return;
    }

    if (isHTMLElement(scope)) {
      enhanceFocusTarget(scope);
    }

    scope.querySelectorAll(
      "a, button, input, select, textarea, " +
      "[tabindex], summary, [contenteditable='true']"
    ).forEach(enhanceFocusTarget);
  }

  /* ---------------------------------------------------------
     12. DYNAMIC CONTENT
     --------------------------------------------------------- */

  function observeDynamicContent() {
    if (typeof MutationObserver !== "function") {
      return;
    }

    state.observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            enhanceFocusTargets(node);
            initializeTogglesWithin(node);
          }
        }
      }
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /* ---------------------------------------------------------
     13. INITIALIZATION
     --------------------------------------------------------- */

  function initialize() {
    if (
      state.initialized ||
      state.destroyed ||
      !document.documentElement
    ) {
      return;
    }

    state.initialized = true;

    installStyles();
    ensureMainTarget();
    createSkipLink();
    ensureAnnouncementRegion();

    initializeMotionPreference();
    initializeTogglesWithin(document);
    enhanceFocusTargets(document);
    observeDynamicContent();

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);

    getRoot().setAttribute(
      "data-mo-accessibility",
      "ready"
    );
  }

  /* ---------------------------------------------------------
     14. CLEANUP AND PUBLIC API
     --------------------------------------------------------- */

  function destroy() {
    if (state.destroyed) {
      return;
    }

    document.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeydown);

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (
      state.mediaQuery &&
      state.motionPreferenceHandler
    ) {
      if (
        typeof state.mediaQuery.removeEventListener === "function"
      ) {
        state.mediaQuery.removeEventListener(
          "change",
          state.motionPreferenceHandler
        );
      } else if (
        typeof state.mediaQuery.removeListener === "function"
      ) {
        state.mediaQuery.removeListener(
          state.motionPreferenceHandler
        );
      }
    }

    if (state.announcementTimer !== null) {
      window.clearTimeout(state.announcementTimer);
      state.announcementTimer = null;
    }

    if (
      state.skipLink &&
      state.skipLink.hasAttribute("data-mo-skip-link-created")
    ) {
      state.skipLink.removeEventListener(
        "click",
        handleSkipLinkClick
      );
      state.skipLink.remove();
    }

    if (state.injectedStyle) {
      state.injectedStyle.remove();
    }

    const region = document.getElementById(
      CONFIG.liveRegionId
    );

    if (region && region === state.announcementRegion) {
      region.remove();
    }

    getRoot().removeAttribute("data-mo-accessibility");
    getRoot().removeAttribute(CONFIG.motionActiveAttribute);

    state.destroyed = true;
  }

  window.MedOrbitsAccessibility = Object.freeze({
    announce: announce,
    setReducedMotion: setReducedMotion,
    useSystemMotionPreference: useSystemMotionPreference,
    setHighContrast: setHighContrast,
    setTextScale: setTextScale,
    resetTextScale: resetTextScale,
    reset: resetAccessibilitySettings,

    refresh: function () {
      ensureMainTarget();
      initializeTogglesWithin(document);
      enhanceFocusTargets(document);
    },

    destroy: destroy
  });

  window[GLOBAL_KEY] = true;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
