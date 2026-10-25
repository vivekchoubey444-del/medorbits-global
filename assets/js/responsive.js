
/*!
 * MedOrbits | Responsive Page Enhancements
 * File: assets/js/responsive.js
 * Version: 2.0.0
 *
 * Purpose:
 * - Work alongside existing MedOrbits CSS without overriding its design
 * - Improve mobile, tablet, laptop and desktop compatibility
 * - Detect horizontal page overflow
 * - Make wide tables scrollable on small screens
 * - Enhance mobile navigation and accessible disclosures
 * - Keep responsive state synchronized with viewport changes
 * - Support dynamically inserted page content
 * - Respect reduced-motion and coarse-pointer preferences
 * - Avoid external dependencies and destructive DOM changes
 *
 * Optional attributes:
 * data-mo-responsive
 * data-mo-mobile-menu
 * data-mo-menu-toggle
 * data-mo-menu-close
 * data-mo-table-scroll
 * data-mo-overflow-check
 * data-mo-responsive-status
 */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsResponsive) return;

  const CONFIG = {
    breakpoints: {
      mobile: 576,
      tablet: 768,
      desktop: 1024,
      wide: 1440
    },

    selectors: {
      menu: "[data-mo-mobile-menu]",
      menuToggle: "[data-mo-menu-toggle]",
      menuClose: "[data-mo-menu-close]",
      table: "[data-mo-table-scroll] table, table[data-mo-table-scroll]",
      overflowCheck: "[data-mo-overflow-check]",
      responsiveRoot: "[data-mo-responsive]"
    },

    overflowTolerance: 2,
    resizeDebounce: 120
  };

  const state = {
    initialized: false,
    observer: null,
    resizeTimer: null,
    resizeHandler: null,
    mutationHandler: null,
    mediaQueries: {},
    listeners: [],
    menuRecords: new Map(),
    tableRecords: new Map(),
    originalAttributes: new WeakMap(),
    originalStyles: new WeakMap(),
    generatedElements: new Set(),
    pageOverflow: false,
    currentBreakpoint: null
  };

  /* -------------------------------------------------------
     Utilities
  ------------------------------------------------------- */

  function listen(element, event, handler, options) {
    if (!element || !element.addEventListener) return;

    element.addEventListener(event, handler, options);

    state.listeners.push(function () {
      element.removeEventListener(event, handler, options);
    });
  }

  function queryAll(root, selector) {
    if (!root || !root.querySelectorAll) return [];

    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function matches(element, selector) {
    try {
      return Boolean(element && element.matches && element.matches(selector));
    } catch (_) {
      return false;
    }
  }

  function rememberAttribute(element, name) {
    if (!element || !element.getAttribute) return;

    let attributes = state.originalAttributes.get(element);

    if (!attributes) {
      attributes = new Map();
      state.originalAttributes.set(element, attributes);
    }

    if (!attributes.has(name)) {
      attributes.set(name, {
        existed: element.hasAttribute(name),
        value: element.getAttribute(name)
      });
    }
  }

  function restoreAttribute(element, name) {
    const attributes = state.originalAttributes.get(element);
    if (!attributes || !attributes.has(name)) return;

    const original = attributes.get(name);

    if (original.existed) {
      element.setAttribute(name, original.value);
    } else {
      element.removeAttribute(name);
    }

    attributes.delete(name);
  }

  function rememberStyle(element, property) {
    if (!element || !element.style) return;

    let styles = state.originalStyles.get(element);

    if (!styles) {
      styles = new Map();
      state.originalStyles.set(element, styles);
    }

    if (!styles.has(property)) {
      styles.set(property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      });
    }
  }

  function restoreStyle(element, property) {
    const styles = state.originalStyles.get(element);
    if (!styles || !styles.has(property)) return;

    const original = styles.get(property);

    if (original.value) {
      element.style.setProperty(
        property,
        original.value,
        original.priority
      );
    } else {
      element.style.removeProperty(property);
    }

    styles.delete(property);
  }

  function emit(name, detail) {
    document.dispatchEvent(
      new CustomEvent(name, {
        detail: detail || {}
      })
    );
  }

  function getViewportWidth() {
    return Math.max(
      document.documentElement.clientWidth || 0,
      0
    );
  }

  function getBreakpoint(width) {
    const points = CONFIG.breakpoints;

    if (width < points.mobile) return "mobile";
    if (width < points.tablet) return "small-tablet";
    if (width < points.desktop) return "tablet";
    if (width < points.wide) return "desktop";

    return "wide";
  }

  function isReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isCoarsePointer() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches
    );
  }

  function setRootClass(className, enabled) {
    if (!document.documentElement) return;

    document.documentElement.classList.toggle(className, Boolean(enabled));
  }

  /* -------------------------------------------------------
     Responsive CSS helpers
  ------------------------------------------------------- */

  function injectStyles() {
    if (document.getElementById("mo-responsive-styles")) return;

    const style = document.createElement("style");
    style.id = "mo-responsive-styles";

    style.textContent = `
      /*
       * MedOrbits responsive helpers.
       * Existing project styles remain authoritative.
       */

      .mo-responsive-table-wrap {
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-inline: contain;
      }

      .mo-responsive-table-wrap:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 3px;
      }

      .mo-responsive-table-wrap > table {
        max-width: 100%;
      }

      .mo-responsive-menu-open {
        overflow: hidden;
      }

      [data-mo-menu-toggle] {
        touch-action: manipulation;
      }

      [data-mo-responsive-status][hidden] {
        display: none !important;
      }

      @media (max-width: 767px) {
        img, video, canvas, svg, iframe {
          max-width: 100%;
        }

        pre {
          max-width: 100%;
          overflow-x: auto;
          overscroll-behavior-inline: contain;
        }

        input, select, textarea, button {
          max-width: 100%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        html:focus-within {
          scroll-behavior: auto !important;
        }

        [data-mo-responsive],
        [data-mo-mobile-menu],
        .mo-responsive-table-wrap {
          scroll-behavior: auto !important;
        }
      }
    `;

    document.head.appendChild(style);
    state.generatedElements.add(style);
  }

  /* -------------------------------------------------------
     Viewport metadata
  ------------------------------------------------------- */

  function ensureViewportMeta() {
    let meta = document.querySelector('meta[name="viewport"]');

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1";
      document.head.appendChild(meta);
      state.generatedElements.add(meta);
    }

    /*
     * Do not overwrite an existing viewport declaration.
     * Sites may intentionally configure viewport scaling.
     */
  }

  /* -------------------------------------------------------
     Responsive page state
  ------------------------------------------------------- */

  function updateResponsiveState() {
    const width = getViewportWidth();
    const breakpoint = getBreakpoint(width);

    const previous = state.currentBreakpoint;

    state.currentBreakpoint = breakpoint;

    setRootClass("mo-screen-mobile", width < CONFIG.breakpoints.mobile);
    setRootClass(
      "mo-screen-tablet",
      width >= CONFIG.breakpoints.mobile &&
      width < CONFIG.breakpoints.desktop
    );
    setRootClass(
      "mo-screen-desktop",
      width >= CONFIG.breakpoints.desktop
    );
    setRootClass("mo-reduced-motion", isReducedMotion());
    setRootClass("mo-coarse-pointer", isCoarsePointer());

    document.documentElement.dataset.moBreakpoint = breakpoint;
    document.documentElement.dataset.moViewportWidth = String(width);

    if (previous !== breakpoint) {
      emit("medorbits:breakpointchange", {
        previous: previous,
        current: breakpoint,
        width: width
      });
    }

    emit("medorbits:responsivechange", {
      breakpoint: breakpoint,
      width: width,
      height: window.innerHeight || 0,
      reducedMotion: isReducedMotion(),
      coarsePointer: isCoarsePointer()
    });
  }

  /* -------------------------------------------------------
     Mobile navigation
  ------------------------------------------------------- */

  function resolveMenu(toggle) {
    const targetId = toggle.getAttribute("aria-controls") ||
      toggle.getAttribute("data-target");

    if (targetId) {
      const id = targetId.replace(/^#/, "");
      const target = document.getElementById(id);

      if (target) return target;
    }

    const wrapper = toggle.closest(
      "[data-mo-navigation], .site-header, header, nav"
    );

    if (wrapper) {
      const menu = wrapper.querySelector(CONFIG.selectors.menu);
      if (menu) return menu;

      const nav = wrapper.querySelector(
        ".nav-menu, .navigation-menu, .main-nav, .navbar-collapse"
      );

      if (nav) return nav;
    }

    return null;
  }

  function setMenuOpen(menu, toggle, open, options) {
    const opts = options || {};

    if (!menu) return;

    const record = state.menuRecords.get(menu) || {
      hidden: menu.hidden,
      ariaHidden: menu.getAttribute("aria-hidden"),
      toggle: toggle || null
    };

    if (toggle) record.toggle = toggle;

    state.menuRecords.set(menu, record);

    if (open) {
      menu.hidden = false;
      menu.classList.add("mo-menu-open");
      menu.setAttribute("data-mo-menu-state", "open");

      if (record.toggle) {
        record.toggle.setAttribute("aria-expanded", "true");
      }

      document.documentElement.classList.add("mo-responsive-menu-open");

      if (opts.focusFirst) {
        const first = menu.querySelector(
          'a[href], button:not([disabled]), input:not([disabled]), ' +
          'select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (first) first.focus();
      }
    } else {
      menu.classList.remove("mo-menu-open");
      menu.setAttribute("data-mo-menu-state", "closed");

      if (record.toggle) {
        record.toggle.setAttribute("aria-expanded", "false");
      }

      document.documentElement.classList.remove("mo-responsive-menu-open");

      if (opts.restoreFocus && record.toggle) {
        record.toggle.focus();
      }

      /*
       * Respect the site's original hidden state.
       * Only add hidden on small screens if CSS does not manage visibility.
       */
      if (window.innerWidth < CONFIG.breakpoints.desktop) {
        menu.hidden = true;
      } else {
        menu.hidden = record.hidden;
      }
    }

    emit("medorbits:menuchange", {
      open: Boolean(open),
      menu: menu
    });
  }

  function bindMenus(root) {
    queryAll(root, CONFIG.selectors.menuToggle).forEach(function (toggle) {
      if (toggle.dataset.moResponsiveBound === "true") return;

      toggle.dataset.moResponsiveBound = "true";

      const menu = resolveMenu(toggle);

      if (!menu) {
        toggle.dataset.moResponsiveWarning = "menu-not-found";
        return;
      }

      toggle.setAttribute("aria-controls", menu.id || createMenuId(menu));
      toggle.setAttribute("aria-expanded", "false");

      state.menuRecords.set(menu, {
        hidden: menu.hidden,
        ariaHidden: menu.getAttribute("aria-hidden"),
        toggle: toggle
      });

      listen(toggle, "click", function () {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        setMenuOpen(menu, toggle, !isOpen);
      });

      queryAll(menu, CONFIG.selectors.menuClose).forEach(function (button) {
        listen(button, "click", function () {
          setMenuOpen(menu, toggle, false, { restoreFocus: true });
        });
      });

      listen(menu, "click", function (event) {
        const link = event.target.closest("a[href]");

        if (
          link &&
          window.innerWidth < CONFIG.breakpoints.desktop &&
          !link.hasAttribute("data-mo-menu-keep-open")
        ) {
          setMenuOpen(menu, toggle, false);
        }
      });

      listen(menu, "keydown", function (event) {
        if (event.key === "Escape") {
          setMenuOpen(menu, toggle, false, { restoreFocus: true });
        }
      });
    });
  }

  function createMenuId(menu) {
    const id = "mo-responsive-menu-" +
      Math.random().toString(36).slice(2, 9);

    menu.id = id;
    return id;
  }

  /* -------------------------------------------------------
     Responsive tables
  ------------------------------------------------------- */

  function makeTableResponsive(table) {
    if (state.tableRecords.has(table)) return;

    /*
     * If a project already has a scroll wrapper, do not add another.
     */
    const existingWrapper = table.closest(
      ".table-responsive, .table-scroll, .overflow-x-auto, " +
      ".mo-responsive-table-wrap"
    );

    if (existingWrapper) {
      state.tableRecords.set(table, {
        wrapper: existingWrapper,
        created: false
      });
      return;
    }

    const parent = table.parentElement;

    if (!parent) return;

    const wrapper = document.createElement("div");

    wrapper.className = "mo-responsive-table-wrap";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Scrollable table");
    wrapper.setAttribute("tabindex", "0");

    parent.insertBefore(wrapper, table);
    wrapper.appendChild(table);

    state.tableRecords.set(table, {
      wrapper: wrapper,
      created: true,
      parent: parent
    });

    state.generatedElements.add(wrapper);
  }

  function bindTables(root) {
    queryAll(root, CONFIG.selectors.table).forEach(makeTableResponsive);
  }

  /* -------------------------------------------------------
     Horizontal overflow detection
  ------------------------------------------------------- */

  function checkOverflow() {
    const doc = document.documentElement;
    if (!doc) return false;

    const viewportWidth = doc.clientWidth;
    const documentWidth = Math.max(
      doc.scrollWidth,
      document.body ? document.body.scrollWidth : 0
    );

    const overflow = documentWidth >
      viewportWidth + CONFIG.overflowTolerance;

    const changed = state.pageOverflow !== overflow;

    state.pageOverflow = overflow;

    setRootClass("mo-has-horizontal-overflow", overflow);

    if (changed) {
      emit("medorbits:overflowchange", {
        overflow: overflow,
        viewportWidth: viewportWidth,
        documentWidth: documentWidth,
        excess: Math.max(0, documentWidth - viewportWidth)
      });
    }

    return overflow;
  }

  function bindOverflowChecks(root) {
    queryAll(root, CONFIG.selectors.overflowCheck).forEach(function (element) {
      if (element.dataset.moOverflowBound === "true") return;

      element.dataset.moOverflowBound = "true";

      listen(element, "click", function () {
        window.requestAnimationFrame(checkOverflow);
      });
    });
  }

  /* -------------------------------------------------------
     Accessibility helpers
  ------------------------------------------------------- */

  function bindDisclosures(root) {
    queryAll(root, "[data-mo-disclosure-toggle]").forEach(function (toggle) {
      if (toggle.dataset.moDisclosureBound === "true") return;

      toggle.dataset.moDisclosureBound = "true";

      const targetId = toggle.getAttribute("aria-controls");
      const target = targetId ? document.getElementById(targetId) : null;

      if (!target) return;

      if (!toggle.hasAttribute("aria-expanded")) {
        toggle.setAttribute("aria-expanded", String(!target.hidden));
      }

      listen(toggle, "click", function () {
        const open = toggle.getAttribute("aria-expanded") !== "true";

        toggle.setAttribute("aria-expanded", String(open));
        target.hidden = !open;

        emit("medorbits:disclosurechange", {
          open: open,
          target: target
        });
      });
    });
  }

  function addResponsiveStatus(root) {
    queryAll(root, "[data-mo-responsive-status]").forEach(function (element) {
      if (element.dataset.moResponsiveStatusBound === "true") return;

      element.dataset.moResponsiveStatusBound = "true";
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
    });
  }

  /* -------------------------------------------------------
     Initialization and dynamic page updates
  ------------------------------------------------------- */

  function refresh(root) {
    const scope = root || document;

    bindMenus(scope);
    bindTables(scope);
    bindOverflowChecks(scope);
    bindDisclosures(scope);
    addResponsiveStatus(scope);

    window.requestAnimationFrame(function () {
      updateResponsiveState();
      checkOverflow();
    });

    return api;
  }

  function handleResize() {
    if (state.resizeTimer) {
      window.clearTimeout(state.resizeTimer);
    }

    state.resizeTimer = window.setTimeout(function () {
      updateResponsiveState();
      checkOverflow();

      /*
       * Close mobile menus when moving to desktop layout.
       */
      if (window.innerWidth >= CONFIG.breakpoints.desktop) {
        state.menuRecords.forEach(function (record, menu) {
          if (menu.classList.contains("mo-menu-open")) {
            setMenuOpen(menu, record.toggle, false);
          }
        });
      }
    }, CONFIG.resizeDebounce);
  }

  function init() {
    if (state.initialized) {
      refresh(document);
      return api;
    }

    ensureViewportMeta();
    injectStyles();

    state.resizeHandler = handleResize;

    listen(window, "resize", state.resizeHandler, { passive: true });
    listen(window, "orientationchange", state.resizeHandler, { passive: true });
    listen(window, "pageshow", function () {
      refresh(document);
    });

    listen(window, "load", function () {
      refresh(document);
    });

    if (window.matchMedia) {
      ["(prefers-reduced-motion: reduce)", "(pointer: coarse)"].forEach(
        function (query) {
          const media = window.matchMedia(query);

          const handler = function () {
            updateResponsiveState();
          };

          if (media.addEventListener) {
            media.addEventListener("change", handler);
            state.listeners.push(function () {
              media.removeEventListener("change", handler);
            });
          } else if (media.addListener) {
            media.addListener(handler);
            state.listeners.push(function () {
              media.removeListener(handler);
            });
          }
        }
      );
    }

    refresh(document);

    if (
      typeof MutationObserver !== "undefined" &&
      document.documentElement
    ) {
      state.observer = new MutationObserver(function (records) {
        let hasAddedElements = false;

        records.forEach(function (record) {
          record.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              hasAddedElements = true;
              refresh(node);
            }
          });
        });

        if (hasAddedElements) {
          window.requestAnimationFrame(checkOverflow);
        }
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    state.initialized = true;

    emit("medorbits:responsiveinit", {
      breakpoint: state.currentBreakpoint
    });

    return api;
  }

  /* -------------------------------------------------------
     Cleanup
  ------------------------------------------------------- */

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.resizeTimer) {
      window.clearTimeout(state.resizeTimer);
      state.resizeTimer = null;
    }

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (_) {
        // Continue cleanup if an element has already been removed.
      }
    });

    state.listeners = [];

    /*
     * Remove helper wrappers while preserving each original table.
     */
    state.tableRecords.forEach(function (record, table) {
      if (
        record.created &&
        record.wrapper &&
        record.wrapper.parentNode &&
        table.parentNode === record.wrapper
      ) {
        record.wrapper.parentNode.insertBefore(table, record.wrapper);
        record.wrapper.remove();
      }
    });

    state.tableRecords.clear();

    /*
     * Restore menu state captured before enhancement.
     */
    state.menuRecords.forEach(function (record, menu) {
      menu.classList.remove("mo-menu-open");
      menu.removeAttribute("data-mo-menu-state");

      if (record.hidden !== undefined) {
        menu.hidden = record.hidden;
      }

      if (record.ariaHidden === null) {
        menu.removeAttribute("aria-hidden");
      } else if (record.ariaHidden !== undefined) {
        menu.setAttribute("aria-hidden", record.ariaHidden);
      }

      if (record.toggle) {
        record.toggle.removeAttribute("data-mo-responsive-bound");
        record.toggle.removeAttribute("aria-expanded");
      }
    });

    state.menuRecords.clear();

    state.generatedElements.forEach(function (element) {
      if (
        element &&
        element.parentNode &&
        (
          element.id === "mo-responsive-styles" ||
          element.name === "viewport" ||
          element.classList.contains("mo-responsive-table-wrap")
        )
      ) {
        element.remove();
      }
    });

    state.generatedElements.clear();

    [
      "mo-screen-mobile",
      "mo-screen-tablet",
      "mo-screen-desktop",
      "mo-reduced-motion",
      "mo-coarse-pointer",
      "mo-has-horizontal-overflow",
      "mo-responsive-menu-open"
    ].forEach(function (className) {
      document.documentElement.classList.remove(className);
    });

    document.documentElement.removeAttribute("data-mo-breakpoint");
    document.documentElement.removeAttribute("data-mo-viewport-width");

    state.initialized = false;
    state.currentBreakpoint = null;
    state.pageOverflow = false;
    state.mediaQueries = {};
  }

  /* -------------------------------------------------------
     Public API
  ------------------------------------------------------- */

  const api = {
    init: init,
    refresh: refresh,
    destroy: destroy,

    getBreakpoint: function () {
      return state.currentBreakpoint || getBreakpoint(getViewportWidth());
    },

    getViewport: function () {
      return {
        width: getViewportWidth(),
        height: window.innerHeight || 0,
        breakpoint: state.currentBreakpoint ||
          getBreakpoint(getViewportWidth()),
        reducedMotion: isReducedMotion(),
        coarsePointer: isCoarsePointer()
      };
    },

    checkOverflow: checkOverflow,

    closeMenus: function () {
      state.menuRecords.forEach(function (record, menu) {
        setMenuOpen(menu, record.toggle, false);
      });
    },

    config: function () {
      return {
        breakpoints: { ...CONFIG.breakpoints },
        selectors: { ...CONFIG.selectors },
        overflowTolerance: CONFIG.overflowTolerance,
        resizeDebounce: CONFIG.resizeDebounce
      };
    }
  };

  window.MedOrbitsResponsive = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
