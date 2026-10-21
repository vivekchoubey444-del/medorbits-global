
/**
 * MedOrbits -- Application Bootstrap
 * File: /assets/js/app.js
 * Version: 1.1.0
 *
 * Responsibilities:
 * - Initialize application-wide UI behavior
 * - Manage accessible mobile navigation and dropdowns
 * - Persist theme preferences
 * - Provide accessible toast notifications
 * - Enhance forms, password visibility and external links
 * - Initialize optional page modules safely
 * - Manage footer year and social links
 * - Provide cookie-consent helpers and global error logging
 *
 * Authentication, API clients, payments and authorization belong
 * to their dedicated modules.
 */

(() => {
  "use strict";

  if (window.MedOrbits?.initialized) return;

  const APP = Object.freeze({
    name: "MedOrbits",
    version: "1.1.0",

    storageKeys: Object.freeze({
      theme: "medorbits-theme",
      cookieConsent: "medorbits-cookie-consent"
    }),

    selectors: Object.freeze({
      menuToggle: "[data-menu-toggle]",
      navigation: "[data-navigation]",
      dropdownToggle: "[data-dropdown-toggle]",
      themeToggle: "[data-theme-toggle]",
      toastContainer: "[data-toast-container]",
      backToTop: "[data-back-to-top]",
      year: "[data-current-year]",
      form: "form[data-enhance]",
      passwordToggle: "[data-password-toggle]"
    })
  });

  const state = {
    initialized: false,
    cleanups: [],
    toastTimerIds: new Set()
  };

  const helpers = {
    query(selector, root = document) {
      return root.querySelector(selector);
    },

    queryAll(selector, root = document) {
      return Array.from(root.querySelectorAll(selector));
    },

    safeStorageGet(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },

    safeStorageSet(key, value) {
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },

    prefersReducedMotion() {
      return window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches === true;
    },

    addListener(target, type, handler, options) {
      if (!target?.addEventListener) return;

      target.addEventListener(type, handler, options);

      state.cleanups.push(() => {
        target.removeEventListener(type, handler, options);
      });
    },

    isExternalLink(url) {
      return url.origin !== window.location.origin;
    },

    emit(name, detail = {}) {
      document.dispatchEvent(
        new CustomEvent(`medorbits:${name}`, { detail })
      );
    },

    safeURL(value, base = window.location.href) {
      try {
        return new URL(value, base);
      } catch {
        return null;
      }
    }
  };

  const logger = {
    info(message, details) {
      if (window.MEDORBITS_DEBUG === true) {
        console.info(`[${APP.name}] ${message}`, details ?? "");
      }
    },

    warn(message, details) {
      console.warn(`[${APP.name}] ${message}`, details ?? "");
    },

    error(message, error) {
      console.error(`[${APP.name}] ${message}`, error ?? "");
    }
  };

  const events = Object.freeze({
    emit(name, detail = {}) {
      helpers.emit(name, detail);
    }
  });

  // --------------------------------------------------
  // Mobile navigation
  // --------------------------------------------------

  const navigation = {
    init() {
      const toggle = helpers.query(APP.selectors.menuToggle);
      const nav = helpers.query(APP.selectors.navigation);

      if (!toggle || !nav) return;

      if (!nav.id) nav.id = "medorbits-primary-navigation";

      toggle.setAttribute("aria-controls", nav.id);

      if (!toggle.hasAttribute("aria-expanded")) {
        toggle.setAttribute("aria-expanded", "false");
      }

      const isOpen = () =>
        toggle.getAttribute("aria-expanded") === "true";

      const setOpen = (open, { returnFocus = false } = {}) => {
        toggle.setAttribute("aria-expanded", String(open));
        nav.classList.toggle("is-open", open);
        document.body.classList.toggle("menu-is-open", open);

        helpers.emit("navigation-change", { open });

        if (!open && returnFocus) {
          toggle.focus({ preventScroll: true });
        }
      };

      helpers.addListener(toggle, "click", () => {
        setOpen(!isOpen());
      });

      helpers.addListener(nav, "click", (event) => {
        const link = event.target.closest("a");

        if (
          link &&
          window.matchMedia("(max-width: 768px)").matches
        ) {
          setOpen(false);
        }
      });

      helpers.addListener(document, "keydown", (event) => {
        if (event.key === "Escape" && isOpen()) {
          setOpen(false, { returnFocus: true });
        }
      });

      helpers.addListener(document, "click", (event) => {
        if (
          isOpen() &&
          !toggle.contains(event.target) &&
          !nav.contains(event.target)
        ) {
          setOpen(false);
        }
      });

      helpers.addListener(window, "resize", () => {
        if (window.innerWidth > 768 && isOpen()) {
          setOpen(false);
        }
      });

      setOpen(isOpen());
    }
  };

  // --------------------------------------------------
  // Accessible dropdowns
  // --------------------------------------------------

  const dropdowns = {
    init() {
      helpers.queryAll(APP.selectors.dropdownToggle).forEach((toggle) => {
        if (toggle.dataset.dropdownInitialized === "true") return;

        const targetId = toggle.getAttribute("aria-controls");
        const panel = targetId
          ? document.getElementById(targetId)
          : toggle.nextElementSibling;

        if (!panel) return;

        toggle.dataset.dropdownInitialized = "true";

        const initialOpen =
          toggle.getAttribute("aria-expanded") === "true" &&
          !panel.hidden;

        const setOpen = (open) => {
          toggle.setAttribute("aria-expanded", String(open));
          panel.hidden = !open;
          panel.classList.toggle("is-open", open);
        };

        setOpen(initialOpen);

        helpers.addListener(toggle, "click", () => {
          setOpen(toggle.getAttribute("aria-expanded") !== "true");
        });

        helpers.addListener(toggle, "keydown", (event) => {
          if (event.key === "Escape") {
            setOpen(false);
            toggle.focus({ preventScroll: true });
          }

          if (
            event.key === "ArrowDown" &&
            toggle.getAttribute("aria-expanded") !== "true"
          ) {
            event.preventDefault();
            setOpen(true);
            helpers.query("a[href], button:not(:disabled)", panel)
              ?.focus({ preventScroll: true });
          }
        });

        helpers.addListener(document, "click", (event) => {
          if (
            !toggle.contains(event.target) &&
            !panel.contains(event.target)
          ) {
            setOpen(false);
          }
        });
      });
    }
  };

  // --------------------------------------------------
  // Theme preferences
  // --------------------------------------------------

  const theme = {
    init() {
      const savedTheme = helpers.safeStorageGet(APP.storageKeys.theme);
      const documentTheme = document.documentElement.dataset.theme;

      const initialTheme = ["dark", "light"].includes(savedTheme)
        ? savedTheme
        : ["dark", "light"].includes(documentTheme)
          ? documentTheme
          : "dark";

      this.apply(initialTheme, false);

      helpers.queryAll(APP.selectors.themeToggle).forEach((toggle) => {
        if (toggle.dataset.themeInitialized === "true") return;

        toggle.dataset.themeInitialized = "true";

        helpers.addListener(toggle, "click", () => {
          const current = document.documentElement.dataset.theme || "dark";
          this.apply(current === "dark" ? "light" : "dark");
        });
      });
    },

    apply(value, persist = true) {
      if (!["dark", "light"].includes(value)) return false;

      const root = document.documentElement;

      root.dataset.theme = value;
      root.style.colorScheme = value;

      helpers.queryAll(APP.selectors.themeToggle).forEach((toggle) => {
        toggle.setAttribute(
          "aria-label",
          value === "dark"
            ? "Switch to light theme"
            : "Switch to dark theme"
        );
        toggle.setAttribute("aria-pressed", String(value === "dark"));
      });

      if (persist) {
        helpers.safeStorageSet(APP.storageKeys.theme, value);
      }

      helpers.emit("theme-change", { theme: value });
      return true;
    }
  };

  // --------------------------------------------------
  // Toast notifications
  // --------------------------------------------------

  const toast = {
    container: null,

    init() {
      this.container = helpers.query(APP.selectors.toastContainer);

      if (!this.container) {
        this.container = document.createElement("div");
        this.container.dataset.toastContainer = "";
        this.container.className = "toast-container";
        document.body.appendChild(this.container);
      }

      this.container.setAttribute("aria-label", "Notifications");
      this.container.setAttribute("aria-live", "polite");
      this.container.setAttribute("aria-relevant", "additions text");
    },

    show(message, options = {}) {
      if (!this.container?.isConnected) this.init();

      const allowedTypes = ["info", "success", "warning", "error"];
      const type = allowedTypes.includes(options.type)
        ? options.type
        : "info";

      const requestedDuration = Number(options.duration ?? 4000);
      const duration = Number.isFinite(requestedDuration)
        ? Math.max(0, Math.min(requestedDuration, 60000))
        : 4000;

      const item = document.createElement("div");
      item.className = `toast toast--${type}`;
      item.setAttribute("role", type === "error" ? "alert" : "status");

      const text = document.createElement("span");
      text.textContent = String(message);

      const close = document.createElement("button");
      close.type = "button";
      close.className = "toast__close";
      close.setAttribute("aria-label", "Dismiss notification");
      close.textContent = "×";

      let timerId = null;

      const remove = () => {
        if (timerId !== null) {
          window.clearTimeout(timerId);
          state.toastTimerIds.delete(timerId);
          timerId = null;
        }
        item.remove();
      };

      helpers.addListener(close, "click", remove);

      item.append(text, close);
      this.container.appendChild(item);

      if (duration > 0) {
        timerId = window.setTimeout(remove, duration);
        state.toastTimerIds.add(timerId);
      }

      helpers.emit("toast", { type, message: String(message) });
      return item;
    },

    success(message, options = {}) {
      return this.show(message, { ...options, type: "success" });
    },

    error(message, options = {}) {
      return this.show(message, { ...options, type: "error" });
    },

    warning(message, options = {}) {
      return this.show(message, { ...options, type: "warning" });
    },

    dismissAll() {
      this.container?.querySelectorAll(".toast").forEach((item) => {
        item.remove();
      });

      state.toastTimerIds.forEach((id) => window.clearTimeout(id));
      state.toastTimerIds.clear();
    }
  };

  // --------------------------------------------------
  // Form enhancements
  // --------------------------------------------------

  const forms = {
    init() {
      helpers.queryAll(APP.selectors.form).forEach((form) => {
        if (form.dataset.enhancedInitialized === "true") return;
        form.dataset.enhancedInitialized = "true";

        helpers.addListener(form, "submit", (event) => {
          if (!form.checkValidity()) {
            event.preventDefault();
            form.reportValidity();

            const invalidField = form.querySelector(":invalid");
            invalidField?.focus({ preventScroll: true });

            helpers.emit("form-invalid", { form });
            return;
          }

          // The responsible form handler must perform submission.
          // Do not display success or prevent normal form submission here.
          helpers.emit("form-valid", { form });
        });

        helpers.addListener(form, "input", (event) => {
          const field = event.target;

          if (!(field instanceof HTMLElement)) return;
          if (!("checkValidity" in field)) return;

          if (field.checkValidity()) {
            field.removeAttribute("aria-invalid");
            field.classList.remove("is-invalid");
          }
        });
      });
    }
  };

  // --------------------------------------------------
  // Password visibility
  // --------------------------------------------------

  const passwordVisibility = {
    init() {
      helpers.queryAll(APP.selectors.passwordToggle).forEach((toggle) => {
        if (toggle.dataset.passwordInitialized === "true") return;

        const targetId = toggle.getAttribute("aria-controls");
        const input = targetId
          ? document.getElementById(targetId)
          : toggle.previousElementSibling;

        if (!(input instanceof HTMLInputElement)) return;
        if (!["password", "text"].includes(input.type)) return;

        toggle.dataset.passwordInitialized = "true";
        toggle.setAttribute("aria-pressed", "false");
        toggle.setAttribute("aria-label", "Show password");

        helpers.addListener(toggle, "click", () => {
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          toggle.setAttribute("aria-pressed", String(show));
          toggle.setAttribute(
            "aria-label",
            show ? "Hide password" : "Show password"
          );
        });
      });
    }
  };

  // --------------------------------------------------
  // External links
  // --------------------------------------------------

  const links = {
    init() {
      helpers.queryAll("a[href]").forEach((link) => {
        const url = helpers.safeURL(link.getAttribute("href"));
        if (!url) return;

        if (
          !["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
        ) {
          link.removeAttribute("href");
          logger.warn("Blocked unsupported link protocol.");
          return;
        }

        if (
          link.target.toLowerCase() === "_blank" &&
          helpers.isExternalLink(url)
        ) {
          const rel = new Set(
            (link.getAttribute("rel") || "")
              .split(/\s+/)
              .filter(Boolean)
          );

          rel.add("noopener");
          rel.add("noreferrer");
          link.setAttribute("rel", [...rel].join(" "));
        }
      });
    }
  };

  // --------------------------------------------------
  // Back to top
  // --------------------------------------------------

  const backToTop = {
    init() {
      const button = helpers.query(APP.selectors.backToTop);
      if (!button) return;

      const update = () => {
        button.hidden = window.scrollY < 400;
      };

      update();
      helpers.addListener(window, "scroll", update, { passive: true });

      helpers.addListener(button, "click", () => {
        window.scrollTo({
          top: 0,
          behavior: helpers.prefersReducedMotion() ? "auto" : "smooth"
        });
      });
    }
  };

  // --------------------------------------------------
  // Footer year and social links
  // --------------------------------------------------

  const footer = {
    init() {
      const year = String(new Date().getFullYear());

      helpers.queryAll(APP.selectors.year).forEach((element) => {
        element.textContent = year;
      });

      this.loadSocialLinks();
    },

    async loadSocialLinks() {
      const containers = helpers.queryAll("[data-social-links]");
      if (!containers.length) return;

      try {
        const response = await fetch("/assets/data/social-links.json", {
          headers: { Accept: "application/json" },
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error("Social links could not be loaded.");
        }

        const data = await response.json();
        const configured = Array.isArray(data.links) ? data.links : [];

        const allowedIcons = new Set([
          "facebook",
          "instagram",
          "linkedin",
          "telegram",
          "whatsapp",
          "x",
          "youtube",
          "website"
        ]);

        containers.forEach((container) => {
          container.replaceChildren();

          configured.forEach((item) => {
            if (!item || typeof item.url !== "string") return;

            const url = helpers.safeURL(item.url);
            if (!url || url.protocol !== "https:") return;

            const id = String(item.id || "").toLowerCase();
            const iconId = id.startsWith("whatsapp") ? "whatsapp" : id;
            if (!allowedIcons.has(iconId)) return;

            const link = document.createElement("a");
            const icon = document.createElement("img");
            const label = document.createElement("span");

            link.className = "footer-social-button";
            link.href = url.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            icon.src = `/assets/icons/social/${iconId === "website" ? "link" : iconId}.svg`;
            icon.alt = "";
            icon.width = 18;
            icon.height = 18;
            icon.setAttribute("aria-hidden", "true");

            label.textContent = String(item.label || item.id || "Social link");

            link.append(icon, label);
            container.appendChild(link);
          });

          container.hidden = container.childElementCount === 0;
        });
      } catch (error) {
        logger.warn("Social links are unavailable.", error);
        containers.forEach((container) => {
          container.hidden = true;
        });
      }
    }
  };

  // --------------------------------------------------
  // Catalog grids and pagination
  // --------------------------------------------------

  const catalogSliders = {
    observer: null,

    init() {
      if (!document.getElementById("medorbits-grid-layout")) {
        const style = document.createElement("style");
        style.id = "medorbits-grid-layout";
        style.textContent = `
          .cards.is-catalog-slider {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 16px !important;
            overflow: visible !important;
            padding: 2px 0 !important;
            scroll-snap-type: none !important;
          }
          .cards.is-catalog-slider > * {
            min-width: 0 !important;
            flex: initial !important;
            scroll-snap-align: none !important;
          }
          .catalog-slider-controls {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
          }
          .catalog-slider-controls[hidden] {
            display: none !important;
          }
          .catalog-slider-button {
            min-width: 40px;
            min-height: 40px;
            cursor: pointer;
          }
          .catalog-slider-button:disabled {
            cursor: not-allowed;
            opacity: .45;
          }
          @media (max-width: 390px) {
            .cards.is-catalog-slider {
              gap: 10px !important;
            }
          }
        `;
        document.head.appendChild(style);
      }

      helpers.queryAll(
        "[data-catalog-slider], .cards:not([data-no-catalog-slider])"
      ).forEach((track, index) => {
        if (track.dataset.sliderInitialized === "true") return;

        track.dataset.sliderInitialized = "true";
        track.classList.add("is-catalog-slider");

        const parsedSize = Number.parseInt(
          track.dataset.sliderPageSize || "4",
          10
        );
        const pageSize = Number.isInteger(parsedSize) && parsedSize > 0
          ? Math.min(parsedSize, 100)
          : 4;

        track.setAttribute(
          "aria-label",
          track.dataset.sliderLabel || `Catalog items ${index + 1}`
        );

        const controls = document.createElement("div");
        controls.className = "catalog-slider-controls";
        controls.setAttribute("role", "group");
        controls.setAttribute("aria-label", "Catalog pagination");

        const previous = document.createElement("button");
        previous.type = "button";
        previous.className = "catalog-slider-button";
        previous.setAttribute("aria-label", "Previous catalog page");
        previous.textContent = "‹";

        const next = document.createElement("button");
        next.type = "button";
        next.className = "catalog-slider-button";
        next.setAttribute("aria-label", "Next catalog page");
        next.textContent = "›";

        controls.append(previous, next);
        track.insertAdjacentElement("afterend", controls);

        let currentPage = 0;
        const getItems = () => [...track.children].filter(
          (item) => !item.matches("[data-slider-ignore]")
        );

        const showPage = (page) => {
          const items = getItems();
          const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
          currentPage = Math.max(0, Math.min(page, pageCount - 1));

          items.forEach((item, index) => {
            item.hidden =
              index < currentPage * pageSize ||
              index >= (currentPage + 1) * pageSize;
          });

          previous.disabled = currentPage === 0;
          next.disabled = currentPage >= pageCount - 1;
          controls.hidden = pageCount <= 1;
        };

        helpers.addListener(previous, "click", () => showPage(currentPage - 1));
        helpers.addListener(next, "click", () => showPage(currentPage + 1));

        helpers.addListener(track, "keydown", (event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          if (event.target !== track) return;

          event.preventDefault();
          showPage(currentPage + (event.key === "ArrowRight" ? 1 : -1));
        });

        showPage(0);
      });

      if (!this.observer && "MutationObserver" in window && document.body) {
        this.observer = new MutationObserver((records) => {
          const addedCatalog = records.some((record) =>
            [...record.addedNodes].some((node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              (node.matches(".cards, [data-catalog-slider]") ||
                node.querySelector(".cards, [data-catalog-slider]"))
            )
          );

          if (addedCatalog) this.init();
        });

        this.observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }
  };

  // --------------------------------------------------
  // Optional page modules
  // --------------------------------------------------

  function loadScriptOnce(selector, src, { defer = true } = {}) {
    if (helpers.query(selector)) return;

    const script = document.createElement("script");
    script.src = src;
    script.defer = defer;
    script.dataset.moduleLoaded = "pending";

    script.addEventListener("load", () => {
      script.dataset.moduleLoaded = "loaded";
      helpers.emit("module-loaded", { src });
    }, { once: true });

    script.addEventListener("error", () => {
      script.dataset.moduleLoaded = "error";
      logger.warn(`Optional module failed to load: ${src}`);
    }, { once: true });

    document.head.appendChild(script);
  }

  const siteTools = {
    init() {
      if (!/^\/(education|career)(\/|$)/.test(location.pathname)) return;

      loadScriptOnce(
        'script[data-site-tools-script]',
        "/assets/js/site-tools.js"
      );
    }
  };

  const documentLibrary = {
    init() {
      const path = location.pathname;
      if (!(path === "/" || /\/index\.html$/.test(path))) return;

      loadScriptOnce(
        "script[data-document-library]",
        "/assets/js/document-library.js"
      );
    }
  };

  const publicData = {
    init() {
      const pages = new Set([
        "/education/index.html",
        "/education/courses.html",
        "/education/colleges.html",
        "/education/universities.html",
        "/education/study-abroad/index.html",
        "/education/admissions/index.html",
        "/education/admissions/process.html",
        "/education/admissions/documents.html",
        "/education/admissions/exams.html",
        "/education/resources/faqs.html",
        "/education/resources/guides.html",
        "/education/resources/fees.html",
        "/education/resources/hostels.html",
        "/career/index.html",
        "/career/jobs.html",
        "/career/internships.html",
        "/career/guidance.html",
        "/career/recruitment.html",
        "/pages/careers.html",
        "/pages/services.html",
        "/pages/notifications.html",
        "/pages/testimonials.html"
      ]);

      const path = location.pathname.endsWith("/")
        ? `${location.pathname}index.html`
        : location.pathname;

      if (!pages.has(path)) return;

      loadScriptOnce(
        "script[data-public-data]",
        "/assets/js/public-data.js"
      );
    }
  };

  const publicBulletins = {
    init() {
      if (![
        "/",
        "/index.html",
        "/pages/notifications.html"
      ].includes(location.pathname)) return;

      loadScriptOnce(
        "script[data-public-bulletins]",
        "/assets/js/bulletins.js"
      );
    }
  };

  // --------------------------------------------------
  // Timed enquiry
  // --------------------------------------------------

  const timedEnquiry = {
    init() {
      if (document.documentElement.dataset.timedEnquiry !== "enabled") return;

      const path = location.pathname;

      if (
        /^\/(admin|account|legal)(\/|$)/.test(path) ||
        path === "/pages/400.html" ||
        path === "/pages/maintenance.html" ||
        path === "/pages/contact.html" ||
        helpers.query("#contactForm")
      ) return;

      const shownKey = "medorbits-enquiry-shown";
      const startKey = "medorbits-enquiry-started-at";
      const delay = 120000;

      let shown = false;
      let startedAt = Date.now();

      try {
        if (sessionStorage.getItem(shownKey) === "true") return;

        const stored = Number(sessionStorage.getItem(startKey));
        if (Number.isSafeInteger(stored) && stored > 0 && stored <= Date.now()) {
          startedAt = stored;
        } else {
          sessionStorage.setItem(startKey, String(startedAt));
        }
      } catch {
        // Session storage is optional; this document still behaves normally.
      }

      const show = () => {
        if (shown) return;

        try {
          if (sessionStorage.getItem(shownKey) === "true") return;
          sessionStorage.setItem(shownKey, "true");
        } catch {
          // Prevent duplicate display in this document.
        }

        shown = true;

        const backdrop = document.createElement("div");
        backdrop.className = "timed-enquiry-backdrop";
        backdrop.dataset.timedEnquiry = "";

        const dialog = document.createElement("section");
        dialog.className = "timed-enquiry-dialog";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "timed-enquiry-title");
        dialog.setAttribute("aria-describedby", "timed-enquiry-description");
        dialog.tabIndex = -1;

        const title = document.createElement("h2");
        title.id = "timed-enquiry-title";
        title.textContent = "Have a question?";

        const description = document.createElement("p");
        description.id = "timed-enquiry-description";
        description.textContent =
          "Share your details and our team will get back to you.";

        const close = document.createElement("button");
        close.type = "button";
        close.className = "timed-enquiry-close";
        close.textContent = "×";
        close.setAttribute("aria-label", "Close enquiry form");

        const form = document.createElement("form");
        form.className = "timed-enquiry-form";

        const addField = (labelText, name, type, required = false) => {
          const label = document.createElement("label");
          label.append(document.createTextNode(labelText));

          const field = document.createElement(type === "textarea" ? "textarea" : "input");
          field.name = name;
          if (type !== "textarea") field.type = type;
          field.required = required;
          field.maxLength = name === "email" ? 254 : 1000;
          label.appendChild(field);
          form.appendChild(label);
          return field;
        };

        const name = addField("Name", "name", "text", true);
        name.minLength = 2;
        name.autocomplete = "name";

        const email = addField("Email", "email", "email");
        email.autocomplete = "email";

        const phone = addField("Phone", "phone", "tel");
        phone.autocomplete = "tel";

        const message = addField("Your question", "message", "textarea", true);
        message.minLength = 10;
        message.maxLength = 10000;

        const source = document.createElement("input");
        source.type = "hidden";
        source.name = "source";
        source.value = "website";
        form.appendChild(source);

        const status = document.createElement("p");
        status.className = "timed-enquiry-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        status.hidden = true;

        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "timed-enquiry-submit";
        submit.textContent = "Send enquiry";

        form.append(status, submit);
        dialog.append(close, title, description, form);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;

        const closeDialog = () => {
          backdrop.remove();
          document.body.style.overflow = previousOverflow;
          if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
            previousFocus.focus({ preventScroll: true });
          }
        };

        helpers.addListener(close, "click", closeDialog);
        helpers.addListener(backdrop, "click", (event) => {
          if (event.target === backdrop) closeDialog();
        });

        helpers.addListener(dialog, "keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeDialog();
          }
        });

        helpers.addListener(form, "submit", async (event) => {
          event.preventDefault();

          if (!email.value.trim() && !phone.value.trim()) {
            email.setCustomValidity("Enter an email address or a phone number.");
            phone.setCustomValidity("Enter an email address or a phone number.");
            form.reportValidity();
            return;
          }

          email.setCustomValidity("");
          phone.setCustomValidity("");

          const digits = phone.value.replace(/\D/g, "").length;
          if (phone.value.trim() && (digits < 7 || digits > 15)) {
            phone.setCustomValidity("Enter a valid phone number.");
            form.reportValidity();
            return;
          }

          if (!form.reportValidity()) return;

          submit.disabled = true;
          status.hidden = false;
          status.textContent = "Sending your enquiry...";

          try {
            const response = await fetch("/api/v1/contact", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
              },
              credentials: "same-origin",
              body: JSON.stringify(Object.fromEntries(new FormData(form)))
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(
                payload?.error?.message ||
                payload?.message ||
                "Your enquiry could not be submitted."
              );
            }

            form.reset();
            status.textContent = "Thank you. Your enquiry has been submitted.";
          } catch (error) {
            status.textContent =
              error.message || "Your enquiry could not be submitted.";
            logger.warn("Timed enquiry submission failed.", error);
          } finally {
            submit.disabled = false;
          }
        });

        document.body.style.overflow = "hidden";
        name.focus({ preventScroll: true });
      };

      window.setTimeout(show, Math.max(0, delay - (Date.now() - startedAt)));
    }
  };

  // --------------------------------------------------
  // Cookie consent helpers
  // --------------------------------------------------

  const consent = {
    get() {
      const value = helpers.safeStorageGet(APP.storageKeys.cookieConsent);
      if (!value) return null;

      try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object") return null;

        return {
          necessary: true,
          analytics: parsed.analytics === true,
          marketing: parsed.marketing === true,
          updatedAt: typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : null
        };
      } catch {
        return null;
      }
    },

    save(preferences) {
      if (!preferences || typeof preferences !== "object") return false;

      const normalized = {
        necessary: true,
        analytics: preferences.analytics === true,
        marketing: preferences.marketing === true,
        updatedAt: new Date().toISOString()
      };

      const saved = helpers.safeStorageSet(
        APP.storageKeys.cookieConsent,
        JSON.stringify(normalized)
      );

      if (saved) helpers.emit("consent-change", normalized);
      return saved;
    }
  };

  // --------------------------------------------------
  // Global errors
  // --------------------------------------------------

  const errorHandling = {
    init() {
      helpers.addListener(window, "error", (event) => {
        logger.error("Uncaught browser error", {
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        });
      });

      helpers.addListener(window, "unhandledrejection", (event) => {
        logger.error("Unhandled promise rejection", event.reason);
      });
    }
  };

  // --------------------------------------------------
  // Initialization
  // --------------------------------------------------

  const modules = [
    ["navigation", navigation],
    ["dropdowns", dropdowns],
    ["theme", theme],
    ["toast", toast],
    ["forms", forms],
    ["password visibility", passwordVisibility],
    ["links", links],
    ["back to top", backToTop],
    ["footer", footer],
    ["catalog grids", catalogSliders],
    ["site tools", siteTools],
    ["document library", documentLibrary],
    ["public data", publicData],
    ["public bulletins", publicBulletins],
    ["timed enquiry", timedEnquiry],
    ["error handling", errorHandling]
  ];

  function init() {
    if (state.initialized) return;

    state.initialized = true;

    modules.forEach(([name, module]) => {
      try {
        module.init();
      } catch (error) {
        logger.error(`Failed to initialize ${name}.`, error);
      }
    });

    logger.info("Application initialized", { version: APP.version });
    helpers.emit("ready", { name: APP.name, version: APP.version });
  }

  window.MedOrbits = Object.freeze({
    version: APP.version,
    events,
    toast,
    theme,
    consent,

    get initialized() {
      return state.initialized;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
