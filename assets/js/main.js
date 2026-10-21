
/**
 * MedOrbits -- Main Frontend Controller
 * File: /assets/js/main.js
 * Version: 1.1.0
 *
 * Responsibilities:
 * - Coordinate page-level UI initialization
 * - Highlight active navigation links
 * - Manage sticky header state
 * - Handle scroll progress and back-to-top controls
 * - Support search interfaces and clear controls
 * - Initialize tabs, accordions, and dismissible banners
 * - Support reveal effects and animated counters
 * - Provide reusable page utilities
 *
 * Dependencies:
 * - Optional: assets/js/app.js
 *
 * API, authentication, payments, authorization, and
 * persistence remain in their dedicated modules.
 */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsMain) return;

  const CONFIG = Object.freeze({
    name: "MedOrbits",
    module: "main",
    version: "1.1.0",

    selectors: Object.freeze({
      header: "[data-site-header]",
      activeNav: "[data-active-nav]",
      scrollProgress: "[data-scroll-progress]",
      backToTop: "[data-back-to-top]",
      searchForm: "[data-site-search]",
      searchInput: "[data-search-input]",
      searchClear: "[data-search-clear]",
      searchResults: "[data-search-results]",
      tabs: "[data-tabs]",
      tabButton: "[data-tab]",
      tabPanel: "[data-tab-panel]",
      accordion: "[data-accordion]",
      accordionToggle: "[data-accordion-toggle]",
      accordionPanel: "[data-accordion-panel]",
      dismiss: "[data-dismiss]",
      lazyContent: "[data-lazy-content]",
      currentYear: "[data-current-year]",
      reveal: "[data-reveal]",
      counter: "[data-counter]"
    }),

    breakpoints: Object.freeze({
      mobile: 768
    }),

    scrollThreshold: 80,
    topThreshold: 400
  });

  const state = {
    initialized: false,
    header: null,
    scrollScheduled: false,
    observers: [],
    eventHandlers: new Map(),
    cleanups: []
  };

  const dom = {
    one(selector, root = document) {
      return root.querySelector(selector);
    },

    all(selector, root = document) {
      return Array.from(root.querySelectorAll(selector));
    },

    create(tag, options = {}) {
      const element = document.createElement(tag);

      if (options.className) {
        element.className = options.className;
      }

      if (options.text !== undefined) {
        element.textContent = String(options.text);
      }

      if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            element.setAttribute(key, String(value));
          }
        });
      }

      return element;
    },

    isVisible(element) {
      return Boolean(
        element &&
        element.isConnected &&
        element.getClientRects().length
      );
    },

    prefersReducedMotion() {
      return window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }
  };

  // --------------------------------------------------
  // Route and navigation utilities
  // --------------------------------------------------

  const routes = {
    normalize(path) {
      if (!path) return "/";

      let normalized = String(path)
        .split("?")[0]
        .split("#")[0];

      try {
        normalized = decodeURIComponent(normalized);
      } catch {
        // Retain the original path if decoding fails.
      }

      normalized = normalized.replace(/\/+/g, "/");

      if (normalized.length > 1) {
        normalized = normalized.replace(/\/+$/, "");
      }

      return normalized || "/";
    },

    currentPath() {
      return this.normalize(window.location.pathname);
    },

    isCurrentLink(link) {
      if (!link || !link.href) return false;

      try {
        const url = new URL(link.href, window.location.href);

        if (url.origin !== window.location.origin) {
          return false;
        }

        const current = this.currentPath();
        const target = this.normalize(url.pathname);

        if (current === target) return true;

        if (target.endsWith("/index.html")) {
          const directory = this.normalize(
            target.slice(0, -"index.html".length)
          );

          return directory === current;
        }

        return false;
      } catch {
        return false;
      }
    },

    updateActiveNavigation() {
      const links = dom.all(
        `${CONFIG.selectors.activeNav} a[href], ` +
        'a[data-active-nav][href]'
      );

      const candidates = links.length
        ? links
        : dom.all('a[href]:not([data-no-active-route])');

      candidates.forEach(link => {
        const active = this.isCurrentLink(link);

        link.classList.toggle("is-active", active);

        if (active) {
          link.setAttribute("aria-current", "page");
        } else if (link.getAttribute("aria-current") === "page") {
          link.removeAttribute("aria-current");
        }

        const parent = link.closest(
          "[data-nav-group], li, [data-navigation-item]"
        );

        parent?.classList.toggle("is-active", active);
      });
    }
  };

  // --------------------------------------------------
  // Sticky header and scroll scheduling
  // --------------------------------------------------

  const header = {
    init() {
      state.header = dom.one(CONFIG.selectors.header);

      if (!state.header) return;

      this.update();

      window.addEventListener("scroll", this.scheduleUpdate, {
        passive: true
      });
    },

    scheduleUpdate() {
      if (state.scrollScheduled) return;

      state.scrollScheduled = true;

      window.requestAnimationFrame(() => {
        state.scrollScheduled = false;

        header.update();
        scrollControls.update();
      });
    },

    update() {
      if (!state.header) return;

      const scrolled = window.scrollY > CONFIG.scrollThreshold;

      state.header.classList.toggle("is-scrolled", scrolled);
      state.header.dataset.scrolled = String(scrolled);
    }
  };

  // --------------------------------------------------
  // Scroll progress and back-to-top controls
  // --------------------------------------------------

  const scrollControls = {
    progressElements: [],
    topButtons: [],

    init() {
      this.progressElements = dom.all(
        CONFIG.selectors.scrollProgress
      );

      this.topButtons = dom.all(
        CONFIG.selectors.backToTop
      );

      this.update();

      // header.init() already registers the scroll handler.
      window.addEventListener("resize", header.scheduleUpdate, {
        passive: true
      });

      this.topButtons.forEach(button => {
        const onClick = () => {
          window.scrollTo({
            top: 0,
            behavior: dom.prefersReducedMotion() ? "auto" : "smooth"
          });
        };

        button.addEventListener("click", onClick);

        state.cleanups.push(() => {
          button.removeEventListener("click", onClick);
        });
      });
    },

    update() {
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      const progress = scrollableHeight > 0
        ? Math.min(
            100,
            Math.max(0, (window.scrollY / scrollableHeight) * 100)
          )
        : 0;

      this.progressElements.forEach(element => {
        element.style.width = `${progress}%`;
        element.setAttribute(
          "aria-valuenow",
          String(Math.round(progress))
        );
      });

      this.topButtons.forEach(button => {
        button.hidden = window.scrollY < CONFIG.topThreshold;
      });
    }
  };

  // --------------------------------------------------
  // Search interface
  // --------------------------------------------------

  const search = {
    init() {
      dom.all(CONFIG.selectors.searchForm).forEach(form => {
        if (form.dataset.mainSearchInitialized === "true") return;

        form.dataset.mainSearchInitialized = "true";

        const input = dom.one(
          CONFIG.selectors.searchInput,
          form
        );

        const clearButton = dom.one(
          CONFIG.selectors.searchClear,
          form
        );

        if (!input) return;

        const updateClearButton = () => {
          if (clearButton) {
            clearButton.hidden = input.value.length === 0;
          }
        };

        const onInput = () => {
          updateClearButton();

          form.dispatchEvent(
            new CustomEvent("medorbits:search-input", {
              bubbles: true,
              detail: {
                query: input.value.trim(),
                form
              }
            })
          );
        };

        const onClear = () => {
          input.value = "";
          input.focus();

          input.dispatchEvent(
            new Event("input", { bubbles: true })
          );
        };

        const onSubmit = event => {
          const query = input.value.trim();

          if (!query) {
            event.preventDefault();
            input.focus();
            return;
          }

          form.dispatchEvent(
            new CustomEvent("medorbits:search-submit", {
              bubbles: true,
              detail: { query, form }
            })
          );

          // Native form submission remains available.
          // Actual search processing belongs to search.js.
        };

        input.addEventListener("input", onInput);
        form.addEventListener("submit", onSubmit);
        clearButton?.addEventListener("click", onClear);

        state.cleanups.push(() => {
          input.removeEventListener("input", onInput);
          form.removeEventListener("submit", onSubmit);
          clearButton?.removeEventListener("click", onClear);
          delete form.dataset.mainSearchInitialized;
        });

        updateClearButton();
      });
    }
  };

  // --------------------------------------------------
  // Accessible tabs
  // --------------------------------------------------

  const tabs = {
    init() {
      dom.all(CONFIG.selectors.tabs).forEach(container => {
        if (container.dataset.mainTabsInitialized === "true") return;

        container.dataset.mainTabsInitialized = "true";

        const buttons = dom.all(
          CONFIG.selectors.tabButton,
          container
        );

        const panels = dom.all(
          CONFIG.selectors.tabPanel,
          container
        );

        if (!buttons.length || !panels.length) return;

        const activate = (selectedButton, moveFocus = false) => {
          const selectedId =
            selectedButton.getAttribute("aria-controls") ||
            selectedButton.dataset.tab;

          if (!selectedId) return;

          buttons.forEach(button => {
            const active = button === selectedButton;

            button.setAttribute("aria-selected", String(active));
            button.setAttribute("tabindex", active ? "0" : "-1");
            button.classList.toggle("is-active", active);
          });

          panels.forEach(panel => {
            const active =
              panel.id === selectedId ||
              panel.dataset.tabPanel === selectedId;

            panel.hidden = !active;
            panel.classList.toggle("is-active", active);
          });

          if (moveFocus) selectedButton.focus();

          container.dispatchEvent(
            new CustomEvent("medorbits:tab-change", {
              bubbles: true,
              detail: { id: selectedId }
            })
          );
        };

        buttons.forEach((button, index) => {
          const onClick = () => activate(button);

          const onKeydown = event => {
            let nextIndex = index;

            if (
              event.key === "ArrowRight" ||
              event.key === "ArrowDown"
            ) {
              nextIndex = (index + 1) % buttons.length;
            } else if (
              event.key === "ArrowLeft" ||
              event.key === "ArrowUp"
            ) {
              nextIndex = (index - 1 + buttons.length) % buttons.length;
            } else if (event.key === "Home") {
              nextIndex = 0;
            } else if (event.key === "End") {
              nextIndex = buttons.length - 1;
            } else {
              return;
            }

            event.preventDefault();
            activate(buttons[nextIndex], true);
          };

          button.addEventListener("click", onClick);
          button.addEventListener("keydown", onKeydown);

          state.cleanups.push(() => {
            button.removeEventListener("click", onClick);
            button.removeEventListener("keydown", onKeydown);
          });
        });

        const initial =
          buttons.find(button =>
            button.getAttribute("aria-selected") === "true"
          ) || buttons[0];

        activate(initial);
      });
    }
  };

  // --------------------------------------------------
  // Accessible accordions
  // --------------------------------------------------

  const accordions = {
    init() {
      dom.all(CONFIG.selectors.accordion).forEach(item => {
        if (item.dataset.mainAccordionInitialized === "true") return;

        item.dataset.mainAccordionInitialized = "true";

        const toggle = dom.one(
          CONFIG.selectors.accordionToggle,
          item
        );

        const panel = dom.one(
          CONFIG.selectors.accordionPanel,
          item
        );

        if (!toggle || !panel) return;

        const setOpen = open => {
          toggle.setAttribute("aria-expanded", String(open));
          panel.hidden = !open;
          item.classList.toggle("is-open", open);
        };

        setOpen(
          toggle.hasAttribute("aria-expanded")
            ? toggle.getAttribute("aria-expanded") === "true"
            : !panel.hidden
        );

        const onClick = () => {
          const open = toggle.getAttribute("aria-expanded") !== "true";

          if (
            item.parentElement?.dataset.accordionMode === "single" &&
            open
          ) {
            dom.all(
              CONFIG.selectors.accordion,
              item.parentElement
            ).forEach(other => {
              if (other === item) return;

              const otherToggle = dom.one(
                CONFIG.selectors.accordionToggle,
                other
              );

              const otherPanel = dom.one(
                CONFIG.selectors.accordionPanel,
                other
              );

              if (otherToggle && otherPanel) {
                otherToggle.setAttribute("aria-expanded", "false");
                otherPanel.hidden = true;
                other.classList.remove("is-open");
              }
            });
          }

          setOpen(open);
        };

        toggle.addEventListener("click", onClick);

        state.cleanups.push(() => {
          toggle.removeEventListener("click", onClick);
        });
      });
    }
  };

  // --------------------------------------------------
  // Dismissible banners and notices
  // --------------------------------------------------

  const dismissible = {
    init() {
      const onClick = event => {
        if (!(event.target instanceof Element)) return;

        const button = event.target.closest(CONFIG.selectors.dismiss);

        if (!button) return;

        const targetId = button.getAttribute("aria-controls");

        const target = targetId
          ? document.getElementById(targetId)
          : button.closest(
              "[data-dismissible], .notice, .alert, .banner"
            );

        if (!target) return;

        target.hidden = true;

        target.dispatchEvent(
          new CustomEvent("medorbits:dismiss", {
            bubbles: true,
            detail: { target }
          })
        );
      };

      document.addEventListener("click", onClick);

      state.cleanups.push(() => {
        document.removeEventListener("click", onClick);
      });
    }
  };

  // --------------------------------------------------
  // Reveal-on-scroll effects
  // --------------------------------------------------

  const reveal = {
    init() {
      const elements = dom.all(CONFIG.selectors.reveal);

      if (!elements.length) return;

      if (
        dom.prefersReducedMotion() ||
        !("IntersectionObserver" in window)
      ) {
        elements.forEach(element => {
          element.classList.add("is-visible");
        });

        return;
      }

      const observer = new IntersectionObserver(
        (entries, currentObserver) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            entry.target.classList.add("is-visible");
            currentObserver.unobserve(entry.target);
          });
        },
        {
          threshold: 0.12,
          rootMargin: "0px 0px -35px 0px"
        }
      );

      elements.forEach(element => observer.observe(element));
      state.observers.push(observer);
    }
  };

  // --------------------------------------------------
  // Animated number counters
  // --------------------------------------------------

  const counters = {
    init() {
      const elements = dom.all(CONFIG.selectors.counter);

      if (!elements.length) return;

      const animate = element => {
        if (element.dataset.counterAnimated === "true") return;

        const target = Number(element.dataset.counter);

        if (!Number.isFinite(target)) return;

        element.dataset.counterAnimated = "true";

        const decimals = Math.min(
          6,
          Math.max(0, Number(element.dataset.decimals) || 0)
        );

        const duration = Math.max(
          100,
          Math.min(5000, Number(element.dataset.duration) || 1200)
        );

        const format = value => value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });

        if (dom.prefersReducedMotion()) {
          element.textContent = format(target);
          return;
        }

        const startTime = performance.now();

        const step = now => {
          const progress = Math.min(
            1,
            (now - startTime) / duration
          );

          const eased = 1 - Math.pow(1 - progress, 3);

          element.textContent = format(target * eased);

          if (progress < 1) {
            window.requestAnimationFrame(step);
          }
        };

        window.requestAnimationFrame(step);
      };

      if (!("IntersectionObserver" in window)) {
        elements.forEach(animate);
        return;
      }

      const observer = new IntersectionObserver(
        (entries, currentObserver) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            animate(entry.target);
            currentObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.4 }
      );

      elements.forEach(element => observer.observe(element));
      state.observers.push(observer);
    }
  };

  // --------------------------------------------------
  // Footer initialization
  // --------------------------------------------------

  const footer = {
    init() {
      const year = String(new Date().getFullYear());

      dom.all(CONFIG.selectors.currentYear).forEach(element => {
        element.textContent = year;
      });
    }
  };

  // --------------------------------------------------
  // Reusable page utilities
  // --------------------------------------------------

  const utils = {
    debounce(callback, delay = 250) {
      let timeoutId;

      return (...args) => {
        window.clearTimeout(timeoutId);

        timeoutId = window.setTimeout(() => {
          callback(...args);
        }, Math.max(0, Number(delay) || 0));
      };
    },

    throttleFrame(callback) {
      let scheduled = false;

      return (...args) => {
        if (scheduled) return;

        scheduled = true;

        window.requestAnimationFrame(() => {
          scheduled = false;
          callback(...args);
        });
      };
    },

    getQueryParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    },

    setQueryParam(name, value) {
      const url = new URL(window.location.href);

      if (value === null || value === undefined || value === "") {
        url.searchParams.delete(name);
      } else {
        url.searchParams.set(name, String(value));
      }

      window.history.replaceState(
        window.history.state,
        "",
        url
      );
    },

    scrollToElement(target, offset = 0) {
      const element = typeof target === "string"
        ? document.querySelector(target)
        : target;

      if (!element) return false;

      const top =
        element.getBoundingClientRect().top +
        window.scrollY -
        (Number(offset) || 0);

      window.scrollTo({
        top: Math.max(0, top),
        behavior: dom.prefersReducedMotion() ? "auto" : "smooth"
      });

      return true;
    },

    on(name, handler) {
      if (typeof handler !== "function") {
        return () => {};
      }

      document.addEventListener(name, handler);

      const handlers = state.eventHandlers.get(name) || new Set();
      handlers.add(handler);
      state.eventHandlers.set(name, handlers);

      return () => {
        document.removeEventListener(name, handler);
        handlers.delete(handler);

        if (!handlers.size) {
          state.eventHandlers.delete(name);
        }
      };
    },

    destroy() {
      state.cleanups.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error("[MedOrbits] Cleanup failed:", error);
        }
      });

      state.cleanups = [];

      state.observers.forEach(observer => observer.disconnect());
      state.observers = [];

      window.removeEventListener("scroll", header.scheduleUpdate);
      window.removeEventListener("resize", header.scheduleUpdate);

      state.header = null;
      state.initialized = false;

      document.documentElement.classList.remove("js-enabled");
    }
  };

  // --------------------------------------------------
  // Page initialization
  // --------------------------------------------------

  function init() {
    if (state.initialized) return;

    state.initialized = true;

    try {
      routes.updateActiveNavigation();
      header.init();
      scrollControls.init();
      search.init();
      tabs.init();
      accordions.init();
      dismissible.init();
      reveal.init();
      counters.init();
      footer.init();

      document.documentElement.classList.add("js-enabled");

      document.dispatchEvent(
        new CustomEvent("medorbits:main-ready", {
          bubbles: true,
          detail: {
            version: CONFIG.version,
            path: routes.currentPath()
          }
        })
      );
    } catch (error) {
      state.initialized = false;

      console.error(
        `[${CONFIG.name}] Main controller initialization failed`,
        error
      );
    }
  }

  const api = Object.freeze({
    version: CONFIG.version,
    init,
    routes,
    search,
    tabs,
    accordions,
    scroll: scrollControls,
    utils,

    get initialized() {
      return state.initialized;
    }
  });

  window.MedOrbitsMain = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }

})(window, document);
