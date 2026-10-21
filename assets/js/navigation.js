
/* =========================================================
   MedOrbits -- Navigation Manager
   File: /assets/js/navigation.js
   Purpose: Sticky header, mobile menu, dropdowns, active links,
            smooth scrolling, breadcrumbs and navigation events
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsNavigation) return;

  const SELECTORS = Object.freeze({
    header: "[data-site-header], .site-header, .main-header",
    menuToggle: "[data-nav-toggle], .nav-toggle, .menu-toggle",
    navigation: "[data-site-navigation], .site-navigation, .main-navigation, .navbar-collapse",
    navLinks: "[data-site-navigation] a[href], .site-navigation a[href], .main-navigation a[href], .navbar-collapse a[href]",
    dropdownToggle: "[data-nav-dropdown-toggle], .dropdown-toggle",
    dropdown: "[data-nav-dropdown], .nav-dropdown, .dropdown",
    breadcrumb: "[data-breadcrumbs]",
    backToTop: "[data-back-to-top]"
  });

  const state = {
    initialized: false,
    header: null,
    navigation: null,
    menuToggle: null,
    scrollHandler: null,
    resizeHandler: null,
    popstateHandler: null,
    lastScrollY: 0,
    ticking: false,
    listeners: [],
    menuInitiallyOpen: false,
    originalBodyOverflow: null
  };

  const utils = {
    escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    dispatch(name, detail = {}) {
      document.dispatchEvent(new CustomEvent(
        "medorbits:navigation:" + name,
        { detail }
      ));
    },

    listen(target, eventName, handler, options) {
      target.addEventListener(eventName, handler, options);
      state.listeners.push({
        target,
        eventName,
        handler,
        options
      });
    },

    normalizePath(path) {
      if (!path) return "/";

      try {
        const url = new URL(path, window.location.origin);
        let pathname = url.pathname.replace(/\/{2,}/g, "/");

        if (pathname.length > 1) {
          pathname = pathname.replace(/\/+$/, "");
        }

        return pathname.toLowerCase();
      } catch (_) {
        return String(path)
          .split("?")[0]
          .split("#")[0]
          .toLowerCase();
      }
    },

    isInternalLink(link) {
      if (!link || !link.href) return false;

      try {
        const url = new URL(link.href, window.location.href);

        return (
          url.origin === window.location.origin &&
          !link.hasAttribute("download") &&
          !link.hasAttribute("data-no-spa") &&
          !/^(mailto:|tel:|javascript:|data:|blob:)/i.test(link.href)
        );
      } catch (_) {
        return false;
      }
    },

    getFocusable(container) {
      if (!container) return [];

      return Array.from(container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"])'
      )).filter((element) => (
        !element.hidden &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.getClientRects().length > 0
      ));
    },

    getReduceMotion() {
      return Boolean(
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    },

    getElement(target) {
      if (!target) return null;
      if (target instanceof Element) return target;

      if (typeof target === "string") {
        try {
          return document.querySelector(target);
        } catch (_) {
          return null;
        }
      }

      return null;
    }
  };

  function getHeader() {
    return document.querySelector(SELECTORS.header);
  }

  function getNavigation() {
    return document.querySelector(SELECTORS.navigation);
  }

  function getMenuToggle() {
    return document.querySelector(SELECTORS.menuToggle);
  }

  function getDropdownMenu(dropdown) {
    return dropdown?.querySelector(
      "[data-dropdown-menu], .dropdown-menu, .nav-dropdown-menu"
    ) || null;
  }

  function isMenuOpen(navigation = state.navigation || getNavigation()) {
    return Boolean(
      navigation &&
      (
        navigation.classList.contains("is-open") ||
        navigation.classList.contains("nav-open")
      )
    );
  }

  function setMenuState(isOpen, options = {}) {
    const navigation = state.navigation || getNavigation();
    const toggle = state.menuToggle || getMenuToggle();

    if (!navigation) return false;

    const wasOpen = isMenuOpen(navigation);

    if (!navigation.id) {
      navigation.id = "medorbits-primary-navigation";
    }

    navigation.classList.toggle("is-open", isOpen);
    navigation.classList.toggle("nav-open", isOpen);

    if (toggle) {
      toggle.classList.toggle("is-active", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-controls", navigation.id);
      toggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation menu" : "Open navigation menu"
      );
    }

    document.body.classList.toggle("navigation-open", isOpen);

    if (isOpen) {
      closeDropdowns();
    }

    if (wasOpen !== isOpen) {
      utils.dispatch("menu-toggle", {
        open: isOpen,
        navigation,
        toggle,
        source: options.source || "api"
      });
    }

    return true;
  }

  function toggleMenu(force) {
    const navigation = state.navigation || getNavigation();

    if (!navigation) return false;

    const shouldOpen = typeof force === "boolean"
      ? force
      : !isMenuOpen(navigation);

    setMenuState(shouldOpen, { source: "toggle" });

    return shouldOpen;
  }

  function closeMenu() {
    return setMenuState(false, { source: "close" });
  }

  function closeDropdowns(except) {
    document.querySelectorAll(SELECTORS.dropdown).forEach((dropdown) => {
      if (except && dropdown === except) return;

      dropdown.classList.remove("is-open", "dropdown-open");
      dropdown.classList.remove("has-active-child");

      const toggle = dropdown.querySelector(SELECTORS.dropdownToggle);
      const menu = getDropdownMenu(dropdown);

      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }

      if (menu) {
        menu.hidden = true;
      }
    });

    if (except) {
      const activeChild = except.querySelector(
        "a.active, a.is-active, a[aria-current='page']"
      );

      if (activeChild) {
        except.classList.add("has-active-child");
      }
    }
  }

  function toggleDropdown(toggle, force) {
    if (!toggle) return false;

    const dropdown = toggle.closest(SELECTORS.dropdown);

    if (!dropdown) return false;

    const menu = getDropdownMenu(dropdown);
    const currentlyOpen =
      dropdown.classList.contains("is-open") ||
      dropdown.classList.contains("dropdown-open");

    const shouldOpen = typeof force === "boolean"
      ? force
      : !currentlyOpen;

    closeDropdowns(shouldOpen ? dropdown : null);

    dropdown.classList.toggle("is-open", shouldOpen);
    dropdown.classList.toggle("dropdown-open", shouldOpen);
    toggle.setAttribute("aria-expanded", String(shouldOpen));

    if (menu) {
      menu.hidden = !shouldOpen;
    }

    utils.dispatch("dropdown-toggle", {
      dropdown,
      toggle,
      open: shouldOpen
    });

    return shouldOpen;
  }

  function markActiveLinks() {
    const currentPath = utils.normalizePath(window.location.pathname);
    const links = document.querySelectorAll(
      "nav a[href], [role='navigation'] a[href]"
    );

    let bestMatch = null;
    let bestLength = -1;

    links.forEach((link) => {
      const href = link.getAttribute("href");

      if (
        !href ||
        href.startsWith("#") ||
        /^(mailto:|tel:|javascript:)/i.test(href)
      ) {
        link.classList.remove("active", "is-active");
        link.removeAttribute("aria-current");
        return;
      }

      let url;

      try {
        url = new URL(href, window.location.href);
      } catch (_) {
        return;
      }

      if (url.origin !== window.location.origin) {
        link.classList.remove("active", "is-active");
        link.removeAttribute("aria-current");
        return;
      }

      const linkPath = utils.normalizePath(url.pathname);
      const exactMatch = linkPath === currentPath;
      const sectionMatch =
        linkPath !== "/" &&
        currentPath.startsWith(linkPath + "/");

      const active = exactMatch || sectionMatch;

      link.classList.toggle("active", active);
      link.classList.toggle("is-active", active);

      if (exactMatch) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }

      if (active && linkPath.length > bestLength) {
        bestMatch = link;
        bestLength = linkPath.length;
      }
    });

    document.querySelectorAll(SELECTORS.dropdown).forEach((dropdown) => {
      dropdown.classList.remove("has-active-child");
    });

    if (bestMatch) {
      const dropdown = bestMatch.closest(SELECTORS.dropdown);

      if (dropdown) {
        dropdown.classList.add("has-active-child");
      }
    }

    utils.dispatch("active-links-updated", {
      path: currentPath,
      activeLink: bestMatch
    });

    return bestMatch;
  }

  function updateStickyHeader() {
    const header = state.header || getHeader();

    if (!header) return;

    const scrollY = Math.max(
      0,
      window.scrollY || window.pageYOffset || 0
    );

    const threshold = Math.max(
      0,
      Number(header.dataset.stickyThreshold) || 20
    );

    const scrolled = scrollY > threshold;

    header.classList.toggle("is-scrolled", scrolled);
    header.classList.toggle("header-scrolled", scrolled);

    if (header.hasAttribute("data-hide-on-scroll")) {
      const delta = scrollY - state.lastScrollY;

      if (scrollY <= threshold || delta < -5) {
        header.classList.remove("is-hidden");
      } else if (
        delta > 5 &&
        !document.body.classList.contains("navigation-open")
      ) {
        header.classList.add("is-hidden");
      }
    }

    state.lastScrollY = scrollY;

    document.querySelectorAll(SELECTORS.backToTop).forEach((button) => {
      const visible = scrollY >= 300;

      button.hidden = !visible;
      button.classList.toggle("is-visible", visible);
      button.setAttribute("aria-hidden", String(!visible));
    });

    utils.dispatch("scroll", {
      scrollY,
      scrolled
    });
  }

  function handleScroll() {
    if (state.ticking) return;

    state.ticking = true;

    window.requestAnimationFrame(() => {
      updateStickyHeader();
      state.ticking = false;
    });
  }

  function setupStickyHeader() {
    state.header = getHeader();

    if (!state.header) return;

    if (
      state.header.hasAttribute("data-sticky") ||
      state.header.classList.contains("sticky-header")
    ) {
      state.header.classList.add("is-sticky");
    }

    updateStickyHeader();
  }

  function setupDropdowns() {
    document.querySelectorAll(SELECTORS.dropdown).forEach((dropdown) => {
      const toggle = dropdown.querySelector(SELECTORS.dropdownToggle);

      if (!toggle) return;

      const menu = getDropdownMenu(dropdown);
      const initiallyOpen =
        dropdown.classList.contains("is-open") ||
        dropdown.classList.contains("dropdown-open");

      toggle.setAttribute("aria-expanded", String(initiallyOpen));

      if (menu) {
        menu.hidden = !initiallyOpen;
      }
    });
  }

  function setupNavigationAccessibility() {
    state.navigation = getNavigation();
    state.menuToggle = getMenuToggle();

    if (state.navigation && !state.navigation.id) {
      state.navigation.id = "medorbits-primary-navigation";
    }

    if (state.menuToggle && state.navigation) {
      state.menuToggle.setAttribute(
        "aria-controls",
        state.navigation.id
      );

      state.menuToggle.setAttribute(
        "aria-expanded",
        String(isMenuOpen(state.navigation))
      );

      if (!state.menuToggle.hasAttribute("aria-label")) {
        state.menuToggle.setAttribute(
          "aria-label",
          "Open navigation menu"
        );
      }

      if (!state.menuToggle.hasAttribute("type")) {
        state.menuToggle.setAttribute("type", "button");
      }
    }
  }

  function setupSmoothScrolling() {
    utils.listen(document, "click", (event) => {
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest('a[href*="#"]');

      if (!link || event.defaultPrevented) return;

      const rawHref = link.getAttribute("href");

      if (!rawHref || rawHref === "#") return;

      let url;

      try {
        url = new URL(rawHref, window.location.href);
      } catch (_) {
        return;
      }

      if (
        url.origin !== window.location.origin ||
        url.pathname !== window.location.pathname ||
        url.search !== window.location.search ||
        !url.hash
      ) {
        return;
      }

      let target;

      try {
        target = document.getElementById(
          decodeURIComponent(url.hash.slice(1))
        );
      } catch (_) {
        return;
      }

      if (!target) return;

      event.preventDefault();

      const header = state.header || getHeader();
      const headerHeight = header
        ? header.getBoundingClientRect().height
        : 0;

      const targetY =
        target.getBoundingClientRect().top +
        window.scrollY -
        headerHeight -
        12;

      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: utils.getReduceMotion() ? "auto" : "smooth"
      });

      const hadTabindex = target.hasAttribute("tabindex");

      if (!hadTabindex) {
        target.setAttribute("tabindex", "-1");
      }

      utils.safeFocus(target);

      if (window.history?.pushState) {
        window.history.pushState(null, "", url.hash);
      }

      closeMenu();

      utils.dispatch("anchor-navigation", {
        href: url.hash,
        target
      });
    });
  }

  function setupBackToTop() {
    utils.listen(document, "click", (event) => {
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest(SELECTORS.backToTop);

      if (!button) return;

      event.preventDefault();

      window.scrollTo({
        top: 0,
        behavior: utils.getReduceMotion() ? "auto" : "smooth"
      });

      utils.dispatch("back-to-top");
    });
  }

  function setupClickHandlers() {
    utils.listen(document, "click", (event) => {
      if (!(event.target instanceof Element)) return;

      const toggle = event.target.closest(SELECTORS.menuToggle);

      if (toggle) {
        event.preventDefault();
        toggleMenu();
        return;
      }

      const dropdownToggle = event.target.closest(
        SELECTORS.dropdownToggle
      );

      if (dropdownToggle) {
        event.preventDefault();
        toggleDropdown(dropdownToggle);
        return;
      }

      const navigationLink = event.target.closest(SELECTORS.navLinks);

      if (navigationLink) {
        const navigation = state.navigation || getNavigation();

        if (navigation?.contains(navigationLink)) {
          if (
            window.matchMedia &&
            window.matchMedia("(max-width: 991px)").matches
          ) {
            closeMenu();
          }

          utils.dispatch("link-click", {
            link: navigationLink,
            href: navigationLink.href
          });
        }

        return;
      }

      if (!event.target.closest(SELECTORS.dropdown)) {
        closeDropdowns();
      }

      const navigation = state.navigation || getNavigation();
      const menuToggle = state.menuToggle || getMenuToggle();

      if (
        navigation &&
        !navigation.contains(event.target) &&
        !menuToggle?.contains(event.target) &&
        window.matchMedia &&
        window.matchMedia("(max-width: 991px)").matches
      ) {
        closeMenu();
      }
    });

    utils.listen(document, "keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
        closeDropdowns();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      const navigation = state.navigation || getNavigation();

      if (!navigation || !navigation.contains(document.activeElement)) {
        return;
      }

      const activeDropdownToggle = document.activeElement.closest(
        SELECTORS.dropdownToggle
      );

      if (activeDropdownToggle) {
        event.preventDefault();

        const dropdown = activeDropdownToggle.closest(SELECTORS.dropdown);
        const menu = getDropdownMenu(dropdown);

        if (menu) {
          toggleDropdown(activeDropdownToggle, true);

          const firstItem = utils.getFocusable(menu)[0];

          if (firstItem) firstItem.focus();
        }

        return;
      }

      const links = utils.getFocusable(navigation);

      if (!links.length) return;

      const index = links.indexOf(document.activeElement);

      if (index === -1) return;

      event.preventDefault();

      const nextIndex = event.key === "ArrowDown"
        ? (index + 1) % links.length
        : (index - 1 + links.length) % links.length;

      links[nextIndex].focus();
    });
  }

  function buildBreadcrumbs(options = {}) {
    const container = utils.getElement(
      options.container || SELECTORS.breadcrumb
    );

    if (!container) return [];

    const segments = window.location.pathname
      .split("/")
      .filter(Boolean);

    const items = [{
      label: options.homeLabel || "Home",
      href: options.homeUrl || "/"
    }];

    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath += "/" + segment;

      let decodedSegment;

      try {
        decodedSegment = decodeURIComponent(segment);
      } catch (_) {
        decodedSegment = segment;
      }

      let label = decodedSegment
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

      if (options.labels && options.labels[segment]) {
        label = String(options.labels[segment]);
      }

      items.push({
        label,
        href: currentPath,
        current: index === segments.length - 1
      });
    });

    const listItems = items.map((item, index) => {
      const current = index === items.length - 1;

      const content = current
        ? `<span aria-current="page">${utils.escapeHTML(item.label)}</span>`
        : `<a href="${utils.escapeHTML(item.href)}">${utils.escapeHTML(item.label)}</a>`;

      const separator = current
        ? ""
        : '<span class="breadcrumb-separator" aria-hidden="true">/</span>';

      return `
        <li class="breadcrumb-item${current ? " is-current" : ""}">
          ${content}${separator}
        </li>`;
    }).join("");

    container.innerHTML = listItems;
    container.setAttribute("aria-label", "Breadcrumb");
    container.setAttribute("role", "navigation");

    if (!["OL", "UL"].includes(container.tagName)) {
      container.classList.add("breadcrumb-list");
    }

    utils.dispatch("breadcrumbs-built", {
      container,
      items
    });

    return items;
  }

  function navigateTo(url, options = {}) {
    if (typeof url !== "string" || !url.trim()) {
      throw new Error("A valid navigation URL is required.");
    }

    const destination = new URL(url, window.location.href);

    if (!["http:", "https:"].includes(destination.protocol)) {
      throw new Error("Unsupported navigation URL.");
    }

    if (
      options.sameOriginOnly &&
      destination.origin !== window.location.origin
    ) {
      throw new Error("External navigation is not allowed.");
    }

    utils.dispatch("before-navigate", {
      url: destination.href,
      options
    });

    if (options.newTab) {
      const opened = window.open(
        destination.href,
        "_blank",
        "noopener,noreferrer"
      );

      if (opened) opened.opener = null;
    } else if (options.replace) {
      window.location.replace(destination.href);
    } else {
      window.location.assign(destination.href);
    }
  }

  function getCurrentRoute() {
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      href: window.location.href
    };
  }

  function on(name, callback) {
    if (typeof callback !== "function") {
      throw new TypeError("A callback function is required.");
    }

    const eventName = "medorbits:navigation:" + name;

    document.addEventListener(eventName, callback);

    return function unsubscribe() {
      document.removeEventListener(eventName, callback);
    };
  }

  function refresh() {
    setupNavigationAccessibility();
    setupStickyHeader();
    setupDropdowns();
    markActiveLinks();

    utils.dispatch("refreshed", {
      route: getCurrentRoute()
    });

    return api;
  }

  function init() {
    if (state.initialized) return api;

    setupNavigationAccessibility();
    setupStickyHeader();
    setupDropdowns();
    markActiveLinks();
    setupSmoothScrolling();
    setupBackToTop();
    setupClickHandlers();

    state.scrollHandler = handleScroll;

    state.resizeHandler = () => {
      setupNavigationAccessibility();

      if (
        window.matchMedia &&
        window.matchMedia("(min-width: 992px)").matches
      ) {
        closeMenu();
      }

      updateStickyHeader();
    };

    state.popstateHandler = markActiveLinks;

    window.addEventListener("scroll", state.scrollHandler, {
      passive: true
    });

    window.addEventListener("resize", state.resizeHandler, {
      passive: true
    });

    window.addEventListener("popstate", state.popstateHandler);

    state.initialized = true;

    utils.dispatch("initialized", {
      route: getCurrentRoute()
    });

    return api;
  }

  function destroy() {
    if (state.scrollHandler) {
      window.removeEventListener("scroll", state.scrollHandler);
    }

    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
    }

    if (state.popstateHandler) {
      window.removeEventListener("popstate", state.popstateHandler);
    }

    state.listeners.forEach(({ target, eventName, handler, options }) => {
      target.removeEventListener(eventName, handler, options);
    });

    state.listeners = [];
    state.scrollHandler = null;
    state.resizeHandler = null;
    state.popstateHandler = null;

    closeMenu();
    closeDropdowns();

    state.initialized = false;
  }

  const api = Object.freeze({
    init,
    destroy,
    refresh,
    openMenu: () => toggleMenu(true),
    closeMenu,
    toggleMenu,
    openDropdown: (target) => toggleDropdown(
      utils.getElement(target),
      true
    ),
    closeDropdowns,
    toggleDropdown,
    markActiveLinks,
    updateStickyHeader,
    buildBreadcrumbs,
    navigateTo,
    getCurrentRoute,
    on,
    selectors: SELECTORS,
    isInternalLink: utils.isInternalLink
  });

  window.MedOrbitsNavigation = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Navigation = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
