
/**
 * MedOrbits -- Public Bulletins & Daily Banners
 * File: /assets/js/bulletins.js
 * Version: 1.1.0
 *
 * Responsibilities:
 * - Load and render published public bulletins
 * - Display education and career daily banners
 * - Validate bulletin publication and verification status
 * - Safely render related PDFs and official notices
 * - Handle unavailable or malformed data gracefully
 *
 * Public JSON data is untrusted input. Publication approval,
 * access control and document permissions must be enforced server-side.
 */

(() => {
  "use strict";

  const DATA_URL = "/assets/data/bulletins.json";
  const DOCUMENT_ROOT = "/assets/documents/";
  const TIME_ZONE = "Asia/Kolkata";

  const list = document.querySelector("[data-bulletin-list]");
  const status = document.querySelector("[data-bulletin-status]");
  const slots = [...document.querySelectorAll("[data-daily-banner-slot]")];
  const grids = [...document.querySelectorAll("[data-daily-banner-grid]")];

  if (!list && slots.length === 0) return;

  const state = {
    loading: false,
    loaded: false,
    error: null,
    items: []
  };

  function makeText(tag, className, value) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    element.textContent = String(value ?? "");

    return element;
  }

  function safeDate(value) {
    if (typeof value !== "string" || !value.trim()) return null;

    const timestamp = Date.parse(value);

    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function isVisible(item, now = Date.now()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    if (
      item.active !== true ||
      item.publicationStatus !== "published" ||
      !["verified", "content_reviewed"].includes(
        item.verificationStatus
      )
    ) {
      return false;
    }

    if (item.publishedAt) {
      const publishedAt = safeDate(item.publishedAt);

      if (publishedAt === null || publishedAt > now) return false;
    }

    if (item.expiresAt) {
      const expiresAt = safeDate(item.expiresAt);

      if (expiresAt === null || expiresAt <= now) return false;
    }

    return (
      typeof item.title === "string" &&
      item.title.trim().length > 0 &&
      typeof item.summary === "string" &&
      item.summary.trim().length > 0
    );
  }

  function getDocumentUrl(item) {
    if (
      !item ||
      item.publicationStatus !== "published" ||
      item.format !== "application/pdf" ||
      typeof item.path !== "string" ||
      !item.path.trim()
    ) {
      return null;
    }

    try {
      const url = new URL(item.path, window.location.origin);

      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith(DOCUMENT_ROOT) ||
        !url.pathname.toLowerCase().endsWith(".pdf") ||
        url.pathname.split("/").includes("..") ||
        url.username ||
        url.password
      ) {
        return null;
      }

      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  function getOfficialNoticeUrl(item) {
    if (
      item?.newsType !== "official_notice" ||
      typeof item.officialNoticeUrl !== "string"
    ) {
      return null;
    }

    try {
      const url = new URL(item.officialNoticeUrl);

      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password
      ) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function formatDate(value) {
    const timestamp = safeDate(value);

    if (timestamp === null) return null;

    try {
      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeZone: TIME_ZONE
      }).format(new Date(timestamp));
    } catch {
      return null;
    }
  }

  function createExternalLink(url, className, label) {
    const link = document.createElement("a");

    link.className = className;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = String(label);

    return link;
  }

  function renderRelatedDocuments(container, item, className = "btn") {
    const documents = Array.isArray(item.relatedDocuments)
      ? item.relatedDocuments
      : [];

    documents.forEach((documentItem) => {
      const path = getDocumentUrl(documentItem);

      if (!path) return;

      const label = typeof documentItem.title === "string" &&
        documentItem.title.trim()
        ? documentItem.title.trim()
        : "related PDF";

      const link = createExternalLink(
        path,
        className,
        `Open ${label}`
      );

      container.appendChild(link);
    });
  }

  function renderOfficialNotice(container, item, className = "btn btn-outline") {
    const url = getOfficialNoticeUrl(item);

    if (!url) return;

    container.appendChild(
      createExternalLink(url, className, "Open official notice")
    );
  }

  function renderItem(item) {
    const article = document.createElement("article");
    article.className = "resource-panel bulletin-item";

    article.appendChild(
      makeText("span", "kicker", item.category || "Update")
    );

    article.appendChild(
      makeText("h3", "", item.title)
    );

    article.appendChild(
      makeText("p", "", item.summary)
    );

    const meta = document.createElement("p");
    meta.className = "bulletin-meta";

    const sourceName =
      typeof item.source?.name === "string" && item.source.name.trim()
        ? item.source.name.trim()
        : "Source not specified";

    const verification = item.verificationStatus === "verified"
      ? "Verified"
      : "MedOrbits informational resource; independently verify official details.";

    meta.textContent = `${sourceName} · ${verification}`;
    article.appendChild(meta);

    const links = document.createElement("div");
    links.className = "bulletin-links";

    renderRelatedDocuments(links, item);
    renderOfficialNotice(links, item);

    if (links.childElementCount > 0) {
      article.appendChild(links);
    }

    const formattedDate = item.publishedAt
      ? formatDate(item.publishedAt)
      : null;

    if (formattedDate) {
      const time = document.createElement("time");
      time.dateTime = new Date(item.publishedAt).toISOString();
      time.textContent = `Published ${formattedDate}`;
      article.appendChild(time);
    }

    return article;
  }

  function renderSlot(slot, item, category) {
    slot.replaceChildren();

    const label = category === "education"
      ? "EDUCATION UPDATE"
      : "CAREER UPDATE";

    slot.appendChild(
      makeText("span", "daily-banner__label", label)
    );

    slot.appendChild(makeText("h2", "", item.title));
    slot.appendChild(makeText("p", "", item.summary));

    renderRelatedDocuments(
      slot,
      item,
      "daily-banner__link"
    );

    renderOfficialNotice(
      slot,
      item,
      "daily-banner__link"
    );

    slot.hidden = false;
  }

  function getIndiaDateKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );

    return Number(
      `${values.year}${values.month}${values.day}`
    );
  }

  function selectDailyItem(items, category) {
    const candidates = items
      .filter((item) =>
        Array.isArray(item.categories) &&
        item.categories.includes(category)
      )
      .sort((a, b) => {
        const dateA = safeDate(a.publishedAt) || 0;
        const dateB = safeDate(b.publishedAt) || 0;

        return dateB - dateA;
      });

    if (candidates.length === 0) return null;

    return candidates[getIndiaDateKey() % candidates.length];
  }

  function updateGridVisibility() {
    grids.forEach((grid) => {
      const hasVisibleSlot = slots.some(
        (slot) => grid.contains(slot) && !slot.hidden
      );

      grid.hidden = !hasVisibleSlot;
    });
  }

  function setStatus(message, visible = true) {
    if (!status) return;

    status.textContent = message;
    status.hidden = !visible;
  }

  function render(items) {
    if (list) {
      const fragment = document.createDocumentFragment();

      items.forEach((item) => {
        fragment.appendChild(renderItem(item));
      });

      list.replaceChildren(fragment);
    }

    slots.forEach((slot) => {
      const category = String(
        slot.dataset.dailyBannerSlot || ""
      ).trim().toLowerCase();

      if (!["education", "career"].includes(category)) {
        slot.hidden = true;
        return;
      }

      const item = selectDailyItem(items, category);

      if (!item) {
        slot.replaceChildren();
        slot.hidden = true;
        return;
      }

      renderSlot(slot, item, category);
    });

    updateGridVisibility();

    setStatus(
      items.length
        ? "Published information and official notices. Verify important details with the issuing authority."
        : "No published bulletins are available right now.",
      Boolean(list) || items.length === 0
    );
  }

  async function load() {
    if (state.loading) return state.items;

    state.loading = true;
    state.error = null;

    if (status) {
      status.textContent = "Loading published updates…";
      status.hidden = false;
    }

    try {
      const response = await fetch(DATA_URL, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error("Bulletin data is unavailable.");
      }

      const contentType = response.headers.get("content-type") || "";

      if (
        contentType &&
        !contentType.includes("application/json") &&
        !contentType.includes("+json")
      ) {
        throw new Error("Bulletin data returned an unsupported format.");
      }

      const data = await response.json();

      if (
        !data ||
        typeof data !== "object" ||
        !Array.isArray(data.bulletins)
      ) {
        throw new Error("Bulletin data has an invalid format.");
      }

      const now = Date.now();

      state.items = data.bulletins.filter((item) =>
        isVisible(item, now)
      );

      state.loaded = true;

      render(state.items);

      document.dispatchEvent(
        new CustomEvent("medorbits:bulletins-loaded", {
          detail: {
            count: state.items.length
          }
        })
      );

      return state.items;
    } catch (error) {
      state.error = error;

      if (list) {
        list.replaceChildren(
          makeText(
            "p",
            "bulletins-error",
            "Bulletins are temporarily unavailable. Please try again later."
          )
        );
      }

      slots.forEach((slot) => {
        slot.replaceChildren();
        slot.hidden = true;
      });

      updateGridVisibility();

      setStatus(
        "The bulletin could not be loaded. Use the resource links below and verify notices with the issuing authority."
      );

      document.dispatchEvent(
        new CustomEvent("medorbits:bulletins-error", {
          detail: {
            message: error.message || "Bulletin loading failed."
          }
        })
      );

      return [];
    } finally {
      state.loading = false;
    }
  }

  const publicAPI = Object.freeze({
    load,

    get items() {
      return [...state.items];
    },

    get loaded() {
      return state.loaded;
    },

    get error() {
      return state.error;
    }
  });

  if (!window.MedOrbitsBulletins) {
    Object.defineProperty(window, "MedOrbitsBulletins", {
      value: publicAPI,
      writable: false,
      configurable: false,
      enumerable: true
    });
  }

  void load();
})();
