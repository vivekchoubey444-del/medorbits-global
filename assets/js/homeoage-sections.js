/* =========================================================
   MEDORBITS | HOMEPAGE SECTION JSON ENGINE
   File: /assets/js/homepage-sections.js
   Data: /assets/data/homepage-sections.json
   Production improvements:
   - Validated JSON and card data
   - Secure DOM construction without innerHTML
   - Same-origin URL validation
   - Restricted local image paths
   - Efficient document-fragment rendering
   - Duplicate initialization protection
   - Delegated interaction handling
   - Timeout and network error recovery
   - Image fallback protection
   - Accessible navigation and status messages
   - Existing enquiry popup compatibility
   - Session interest persistence
   - Optional section-specific rendering
========================================================= */
(() => {
  "use strict";
  /* =======================================================
     01. CONFIGURATION
  ======================================================= */
  const CONFIG = Object.freeze({
    dataURL: "/assets/data/homepage-sections.json",
    imageDirectory: "/assets/images/home/",
    logoFallback: "/assets/images/logo/medorbits-logo.svg",
    fallbackPage: "/education/index.html",
    enquiryPage: "/pages/enquiry-cum-popup-form.html",
    storageKey: "medorbits_selected_interest",
    requestTimeout: 12000,
    maxSections: 100,
    maxCardsPerSection: 100,
    maxSectionIdLength: 150,
    maxTitleLength: 250,
    maxDescriptionLength: 2000,
    maxImageAltLength: 300,
    maxInterestLength: 200,
    maxLinkTextLength: 100,
    maxImageFilenameLength: 180,
    /*
     * Keep false for compatibility with the existing
     * homepage markup and CSS.
     */
    hideEmptySections: false
  });
  const ICONS = Object.freeze({
    target: "◎",
    compass: "⌖",
    "file-check": "▤",
    "arrow-up-right": "↗",
    "graduation-cap": "⌂",
    "clipboard-check": "✓",
    "briefcase-business": "▣",
    globe: "◎",
    search: "⌕",
    "file-text": "▤",
    users: "♧",
    route: "⇢",
    "message-circle": "◌",
    "clipboard-list": "☷"
  });
  const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
  const SAFE_IMAGE_FILENAME =
    /^[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g|avif|svg)$/i;
  const JSON_CONTENT_TYPE =
    /^application\/(?:[\w.+-]*\+)?json\b/i;
  let initializationPromise = null;
  /* =======================================================
     02. DOM UTILITIES
  ======================================================= */
  function createElement(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }
    return element;
  }
  function safeText(
    value,
    fallback = "",
    maxLength = CONFIG.maxDescriptionLength
  ) {
    if (
      typeof value !== "string" &&
      typeof value !== "number"
    ) {
      return fallback;
    }
    const valueAsString = String(value).trim();
    if (
      !valueAsString ||
      CONTROL_CHARACTERS.test(valueAsString)
    ) {
      return fallback;
    }
    return valueAsString.slice(0, maxLength);
  }
  function isPlainObject(value) {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return (
      prototype === Object.prototype ||
      prototype === null
    );
  }
  function isSafeIdentifier(value) {
    return (
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= CONFIG.maxSectionIdLength &&
      !CONTROL_CHARACTERS.test(value)
    );
  }
  function isElement(value) {
    return (
      typeof Element !== "undefined" &&
      value instanceof Element
    );
  }
  /* =======================================================
     03. INTERNAL URL VALIDATION
  ======================================================= */
  function getInternalHref(
    path,
    fallback = CONFIG.fallbackPage
  ) {
    if (
      typeof path !== "string" ||
      !path.trim()
    ) {
      return fallback;
    }
    const candidate = path.trim();
    if (
      candidate.startsWith("//") ||
      candidate.includes("\\") ||
      CONTROL_CHARACTERS.test(candidate)
    ) {
      return fallback;
    }
    try {
      const url = new URL(
        candidate,
        window.location.origin
      );
      if (
        url.origin !== window.location.origin ||
        !["http:", "https:"].includes(url.protocol)
      ) {
        return fallback;
      }
      return (
        url.pathname +
        url.search +
        url.hash
      );
    } catch {
      return fallback;
    }
  }
  /* =======================================================
     04. LOCAL IMAGE VALIDATION
  ======================================================= */
  function getLocalImagePath(filename) {
    if (typeof filename !== "string") {
      return CONFIG.logoFallback;
    }
    const value = filename.trim();
    if (
      !value ||
      value.length > CONFIG.maxImageFilenameLength ||
      value.includes("/") ||
      value.includes("\\") ||
      value.includes("..") ||
      CONTROL_CHARACTERS.test(value) ||
      !SAFE_IMAGE_FILENAME.test(value)
    ) {
      return CONFIG.logoFallback;
    }
    return CONFIG.imageDirectory + value;
  }
  function applyImageFallback(image) {
    if (
      !image ||
      image.dataset.fallbackApplied === "true"
    ) {
      return;
    }
    image.dataset.fallbackApplied = "true";
    /*
     * Remove the error handler before switching sources.
     * Prevents repeated fallback attempts if the logo
     * is also unavailable.
     */
    image.onerror = null;
    image.src = CONFIG.logoFallback;
    image.alt = "MedOrbits";
    image.classList.add(
      "json-section-image-fallback"
    );
  }
  /* =======================================================
     05. SESSION INTEREST STORAGE
  ======================================================= */
  function saveInterest(interest) {
    const value = safeText(
      interest,
      "",
      CONFIG.maxInterestLength
    );
    if (!value) {
      return;
    }
    try {
      sessionStorage.setItem(
        CONFIG.storageKey,
        value
      );
    } catch {
      /*
       * Storage can be blocked by browser privacy
       * settings. Navigation must still work.
       */
    }
  }
  /* =======================================================
     06. ENQUIRY POPUP INTEGRATION
  ======================================================= */
  function openExistingEnquiryPopup() {
    const trigger = document.querySelector(
      "[data-open-enquiry]"
    );
    if (
      !trigger ||
      !trigger.isConnected ||
      typeof trigger.click !== "function"
    ) {
      return false;
    }
    trigger.click();
    return true;
  }
  /* =======================================================
     07. ICON GENERATOR
  ======================================================= */
  function buildIcon(iconName) {
    const symbol =
      typeof iconName === "string"
        ? ICONS[iconName] || "✦"
        : "✦";
    const icon = createElement(
      "span",
      "json-section-icon",
      symbol
    );
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }
  /* =======================================================
     08. IMAGE GENERATOR
  ======================================================= */
  function buildImage(card) {
    const imageWrap = createElement(
      "div",
      "json-section-image-wrap"
    );
    const image = createElement(
      "img",
      "json-section-image"
    );
    const title = safeText(
      card.title,
      "MedOrbits educational resource",
      CONFIG.maxTitleLength
    );
    image.alt = safeText(
      card.imageAlt,
      title,
      CONFIG.maxImageAltLength
    );
    image.loading = "lazy";
    image.decoding = "async";
    /*
     * Appropriate for below-the-fold cards.
     * Give the first visible hero image priority separately
     * if your layout includes one.
     */
    image.setAttribute("fetchpriority", "low");
    image.addEventListener(
      "error",
      () => applyImageFallback(image),
      { once: true }
    );
    image.src = getLocalImagePath(card.image);
    const number = createElement(
      "span",
      "json-section-number",
      safeText(card.number, "", 20)
    );
    number.setAttribute("aria-hidden", "true");
    imageWrap.append(image, number);
    return imageWrap;
  }
  /* =======================================================
     09. DESCRIPTION GENERATOR
  ======================================================= */
  function buildDescription(card) {
    return createElement(
      "p",
      "",
      safeText(
        card.description,
        "",
        CONFIG.maxDescriptionLength
      )
    );
  }
  /* =======================================================
     10. LINK GENERATOR
  ======================================================= */
  function buildLink(card) {
    const title = safeText(
      card.title,
      "MedOrbits resource",
      CONFIG.maxTitleLength
    );
    const label = safeText(
      card.linkText,
      "Explore",
      CONFIG.maxLinkTextLength
    );
    const opensPopup = card.openPopup === true;
    const defaultDestination = opensPopup
      ? CONFIG.enquiryPage
      : CONFIG.fallbackPage;
    const link = createElement(
      "a",
      "json-section-link",
      label + " ↗"
    );
    link.href = getInternalHref(
      card.link,
      defaultDestination
    );
    link.setAttribute(
      "aria-label",
      `${label}: ${title}`
    );
    if (card.interest !== undefined) {
      const interest = safeText(
        card.interest,
        "",
        CONFIG.maxInterestLength
      );
      if (interest) {
        link.dataset.interest = interest;
      }
    }
    if (opensPopup) {
      link.dataset.openPopup = "true";
    }
    return link;
  }
  /* =======================================================
     11. CARD GENERATOR
  ======================================================= */
  function buildCard(input) {
    const card = isPlainObject(input)
      ? input
      : {};
    const article = createElement(
      "article",
      "json-section-card"
    );
    const imageWrap = buildImage(card);
    const content = createElement(
      "div",
      "json-section-content"
    );
    const title = createElement(
      "h3",
      "",
      safeText(
        card.title,
        "Explore MedOrbits",
        CONFIG.maxTitleLength
      )
    );
    const icon = buildIcon(card.icon);
    const description = buildDescription(card);
    const link = buildLink(card);
    content.append(
      icon,
      title,
      description,
      link
    );
    article.append(
      imageWrap,
      content
    );
    return article;
  }
  /* =======================================================
     12. STATUS MESSAGES
  ======================================================= */
  function setStatus(
    grid,
    message,
    linkHref = "",
    linkText = ""
  ) {
    if (!grid) {
      return;
    }
    const status = createElement(
      "p",
      "json-section-status",
      message
    );
    if (linkHref && linkText) {
      const link = createElement(
        "a",
        "",
        linkText
      );
      link.href = getInternalHref(linkHref);
      status.append(" ", link);
    }
    grid.replaceChildren(status);
  }
  /* =======================================================
     13. JSON VALIDATION
  ======================================================= */
  function validateData(data) {
    if (
      !isPlainObject(data) ||
      !Array.isArray(data.sections)
    ) {
      throw new Error(
        "Invalid homepage JSON structure."
      );
    }
    if (
      data.sections.length > CONFIG.maxSections
    ) {
      throw new Error(
        "Homepage JSON exceeds the section limit."
      );
    }
    const ids = new Set();
    for (const section of data.sections) {
      if (!isPlainObject(section)) {
        throw new Error(
          "Invalid homepage section entry."
        );
      }
      if (!isSafeIdentifier(section.id)) {
        throw new Error(
          "A homepage section has an invalid ID."
        );
      }
      if (ids.has(section.id)) {
        throw new Error(
          "Duplicate homepage section ID: " +
          section.id
        );
      }
      ids.add(section.id);
      if (!Array.isArray(section.cards)) {
        throw new Error(
          "Section cards must be an array: " +
          section.id
        );
      }
      if (
        section.cards.length >
        CONFIG.maxCardsPerSection
      ) {
        throw new Error(
          "Section exceeds the card limit: " +
          section.id
        );
      }
      /*
       * Invalid individual cards are skipped during
       * rendering rather than breaking every section.
       */
    }
    return data;
  }
  /* =======================================================
     14. SECTION RENDERING
  ======================================================= */
  function renderSections(input) {
    const data = validateData(input);
    const sectionMap = new Map(
      data.sections.map(section => [
        section.id,
        section
      ])
    );
    const sectionElements = document.querySelectorAll(
      "[data-json-section]"
    );
    sectionElements.forEach(sectionElement => {
      const sectionId =
        sectionElement.dataset.jsonSection;
      const grid = sectionElement.querySelector(
        "[data-section-cards]"
      );
      if (!grid) {
        return;
      }
      const sectionData = sectionMap.get(sectionId);
      if (
        !sectionData ||
        !Array.isArray(sectionData.cards)
      ) {
        if (CONFIG.hideEmptySections) {
          sectionElement.hidden = true;
          return;
        }
        setStatus(
          grid,
          "This section's content is not available yet.",
          CONFIG.fallbackPage,
          "Browse education resources."
        );
        return;
      }
      const fragment =
        document.createDocumentFragment();
      let renderedCount = 0;
      sectionData.cards.forEach(card => {
        if (!isPlainObject(card)) {
          return;
        }
        fragment.appendChild(
          buildCard(card)
        );
        renderedCount += 1;
      });
      if (renderedCount === 0) {
        setStatus(
          grid,
          "New resources are coming soon.",
          CONFIG.fallbackPage,
          "Browse education resources."
        );
        return;
      }
      /*
       * One DOM replacement reduces repeated layout
       * work and avoids partially rendered card grids.
       */
      grid.replaceChildren(fragment);
      sectionElement.hidden = false;
    });
  }
  /* =======================================================
     15. DELEGATED INTERACTIONS
  ======================================================= */
  function handleDocumentClick(event) {
    if (!isElement(event.target)) {
      return;
    }
    const link = event.target.closest(
      ".json-section-link"
    );
    if (!link) {
      return;
    }
    /*
     * Ignore links outside the homepage JSON component.
     */
    if (
      !link.closest("[data-json-section]")
    ) {
      return;
    }
    if (link.dataset.interest) {
      saveInterest(link.dataset.interest);
    }
    if (link.dataset.openPopup !== "true") {
      return;
    }
    /*
     * Do not interfere with modified clicks, new-tab
     * shortcuts or non-primary mouse clicks.
     */
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (!openExistingEnquiryPopup()) {
      window.location.assign(
        getInternalHref(
          link.getAttribute("href"),
          CONFIG.enquiryPage
        )
      );
    }
  }
  /* =======================================================
     16. TIMEOUT-PROTECTED DATA REQUEST
  ======================================================= */
  async function fetchHomepageData() {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      CONFIG.requestTimeout
    );
    try {
      const response = await fetch(
        CONFIG.dataURL,
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          credentials: "same-origin",
          /*
           * Allow normal browser caching. Configure
           * Cache-Control on the server for production.
           */
          cache: "default",
          signal: controller.signal
        }
      );
      if (!response.ok) {
        throw new Error(
          `Homepage JSON request failed (${response.status}).`
        );
      }
      const contentType =
        response.headers.get("content-type") || "";
      if (
        contentType &&
        !JSON_CONTENT_TYPE.test(contentType)
      ) {
        throw new Error(
          "Homepage endpoint did not return JSON."
        );
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }
  /* =======================================================
     17. ERROR RECOVERY
  ======================================================= */
  function renderFailure(elements, error) {
    console.error(
      "[MedOrbits] Homepage sections failed to load:",
      error
    );
    elements.forEach(sectionElement => {
      const grid = sectionElement.querySelector(
        "[data-section-cards]"
      );
      if (!grid) {
        return;
      }
      setStatus(
        grid,
        "The section content could not be loaded. Please browse the full catalogue.",
        CONFIG.fallbackPage,
        "Browse education resources."
      );
    });
  }
  /* =======================================================
     18. INITIALIZATION
  ======================================================= */
  async function initialise() {
    /*
     * Reuse the same promise if initialization is called
     * more than once.
     */
    if (initializationPromise) {
      return initializationPromise;
    }
    initializationPromise = (async () => {
      const sectionElements = document.querySelectorAll(
        "[data-json-section]"
      );
      if (!sectionElements.length) {
        return;
      }
      document.addEventListener(
        "click",
        handleDocumentClick
      );
      try {
        const data = await fetchHomepageData();
        renderSections(data);
      } catch (error) {
        renderFailure(
          sectionElements,
          error
        );
      }
    })();
    return initializationPromise;
  }
  /* =======================================================
     19. STARTUP
  ======================================================= */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialise,
      { once: true }
    );
  } else {
    initialise();
  }
})();