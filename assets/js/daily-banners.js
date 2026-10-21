
/* =========================================================
   MedOrbits -- assets/js/daily-banner.js
   Daily education/career banners and social links
   Version: 1.1.0
   ========================================================= */

(function (window, document) {
  "use strict";

  const SELECTORS = Object.freeze({
    slots: "[data-daily-banner-slot]",
    socialLinks: "[data-social-links]"
  });

  const PATHS = Object.freeze({
    bulletins: "/assets/data/bulletins.json",
    socialLinks: "/assets/data/social-links.json",
    documentsPrefix: "/assets/documents/"
  });

  const slots = Array.from(document.querySelectorAll(SELECTORS.slots));
  const socialList = document.querySelector(SELECTORS.socialLinks);

  if (!slots.length && !socialList) return;

  let initialized = false;

  function loadJson(path) {
    return window.fetch(path, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      credentials: "same-origin",
      cache: "no-cache"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Unable to load public data.");
      }

      return response.json();
    });
  }

  function todayKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const values = {};

    parts.forEach(function (part) {
      values[part.type] = part.value;
    });

    return Number(
      String(values.year) +
      String(values.month) +
      String(values.day)
    );
  }

  function isValidDateOrEmpty(value) {
    if (value === undefined || value === null || value === "") {
      return true;
    }

    return typeof value === "string" &&
      Number.isFinite(Date.parse(value));
  }

  function eligible(item, now) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    if (
      item.active !== true ||
      item.publicationStatus !== "published"
    ) {
      return false;
    }

    if (
      !isValidDateOrEmpty(item.publishedAt) ||
      !isValidDateOrEmpty(item.expiresAt)
    ) {
      return false;
    }

    if (
      item.publishedAt &&
      Date.parse(item.publishedAt) > now
    ) {
      return false;
    }

    if (
      item.expiresAt &&
      Date.parse(item.expiresAt) <= now
    ) {
      return false;
    }

    return (
      typeof item.title === "string" &&
      item.title.trim().length > 0 &&
      typeof item.summary === "string" &&
      item.summary.trim().length > 0 &&
      Array.isArray(item.categories)
    );
  }

  function safeDocumentPath(documentItem) {
    if (
      !documentItem ||
      typeof documentItem !== "object" ||
      Array.isArray(documentItem) ||
      documentItem.publicationStatus !== "published" ||
      documentItem.format !== "application/pdf" ||
      typeof documentItem.path !== "string" ||
      !documentItem.path.trim()
    ) {
      return null;
    }

    try {
      const url = new URL(
        documentItem.path,
        window.location.origin
      );

      const pathname = url.pathname;

      if (
        url.origin !== window.location.origin ||
        url.username ||
        url.password ||
        !pathname.startsWith(PATHS.documentsPrefix) ||
        pathname.split("/").includes("..") ||
        pathname.includes("\\") ||
        !pathname.toLowerCase().endsWith(".pdf")
      ) {
        return null;
      }

      return pathname;
    } catch (error) {
      return null;
    }
  }

  function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    element.textContent = String(text == null ? "" : text);

    return element;
  }

  function renderSlot(slot, item, category) {
    if (!slot || !item) return;

    slot.replaceChildren();

    const labelText = category === "education"
      ? "EDUCATION UPDATE"
      : category === "career"
        ? "CAREER UPDATE"
        : "LATEST UPDATE";

    const label = createTextElement(
      "span",
      "daily-banner__label",
      labelText
    );

    const title = createTextElement(
      "h2",
      "daily-banner__title",
      item.title
    );

    const summary = createTextElement(
      "p",
      "daily-banner__summary",
      item.summary
    );

    slot.append(label, title, summary);

    const relatedDocuments = Array.isArray(item.relatedDocuments)
      ? item.relatedDocuments
      : [];

    relatedDocuments.slice(0, 10).forEach(function (related) {
      const path = safeDocumentPath(related);

      if (!path) return;

      const link = document.createElement("a");

      link.href = path;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "daily-banner__link";
      link.textContent = "Open " +
        String(related.title || "related PDF").slice(0, 150);

      slot.appendChild(link);
    });

    slot.hidden = false;
  }

  function renderSocialLinks(container, links) {
    if (!container) return;

    container.replaceChildren();

    (Array.isArray(links) ? links : [])
      .slice(0, 20)
      .forEach(function (entry) {
        if (
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          typeof entry.url !== "string" ||
          !entry.url.trim()
        ) {
          return;
        }

        try {
          const url = new URL(entry.url);

          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password
          ) {
            return;
          }

          const link = document.createElement("a");

          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = String(
            entry.label || entry.id || "Social link"
          ).slice(0, 100);

          container.appendChild(link);
        } catch (error) {
          // Ignore malformed or unconfigured links.
        }
      });

    container.hidden = container.childElementCount === 0;
  }

  function hideSlots() {
    slots.forEach(function (slot) {
      slot.replaceChildren();
      slot.hidden = true;
    });
  }

  function getBulletins(data, now) {
    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.bulletins)
    ) {
      return [];
    }

    return data.bulletins.filter(function (item) {
      return eligible(item, now);
    });
  }

  function selectDailyItem(items, category, dayKey) {
    const candidates = items.filter(function (item) {
      return item.categories.includes(category);
    });

    if (!candidates.length) return null;

    /*
     * Deterministic daily rotation:
     * the same category displays the same item throughout an IST day.
     */
    return candidates[dayKey % candidates.length];
  }

  async function init() {
    if (initialized) return;
    initialized = true;

    try {
      const results = await Promise.all([
        loadJson(PATHS.bulletins),
        socialList
          ? loadJson(PATHS.socialLinks)
          : Promise.resolve({ links: [] })
      ]);

      const bulletinData = results[0];
      const socialData = results[1];

      const now = Date.now();
      const dayKey = todayKey();
      const items = getBulletins(bulletinData, now);

      slots.forEach(function (slot) {
        const category = String(
          slot.dataset.dailyBannerSlot || ""
        ).trim().toLowerCase();

        if (!["education", "career"].includes(category)) {
          slot.replaceChildren();
          slot.hidden = true;
          return;
        }

        const item = selectDailyItem(items, category, dayKey);

        if (!item) {
          slot.replaceChildren();
          slot.hidden = true;
          return;
        }

        renderSlot(slot, item, category);
      });

      if (socialList) {
        renderSocialLinks(socialList, socialData && socialData.links);
      }

      emit("medorbits:daily-banner:loaded", {
        bulletinCount: items.length
      });
    } catch (error) {
      hideSlots();

      if (socialList) {
        socialList.replaceChildren();
        socialList.hidden = true;
      }

      emit("medorbits:daily-banner:error", {
        message: "Public banner data could not be loaded."
      });

      if (window.console && typeof window.console.warn === "function") {
        window.console.warn(
          "[MedOrbits] Daily banner data could not be loaded."
        );
      }
    }
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(new window.CustomEvent(name, {
        detail: detail || {}
      }));
    } catch (error) {
      // Custom events are optional.
    }
  }

  window.MedOrbitsDailyBanner = Object.freeze({
    init: init,
    todayKey: todayKey,
    eligible: eligible,
    safeDocumentPath: safeDocumentPath,
    selectDailyItem: selectDailyItem
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})(window, document);
