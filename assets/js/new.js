
(() => {
  "use strict";

  /* =========================================================
     MEDORBITS UNIVERSAL WEBSITE ENGINE
     File: /assets/js/new.js
     Theme: Burgundy Noir + Champagne Luxury
     Features:
       - Luxury page theme and intro animations
       - Responsive navigation and mobile menu
       - Search and catalogue filters
       - Catalogue sliders and carousels
       - Live notification ticker
       - New releases JSON integration
       - Scroll reveal and animated counters
       - Modal dialogs
       - Forms, validation and feedback
       - Password visibility toggles
       - Accordions and tabs
       - Safe links and utility helpers
       - Reduced-motion accessibility
     ========================================================= */

  const GLOBAL_KEY = "__MEDORBITS_UNIVERSAL_ENGINE__";

  if (window[GLOBAL_KEY]?.initialized) {
    window[GLOBAL_KEY].refresh?.();
    return;
  }

  const state = {
    initialized: false,
    observers: [],
    listeners: [],
    intervals: [],
    timeouts: [],
    pageTheme: "cinematic"
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isElement = (value) =>
    value instanceof Element;

  const on = (element, event, handler, options) => {
    if (!element) return;

    element.addEventListener(event, handler, options);

    state.listeners.push(() => {
      element.removeEventListener(event, handler, options);
    });
  };

  const later = (callback, delay = 0) => {
    const id = window.setTimeout(callback, delay);
    state.timeouts.push(id);
    return id;
  };

  const every = (callback, delay) => {
    const id = window.setInterval(callback, delay);
    state.intervals.push(id);
    return id;
  };

  const safeText = (value) =>
    String(value ?? "").trim();

  const safeUrl = (value, fallback = "#") => {
    try {
      const url = new URL(
        safeText(value) || fallback,
        window.location.href
      );

      if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
        return fallback;
      }

      return url.href;
    } catch {
      return fallback;
    }
  };

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const parseJson = (value, fallback = null) => {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const normalize = (value) =>
    safeText(value)
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const debounce = (callback, delay = 180) => {
    let timer;

    return (...args) => {
      window.clearTimeout(timer);

      timer = window.setTimeout(() => {
        callback(...args);
      }, delay);

      state.timeouts.push(timer);
    };
  };

  const dispatch = (name, detail = {}) => {
    document.dispatchEvent(
      new CustomEvent(`medorbits:${name}`, { detail })
    );
  };

  /* =========================================================
     1. PAGE IDENTIFICATION AND LUXURY THEME
     ========================================================= */

  function getPageSlug() {
    const explicit =
      document.body?.dataset.page ||
      document.documentElement.dataset.page;

    if (explicit) {
      return normalize(explicit).replace(/\s+/g, "-");
    }

    const path = window.location.pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    const filename = path[path.length - 1] || "home";

    return normalize(
      filename.replace(/\.(html?|php|aspx?)$/i, "")
    );
  }

  function getPageTheme(slug) {
    const page = normalize(slug);

    const themeMap = {
      home: "cinematic",
      index: "cinematic",
      "index-html": "cinematic",
      admissions: "admissions",
      admission: "admissions",
      mbbs: "admissions",
      bds: "admissions",
      bams: "admissions",
      bums: "admissions",
      courses: "catalogue",
      catalogue: "catalogue",
      catalog: "catalogue",
      colleges: "catalogue",
      universities: "catalogue",
      search: "catalogue",
      directory: "catalogue",
      scholarships: "catalogue",
      hostels: "catalogue",
      support: "support",
      contact: "support",
      "help-centre": "support",
      "help-center": "support",
      refunds: "support",
      "refund-request": "support",
      payments: "support",
      login: "account",
      register: "account",
      signup: "account",
      "sign-in": "account",
      "sign-up": "account",
      profile: "account",
      dashboard: "account",
      security: "account",
      "security-settings": "account",
      careers: "careers",
      career: "careers",
      jobs: "careers",
      recruitment: "careers",
      "career-guidance": "careers",
      legal: "legal",
      privacy: "legal",
      "privacy-policy": "legal",
      terms: "legal",
      "terms-and-conditions": "legal",
      "refund-policy": "legal",
      cookies: "legal",
      disclaimer: "legal"
    };

    if (themeMap[page]) {
      return themeMap[page];
    }

    if (/admission|medical|neet|mbbs|bds|bams|bums/.test(page)) {
      return "admissions";
    }

    if (/course|catalog|college|universit|search|directory|scholarship/.test(page)) {
      return "catalogue";
    }

    if (/support|contact|help|refund|payment|ticket/.test(page)) {
      return "support";
    }

    if (/login|register|signup|account|profile|dashboard|security/.test(page)) {
      return "account";
    }

    if (/career|job|recruit|employment/.test(page)) {
      return "careers";
    }

    if (/legal|privacy|terms|policy|cookie|disclaimer/.test(page)) {
      return "legal";
    }

    return "cinematic";
  }

  function initLuxuryPageTheme() {
    const slug = getPageSlug();
    const theme = getPageTheme(slug);

    state.pageTheme = theme;

    document.documentElement.dataset.page = slug;
    document.documentElement.dataset.theme = "burgundy-champagne";
    document.documentElement.dataset.intro = theme;

    if (document.body) {
      document.body.dataset.page = slug;
      document.body.dataset.intro = theme;
      document.body.classList.add("mo-theme-luxury");
    }

    const intro = $(".intro");

    if (intro) {
      intro.dataset.intro = theme;
      intro.classList.add(`intro-${theme}`);
    }

    dispatch("theme-ready", {
      page: slug,
      theme
    });
  }

  /* =========================================================
     2. INTRO ANIMATION
     ========================================================= */

  function initIntro() {
    const intro = $(".intro");

    if (!intro) return;

    const pageSlug = getPageSlug();
    const sessionKey = `medorbits-intro-seen:${pageSlug}`;

    intro.dataset.intro = state.pageTheme;
    intro.classList.add(`intro-${state.pageTheme}`);

    if (prefersReducedMotion()) {
      intro.classList.add("is-complete");
      intro.setAttribute("aria-hidden", "true");
      return;
    }

    let alreadySeen = false;

    try {
      alreadySeen = sessionStorage.getItem(sessionKey) === "1";
    } catch {
      // Storage may be blocked by the browser.
    }

    if (alreadySeen) {
      intro.classList.add("is-complete");
      intro.setAttribute("aria-hidden", "true");
      return;
    }

    document.documentElement.classList.add("mo-intro-active");

    const finishIntro = () => {
      intro.classList.add("is-complete");
      intro.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("mo-intro-active");

      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {
        // Intro can still finish without session storage.
      }

      dispatch("intro-complete", {
        page: pageSlug,
        theme: state.pageTheme
      });
    };

    const duration = Math.max(
      500,
      Number(intro.dataset.duration) || 1800
    );

    const finishButton = $(
      "[data-intro-skip], .intro-skip, .skip-intro",
      intro
    );

    if (finishButton) {
      on(finishButton, "click", finishIntro);
    }

    on(document, "keydown", (event) => {
      if (event.key === "Escape" && !intro.classList.contains("is-complete")) {
        finishIntro();
      }
    });

    later(finishIntro, duration);
  }

  /* =========================================================
     3. NAVIGATION AND MOBILE MENU
     ========================================================= */

  function initNavigation() {
    const menuButtons = $$(
      [
        "[data-menu-toggle]",
        "[data-nav-toggle]",
        ".menu-toggle",
        ".nav-toggle",
        ".hamburger",
        ".mobile-menu-toggle"
      ].join(",")
    );

    const menus = $$(
      [
        "[data-navigation]",
        "[data-mobile-menu]",
        ".site-navigation",
        ".main-navigation",
        ".nav-menu",
        ".mobile-menu"
      ].join(",")
    );

    const setMenuState = (menu, button, open) => {
      menu.classList.toggle("is-open", open);
      menu.classList.toggle("active", open);
      menu.classList.toggle("open", open);

      if (button) {
        button.setAttribute("aria-expanded", String(open));
      }

      if (open) {
        menu.removeAttribute("inert");
      } else {
        menu.setAttribute("inert", "");
      }
    };

    menuButtons.forEach((button) => {
      const targetSelector =
        button.dataset.target ||
        button.dataset.menuTarget ||
        button.getAttribute("aria-controls");

      const menu = targetSelector
        ? $(targetSelector)
        : menus[0];

      if (!menu) return;

      button.setAttribute(
        "aria-expanded",
        String(
          menu.classList.contains("is-open") ||
          menu.classList.contains("active") ||
          menu.classList.contains("open")
        )
      );

      on(button, "click", () => {
        const open = !(
          menu.classList.contains("is-open") ||
          menu.classList.contains("active") ||
          menu.classList.contains("open")
        );

        setMenuState(menu, button, open);
      });

      on(menu, "click", (event) => {
        const link = event.target.closest("a");

        if (link && window.matchMedia("(max-width: 900px)").matches) {
          setMenuState(menu, button, false);
        }
      });

      on(document, "keydown", (event) => {
        if (event.key === "Escape") {
          setMenuState(menu, button, false);
        }
      });
    });

    $$("a[href]").forEach((link) => {
      const url = safeUrl(link.getAttribute("href"), "");

      if (!url) {
        link.setAttribute("href", "#");
        link.setAttribute("aria-disabled", "true");
        return;
      }

      const rawHref = link.getAttribute("href") || "";

      if (/^https?:\/\//i.test(rawHref)) {
        try {
          const parsed = new URL(rawHref);

          if (parsed.origin !== window.location.origin) {
            link.setAttribute("rel", "noopener noreferrer");
          }
        } catch {
          // Leave normal browser handling intact.
        }
      }
    });

    const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

    $$("nav a[href], [data-navigation] a[href], .nav-menu a[href]").forEach((link) => {
      try {
        const linkUrl = new URL(link.href, window.location.href);

        const linkPath = linkUrl.pathname.replace(/\/+$/, "") || "/";

        if (
          linkUrl.origin === window.location.origin &&
          linkPath === currentPath
        ) {
          link.setAttribute("aria-current", "page");
          link.classList.add("is-current");
        }
      } catch {
        // Ignore malformed navigation URLs.
      }
    });

    const header = $(
      "[data-site-header], .site-header, header.site-header, .main-header"
    );

    if (header) {
      const updateHeader = () => {
        header.classList.toggle("is-scrolled", window.scrollY > 24);
      };

      updateHeader();

      on(window, "scroll", updateHeader, { passive: true });
    }
  }

  /* =========================================================
     4. UNIVERSAL SEARCH
     ========================================================= */

  function initSearch() {
    const searchInputs = $$(
      [
        "[data-site-search]",
        "[data-search-input]",
        ".site-search-input",
        ".catalogue-search",
        ".catalog-search",
        "input[type='search'][data-filter-target]"
      ].join(",")
    );

    searchInputs.forEach((input) => {
      const targetSelector =
        input.dataset.filterTarget ||
        input.dataset.searchTarget;

      const target = targetSelector ? $(targetSelector) : null;

      const resultSelector =
        input.dataset.results ||
        "[data-searchable], .searchable-item, .catalogue-card, .course-card";

      const statusSelector =
        input.dataset.status ||
        "[data-search-status]";

      const status = statusSelector ? $(statusSelector) : null;

      const performSearch = () => {
        const query = normalize(input.value);
        let visible = 0;
        let total = 0;

        if (target) {
          const items = $$(resultSelector, target);

          items.forEach((item) => {
            total += 1;

            const text = normalize(
              item.dataset.searchText ||
              item.textContent ||
              ""
            );

            const matches = !query || text.includes(query);

            item.hidden = !matches;
            item.classList.toggle("is-filtered-out", !matches);

            if (matches) visible += 1;
          });
        }

        if (status) {
          status.textContent = query
            ? `${visible} result${visible === 1 ? "" : "s"} found`
            : "";
        }

        dispatch("search", {
          query,
          visible,
          total
        });
      };

      on(input, "input", debounce(performSearch, 140));

      on(input, "keydown", (event) => {
        if (event.key === "Escape") {
          input.value = "";
          performSearch();
          input.blur();
        }
      });

      const form = input.closest("form");

      if (form) {
        on(form, "submit", (event) => {
          const hasLocalTarget = Boolean(target);

          if (hasLocalTarget) {
            event.preventDefault();
            performSearch();
          }
        });
      }
    });

    $$("[data-search-clear]").forEach((button) => {
      on(button, "click", () => {
        const targetSelector = button.dataset.searchClear;
        const input = targetSelector
          ? $(targetSelector)
          : $("input[type='search'], [data-site-search], [data-search-input]");

        if (!input) return;

        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
    });
  }

  /* =========================================================
     5. CATALOGUE FILTERS
     ========================================================= */

  function initCatalogueFilters() {
    const filters = $$("[data-catalogue-filter], [data-filter-group]");

    filters.forEach((filter) => {
      const selector =
        filter.dataset.filterTarget ||
        filter.dataset.catalogueTarget ||
        "[data-catalogue-list], .catalogue-grid";

      const container = $(selector);

      if (!container) return;

      const items = $$(
        "[data-catalogue-item], [data-searchable], .catalogue-card, .course-card, .college-card, .job-card",
        container
      );

      const applyFilters = () => {
        const selectedValue = normalize(
          filter.value ||
          filter.dataset.value ||
          "all"
        );

        let count = 0;

        items.forEach((item) => {
          const categories = normalize(
            [
              item.dataset.category,
              item.dataset.type,
              item.dataset.course,
              item.dataset.level,
              item.dataset.location,
              item.dataset.mode,
              item.dataset.tags
            ].filter(Boolean).join(" ")
          );

          const matches =
            !selectedValue ||
            selectedValue === "all" ||
            selectedValue === "all categories" ||
            categories.includes(selectedValue);

          item.hidden = !matches;
          item.classList.toggle("is-filtered-out", !matches);

          if (matches) count += 1;
        });

        const countTarget = $(
          filter.dataset.countTarget ||
          "[data-filter-count]"
        );

        if (countTarget) {
          countTarget.textContent = String(count);
        }

        dispatch("catalogue-filter", {
          value: selectedValue,
          visible: count,
          total: items.length
        });
      };

      on(filter, "change", applyFilters);

      if (filter.matches("input[type='search'], input[type='text']")) {
        on(filter, "input", debounce(applyFilters, 150));
      }
    });

    $$("[data-filter-button]").forEach((button) => {
      on(button, "click", () => {
        const group = button.dataset.filterGroup || "default";
        const value = normalize(button.dataset.filterButton || "all");

        $$(`[data-filter-button][data-filter-group="${CSS.escape(group)}"]`)
          .forEach((other) => {
            const active =
              other === button;

            other.classList.toggle("is-active", active);
            other.setAttribute("aria-pressed", String(active));
          });

        const selector =
          button.dataset.filterTarget ||
          "[data-catalogue-list], .catalogue-grid";

        const container = $(selector);

        if (!container) return;

        let count = 0;

        $$(
          "[data-catalogue-item], [data-searchable], .catalogue-card, .course-card, .college-card, .job-card",
          container
        ).forEach((item) => {
          const tags = normalize(
            [
              item.dataset.category,
              item.dataset.type,
              item.dataset.course,
              item.dataset.tags
            ].filter(Boolean).join(" ")
          );

          const visible =
            value === "all" ||
            value === "" ||
            tags.includes(value);

          item.hidden = !visible;
          item.classList.toggle("is-filtered-out", !visible);

          if (visible) count += 1;
        });

        const countTarget = $("[data-filter-count]");

        if (countTarget) {
          countTarget.textContent = String(count);
        }
      });
    });
  }

  /* =========================================================
     6. CAROUSELS AND CATALOGUE SLIDERS
     ========================================================= */

  function initSliders() {
    $$("[data-slider], [data-carousel]").forEach((slider) => {
      if (slider.dataset.moSliderReady === "1") return;

      slider.dataset.moSliderReady = "1";

      const track = $(
        "[data-slider-track], [data-carousel-track], .slider-track, .carousel-track",
        slider
      );

      if (!track) return;

      const slides = () => Array.from(track.children).filter((child) =>
        child.matches("[data-slide], .slide, .carousel-item, .catalogue-card")
      );

      const getGap = () => {
        const style = window.getComputedStyle(track);
        return parseFloat(style.columnGap || style.gap || "0") || 0;
      };

      const getStep = () => {
        const first = slides()[0];

        if (!first) return 0;

        return first.getBoundingClientRect().width + getGap();
      };

      const previous = $(
        "[data-slider-prev], [data-carousel-prev], .slider-prev, .carousel-prev",
        slider
      );

      const next = $(
        "[data-slider-next], [data-carousel-next], .slider-next, .carousel-next",
        slider
      );

      const updateControls = () => {
        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        const position = track.scrollLeft;

        if (previous) {
          previous.disabled = position <= 2;
          previous.setAttribute("aria-disabled", String(previous.disabled));
        }

        if (next) {
          next.disabled = position >= maxScroll - 2;
          next.setAttribute("aria-disabled", String(next.disabled));
        }
      };

      if (previous) {
        on(previous, "click", () => {
          track.scrollBy({
            left: -getStep(),
            behavior: prefersReducedMotion() ? "auto" : "smooth"
          });
        });
      }

      if (next) {
        on(next, "click", () => {
          track.scrollBy({
            left: getStep(),
            behavior: prefersReducedMotion() ? "auto" : "smooth"
          });
        });
      }

      on(track, "scroll", debounce(updateControls, 70), {
        passive: true
      });

      on(window, "resize", debounce(updateControls, 100));

      updateControls();
    });
  }

  /* =========================================================
     7. LIVE NOTIFICATIONS / ANNOUNCEMENT TICKER
     ========================================================= */

  function initNotifications() {
    $$("[data-notification-ticker], [data-live-ticker]").forEach((ticker) => {
      if (ticker.dataset.moTickerReady === "1") return;

      ticker.dataset.moTickerReady = "1";

      const items = $$(
        "[data-ticker-item], .ticker-item, .notification-item",
        ticker
      );

      if (items.length < 2) return;

      let index = items.findIndex((item) =>
        item.classList.contains("is-active")
      );

      if (index < 0) index = 0;

      const activate = (nextIndex) => {
        items.forEach((item, itemIndex) => {
          const active = itemIndex === nextIndex;

          item.classList.toggle("is-active", active);
          item.setAttribute("aria-hidden", String(!active));
        });

        index = nextIndex;
      };

      activate(index);

      if (!prefersReducedMotion()) {
        every(() => {
          activate((index + 1) % items.length);
        }, Math.max(2500, Number(ticker.dataset.interval) || 5000));
      }
    });

    $$("[data-notification-dismiss]").forEach((button) => {
      on(button, "click", () => {
        const notification = button.closest(
          "[data-notification], .notification, .notice"
        );

        if (!notification) return;

        notification.classList.add("is-dismissed");
        notification.setAttribute("aria-hidden", "true");

        later(() => {
          notification.hidden = true;
        }, 250);
      });
    });
  }

  /* =========================================================
     8. NEW RELEASES / JSON DATA
     ========================================================= */

  async function loadReleases(container) {
    const source =
      container.dataset.src ||
      container.dataset.releasesSrc ||
      "/assets/data/new-releases.json";

    const endpoint = safeUrl(source, "");

    if (!endpoint) {
      container.dataset.loadState = "error";
      return;
    }

    container.setAttribute("aria-busy", "true");
    container.dataset.loadState = "loading";

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const payload = await response.json();

      const releases = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.releases)
          ? payload.releases
          : Array.isArray(payload.items)
            ? payload.items
            : Array.isArray(payload.data)
              ? payload.data
              : [];

      if (!releases.length) {
        container.dataset.loadState = "empty";

        const emptyMessage =
          container.dataset.emptyMessage ||
          "New releases will appear here soon.";

        container.textContent = emptyMessage;
        return;
      }

      const fragment = document.createDocumentFragment();

      releases.forEach((release) => {
        if (!release || typeof release !== "object") return;

        const article = document.createElement("article");
        article.className = "release-card";
        article.dataset.releaseCard = "";

        if (release.category) {
          article.dataset.category = safeText(release.category);
        }

        const title = safeText(
          release.title ||
          release.name ||
          release.label ||
          "New release"
        );

        const description = safeText(
          release.description ||
          release.summary ||
          release.excerpt ||
          ""
        );

        const category = safeText(
          release.category ||
          release.type ||
          "Update"
        );

        const imageUrl = safeText(
          release.image ||
          release.imageUrl ||
          release.thumbnail ||
          ""
        );

        const linkUrl = safeUrl(
          release.url ||
          release.link ||
          release.href ||
          "#"
        );

        const badge = document.createElement("span");
        badge.className = "release-card__category";
        badge.textContent = category;

        const heading = document.createElement("h3");
        heading.className = "release-card__title";
        heading.textContent = title;

        article.appendChild(badge);

        if (imageUrl) {
          const safeImageUrl = safeUrl(imageUrl, "");

          if (safeImageUrl) {
            const image = document.createElement("img");

            image.className = "release-card__image";
            image.src = safeImageUrl;
            image.alt = safeText(release.imageAlt || title);
            image.loading = "lazy";
            image.decoding = "async";

            article.appendChild(image);
          }
        }

        article.appendChild(heading);

        if (description) {
          const paragraph = document.createElement("p");
          paragraph.className = "release-card__description";
          paragraph.textContent = description;

          article.appendChild(paragraph);
        }

        if (linkUrl && linkUrl !== safeUrl("#")) {
          const link = document.createElement("a");

          link.className = "release-card__link";
          link.href = linkUrl;
          link.textContent = safeText(
            release.buttonText ||
            release.cta ||
            "Explore"
          );

          if (new URL(linkUrl).origin !== window.location.origin) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }

          article.appendChild(link);
        }

        fragment.appendChild(article);
      });

      container.replaceChildren(fragment);
      container.dataset.loadState = "loaded";

      dispatch("releases-loaded", {
        count: container.children.length,
        source: endpoint
      });
    } catch (error) {
      container.dataset.loadState = "error";

      const errorTarget = $(
        "[data-releases-error]",
        container.parentElement || document
      );

      if (errorTarget) {
        errorTarget.hidden = false;
        errorTarget.textContent =
          "Releases are temporarily unavailable. Please try again later.";
      }

      console.error("[MedOrbits] Unable to load releases:", error);

      dispatch("releases-error", {
        message: safeText(error?.message)
      });
    } finally {
      container.removeAttribute("aria-busy");
    }
  }

  function initNewReleases() {
    $$("[data-new-releases], [data-releases-container]").forEach((container) => {
      if (container.dataset.moReleasesReady === "1") return;

      container.dataset.moReleasesReady = "1";
      loadReleases(container);
    });
  }

  /* =========================================================
     9. SCROLL REVEAL
     ========================================================= */

  function initScrollReveal() {
    const elements = $$(
      [
        "[data-reveal]",
        ".reveal-on-scroll",
        ".scroll-reveal",
        ".fade-up"
      ].join(",")
    );

    if (!elements.length) return;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.add("is-visible", "revealed");
        element.style.removeProperty("--mo-reveal-delay");
      });

      return;
    }

    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const element = entry.target;

        element.classList.add("is-visible", "revealed");
        instance.unobserve(element);
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -45px 0px"
    });

    elements.forEach((element, index) => {
      const delay = Number(element.dataset.revealDelay);

      if (Number.isFinite(delay) && delay >= 0) {
        element.style.setProperty(
          "--mo-reveal-delay",
          `${Math.min(delay, 1500)}ms`
        );
      } else if (element.dataset.revealStagger === "true") {
        element.style.setProperty(
          "--mo-reveal-delay",
          `${Math.min((index % 5) * 90, 360)}ms`
        );
      }

      observer.observe(element);
    });

    state.observers.push(observer);
  }

  /* =========================================================
     10. ANIMATED COUNTERS
     ========================================================= */

  function initCounters() {
    const counters = $$("[data-counter], [data-count-to]");

    if (!counters.length) return;

    const animateCounter = (element) => {
      if (element.dataset.counterDone === "1") return;

      element.dataset.counterDone = "1";

      const target = Number(
        element.dataset.countTo ||
        element.dataset.counter ||
        element.textContent.replace(/[^\d.-]/g, "")
      );

      if (!Number.isFinite(target)) return;

      if (prefersReducedMotion()) {
        element.textContent = formatCounter(element, target);
        return;
      }

      const duration = Math.max(
        250,
        Number(element.dataset.duration) || 1500
      );

      const startValue = Number(element.dataset.start) || 0;
      const startTime = performance.now();

      const update = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (target - startValue) * eased;

        element.textContent = formatCounter(element, current);

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          element.textContent = formatCounter(element, target);
        }
      };

      requestAnimationFrame(update);
    };

    const formatCounter = (element, value) => {
      const decimals = Math.max(
        0,
        Math.min(4, Number(element.dataset.decimals) || 0)
      );

      const formatted = Number(value).toLocaleString(
        document.documentElement.lang || "en-IN",
        {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }
      );

      return (
        safeText(element.dataset.prefix) +
        formatted +
        safeText(element.dataset.suffix)
      );
    };

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      counters.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        animateCounter(entry.target);
        instance.unobserve(entry.target);
      });
    }, {
      threshold: 0.45
    });

    counters.forEach((counter) => observer.observe(counter));
    state.observers.push(observer);
  }

  /* =========================================================
     11. MODAL DIALOGS
     ========================================================= */

  function initModals() {
    let activeModal = null;
    let previousFocus = null;

    const openModal = (modal) => {
      if (!modal) return;

      previousFocus = document.activeElement;
      activeModal = modal;

      modal.hidden = false;
      modal.classList.add("is-open", "active");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("mo-modal-open");

      const focusTarget = $(
        "[autofocus], [data-modal-focus], button, input, select, textarea, a[href]",
        modal
      );

      later(() => {
        focusTarget?.focus?.();
      }, 30);

      dispatch("modal-open", {
        id: modal.id || ""
      });
    };

    const closeModal = (modal = activeModal) => {
      if (!modal) return;

      modal.classList.remove("is-open", "active");
      modal.setAttribute("aria-hidden", "true");
      modal.hidden = true;

      if (activeModal === modal) {
        activeModal = null;
      }

      if (!activeModal) {
        document.body.classList.remove("mo-modal-open");
      }

      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }

      dispatch("modal-close", {
        id: modal.id || ""
      });
    };

    $$("[data-modal-open], [data-modal-target], [data-open-modal]").forEach((button) => {
      on(button, "click", (event) => {
        const selector =
          button.dataset.modalOpen ||
          button.dataset.modalTarget ||
          button.dataset.openModal;

        if (!selector) return;

        const modal = $(selector);

        if (!modal) return;

        event.preventDefault();
        openModal(modal);
      });
    });

    $$("[data-modal-close], .modal-close, [data-close-modal]").forEach((button) => {
      on(button, "click", () => {
        const modal = button.closest("[role='dialog'], .modal, [data-modal]");

        if (modal) closeModal(modal);
      });
    });

    $$("[role='dialog'], .modal, [data-modal]").forEach((modal) => {
      if (modal.hasAttribute("data-modal-initialized")) return;

      modal.setAttribute("data-modal-initialized", "true");

      if (!modal.classList.contains("is-open") && !modal.classList.contains("active")) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
      }

      on(modal, "click", (event) => {
        if (
          event.target === modal &&
          modal.dataset.closeOnBackdrop !== "false"
        ) {
          closeModal(modal);
        }
      });
    });

    on(document, "keydown", (event) => {
      if (event.key === "Escape" && activeModal) {
        closeModal(activeModal);
      }

      if (event.key === "Tab" && activeModal) {
        const focusable = $$(
          "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
          activeModal
        ).filter((element) => !element.hidden);

        if (!focusable.length) {
          event.preventDefault();
          activeModal.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    state.openModal = openModal;
    state.closeModal = closeModal;
  }

  /* =========================================================
     12. FORM VALIDATION AND FEEDBACK
     ========================================================= */

  function showFormMessage(form, message, success = false) {
    let target = $(
      "[data-form-feedback], .form-feedback, .form-message",
      form
    );

    if (!target) {
      target = document.createElement("p");
      target.className = "form-feedback";
      target.dataset.formFeedback = "";
      target.setAttribute("role", "status");
      target.setAttribute("aria-live", "polite");
      form.appendChild(target);
    }

    target.textContent = message;
    target.hidden = false;
    target.classList.toggle("is-success", success);
    target.classList.toggle("is-error", !success);
  }

  function initForms() {
    $$("form").forEach((form) => {
      if (form.dataset.moFormReady === "1") return;

      form.dataset.moFormReady = "1";

      on(form, "submit", (event) => {
        const requiredFields = $$(
          "input[required], select[required], textarea[required]",
          form
        );

        let firstInvalid = null;

        requiredFields.forEach((field) => {
          const valid = field.checkValidity();

          field.setAttribute("aria-invalid", String(!valid));

          if (!valid && !firstInvalid) {
            firstInvalid = field;
          }
        });

        const invalidField = $$(
          "input:invalid, select:invalid, textarea:invalid",
          form
        )[0];

        if (firstInvalid || invalidField) {
          event.preventDefault();

          const field = firstInvalid || invalidField;

          field.focus();

          showFormMessage(
            form,
            field.validationMessage || "Please check the required fields.",
            false
          );

          return;
        }

        const localOnly =
          form.dataset.localValidation === "true" ||
          form.dataset.noSubmit === "true";

        if (localOnly) {
          event.preventDefault();

          showFormMessage(
            form,
            form.dataset.successMessage ||
              "Your information looks valid. Connect this form to your submission endpoint to send it.",
            true
          );

          dispatch("form-validated", {
            formId: form.id || "",
            action: form.getAttribute("action") || ""
          });

          return;
        }

        /*
         * Normal forms submit using their HTML action and method.
         * No fake success message is shown here.
         */
        dispatch("form-submit", {
          formId: form.id || "",
          action: form.getAttribute("action") || "",
          method: (form.getAttribute("method") || "get").toUpperCase()
        });
      });

      $$("input, select, textarea", form).forEach((field) => {
        on(field, "input", () => {
          if (field.checkValidity()) {
            field.removeAttribute("aria-invalid");
          }
        });
      });
    });

    $$("[data-reset-form]").forEach((button) => {
      on(button, "click", () => {
        const selector = button.dataset.resetForm;
        const form = selector ? $(selector) : button.closest("form");

        if (!form) return;

        form.reset();

        const feedback = $(
          "[data-form-feedback], .form-feedback, .form-message",
          form
        );

        if (feedback) {
          feedback.textContent = "";
          feedback.hidden = true;
        }
      });
    });
  }

  /* =========================================================
     13. PASSWORD VISIBILITY
     ========================================================= */

  function initPasswordToggles() {
    $$(
      "[data-password-toggle], .password-toggle, [data-toggle-password]"
    ).forEach((button) => {
      const selector =
        button.dataset.passwordToggle ||
        button.dataset.togglePassword ||
        button.getAttribute("aria-controls");

      const input = selector
        ? $(selector)
        : button.parentElement?.querySelector("input");

      if (!input) return;

      button.setAttribute(
        "aria-label",
        button.getAttribute("aria-label") || "Show password"
      );

      button.setAttribute("aria-pressed", "false");

      on(button, "click", () => {
        const show = input.type === "password";

        input.type = show ? "text" : "password";

        button.setAttribute("aria-pressed", String(show));
        button.setAttribute(
          "aria-label",
          show ? "Hide password" : "Show password"
        );

        button.classList.toggle("is-visible", show);

        const label = $("[data-password-label]", button);

        if (label) {
          label.textContent = show ? "Hide" : "Show";
        }

        dispatch("password-visibility", {
          visible: show,
          inputId: input.id || ""
        });
      });
    });
  }

  /* =========================================================
     14. ACCORDIONS
     ========================================================= */

  function initAccordions() {
    $$(
      "[data-accordion-trigger], .accordion-trigger, .faq-question"
    ).forEach((trigger) => {
      const selector =
        trigger.dataset.accordionTrigger ||
        trigger.dataset.target ||
        trigger.getAttribute("aria-controls");

      const panel = selector
        ? $(selector)
        : trigger.nextElementSibling;

      if (!panel) return;

      const expanded =
        trigger.getAttribute("aria-expanded") === "true" ||
        panel.classList.contains("is-open") ||
        panel.classList.contains("active");

      trigger.setAttribute("aria-expanded", String(expanded));
      panel.hidden = !expanded;

      on(trigger, "click", () => {
        const open = trigger.getAttribute("aria-expanded") !== "true";

        const group = trigger.dataset.accordionGroup;

        if (group) {
          $$(
            `[data-accordion-trigger][data-accordion-group="${CSS.escape(group)}"]`
          ).forEach((otherTrigger) => {
            if (otherTrigger === trigger) return;

            const otherSelector =
              otherTrigger.dataset.accordionTrigger ||
              otherTrigger.dataset.target ||
              otherTrigger.getAttribute("aria-controls");

            const otherPanel = otherSelector
              ? $(otherSelector)
              : otherTrigger.nextElementSibling;

            otherTrigger.setAttribute("aria-expanded", "false");

            if (otherPanel) {
              otherPanel.hidden = true;
              otherPanel.classList.remove("is-open", "active");
            }
          });
        }

        trigger.setAttribute("aria-expanded", String(open));
        panel.hidden = !open;
        panel.classList.toggle("is-open", open);
        panel.classList.toggle("active", open);

        dispatch("accordion-toggle", {
          open,
          trigger: trigger.id || ""
        });
      });
    });
  }

  /* =========================================================
     15. TABS
     ========================================================= */

  function initTabs() {
    $$("[data-tab-list], .tabs").forEach((tabList) => {
      const buttons = $$(
        "[data-tab], [role='tab'], .tab-button",
        tabList
      );

      if (!buttons.length) return;

      const activate = (button) => {
        const targetSelector =
          button.dataset.tab ||
          button.dataset.tabTarget ||
          button.getAttribute("aria-controls");

        if (!targetSelector) return;

        const panel = $(targetSelector);

        if (!panel) return;

        buttons.forEach((other) => {
          const active = other === button;

          other.classList.toggle("is-active", active);
          other.setAttribute("aria-selected", String(active));
          other.setAttribute("tabindex", active ? "0" : "-1");
        });

        const groupSelector =
          tabList.dataset.tabPanels ||
          "[data-tab-panel], [role='tabpanel']";

        const panels = $$(
          groupSelector,
          tabList.parentElement || document
        );

        panels.forEach((otherPanel) => {
          const activePanel = otherPanel === panel;

          otherPanel.hidden = !activePanel;
          otherPanel.classList.toggle("is-active", activePanel);
        });

        panel.hidden = false;
        panel.classList.add("is-active");

        dispatch("tab-change", {
          target: targetSelector
        });
      };

      buttons.forEach((button) => {
        on(button, "click", () => activate(button));

        on(button, "keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
          }

          event.preventDefault();

          const currentIndex = buttons.indexOf(button);
          let nextIndex = currentIndex;

          if (event.key === "ArrowRight") {
            nextIndex = (currentIndex + 1) % buttons.length;
          } else if (event.key === "ArrowLeft") {
            nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
          } else if (event.key === "Home") {
            nextIndex = 0;
          } else if (event.key === "End") {
            nextIndex = buttons.length - 1;
          }

          buttons[nextIndex].focus();
          activate(buttons[nextIndex]);
        });
      });

      const initial =
        buttons.find((button) =>
          button.getAttribute("aria-selected") === "true" ||
          button.classList.contains("is-active")
        ) || buttons[0];

      activate(initial);
    });
  }

  /* =========================================================
     16. COPY TO CLIPBOARD
     ========================================================= */

  function initCopyButtons() {
    $$("[data-copy]").forEach((button) => {
      on(button, "click", async () => {
        const selector = button.dataset.copy;
        const target = selector ? $(selector) : null;

        const value =
          button.dataset.copyText ||
          target?.value ||
          target?.textContent ||
          "";

        if (!value) return;

        try {
          await navigator.clipboard.writeText(value);

          const originalText = button.dataset.originalText || button.textContent;

          button.dataset.originalText = originalText;
          button.textContent = button.dataset.copiedLabel || "Copied";

          later(() => {
            button.textContent = originalText;
          }, 1600);

          dispatch("copied", { length: value.length });
        } catch {
          showCopyFallback(value, button);
        }
      });
    });
  }

  function showCopyFallback(value, button) {
    const textarea = document.createElement("textarea");

    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    textarea.remove();

    if (copied) {
      const originalText = button.textContent;
      button.textContent = "Copied";

      later(() => {
        button.textContent = originalText;
      }, 1600);
    } else {
      window.prompt("Copy this text:", value);
    }
  }

  /* =========================================================
     17. BACK TO TOP
     ========================================================= */

  function initBackToTop() {
    const buttons = $$(
      "[data-back-to-top], .back-to-top, #backToTop"
    );

    if (!buttons.length) return;

    const update = () => {
      buttons.forEach((button) => {
        button.classList.toggle("is-visible", window.scrollY > 420);
        button.setAttribute(
          "aria-hidden",
          String(window.scrollY <= 420)
        );
      });
    };

    update();

    on(window, "scroll", debounce(update, 70), {
      passive: true
    });

    buttons.forEach((button) => {
      on(button, "click", () => {
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion() ? "auto" : "smooth"
        });
      });
    });
  }

  /* =========================================================
     18. EXTERNAL LINK AND DOWNLOAD HELPERS
     ========================================================= */

  function initActionLinks() {
    $$("[data-open-url]").forEach((button) => {
      on(button, "click", () => {
        const url = safeUrl(button.dataset.openUrl, "");

        if (!url) return;

        const parsed = new URL(url);

        if (parsed.origin === window.location.origin) {
          window.location.assign(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      });
    });

    $$("[data-scroll-to]").forEach((button) => {
      on(button, "click", () => {
        const target = $(button.dataset.scrollTo);

        if (!target) return;

        target.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start"
        });
      });
    });
  }

  /* =========================================================
     19. LAZY IMAGES
     ========================================================= */

  function initLazyImages() {
    $$("img[data-src]").forEach((image) => {
      if (image.dataset.moLazyReady === "1") return;

      image.dataset.moLazyReady = "1";

      const source = safeUrl(image.dataset.src, "");

      if (!source) return;

      if ("loading" in HTMLImageElement.prototype) {
        image.loading = image.loading || "lazy";
        image.src = source;
        image.removeAttribute("data-src");
        return;
      }

      if (!("IntersectionObserver" in window)) {
        image.src = source;
        image.removeAttribute("data-src");
        return;
      }

      const observer = new IntersectionObserver((entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          image.src = source;
          image.removeAttribute("data-src");
          instance.unobserve(image);
        });
      }, {
        rootMargin: "180px"
      });

      observer.observe(image);
      state.observers.push(observer);
    });
  }

  /* =========================================================
     20. CURRENT YEAR
     ========================================================= */

  function initCurrentYear() {
    $$("[data-current-year], .current-year, #currentYear").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  /* =========================================================
     21. EXTERNAL CUSTOM INITIALIZERS
     ========================================================= */

  function initCustomEvents() {
    dispatch("ready", {
      page: getPageSlug(),
      theme: state.pageTheme
    });
  }

  /* =========================================================
     22. ENGINE INITIALIZATION
     ========================================================= */

  function refresh() {
    /*
     * Refresh is intentionally limited to lightweight components.
     * It does not rebind the full document and duplicate listeners.
     */
    initCurrentYear();
    initLazyImages();
    initScrollReveal();
    initCounters();
    initSliders();
  }

  function init() {
    if (state.initialized) {
      refresh();
      return;
    }

    state.initialized = true;

    initLuxuryPageTheme();
    initIntro();
    initNavigation();
    initSearch();
    initCatalogueFilters();
    initSliders();
    initNotifications();
    initNewReleases();
    initScrollReveal();
    initCounters();
    initModals();
    initForms();
    initPasswordToggles();
    initAccordions();
    initTabs();
    initCopyButtons();
    initBackToTop();
    initActionLinks();
    initLazyImages();
    initCurrentYear();
    initCustomEvents();
  }

  function destroy() {
    state.listeners.forEach((removeListener) => {
      try {
        removeListener();
      } catch {
        // Continue cleanup if a listener was already removed.
      }
    });

    state.listeners = [];

    state.observers.forEach((observer) => {
      try {
        observer.disconnect();
      } catch {
        // Continue cleanup if an observer is unavailable.
      }
    });

    state.observers = [];

    state.intervals.forEach((id) => window.clearInterval(id));
    state.timeouts.forEach((id) => window.clearTimeout(id));

    state.intervals = [];
    state.timeouts = [];
    state.initialized = false;

    document.documentElement.classList.remove("mo-intro-active");
    document.body?.classList.remove("mo-modal-open");

    dispatch("destroy");
  }

  window[GLOBAL_KEY] = {
    initialized: false,
    refresh,
    destroy,
    openModal: (...args) => state.openModal?.(...args),
    closeModal: (...args) => state.closeModal?.(...args),
    get pageTheme() {
      return state.pageTheme;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window[GLOBAL_KEY].initialized = true;

  /*
   * Optional compatibility alias for existing project scripts.
   * Example: MedOrbits.refresh()
   */
  window.MedOrbits = window.MedOrbits || {};

  window.MedOrbits.refresh = refresh;
  window.MedOrbits.destroy = destroy;
  window.MedOrbits.openModal = (...args) => state.openModal?.(...args);
  window.MedOrbits.closeModal = (...args) => state.closeModal?.(...args);
  window.MedOrbits.safeUrl = safeUrl;
  window.MedOrbits.escapeHtml = escapeHtml;
  window.MedOrbits.dispatch = dispatch;

})();
