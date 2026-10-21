
/* =========================================================
   MedOrbits -- Pagination Manager
   File: /assets/js/pagination.js
   Version: 1.1.0
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsPagination) return;

  const DEFAULT_PAGE_SIZE = 10;
  const DEFAULT_MAX_VISIBLE_PAGES = 5;
  const DEFAULT_PAGE_SIZE_OPTIONS = Object.freeze([10, 20, 50, 100]);
  const instances = new Map();

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
        "medorbits:pagination:" + name,
        { detail }
      ));
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
    },

    positiveInteger(value, fallback) {
      const number = Number(value);
      return Number.isSafeInteger(number) && number > 0
        ? number
        : fallback;
    },

    nonNegativeInteger(value, fallback = 0) {
      const number = Number(value);
      return Number.isSafeInteger(number) && number >= 0
        ? number
        : fallback;
    },

    clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }
  };

  function normalizeOptions(options = {}) {
    const pageSize = Math.min(
      1000,
      utils.positiveInteger(
        options.pageSize ?? options.limit,
        DEFAULT_PAGE_SIZE
      )
    );

    const pageSizeOptions = Array.isArray(options.pageSizeOptions)
      ? [...new Set(options.pageSizeOptions
          .map((value) => utils.positiveInteger(value, 0))
          .filter((value) => value > 0 && value <= 1000))]
      : [...DEFAULT_PAGE_SIZE_OPTIONS];

    if (!pageSizeOptions.includes(pageSize)) {
      pageSizeOptions.push(pageSize);
    }

    return {
      page: utils.positiveInteger(options.page, 1),
      pageSize,
      totalItems: utils.nonNegativeInteger(options.totalItems),
      totalPages: utils.nonNegativeInteger(options.totalPages),
      maxVisiblePages: Math.min(
        15,
        utils.positiveInteger(
          options.maxVisiblePages,
          DEFAULT_MAX_VISIBLE_PAGES
        )
      ),
      pageSizeOptions: pageSizeOptions.sort((a, b) => a - b),
      showFirstLast: options.showFirstLast !== false,
      showPreviousNext: options.showPreviousNext !== false,
      showPageSize: options.showPageSize !== false,
      showSummary: options.showSummary !== false,
      showJumpToPage: Boolean(options.showJumpToPage),
      urlSync: Boolean(options.urlSync),
      urlPageParam: options.urlPageParam || "page",
      urlPageSizeParam: options.urlPageSizeParam || "limit",
      labels: {
        first: "First",
        previous: "Previous",
        next: "Next",
        last: "Last",
        page: "Page",
        pageSize: "Items per page",
        showing: "Showing",
        of: "of",
        items: "items",
        jump: "Go",
        ...(options.labels || {})
      },
      onChange: typeof options.onChange === "function"
        ? options.onChange
        : null
    };
  }

  function getTotalPages(totalItems, pageSize, suppliedTotalPages) {
    if (suppliedTotalPages > 0) return suppliedTotalPages;
    return Math.ceil(totalItems / pageSize);
  }

  function getPageRange(page, pageSize, totalItems) {
    if (totalItems === 0) return { start: 0, end: 0 };

    return {
      start: (page - 1) * pageSize + 1,
      end: Math.min(page * pageSize, totalItems)
    };
  }

  function getVisiblePages(currentPage, totalPages, maxVisiblePages) {
    if (totalPages <= 0) return [];

    const count = Math.min(maxVisiblePages, totalPages);
    const half = Math.floor(count / 2);

    let start = Math.max(1, currentPage - half);
    let end = start + count - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - count + 1);
    }

    return Array.from(
      { length: end - start + 1 },
      (_, index) => start + index
    );
  }

  function buildPaginationMarkup(options) {
    const settings = options;
    const totalPages = getTotalPages(
      settings.totalItems,
      settings.pageSize,
      settings.totalPages
    );

    const page = utils.clamp(
      settings.page,
      1,
      Math.max(1, totalPages)
    );

    const range = getPageRange(
      page,
      settings.pageSize,
      settings.totalItems
    );

    const visiblePages = getVisiblePages(
      page,
      totalPages,
      settings.maxVisiblePages
    );

    const labels = settings.labels;
    const controls = [];

    function button(label, action, disabled, ariaLabel) {
      return `
        <button type="button"
          class="mo-pagination-button mo-pagination-${action}"
          data-page-action="${action}"
          aria-label="${utils.escapeHTML(ariaLabel)}"
          ${disabled ? "disabled" : ""}>
          ${label}
        </button>`;
    }

    if (settings.showFirstLast) {
      controls.push(button("«", "first", page <= 1 || !totalPages,
        labels.first + " page"));
    }

    if (settings.showPreviousNext) {
      controls.push(button("‹", "previous", page <= 1 || !totalPages,
        labels.previous + " page"));
    }

    if (visiblePages.length && visiblePages[0] > 1) {
      controls.push(`
        <button type="button" class="mo-pagination-button"
          data-page-number="1" aria-label="Page 1">1</button>`);

      if (visiblePages[0] > 2) {
        controls.push(
          '<span class="mo-pagination-ellipsis" aria-hidden="true">…</span>'
        );
      }
    }

    visiblePages.forEach((number) => {
      const active = number === page;

      controls.push(`
        <button type="button"
          class="mo-pagination-button${active ? " is-active" : ""}"
          data-page-number="${number}"
          aria-label="Page ${number}"
          ${active ? 'aria-current="page"' : ""}>
          ${number}
        </button>`);
    });

    if (
      visiblePages.length &&
      visiblePages[visiblePages.length - 1] < totalPages
    ) {
      if (visiblePages[visiblePages.length - 1] < totalPages - 1) {
        controls.push(
          '<span class="mo-pagination-ellipsis" aria-hidden="true">…</span>'
        );
      }

      controls.push(`
        <button type="button" class="mo-pagination-button"
          data-page-number="${totalPages}"
          aria-label="Page ${totalPages}">${totalPages}</button>`);
    }

    if (settings.showPreviousNext) {
      controls.push(button("›", "next", page >= totalPages || !totalPages,
        labels.next + " page"));
    }

    if (settings.showFirstLast) {
      controls.push(button("»", "last", page >= totalPages || !totalPages,
        labels.last + " page"));
    }

    const pageSizeControl = settings.showPageSize
      ? `
        <label class="mo-pagination-size-label">
          <span>${utils.escapeHTML(labels.pageSize)}</span>
          <select data-page-size aria-label="${utils.escapeHTML(labels.pageSize)}">
            ${settings.pageSizeOptions.map((size) => `
              <option value="${size}"
                ${size === settings.pageSize ? "selected" : ""}>
                ${size}
              </option>`).join("")}
          </select>
        </label>`
      : "";

    const summary = settings.showSummary
      ? `
        <div class="mo-pagination-summary" aria-live="polite" aria-atomic="true">
          ${utils.escapeHTML(labels.showing)}
          <strong>${range.start}–${range.end}</strong>
          ${utils.escapeHTML(labels.of)}
          <strong>${settings.totalItems}</strong>
          ${utils.escapeHTML(labels.items)}
        </div>`
      : "";

    const jumpControl = settings.showJumpToPage && totalPages > 1
      ? `
        <form class="mo-pagination-jump-form" data-page-jump-form>
          <label>
            <span>${utils.escapeHTML(labels.page)}</span>
            <input type="number" data-page-jump min="1"
              max="${totalPages}" value="${page}"
              inputmode="numeric" required
              aria-label="Go to page">
          </label>
          <button type="submit">${utils.escapeHTML(labels.jump)}</button>
        </form>`
      : "";

    return `
      <nav class="mo-pagination" aria-label="Pagination"
        data-pagination-root>
        ${summary}
        ${pageSizeControl}
        <div class="mo-pagination-controls">
          ${totalPages > 1 ? controls.join("") : ""}
        </div>
        ${jumpControl}
      </nav>`;
  }

  function syncUrl(instance) {
    if (!instance.options.urlSync) return;

    try {
      const url = new URL(window.location.href);

      url.searchParams.set(
        instance.options.urlPageParam,
        String(instance.page)
      );

      url.searchParams.set(
        instance.options.urlPageSizeParam,
        String(instance.pageSize)
      );

      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash
      );
    } catch (error) {
      console.warn("[MedOrbits Pagination] URL sync failed.", error);
    }
  }

  function getUrlState(options) {
    const settings = normalizeOptions(options);
    const url = new URL(window.location.href);

    const allowedSizes = settings.pageSizeOptions;

    const requestedSize = utils.positiveInteger(
      url.searchParams.get(settings.urlPageSizeParam),
      settings.pageSize
    );

    return {
      page: utils.positiveInteger(
        url.searchParams.get(settings.urlPageParam),
        settings.page
      ),
      pageSize: allowedSizes.includes(requestedSize)
        ? requestedSize
        : settings.pageSize
    };
  }

  function renderMarkup(instance) {
    instance.container.innerHTML = buildPaginationMarkup({
      ...instance.options,
      page: instance.page,
      pageSize: instance.pageSize,
      totalItems: instance.totalItems,
      totalPages: instance.totalPages
    });
  }

  function render(target, options = {}) {
    const container = utils.getElement(target);

    if (!container) {
      throw new Error("Pagination container was not found.");
    }

    const settings = normalizeOptions(options);
    const existingId = container.dataset.paginationId;

    if (existingId) {
      destroy(existingId);
    }

    const id = "pagination-" +
      (window.crypto?.randomUUID?.() ||
        Math.random().toString(36).slice(2, 12));

    let page = settings.page;
    let pageSize = settings.pageSize;

    if (settings.urlSync) {
      const urlState = getUrlState(settings);
      page = urlState.page;
      pageSize = urlState.pageSize;
    }

    const instance = {
      id,
      container,
      options: settings,
      page,
      pageSize,
      totalItems: settings.totalItems,
      totalPages: getTotalPages(
        settings.totalItems,
        pageSize,
        settings.totalPages
      )
    };

    instance.page = utils.clamp(
      instance.page,
      1,
      Math.max(1, instance.totalPages)
    );

    container.dataset.paginationId = id;
    instances.set(id, instance);

    renderMarkup(instance);
    bindInstance(instance);

    if (settings.urlSync) syncUrl(instance);

    return instance;
  }

  function bindInstance(instance) {
    const container = instance.container;

    container._moPaginationClick = function (event) {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const button = target.closest(
        "[data-page-number], [data-page-action]"
      );

      if (!button || !container.contains(button) || button.disabled) {
        return;
      }

      event.preventDefault();

      if (button.hasAttribute("data-page-number")) {
        goToPage(instance.id, Number(button.dataset.pageNumber));
        return;
      }

      const action = button.dataset.pageAction;

      const destinations = {
        first: 1,
        previous: instance.page - 1,
        next: instance.page + 1,
        last: instance.totalPages
      };

      if (Object.prototype.hasOwnProperty.call(destinations, action)) {
        goToPage(instance.id, destinations[action]);
      }
    };

    container._moPaginationChange = function (event) {
      if (
        event.target instanceof HTMLSelectElement &&
        event.target.matches("[data-page-size]")
      ) {
        setPageSize(instance.id, Number(event.target.value));
      }
    };

    container._moPaginationSubmit = function (event) {
      const form = event.target;

      if (
        !(form instanceof HTMLFormElement) ||
        !form.matches("[data-page-jump-form]")
      ) {
        return;
      }

      event.preventDefault();

      const input = form.querySelector("[data-page-jump]");

      if (!input || !input.reportValidity()) return;

      goToPage(instance.id, Number(input.value));
    };

    container.addEventListener("click", container._moPaginationClick);
    container.addEventListener("change", container._moPaginationChange);
    container.addEventListener("submit", container._moPaginationSubmit);

    container.dataset.paginationBound = "true";
  }

  function update(instance, options = {}) {
    if (options.totalItems !== undefined) {
      instance.totalItems = utils.nonNegativeInteger(options.totalItems);
      instance.options.totalPages = 0;
    }

    if (options.totalPages !== undefined) {
      instance.options.totalPages = utils.nonNegativeInteger(
        options.totalPages
      );
    }

    if (options.pageSize !== undefined) {
      instance.pageSize = Math.min(
        1000,
        utils.positiveInteger(options.pageSize, instance.pageSize)
      );
    }

    if (options.page !== undefined) {
      instance.page = utils.positiveInteger(options.page, instance.page);
    }

    if (options.onChange !== undefined) {
      instance.options.onChange =
        typeof options.onChange === "function"
          ? options.onChange
          : null;
    }

    if (options.pageSizeOptions !== undefined) {
      instance.options.pageSizeOptions =
        normalizeOptions({
          ...instance.options,
          pageSize: instance.pageSize,
          pageSizeOptions: options.pageSizeOptions
        }).pageSizeOptions;
    }

    instance.totalPages = getTotalPages(
      instance.totalItems,
      instance.pageSize,
      instance.options.totalPages
    );

    instance.page = utils.clamp(
      instance.page,
      1,
      Math.max(1, instance.totalPages)
    );

    instance.options.totalItems = instance.totalItems;
    instance.options.totalPages = instance.totalPages;
    instance.options.page = instance.page;
    instance.options.pageSize = instance.pageSize;

    renderMarkup(instance);
    bindInstance(instance);

    return instance;
  }

  function notifyChange(instance, reason) {
    const range = getPageRange(
      instance.page,
      instance.pageSize,
      instance.totalItems
    );

    const detail = {
      id: instance.id,
      page: instance.page,
      pageSize: instance.pageSize,
      totalItems: instance.totalItems,
      totalPages: instance.totalPages,
      start: range.start,
      end: range.end,
      reason
    };

    syncUrl(instance);
    utils.dispatch("change", detail);

    if (instance.options.onChange) {
      try {
        instance.options.onChange(detail);
      } catch (error) {
        console.error("[MedOrbits Pagination] onChange failed.", error);
      }
    }
  }

  function goToPage(id, page) {
    const instance = instances.get(String(id));

    if (!instance) return null;

    const requestedPage = Number(page);

    if (!Number.isFinite(requestedPage)) return instance;

    const nextPage = utils.clamp(
      Math.trunc(requestedPage),
      1,
      Math.max(1, instance.totalPages)
    );

    if (nextPage === instance.page) return instance;

    instance.page = nextPage;
    update(instance, { page: nextPage });
    notifyChange(instance, "page");

    return instance;
  }

  function setPageSize(id, pageSize) {
    const instance = instances.get(String(id));

    if (!instance) return null;

    const requestedSize = utils.positiveInteger(
      pageSize,
      instance.pageSize
    );

    const nextSize = Math.min(1000, requestedSize);

    if (nextSize === instance.pageSize) return instance;

    instance.pageSize = nextSize;
    instance.page = 1;
    instance.options.totalPages = 0;

    update(instance, {
      page: 1,
      pageSize: nextSize,
      totalPages: 0
    });

    notifyChange(instance, "page-size");

    return instance;
  }

  function setTotalItems(id, totalItems) {
    const instance = instances.get(String(id));

    if (!instance) return null;

    update(instance, {
      totalItems: utils.nonNegativeInteger(totalItems),
      totalPages: 0
    });

    notifyChange(instance, "total-items");

    return instance;
  }

  function getPageData(items, page, pageSize) {
    const data = Array.isArray(items) ? items : [];
    const size = Math.min(
      1000,
      utils.positiveInteger(pageSize, DEFAULT_PAGE_SIZE)
    );

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / size);
    const currentPage = utils.clamp(
      utils.positiveInteger(page, 1),
      1,
      Math.max(1, totalPages)
    );

    const startIndex = (currentPage - 1) * size;

    return {
      items: data.slice(startIndex, startIndex + size),
      page: currentPage,
      pageSize: size,
      totalItems,
      totalPages,
      startIndex,
      endIndex: Math.min(startIndex + size, totalItems)
    };
  }

  function paginate(items, options = {}) {
    return getPageData(
      items,
      options.page || 1,
      options.pageSize || options.limit || DEFAULT_PAGE_SIZE
    );
  }

  function destroy(id) {
    const instance = instances.get(String(id));

    if (!instance) return false;

    const container = instance.container;

    if (container._moPaginationClick) {
      container.removeEventListener("click", container._moPaginationClick);
    }

    if (container._moPaginationChange) {
      container.removeEventListener("change", container._moPaginationChange);
    }

    if (container._moPaginationSubmit) {
      container.removeEventListener("submit", container._moPaginationSubmit);
    }

    delete container._moPaginationClick;
    delete container._moPaginationChange;
    delete container._moPaginationSubmit;

    delete container.dataset.paginationBound;
    delete container.dataset.paginationId;

    instances.delete(String(id));

    return true;
  }

  function destroyAll() {
    Array.from(instances.keys()).forEach(destroy);
  }

  function initAll() {
    document.querySelectorAll("[data-pagination]").forEach((container) => {
      render(container, {
        page: utils.positiveInteger(container.dataset.page, 1),
        pageSize: utils.positiveInteger(
          container.dataset.pageSize,
          DEFAULT_PAGE_SIZE
        ),
        totalItems: utils.nonNegativeInteger(
          container.dataset.totalItems
        ),
        totalPages: utils.nonNegativeInteger(
          container.dataset.totalPages
        ),
        maxVisiblePages: utils.positiveInteger(
          container.dataset.maxVisiblePages,
          DEFAULT_MAX_VISIBLE_PAGES
        ),
        showPageSize: container.dataset.showPageSize !== "false",
        showSummary: container.dataset.showSummary !== "false",
        showJumpToPage: container.dataset.showJumpToPage === "true",
        urlSync: container.dataset.urlSync === "true"
      });
    });
  }

  const api = Object.freeze({
    initAll,
    create: render,
    render,
    update,
    destroy,
    destroyAll,

    goToPage,
    setPageSize,
    setTotalItems,

    paginate,
    getPageData,
    getPageRange,
    getVisiblePages,
    getInstance: (id) => instances.get(String(id)) || null,
    getInstances: () => Array.from(instances.values()),

    constants: Object.freeze({
      DEFAULT_PAGE_SIZE,
      DEFAULT_MAX_VISIBLE_PAGES,
      DEFAULT_PAGE_SIZE_OPTIONS
    })
  });

  window.MedOrbitsPagination = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Pagination = api;

  function autoInit() {
    initAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }
})(window, document);
