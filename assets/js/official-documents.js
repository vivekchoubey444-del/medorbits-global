
/* ==========================================================================
   MedOrbits | Official Documents
   File: assets/js/official-documents.js

   Features:
   - Accessible responsive navigation and dropdowns
   - Live resource search and category filtering
   - Resource counts and accessible empty states
   - Desktop horizontal carousels
   - Mobile two-column grid compatibility
   - Optional JSON catalogue integration
   - Duplicate prevention and safe DOM rendering
   - HTTP/HTTPS URL validation
   - Graceful loading and error handling
   - Reduced-motion support
   ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------------
     1. Shared utilities
     ------------------------------------------------------------------------ */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  const mobileGridQuery = window.matchMedia
    ? window.matchMedia("(max-width: 560px)")
    : { matches: false };

  const desktopQuery = window.matchMedia
    ? window.matchMedia("(min-width: 64rem)")
    : { matches: false };

  const state = {
    jsonStatus: "idle",
    jsonLoaded: false
  };

  const normalize = value =>
    String(value ?? "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase();

  const setText = (element, value) => {
    if (element) element.textContent = String(value ?? "");
  };

  const isElement = value =>
    typeof Element !== "undefined" && value instanceof Element;

  function createElement(tag, className = "", text) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }

  function slugify(value) {
    return normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Resolve a URL against this website and allow only HTTP or HTTPS.
   * Reject javascript:, data:, file: and other unsafe URL schemes.
   */
  function getSafeHttpUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    try {
      const url = new URL(value.trim(), window.location.origin);

      if (!["https:", "http:"].includes(url.protocol)) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  /* ------------------------------------------------------------------------
     2. Footer year
     ------------------------------------------------------------------------ */

  setText($("#currentYear"), new Date().getFullYear());

  /* ------------------------------------------------------------------------
     3. Responsive navigation
     ------------------------------------------------------------------------ */

  const menuToggle = $("#menuToggle");
  const mainNav = $("#mainNav");
  const navGroups = $$(".nav-group", mainNav || document);

  function setMenuButtonState(open) {
    if (!menuToggle) return;

    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute(
      "aria-label",
      open ? "Close navigation menu" : "Open navigation menu"
    );

    menuToggle.textContent = open ? "× CLOSE" : "☰ MENU";
  }

  function setGroupState(group, open) {
    group.classList.toggle("open", open);

    const trigger = $(".nav-trigger", group);

    trigger?.setAttribute("aria-expanded", String(open));
  }

  function closeDropdowns(except = null) {
    navGroups.forEach(group => {
      if (group !== except) {
        setGroupState(group, false);
      }
    });
  }

  function closeNav({ returnFocus = false } = {}) {
    mainNav?.classList.remove("open");

    setMenuButtonState(false);
    closeDropdowns();

    if (returnFocus) {
      menuToggle?.focus();
    }
  }

  if (menuToggle && mainNav) {
    setMenuButtonState(mainNav.classList.contains("open"));

    menuToggle.addEventListener("click", () => {
      const shouldOpen = !mainNav.classList.contains("open");

      mainNav.classList.toggle("open", shouldOpen);
      setMenuButtonState(shouldOpen);

      if (!shouldOpen) {
        closeDropdowns();
      }
    });

    navGroups.forEach(group => {
      const trigger = $(".nav-trigger", group);

      if (!trigger) return;

      trigger.addEventListener("click", event => {
        event.stopPropagation();

        const shouldOpen = !group.classList.contains("open");

        closeDropdowns(group);
        setGroupState(group, shouldOpen);
      });

      /* Close a dropdown when focus moves outside its navigation group. */
      group.addEventListener("focusout", event => {
        const nextTarget = event.relatedTarget;

        if (
          nextTarget instanceof Node &&
          group.contains(nextTarget)
        ) {
          return;
        }

        if (nextTarget) {
          setGroupState(group, false);
        }
      });
    });

    $$("#mainNav a").forEach(link => {
      link.addEventListener("click", () => {
        closeNav();
      });
    });

    document.addEventListener("click", event => {
      if (!isElement(event.target)) return;

      if (!event.target.closest(".nav-group")) {
        closeDropdowns();
      }

      const clickedNav = event.target.closest("#mainNav");
      const clickedToggle = event.target.closest("#menuToggle");

      if (
        mainNav.classList.contains("open") &&
        !clickedNav &&
        !clickedToggle
      ) {
        closeNav();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;

      const menuWasOpen = mainNav.classList.contains("open");

      const dropdownWasOpen = navGroups.some(group =>
        group.classList.contains("open")
      );

      if (menuWasOpen || dropdownWasOpen) {
        closeNav({ returnFocus: true });
      }
    });

    function handleBreakpointChange() {
      if (desktopQuery.matches) {
        closeNav();
      }
    }

    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener("change", handleBreakpointChange);
    } else if (desktopQuery.addListener) {
      desktopQuery.addListener(handleBreakpointChange);
    }

    window.addEventListener("resize", handleBreakpointChange, {
      passive: true
    });
  }

  /* ------------------------------------------------------------------------
     4. Resource library references
     ------------------------------------------------------------------------ */

  const searchInput = $("#documentSearch");
  const categorySelect = $("#documentCategory");
  const resetButton = $("#resetDocuments");
  const statusMessage = $("#documentStatus");
  const grid = $("#documentGrid");

  /*
   * In the supplied HTML, #documentGrid itself has class resource-rails.
   * Support both that structure and a nested .resource-rails container.
   */
  const railsRoot = grid
    ? grid.matches(".resource-rails")
      ? grid
      : $(".resource-rails", grid) || grid
    : null;

  function getCards() {
    return $$(".resource-card", railsRoot || document);
  }

  function getRails() {
    return $$(".resource-rail", railsRoot || document);
  }

  /* ------------------------------------------------------------------------
     5. Empty state
     ------------------------------------------------------------------------ */

  function getEmptyState() {
    if (!railsRoot) return null;

    let empty = $("#documentEmpty", railsRoot);

    if (!empty) {
      empty = createElement(
        "p",
        "empty-state",
        "No matching resources found. Try another keyword or reset the filters."
      );

      empty.id = "documentEmpty";
      empty.setAttribute("role", "status");
      empty.setAttribute("aria-live", "polite");
      empty.hidden = true;

      railsRoot.appendChild(empty);
    }

    return empty;
  }

  function updateStatus(visibleCount, totalCount) {
    if (!statusMessage) return;

    if (totalCount === 0) {
      const messages = {
        loading: "Loading official document resources…",
        error: "The resource catalogue could not be loaded. Please try again later.",
        loaded: "No document resources are currently available.",
        idle: "No document resources are currently configured."
      };

      setText(
        statusMessage,
        messages[state.jsonStatus] || messages.idle
      );

      return;
    }

    if (visibleCount === 0) {
      setText(
        statusMessage,
        "No matching resources found. Try another keyword or reset the filters."
      );

      return;
    }

    const noun = visibleCount === 1 ? "resource" : "resources";

    setText(
      statusMessage,
      `Showing ${visibleCount} of ${totalCount} ${noun}. ` +
      "Verify current requirements with the relevant official authority."
    );
  }

  function getSearchableText(card) {
    return normalize([
      card.dataset.search,
      card.dataset.searchable,
      card.dataset.resourceId,
      card.dataset.category,
      card.textContent
    ].filter(Boolean).join(" "));
  }

  /* ------------------------------------------------------------------------
     6. Search and category filtering
     ------------------------------------------------------------------------ */

  function applyFilters() {
    if (!railsRoot) return;

    const query = normalize(searchInput?.value);
    const selectedCategory = normalize(
      categorySelect?.value || "all"
    );

    const cards = getCards();
    let visibleCount = 0;

    cards.forEach(card => {
      const cardCategory = normalize(
        card.dataset.category || "education"
      );

      const categoryMatches =
        selectedCategory === "all" ||
        cardCategory === selectedCategory;

      const queryMatches =
        !query || getSearchableText(card).includes(query);

      const visible = categoryMatches && queryMatches;

      card.hidden = !visible;

      if (visible) {
        visibleCount += 1;
      }
    });

    /* Hide headings and controls when a rail has no visible cards. */
    getRails().forEach(rail => {
      const hasVisibleCard = $$(".resource-card", rail)
        .some(card => !card.hidden);

      rail.hidden = !hasVisibleCard;

      const track = $(".resource-track", rail);

      /*
       * Desktop uses horizontal carousels. Mobile uses a grid, so
       * do not scroll the grid back to its first column during filtering.
       */
      if (track && !mobileGridQuery.matches) {
        track.scrollTo({
          left: 0,
          behavior: reducedMotion.matches ? "auto" : "smooth"
        });
      }
    });

    const empty = getEmptyState();

    if (empty) {
      empty.hidden = visibleCount > 0;
    }

    updateStatus(visibleCount, cards.length);
    updateRailControls();
  }

  searchInput?.addEventListener("input", applyFilters);
  categorySelect?.addEventListener("change", applyFilters);

  resetButton?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (categorySelect) categorySelect.value = "all";

    applyFilters();
    searchInput?.focus();
  });

  /* ------------------------------------------------------------------------
     7. Desktop horizontal carousels
     ------------------------------------------------------------------------ */

  function getRailStep(track) {
    const visibleCard = $(".resource-card:not([hidden])", track);

    if (!visibleCard) {
      return Math.max(220, Math.round(track.clientWidth * 0.85));
    }

    const styles = window.getComputedStyle(track);

    const gapValue =
      styles.columnGap !== "normal"
        ? styles.columnGap
        : styles.gap;

    const gap = Number.parseFloat(gapValue) || 16;

    return Math.round(
      visibleCard.getBoundingClientRect().width + gap
    );
  }

  function updateRailControls(scope = document) {
    const rails = [];

    if (
      isElement(scope) &&
      scope.matches(".resource-rail")
    ) {
      rails.push(scope);
    }

    rails.push(...$$(".resource-rail", scope));

    rails.forEach(rail => {
      const track = $(".resource-track", rail);

      if (!track) return;

      const previous = $("[data-rail-prev]", rail);
      const next = $("[data-rail-next]", rail);

      /*
       * Carousel controls are not needed in the two-column mobile grid.
       * CSS hides the controls; this also keeps their state consistent.
       */
      if (mobileGridQuery.matches) {
        if (previous) previous.disabled = true;
        if (next) next.disabled = true;

        rail.classList.remove("has-overflow");
        return;
      }

      const maxScroll = Math.max(
        0,
        track.scrollWidth - track.clientWidth
      );

      const currentScroll = Math.max(0, track.scrollLeft);

      if (previous) {
        previous.disabled = currentScroll <= 2;
      }

      if (next) {
        next.disabled =
          maxScroll <= 2 ||
          currentScroll >= maxScroll - 3;
      }

      rail.classList.toggle("has-overflow", maxScroll > 2);
    });
  }

  function wireRail(rail) {
    const track = $(".resource-track", rail);

    if (!track || track.dataset.railWired === "true") {
      return;
    }

    track.dataset.railWired = "true";

    const previous = $("[data-rail-prev]", rail);
    const next = $("[data-rail-next]", rail);

    previous?.addEventListener("click", () => {
      if (mobileGridQuery.matches) return;

      track.scrollBy({
        left: -getRailStep(track),
        behavior: reducedMotion.matches ? "auto" : "smooth"
      });
    });

    next?.addEventListener("click", () => {
      if (mobileGridQuery.matches) return;

      track.scrollBy({
        left: getRailStep(track),
        behavior: reducedMotion.matches ? "auto" : "smooth"
      });
    });

    track.addEventListener(
      "scroll",
      () => updateRailControls(rail),
      { passive: true }
    );

    updateRailControls(rail);
  }

  function wireAllRails(scope = document) {
    const rails = [];

    if (
      isElement(scope) &&
      scope.matches(".resource-rail")
    ) {
      rails.push(scope);
    }

    rails.push(...$$(".resource-rail", scope));

    rails.forEach(wireRail);
    updateRailControls(scope);
  }

  wireAllRails();

  function handleGridBreakpointChange() {
    updateRailControls();

    /*
     * Recalculate desktop control states when switching from grid to
     * carousel layout, without changing the cards or their DOM order.
     */
    if (!mobileGridQuery.matches) {
      requestAnimationFrame(() => updateRailControls());
    }
  }

  if (mobileGridQuery.addEventListener) {
    mobileGridQuery.addEventListener(
      "change",
      handleGridBreakpointChange
    );
  } else if (mobileGridQuery.addListener) {
    mobileGridQuery.addListener(handleGridBreakpointChange);
  }

  window.addEventListener(
    "resize",
    () => updateRailControls(),
    { passive: true }
  );

  window.addEventListener(
    "load",
    () => updateRailControls(),
    { once: true }
  );

  /* ------------------------------------------------------------------------
     8. JSON catalogue support

     Body configuration:
     data-resources-json="/assets/data/official-document-resources.json"

     Expected structure:
     {
       "resources": [
         {
           "id": "sample-resource",
           "title": "Official resource title",
           "category": "education",
           "categoryLabel": "Education records",
           "description": "Short description.",
           "url": "https://official.example/",
           "linkLabel": "Open official resource",
           "image": "/assets/images/example.jpg",
           "imageAlt": "Description of image",
           "icon": "▤",
           "keywords": ["admission", "certificate"],
           "rail": "education",
           "railLabel": "Education resources"
         }
       ]
     }
     ------------------------------------------------------------------------ */

  function getOrCreateRail(item) {
    if (!railsRoot) return null;

    const railName = String(
      item.rail || "additional"
    ).trim();

    let rail = getRails().find(candidate =>
      candidate.dataset.resourceRail === railName
    );

    if (rail) return rail;

    rail = createElement("section", "resource-rail");
    rail.dataset.resourceRail = railName;

    const heading = createElement("div", "rail-heading");
    const headingCopy = createElement("div");

    const railTitle =
      String(item.railLabel || "").trim() ||
      "Additional official resources";

    const title = createElement("h3", "", railTitle);

    const description = createElement(
      "p",
      "",
      "Official resources selected for this topic."
    );

    headingCopy.append(title, description);

    const controls = createElement("div", "rail-controls");

    const previous = createElement(
      "button",
      "rail-control",
      "‹"
    );

    previous.type = "button";
    previous.dataset.railPrev = "";
    previous.setAttribute(
      "aria-label",
      `Scroll ${railTitle} backwards`
    );

    const next = createElement(
      "button",
      "rail-control",
      "›"
    );

    next.type = "button";
    next.dataset.railNext = "";
    next.setAttribute(
      "aria-label",
      `Scroll ${railTitle} forwards`
    );

    controls.append(previous, next);
    heading.append(headingCopy, controls);

    const track = createElement("div", "resource-track");
    track.tabIndex = 0;
    track.setAttribute("role", "group");
    track.setAttribute("aria-label", railTitle);

    rail.append(heading, track);

    railsRoot.appendChild(rail);

    wireRail(rail);

    return rail;
  }

  function createResourceCard(item, fallbackId) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return null;
    }

    const titleText = String(item.title || "").trim();
    const descriptionText = String(
      item.description || ""
    ).trim();

    const safeUrl = getSafeHttpUrl(
      String(item.url || "")
    );

    /*
     * Invalid records are skipped instead of creating incomplete
     * cards with broken links or empty headings.
     */
    if (!titleText || !descriptionText || !safeUrl) {
      return null;
    }

    const article = createElement("article", "resource-card");

    article.dataset.resourceId = String(
      item.id || fallbackId
    );

    article.dataset.category = String(
      item.category || "education"
    );

    article.dataset.search = [
      titleText,
      item.categoryLabel,
      descriptionText,
      Array.isArray(item.keywords)
        ? item.keywords.join(" ")
        : item.keywords
    ].filter(Boolean).join(" ");

    /* Image with a graceful fallback. */
    const media = createElement("div", "resource-image");

    const iconText = String(item.icon || "▤");

    const imageUrl = item.image
      ? getSafeHttpUrl(String(item.image))
      : null;

    if (imageUrl) {
      const image = document.createElement("img");

      image.src = imageUrl;
      image.alt = String(item.imageAlt || "");
      image.loading = "lazy";
      image.decoding = "async";

      image.addEventListener("error", () => {
        const fallback = createElement(
          "div",
          "image-fallback",
          iconText
        );

        fallback.setAttribute("aria-hidden", "true");
        media.replaceChildren(fallback);
      }, { once: true });

      media.appendChild(image);
    } else {
      const fallback = createElement(
        "div",
        "image-fallback",
        iconText
      );

      fallback.setAttribute("aria-hidden", "true");
      media.appendChild(fallback);
    }

    /* Card content uses textContent, not untrusted HTML strings. */
    const body = createElement("div", "resource-card-body");

    const badge = createElement(
      "span",
      "resource-category",
      item.categoryLabel || item.category || "Resource"
    );

    const title = createElement("h4", "", titleText);

    const description = createElement(
      "p",
      "",
      descriptionText
    );

    const linkLabel =
      String(item.linkLabel || "").trim() ||
      "Open official resource";

    const link = createElement(
      "a",
      "resource-link",
      `${linkLabel} ↗`
    );

    link.href = safeUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    body.append(badge, title, description, link);
    article.append(media, body);

    return article;
  }

  async function loadResourceData() {
    const configuredUrl = document.body
      .dataset.resourcesJson
      ?.trim();

    /*
     * JSON is optional. Without a configured URL, the static HTML
     * fallback cards remain in place.
     */
    if (!configuredUrl || !railsRoot) {
      state.jsonStatus = "idle";
      applyFilters();
      return;
    }

    const safeDataUrl = getSafeHttpUrl(configuredUrl);

    if (!safeDataUrl) {
      state.jsonStatus = "error";

      console.warn(
        "[MedOrbits] Invalid resource JSON URL. Use HTTP or HTTPS."
      );

      applyFilters();
      return;
    }

    state.jsonStatus = "loading";
    applyFilters();

    try {
      const response = await fetch(safeDataUrl, {
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error(
          `Resource request failed with HTTP ${response.status}.`
        );
      }

      const payload = await response.json();

      if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray(payload.resources)
      ) {
        throw new Error(
          'Invalid resource catalogue: expected a "resources" array.'
        );
      }

      const existingIds = new Set(
        getCards()
          .map(card => card.dataset.resourceId)
          .filter(Boolean)
      );

      payload.resources.forEach((item, index) => {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item)
        ) {
          console.warn(
            `[MedOrbits] Skipped malformed resource at index ${index}.`
          );
          return;
        }

        const id = String(
          item.id ||
          `${slugify(item.rail || "additional")}-${index}`
        ).trim();

        if (!id || existingIds.has(id)) {
          return;
        }

        const card = createResourceCard(item, id);

        if (!card) {
          console.warn(
            `[MedOrbits] Skipped invalid resource record: ${id}`
          );
          return;
        }

        const rail = getOrCreateRail(item);

        if (!rail) return;

        const track = $(".resource-track", rail);

        if (!track) return;

        track.appendChild(card);
        existingIds.add(id);
      });

      state.jsonLoaded = true;
      state.jsonStatus = "loaded";

      wireAllRails();
      applyFilters();
    } catch (error) {
      state.jsonStatus = "error";

      console.warn(
        "[MedOrbits] Resource JSON could not be loaded. " +
        "Existing HTML resources will remain available.",
        error
      );

      /*
       * Preserve the static cards when JSON is unavailable.
       * Do not clear the resource library on fetch or parse errors.
       */
      applyFilters();
    }
  }

  /* ------------------------------------------------------------------------
     9. Initialisation
     ------------------------------------------------------------------------ */

  wireAllRails();
  applyFilters();
  loadResourceData();
})();
