
/* =========================================================
   MEDORBITS | NAVIGATION MODULE
   File: assets/js/navigation.js
   Version: 1.0.0
   Dependencies: None
   Compatible with: app.js, accessibility.js, config.js, i18n.js
   ========================================================= */

(function MedOrbitsNavigation() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_NAVIGATION_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var SELECTORS = {
    header: "[data-mo-header]",
    nav: "[data-mo-navigation], [data-navigation]",
    toggle: "[data-nav-toggle], [data-menu-toggle]",
    panel: "[data-nav-panel], [data-mobile-menu]",
    close: "[data-nav-close]",
    dropdown: "[data-nav-dropdown]",
    dropdownToggle: "[data-nav-dropdown-toggle]",
    dropdownPanel: "[data-nav-dropdown-panel]",
    link: "a[href]",
    activeLink: "[aria-current='page']"
  };

  var state = {
    roots: new Map(),
    listeners: [],
    observer: null,
    initialized: false,
    destroyed: false,
    lastFocused: null
  };

  function listen(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options || false);

    state.listeners.push(function () {
      target.removeEventListener(eventName, handler, options || false);
    });
  }

  function safeText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, limit || 500);
  }

  function isElementVisible(element) {
    if (!element || element.hidden) return false;

    if (element.closest("[hidden], [inert], [aria-hidden='true']")) {
      return false;
    }

    var style = window.getComputedStyle(element);

    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getAttribute("aria-disabled") !== "true";
  }

  function getFocusable(container) {
    if (!container) return [];

    return Array.from(container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), ' +
      'select:not([disabled]), textarea:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])'
    )).filter(isElementVisible);
  }

  function getNavigationRoot(element) {
    return element.closest(SELECTORS.nav) ||
      element.closest(SELECTORS.header) ||
      element.closest("header") ||
      element.closest("nav");
  }

  function getPanel(root) {
    return root ? root.querySelector(SELECTORS.panel) : null;
  }

  function getToggle(root) {
    return root ? root.querySelector(SELECTORS.toggle) : null;
  }

  function setExpanded(button, expanded) {
    if (!button) return;

    button.setAttribute("aria-expanded", String(Boolean(expanded)));
  }

  function setHidden(panel, hidden) {
    if (!panel) return;

    panel.hidden = Boolean(hidden);
    panel.setAttribute("aria-hidden", String(Boolean(hidden)));
  }

  function isExpanded(button) {
    return Boolean(button && button.getAttribute("aria-expanded") === "true");
  }

  function syncInitialState(root) {
    var panel = getPanel(root);
    var toggle = getToggle(root);

    if (panel && toggle) {
      var initiallyOpen = isExpanded(toggle) && !panel.hidden;

      setExpanded(toggle, initiallyOpen);
      setHidden(panel, !initiallyOpen);
    }

    root.querySelectorAll(SELECTORS.dropdown).forEach(function (dropdown) {
      var button = dropdown.querySelector(SELECTORS.dropdownToggle);
      var menu = dropdown.querySelector(SELECTORS.dropdownPanel);

      if (!button || !menu) return;

      var initiallyOpen = isExpanded(button) && !menu.hidden;

      setExpanded(button, initiallyOpen);
      setHidden(menu, !initiallyOpen);
    });
  }

  function closeDropdown(dropdown, restoreFocus) {
    if (!dropdown) return;

    var button = dropdown.querySelector(SELECTORS.dropdownToggle);
    var panel = dropdown.querySelector(SELECTORS.dropdownPanel);

    setExpanded(button, false);
    setHidden(panel, true);

    if (restoreFocus && button) {
      button.focus();
    }
  }

  function closeAllDropdowns(root, except) {
    if (!root) return;

    root.querySelectorAll(SELECTORS.dropdown).forEach(function (dropdown) {
      if (dropdown !== except) {
        closeDropdown(dropdown, false);
      }
    });
  }

  function openDropdown(dropdown, focusFirst) {
    if (!dropdown) return;

    var root = getNavigationRoot(dropdown) || dropdown.parentElement;
    var button = dropdown.querySelector(SELECTORS.dropdownToggle);
    var panel = dropdown.querySelector(SELECTORS.dropdownPanel);

    if (!button || !panel) return;

    closeAllDropdowns(root, dropdown);
    setHidden(panel, false);
    setExpanded(button, true);

    if (focusFirst) {
      var items = getFocusable(panel);
      if (items.length) items[0].focus();
    }
  }

  function toggleDropdown(dropdown) {
    var button = dropdown.querySelector(SELECTORS.dropdownToggle);

    if (isExpanded(button)) {
      closeDropdown(dropdown, false);
    } else {
      openDropdown(dropdown, false);
    }
  }

  function openMobileMenu(root, focusFirst) {
    var panel = getPanel(root);
    var toggle = getToggle(root);

    if (!panel || !toggle) return;

    state.lastFocused = document.activeElement;

    setHidden(panel, false);
    setExpanded(toggle, true);

    root.setAttribute("data-navigation-open", "true");

    if (focusFirst) {
      var items = getFocusable(panel);
      if (items.length) items[0].focus();
    }
  }

  function closeMobileMenu(root, restoreFocus) {
    var panel = getPanel(root);
    var toggle = getToggle(root);

    if (!panel || !toggle) return;

    closeAllDropdowns(root);
    setHidden(panel, true);
    setExpanded(toggle, false);
    root.removeAttribute("data-navigation-open");

    if (restoreFocus && isElementVisible(toggle)) {
      toggle.focus();
    }
  }

  function toggleMobileMenu(root) {
    var toggle = getToggle(root);

    if (isExpanded(toggle)) {
      closeMobileMenu(root, false);
    } else {
      openMobileMenu(root, false);
    }
  }

  function normalizePath(path) {
    try {
      var url = new URL(path, window.location.href);
      var normalized = decodeURIComponent(url.pathname);

      normalized = normalized.replace(/\/+/g, "/");

      if (normalized.length > 1) {
        normalized = normalized.replace(/\/+$/, "");
      }

      return normalized.toLowerCase();
    } catch (error) {
      return "";
    }
  }

  function updateActiveLinks(root) {
    if (!root) return;

    var currentPath = normalizePath(window.location.pathname);

    root.querySelectorAll(SELECTORS.link).forEach(function (link) {
      var href = link.getAttribute("href");

      if (
        !href ||
        href.charAt(0) === "#" ||
        /^\s*javascript:/i.test(href)
      ) {
        return;
      }

      var targetPath = normalizePath(href);

      if (!targetPath) return;

      var isHome = currentPath === "/" || /\/index\.html?$/i.test(currentPath);
      var targetIsHome = targetPath === "/" ||
        /\/index\.html?$/i.test(targetPath);

      var active = targetPath === currentPath ||
        (isHome && targetIsHome);

      if (link.hasAttribute("data-nav-exact") ||
          link.hasAttribute("data-nav-no-active-match")) {
        active = targetPath === currentPath;
      }

      if (active) {
        link.setAttribute("aria-current", "page");
      } else if (link.getAttribute("aria-current") === "page") {
        link.removeAttribute("aria-current");
      }
    });
  }

  function handleNavigationClick(event) {
    var target = event.target;

    if (!(target instanceof Element)) return;

    var closeButton = target.closest(SELECTORS.close);

    if (closeButton) {
      var closeRoot = getNavigationRoot(closeButton);

      if (closeRoot) {
        event.preventDefault();
        closeMobileMenu(closeRoot, true);
      }

      return;
    }

    var toggle = target.closest(SELECTORS.toggle);

    if (toggle) {
      var root = getNavigationRoot(toggle);

      if (root) {
        event.preventDefault();
        toggleMobileMenu(root);
      }

      return;
    }

    var dropdownToggle = target.closest(SELECTORS.dropdownToggle);

    if (dropdownToggle) {
      var dropdown = dropdownToggle.closest(SELECTORS.dropdown);

      if (dropdown) {
        event.preventDefault();
        toggleDropdown(dropdown);
      }

      return;
    }

    var link = target.closest(SELECTORS.link);

    if (link) {
      var navRoot = getNavigationRoot(link);

      if (!navRoot) return;

      var panel = getPanel(navRoot);

      if (panel && panel.contains(link)) {
        closeMobileMenu(navRoot, false);
      }

      var parentDropdown = link.closest(SELECTORS.dropdown);

      if (parentDropdown) {
        closeDropdown(parentDropdown, false);
      }
    }
  }

  function handleOutsideClick(event) {
    var target = event.target;

    if (!(target instanceof Node)) return;

    state.roots.forEach(function (root) {
      if (root.contains(target)) return;

      if (isExpanded(getToggle(root))) {
        closeMobileMenu(root, false);
      }

      closeAllDropdowns(root);
    });
  }

  function handleKeyboard(event) {
    var target = event.target;

    if (!(target instanceof Element)) return;

    if (event.key === "Escape") {
      var dropdown = target.closest(SELECTORS.dropdown);

      if (dropdown) {
        var dropdownButton = dropdown.querySelector(SELECTORS.dropdownToggle);

        if (isExpanded(dropdownButton)) {
          event.preventDefault();
          closeDropdown(dropdown, true);
          return;
        }
      }

      state.roots.forEach(function (root) {
        if (isExpanded(getToggle(root))) {
          event.preventDefault();
          closeMobileMenu(root, true);
        }
      });

      return;
    }

    var dropdownToggle = target.closest(SELECTORS.dropdownToggle);

    if (
      dropdownToggle &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      var menuDropdown = dropdownToggle.closest(SELECTORS.dropdown);
      var menuPanel = menuDropdown &&
        menuDropdown.querySelector(SELECTORS.dropdownPanel);

      if (!menuPanel) return;

      event.preventDefault();

      if (!isExpanded(dropdownToggle)) {
        openDropdown(menuDropdown, false);
      }

      var items = getFocusable(menuPanel);
      if (!items.length) return;

      if (event.key === "Home") {
        items[0].focus();
      } else if (event.key === "End") {
        items[items.length - 1].focus();
      } else if (event.key === "ArrowDown") {
        items[0].focus();
      } else if (event.key === "ArrowUp") {
        items[items.length - 1].focus();
      }

      return;
    }

    var focusedDropdown = target.closest(SELECTORS.dropdown);

    if (
      focusedDropdown &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
      !target.matches(SELECTORS.dropdownToggle)
    ) {
      var panel = focusedDropdown.querySelector(SELECTORS.dropdownPanel);
      var focusable = getFocusable(panel);
      var index = focusable.indexOf(target);

      if (!focusable.length || index < 0) return;

      event.preventDefault();

      if (event.key === "Home") {
        focusable[0].focus();
      } else if (event.key === "End") {
        focusable[focusable.length - 1].focus();
      } else if (event.key === "ArrowDown") {
        focusable[(index + 1) % focusable.length].focus();
      } else if (event.key === "ArrowUp") {
        focusable[(index - 1 + focusable.length) % focusable.length].focus();
      }
    }
  }

  function initializeRoot(root) {
    if (!root || state.roots.has(root)) return;

    state.roots.set(root, true);
    syncInitialState(root);
    updateActiveLinks(root);

    root.querySelectorAll(SELECTORS.dropdownToggle).forEach(function (button) {
      var dropdown = button.closest(SELECTORS.dropdown);

      if (!dropdown) return;

      if (!button.hasAttribute("aria-haspopup")) {
        button.setAttribute("aria-haspopup", "true");
      }

      var panel = dropdown.querySelector(SELECTORS.dropdownPanel);

      if (panel && !panel.id) {
        panel.id = "mo-nav-dropdown-" +
          Math.random().toString(36).slice(2, 10);
      }

      if (panel && panel.id) {
        button.setAttribute("aria-controls", panel.id);
      }
    });

    var mobileToggle = getToggle(root);
    var mobilePanel = getPanel(root);

    if (mobileToggle && mobilePanel) {
      if (!mobilePanel.id) {
        mobilePanel.id = "mo-nav-panel-" +
          Math.random().toString(36).slice(2, 10);
      }

      mobileToggle.setAttribute("aria-controls", mobilePanel.id);

      if (!mobileToggle.hasAttribute("aria-label")) {
        mobileToggle.setAttribute("aria-label", "Toggle navigation");
      }
    }
  }

  function refresh() {
    if (state.destroyed) return;

    document.querySelectorAll(
      SELECTORS.nav + ", " + SELECTORS.header + ", header"
    ).forEach(function (root) {
      if (
        root.querySelector(SELECTORS.toggle) ||
        root.querySelector(SELECTORS.dropdownToggle) ||
        root.matches(SELECTORS.nav)
      ) {
        initializeRoot(root);
      }
    });

    state.roots.forEach(function (_, root) {
      if (!root.isConnected) state.roots.delete(root);
    });
  }

  function init() {
    if (state.initialized || state.destroyed) return;

    state.initialized = true;

    listen(document, "click", handleNavigationClick);
    listen(document, "click", handleOutsideClick);
    listen(document, "keydown", handleKeyboard);

    listen(window, "resize", function () {
      state.roots.forEach(function (root) {
        var panel = getPanel(root);

        if (!panel) return;

        var breakpoint = Number(root.getAttribute("data-nav-breakpoint")) || 768;

        if (window.innerWidth > breakpoint) {
          closeMobileMenu(root, false);
        }
      });
    });

    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var shouldRefresh = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && (
                  node.matches(SELECTORS.nav) ||
                  node.matches(SELECTORS.header) ||
                  node.matches("header")
                )) ||
                (node.querySelector && (
                  node.querySelector(SELECTORS.nav) ||
                  node.querySelector(SELECTORS.toggle) ||
                  node.querySelector(SELECTORS.dropdownToggle)
                ))
              );
          });
        });

        if (shouldRefresh) refresh();
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

    state.listeners.forEach(function (remove) {
      try {
        remove();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.listeners = [];
    state.roots.clear();
    state.destroyed = true;
  }

  var api = {
    version: "1.0.0",
    refresh: refresh,
    open: function (root) {
      openMobileMenu(root, false);
    },
    close: function (root, restoreFocus) {
      closeMobileMenu(root, Boolean(restoreFocus));
    },
    closeDropdown: closeDropdown,
    updateActiveLinks: function () {
      state.roots.forEach(function (_, root) {
        updateActiveLinks(root);
      });
    },
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsNavigation = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
