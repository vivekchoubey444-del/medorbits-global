
/* =========================================================
   MEDORBITS | CORE APPLICATION
   File: assets/js/app.js
   Version: 1.0.0

   Features:
   - No dependencies or framework requirements
   - CSS-neutral application initialization
   - Duplicate-load protection
   - Responsive navigation toggle support
   - Accessible dropdown and disclosure controls
   - Active navigation link detection
   - Search form integration through existing API client
   - Accessible announcements
   - Dynamic-content support
   - Safe optional module integration
   - Event cleanup and public API

   Recommended loading order:
   1. api-client.js
   2. accessibility.js
   3. admissions.js (where needed)
   4. app.js

   Example:
   <script src="/assets/js/api-client.js" defer></script>
   <script src="/assets/js/accessibility.js" defer></script>
   <script src="/assets/js/app.js" defer></script>

   IMPORTANT:
   This file does not replace authentication, authorization,
   routing, or server-side validation.
   ========================================================= */

(function medOrbitsApp() {
  "use strict";

  const GLOBAL_KEY = "__MEDORBITS_APP_V1__";

  if (window[GLOBAL_KEY]) {
    return;
  }

  const CONFIG = Object.freeze({
    styleId: "medorbits-app-styles",
    liveRegionId: "mo-app-announcements",

    navigationToggle: "[data-mo-nav-toggle]",
    navigationTargetAttribute: "data-mo-nav-target",

    disclosureToggle: "[data-mo-disclosure-toggle]",
    disclosureTargetAttribute: "data-mo-disclosure-target",

    searchForm: "[data-mo-search-form]",
    searchInput: "[data-mo-search-input]",
    searchResults: "[data-mo-search-results]",
    searchEndpoint: "/search",

    mobileBreakpoint: 768,
    announcementDelay: 40
  });

  const state = {
    initialized: false,
    destroyed: false,
    observer: null,
    announcementRegion: null,
    announcementTimer: null,
    injectedStyle: null,
    navigationToggles: new WeakSet(),
    disclosureToggles: new WeakSet(),
    searchForms: new WeakSet(),
    activeSearchController: null,
    searchSequence: 0,
    listeners: []
  };

  /* ---------------------------------------------------------
     1. SAFE DOM HELPERS
     --------------------------------------------------------- */

  function isHTMLElement(value) {
    return value instanceof HTMLElement;
  }

  function getById(id) {
    if (typeof id !== "string" || !id.trim()) {
      return null;
    }

    return document.getElementById(id.replace(/^#/, ""));
  }

  function isDisabled(element) {
    return (
      !isHTMLElement(element) ||
      element.matches(":disabled") ||
      element.getAttribute("aria-disabled") === "true"
    );
  }

  function isVisible(element) {
    if (!isHTMLElement(element)) {
      return false;
    }

    if (element.hidden || element.closest("[hidden], [inert]")) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
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

  function listen(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);

    state.listeners.push(function () {
      target.removeEventListener(eventName, handler, options);
    });
  }

  /* ---------------------------------------------------------
     2. MINIMAL SCOPED STYLES
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
       * Core application utilities only.
       * Existing MedOrbits layout and theme remain in control.
       */

      [data-mo-app-managed-hidden][hidden] {
        display: none !important;
      }

      [data-mo-nav-toggle]:focus-visible,
      [data-mo-disclosure-toggle]:focus-visible,
      [data-mo-search-form] :focus-visible {
        outline: 3px solid #b78b36;
        outline-offset: 3px;
      }

      [data-mo-app-status] {
        overflow-wrap: anywhere;
      }

      @media (forced-colors: active) {
        [data-mo-nav-toggle]:focus-visible,
        [data-mo-disclosure-toggle]:focus-visible,
        [data-mo-search-form] :focus-visible {
          outline: 3px solid Highlight;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);

    state.injectedStyle = style;
  }

  /* ---------------------------------------------------------
     3. ACCESSIBLE ANNOUNCEMENTS
     --------------------------------------------------------- */

  function ensureLiveRegion() {
    if (
      state.announcementRegion &&
      state.announcementRegion.isConnected
    ) {
      return state.announcementRegion;
    }

    let region = document.getElementById(CONFIG.liveRegionId);

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

      (document.body || document.documentElement).appendChild(region);
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

    const region = ensureLiveRegion();

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
     4. RESPONSIVE NAVIGATION
     --------------------------------------------------------- */

  function getNavigationTarget(control) {
    const id = control.getAttribute(
      CONFIG.navigationTargetAttribute
    ) || control.getAttribute("aria-controls");

    return getById(id);
  }

  function setNavigationState(control, target, expanded) {
    if (!isHTMLElement(control) || !isHTMLElement(target)) {
      return false;
    }

    control.setAttribute("aria-expanded", String(Boolean(expanded)));

    target.setAttribute("data-mo-app-managed-hidden", "");
    target.hidden = !expanded;

    return true;
  }

  function initializeNavigationToggle(control) {
    if (
      !isHTMLElement(control) ||
      state.navigationToggles.has(control)
    ) {
      return;
    }

    const target = getNavigationTarget(control);

    if (!target) {
      return;
    }

    state.navigationToggles.add(control);

    if (!control.hasAttribute("aria-controls") && target.id) {
      control.setAttribute("aria-controls", target.id);
    }

    if (!control.hasAttribute("aria-expanded")) {
      control.setAttribute(
        "aria-expanded",
        String(!target.hidden)
      );
    }

    /*
     * Preserve the initial visibility of the target.
     * Do not automatically collapse a desktop navigation menu.
     */
    if (control.getAttribute("aria-expanded") === "false") {
      setNavigationState(control, target, false);
    } else {
      control.setAttribute("aria-expanded", "true");
    }
  }

  function toggleNavigation(control) {
    const target = getNavigationTarget(control);

    if (!target || isDisabled(control)) {
      return;
    }

    const expanded =
      control.getAttribute("aria-expanded") !== "true";

    setNavigationState(control, target, expanded);

    if (!expanded && target.contains(document.activeElement)) {
      safeFocus(control);
    }

    announce(expanded ? "Navigation opened." : "Navigation closed.");
  }

  function closeNavigation(control) {
    const target = getNavigationTarget(control);

    if (
      !target ||
      control.getAttribute("aria-expanded") !== "true"
    ) {
      return;
    }

    setNavigationState(control, target, false);

    if (target.contains(document.activeElement)) {
      safeFocus(control);
    }
  }

  /* ---------------------------------------------------------
     5. ACCESSIBLE DISCLOSURES
     --------------------------------------------------------- */

  function getDisclosureTarget(control) {
    const id = control.getAttribute(
      CONFIG.disclosureTargetAttribute
    ) || control.getAttribute("aria-controls");

    return getById(id);
  }

  function initializeDisclosure(control) {
    if (
      !isHTMLElement(control) ||
      state.disclosureToggles.has(control)
    ) {
      return;
    }

    const target = getDisclosureTarget(control);

    if (!target) {
      return;
    }

    state.disclosureToggles.add(control);

    if (!control.hasAttribute("aria-controls") && target.id) {
      control.setAttribute("aria-controls", target.id);
    }

    if (!control.hasAttribute("aria-expanded")) {
      control.setAttribute(
        "aria-expanded",
        String(!target.hidden)
      );
    }

    target.setAttribute("data-mo-app-managed-hidden", "");
  }

  function toggleDisclosure(control) {
    const target = getDisclosureTarget(control);

    if (!target || isDisabled(control)) {
      return;
    }

    const expanded =
      control.getAttribute("aria-expanded") !== "true";

    control.setAttribute("aria-expanded", String(expanded));
    target.hidden = !expanded;

    if (!expanded && target.contains(document.activeElement)) {
      safeFocus(control);
    }

    announce(
      expanded ? "Section expanded." : "Section collapsed."
    );
  }

  /* ---------------------------------------------------------
     6. ACTIVE NAVIGATION LINKS
     --------------------------------------------------------- */

  function normalizePath(path) {
    if (typeof path !== "string") {
      return "/";
    }

    let normalized = path.split("?")[0].split("#")[0];

    try {
      normalized = decodeURIComponent(normalized);
    } catch (error) {
      // Keep the original path if decoding fails.
    }

    if (!normalized.startsWith("/")) {
      normalized = "/" + normalized;
    }

    if (normalized.length > 1) {
      normalized = normalized.replace(/\/+$/, "");
    }

    return normalized || "/";
  }

  function updateActiveNavigation(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const currentPath = normalizePath(window.location.pathname);

    scope.querySelectorAll(
      "[data-mo-nav-link], nav a[href]"
    ).forEach(function (link) {
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      let url;

      try {
        url = new URL(link.href, window.location.href);
      } catch (error) {
        return;
      }

      if (url.origin !== window.location.origin) {
        return;
      }

      const linkPath = normalizePath(url.pathname);
      const matches =
        linkPath === currentPath ||
        (
          linkPath !== "/" &&
          currentPath.startsWith(linkPath + "/") &&
          link.hasAttribute("data-mo-nav-parent")
        );

      if (matches) {
        link.setAttribute("aria-current", "page");
      } else if (link.getAttribute("aria-current") === "page") {
        link.removeAttribute("aria-current");
      }
    });
  }

  /* ---------------------------------------------------------
     7. SEARCH FORM
     --------------------------------------------------------- */

  function setSearchStatus(form, message, type) {
    let status = form.querySelector("[data-mo-app-status]");

    if (!status) {
      status = document.createElement("div");
      status.setAttribute("data-mo-app-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      form.appendChild(status);
    }

    status.textContent = message;
    status.setAttribute("data-status-type", type || "info");
  }

  function clearSearchResults(container) {
    if (container) {
      container.replaceChildren();
    }
  }

  function renderSearchResults(container, results) {
    if (!container) {
      return;
    }

    clearSearchResults(container);

    if (!Array.isArray(results) || results.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No results found.";
      container.appendChild(empty);
      return;
    }

    const list = document.createElement("ul");

    results.forEach(function (item) {
      if (!item || typeof item !== "object") {
        return;
      }

      const title = typeof item.title === "string"
        ? item.title
        : typeof item.name === "string"
          ? item.name
          : "";

      if (!title) {
        return;
      }

      const listItem = document.createElement("li");
      const link = document.createElement("a");

      link.textContent = title;

      const href = typeof item.url === "string"
        ? item.url
        : typeof item.href === "string"
          ? item.href
          : "";

      if (href) {
        try {
          const url = new URL(href, window.location.href);

          if (
            ["http:", "https:"].includes(url.protocol) &&
            (
              url.origin === window.location.origin ||
              item.allowExternal === true
            )
          ) {
            link.href = url.href;
          } else {
            link.removeAttribute("href");
          }
        } catch (error) {
          link.removeAttribute("href");
        }
      } else {
        link.removeAttribute("href");
      }

      listItem.appendChild(link);

      if (typeof item.description === "string") {
        const description = document.createElement("p");
        description.textContent = item.description;
        listItem.appendChild(description);
      }

      list.appendChild(listItem);
    });

    container.appendChild(list);
  }

  async function handleSearchSubmit(form, event) {
    const input = form.querySelector(CONFIG.searchInput);

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const query = input.value.trim();

    if (!query) {
      event.preventDefault();
      setSearchStatus(form, "Enter a search term.", "error");
      safeFocus(input);
      return;
    }

    /*
     * Native search is the default.
     * AJAX search activates only when data-mo-search-api="true".
     */
    if (form.getAttribute("data-mo-search-api") !== "true") {
      return;
    }

    event.preventDefault();

    const api = window.MedOrbitsAPI;

    if (!api || typeof api.get !== "function") {
      setSearchStatus(
        form,
        "Search is temporarily unavailable. Please try again later.",
        "error"
      );
      return;
    }

    if (state.activeSearchController) {
      state.activeSearchController.abort();
    }

    const controller = new AbortController();
    state.activeSearchController = controller;

    const sequence = ++state.searchSequence;
    const resultsContainer = document.querySelector(
      form.getAttribute("data-mo-search-results") ||
      CONFIG.searchResults
    );

    setSearchStatus(form, "Searching…", "pending");

    try {
      const response = await api.get(
        form.getAttribute("data-mo-search-endpoint") ||
        CONFIG.searchEndpoint,
        {
          query: { q: query },
          signal: controller.signal
        }
      );

      if (sequence !== state.searchSequence) {
        return;
      }

      const payload = response && response.data;
      const results = Array.isArray(payload)
        ? payload
        : payload && Array.isArray(payload.results)
          ? payload.results
          : [];

      renderSearchResults(resultsContainer, results);

      setSearchStatus(
        form,
        results.length
          ? results.length + " result(s) found."
          : "No results found.",
        "success"
      );

      announce(
        results.length
          ? results.length + " search results found."
          : "No search results found."
      );
    } catch (error) {
      if (error && error.code === "REQUEST_ABORTED") {
        return;
      }

      if (sequence !== state.searchSequence) {
        return;
      }

      setSearchStatus(
        form,
        "Search failed. Please try again.",
        "error"
      );

      announce("Search failed. Please try again.");
    } finally {
      if (sequence === state.searchSequence) {
        state.activeSearchController = null;
      }
    }
  }

  function initializeSearchForm(form) {
    if (
      !(form instanceof HTMLFormElement) ||
      form.dataset.moAppSearchReady === "true"
    ) {
      return;
    }

    form.dataset.moAppSearchReady = "true";

    form.addEventListener("submit", function (event) {
      handleSearchSubmit(form, event);
    });
  }

  /* ---------------------------------------------------------
     8. EVENT DELEGATION
     --------------------------------------------------------- */

  function handleClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const navControl = event.target.closest(
      CONFIG.navigationToggle
    );

    if (navControl instanceof HTMLElement) {
      toggleNavigation(navControl);
      return;
    }

    const disclosureControl = event.target.closest(
      CONFIG.disclosureToggle
    );

    if (disclosureControl instanceof HTMLElement) {
      toggleDisclosure(disclosureControl);
    }
  }

  function handleKeydown(event) {
    if (event.defaultPrevented || event.key !== "Escape") {
      return;
    }

    const expandedNavs = document.querySelectorAll(
      CONFIG.navigationToggle + '[aria-expanded="true"]'
    );

    for (const control of expandedNavs) {
      const target = getNavigationTarget(control);

      if (
        target &&
        target.contains(document.activeElement)
      ) {
        closeNavigation(control);
        return;
      }
    }

    const expandedDisclosures = document.querySelectorAll(
      CONFIG.disclosureToggle + '[aria-expanded="true"]'
    );

    for (const control of expandedDisclosures) {
      const target = getDisclosureTarget(control);

      if (
        target &&
        target.contains(document.activeElement)
      ) {
        control.setAttribute("aria-expanded", "false");
        target.hidden = true;
        safeFocus(control);
        announce("Section collapsed.");
        return;
      }
    }
  }

  /* ---------------------------------------------------------
     9. DYNAMIC CONTENT
     --------------------------------------------------------- */

  function initializeWithin(root) {
    if (!root || !root.querySelectorAll) {
      return;
    }

    if (
      isHTMLElement(root) &&
      root.matches(CONFIG.navigationToggle)
    ) {
      initializeNavigationToggle(root);
    }

    if (
      isHTMLElement(root) &&
      root.matches(CONFIG.disclosureToggle)
    ) {
      initializeDisclosure(root);
    }

    if (
      root instanceof HTMLFormElement &&
      root.matches(CONFIG.searchForm)
    ) {
      initializeSearchForm(root);
    }

    root.querySelectorAll(CONFIG.navigationToggle)
      .forEach(initializeNavigationToggle);

    root.querySelectorAll(CONFIG.disclosureToggle)
      .forEach(initializeDisclosure);

    root.querySelectorAll(CONFIG.searchForm)
      .forEach(initializeSearchForm);

    updateActiveNavigation(root);
  }

  function observeDynamicContent() {
    if (typeof MutationObserver !== "function") {
      return;
    }

    state.observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node instanceof HTMLElement) {
            initializeWithin(node);
          }
        });
      });
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /* ---------------------------------------------------------
     10. INITIALIZATION
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
    ensureLiveRegion();
    initializeWithin(document);

    listen(document, "click", handleClick);
    listen(document, "keydown", handleKeydown);

    observeDynamicContent();

    document.documentElement.setAttribute(
      "data-mo-app",
      "ready"
    );
  }

  /* ---------------------------------------------------------
     11. PUBLIC API AND CLEANUP
     --------------------------------------------------------- */

  function destroy() {
    if (state.destroyed) {
      return;
    }

    state.listeners.forEach(function (removeListener) {
      removeListener();
    });

    state.listeners.length = 0;

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.activeSearchController) {
      state.activeSearchController.abort();
      state.activeSearchController = null;
    }

    if (state.announcementTimer !== null) {
      window.clearTimeout(state.announcementTimer);
      state.announcementTimer = null;
    }

    if (state.injectedStyle) {
      state.injectedStyle.remove();
    }

    if (
      state.announcementRegion &&
      state.announcementRegion.id === CONFIG.liveRegionId
    ) {
      state.announcementRegion.remove();
    }

    document.documentElement.removeAttribute("data-mo-app");

    state.destroyed = true;
  }

  const api = Object.freeze({
    announce: announce,

    refresh: function () {
      initializeWithin(document);
    },

    updateActiveNavigation: function () {
      updateActiveNavigation(document);
    },

    destroy: destroy
  });

  window.MedOrbitsApp = api;
  window[GLOBAL_KEY] = api;

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
