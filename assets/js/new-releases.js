(() => {
  "use strict";

  const FEED_URL = "/assets/data/new-releases.json";
  const FALLBACK_URL = "/notifications.html";
  const grid = document.getElementById("moReleaseGrid");
  if (!grid) return;

  const ICONS = {
    pdf: "PDF",
    notice: "!",
    guide: "↗",
    link: "↗",
    document: "DOC",
    announcement: "!",
    resource: "✦"
  };

  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return FALLBACK_URL;
    try {
      const url = new URL(value, window.location.origin);
      if (url.protocol !== "https:" && url.protocol !== "http:") return FALLBACK_URL;
      if (url.origin !== window.location.origin && url.protocol !== "https:") return FALLBACK_URL;
      return url.href;
    } catch (_) {
      return FALLBACK_URL;
    }
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return "Recently added";
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function getCurrentItems(data) {
    const items = data && Array.isArray(data.releases) ? data.releases : [];
    const now = new Date();
    return items.filter(item => {
      if (!item || item.active === false || typeof item.title !== "string" || !item.title.trim()) return false;
      const publishAt = parseDate(item.publishAt);
      const expiresAt = parseDate(item.expiresAt);
      return (!publishAt || publishAt <= now) && (!expiresAt || expiresAt >= now);
    }).sort((a, b) => {
      const aDate = parseDate(a.publishAt)?.getTime() || 0;
      const bDate = parseDate(b.publishAt)?.getTime() || 0;
      return bDate - aDate;
    }).slice(0, 9);
  }

  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render(items) {
    grid.replaceChildren();
    if (!items.length) {
      const status = makeElement("p", "release-status", "No new resources are available right now. Please check the updates page again soon.");
      grid.appendChild(status);
      return;
    }

    items.forEach(item => {
      const card = makeElement("article", "release-card");
      const top = makeElement("div", "release-card__top");
      const kindValue = String(item.type || item.category || "resource").toLowerCase();
      const kind = makeElement("span", "release-kind", item.categoryLabel || kindValue.replace(/[-_]/g, " "));
      kind.dataset.symbol = ICONS[kindValue] || "✦";
      const date = makeElement("time", "release-date", formatDate(item.publishAt || item.date));
      const dateValue = parseDate(item.publishAt || item.date);
      if (dateValue) date.dateTime = dateValue.toISOString();
      top.append(kind, date);

      const title = makeElement("h3", "", item.title.trim());
      const description = makeElement("p", "", typeof item.description === "string" ? item.description : "Open this resource for more information.");
      const footer = makeElement("div", "release-card__footer");
      const format = makeElement("span", "release-format", item.format || kindValue);
      const link = makeElement("a", "release-link", item.linkLabel || "Open resource ↗");
      link.href = safeUrl(item.url || item.link);
      if (link.origin !== window.location.origin) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      footer.append(format, link);
      card.append(top, title, description, footer);
      grid.appendChild(card);
    });
  }

  async function loadReleases() {
    try {
      const response = await fetch(FEED_URL, {
        cache: "no-cache",
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`Release feed request failed: ${response.status}`);
      const data = await response.json();
      render(getCurrentItems(data));
    } catch (error) {
      console.warn("[MedOrbits releases] Could not load release feed.", error);
      grid.replaceChildren(makeElement("p", "release-status", "Resources could not be loaded right now. Please visit the updates page."));
    }
  }

  loadReleases();
})();