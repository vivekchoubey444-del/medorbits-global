
/* =========================================================
   MedOrbits -- assets/js/document-library.js
   Public PDF library for published document manifests
   Version: 1.1.0
   ========================================================= */

(function (window, document) {
  "use strict";

  const CONFIG = Object.freeze({
    sectionId: "published-pdf-library",
    documentsRoot: "/assets/documents/",
    manifests: [
      {
        url: "/assets/documents/checklists/MANIFEST.json",
        base: "/assets/documents/checklists/"
      },
      {
        url: "/assets/documents/admission-guides/MANIFEST.json",
        base: "/assets/documents/admission-guides/"
      },
      {
        url: "/assets/documents/fee-guides/manifest.json",
        base: "/assets/documents/fee-guides/"
      },
      {
        url: "/assets/documents/study-abroad/MANIFEST.json",
        base: "/assets/documents/study-abroad/"
      }
    ]
  });

  const pathname = window.location.pathname;

  const isIndexPage =
    pathname === "/" ||
    /\/index\.html$/i.test(pathname);

  const isPrivateArea =
    /^\/(admin|account|legal)(\/|$)/i.test(pathname);

  if (!isIndexPage || isPrivateArea) return;

  const main = document.querySelector("main");

  if (!main || document.getElementById(CONFIG.sectionId)) return;

  function cleanText(value, maxLength) {
    if (
      value === null ||
      value === undefined ||
      typeof value === "object"
    ) {
      return "";
    }

    return String(value)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .trim()
      .slice(0, maxLength || 500);
  }

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function safePdfPath(value, base) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    const input = value.trim();

    if (
      /^[a-z][a-z0-9+.-]*:/i.test(input) ||
      input.startsWith("//") ||
      input.includes("\\") ||
      input.includes("?") ||
      input.includes("#") ||
      input.split("/").includes("..") ||
      input.split("/").includes(".")
    ) {
      return null;
    }

    const candidate = input.startsWith(CONFIG.documentsRoot)
      ? input
      : base + input.replace(/^\/+/, "");

    try {
      const url = new URL(candidate, window.location.origin);

      if (
        url.origin !== window.location.origin ||
        url.username ||
        url.password ||
        !url.pathname.startsWith(CONFIG.documentsRoot) ||
        url.pathname.split("/").includes("..") ||
        url.pathname.split("/").includes(".") ||
        !url.pathname.toLowerCase().endsWith(".pdf")
      ) {
        return null;
      }

      return url.pathname;
    } catch (error) {
      return null;
    }
  }

  async function loadManifest(manifest) {
    try {
      const response = await window.fetch(manifest.url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin",
        cache: "no-cache"
      });

      if (!response.ok) return [];

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.toLowerCase().includes("json")) {
        return [];
      }

      const data = await response.json();

      if (!isObject(data)) return [];

      const records = [
        ...(Array.isArray(data.resources) ? data.resources : []),
        ...(Array.isArray(data.documents) ? data.documents : [])
      ];

      return records
        .filter(function (item) {
          return isObject(item) &&
            item.status === "published";
        })
        .map(function (item) {
          const path = safePdfPath(
            item.path || item.filename,
            manifest.base
          );

          if (!path) return null;

          const title = cleanText(
            item.title || "MedOrbits PDF resource",
            200
          );

          if (!title) return null;

          return {
            title: title,
            description: cleanText(
              item.description ||
                "Published MedOrbits planning resource.",
              1000
            ),
            category: cleanText(
              item.category || "Resource",
              100
            ),
            path: path
          };
        })
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async function readPublishedPdfs() {
    const groups = await Promise.all(
      CONFIG.manifests.map(loadManifest)
    );

    const unique = new Map();

    groups.flat().forEach(function (item) {
      if (!unique.has(item.path)) {
        unique.set(item.path, item);
      }
    });

    return Array.from(unique.values()).sort(function (left, right) {
      return left.title.localeCompare(right.title);
    });
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function render(items) {
    if (!main || document.getElementById(CONFIG.sectionId)) return;

    const section = createElement(
      "section",
      "section alt document-library"
    );

    section.id = CONFIG.sectionId;
    section.setAttribute("aria-labelledby", "publishedPdfTitle");

    const container = createElement("div", "container");
    const heading = createElement("div", "section-head");
    const headingCopy = createElement("div");

    const eyebrow = createElement(
      "span",
      "kicker",
      "Published downloads"
    );

    const title = createElement("h2");
    title.id = "publishedPdfTitle";
    title.appendChild(document.createTextNode("Document "));

    const accent = createElement("span", "", "library");
    title.appendChild(accent);

    const description = createElement(
      "p",
      "",
      "Browse PDFs approved for public download. Draft or unreviewed documents are not listed."
    );

    headingCopy.append(eyebrow, title, description);
    heading.appendChild(headingCopy);

    const list = createElement("div", "cards document-library__grid");
    list.setAttribute("aria-label", "Published PDF resources");

    if (!items.length) {
      const empty = createElement(
        "p",
        "document-library__empty",
        "No published PDF resources are available right now."
      );

      list.appendChild(empty);
    } else {
      items.forEach(function (item) {
        const card = createElement(
          "article",
          "card document-library__card"
        );

        const body = createElement("div", "card-body");

        const category = createElement(
          "span",
          "kicker",
          item.category
        );

        const cardTitle = createElement("h3", "", item.title);

        const cardDescription = createElement(
          "p",
          "",
          item.description
        );

        const link = createElement("a", "card-link", "Open PDF ↗");

        link.href = item.path;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", "Open PDF: " + item.title);

        body.append(category, cardTitle, cardDescription, link);
        card.appendChild(body);
        list.appendChild(card);
      });
    }

    container.append(heading, list);
    section.appendChild(container);
    main.appendChild(section);
  }

  async function init() {
    try {
      const items = await readPublishedPdfs();
      render(items);
    } catch (error) {
      render([]);
    }
  }

  const api = Object.freeze({
    init: init,
    readPublishedPdfs: readPublishedPdfs,
    safePdfPath: safePdfPath
  });

  window.MedOrbitsDocumentLibrary = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.DocumentLibrary = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})(window, document);
