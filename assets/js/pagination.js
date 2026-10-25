
/* =========================================================
   MEDORBITS | PAGINATION
   File: assets/js/pagination.js
   Version: 1.0.0
   Dependencies: None
   ========================================================= */

(function MedOrbitsPagination() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_PAGINATION_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var SELECTOR = "[data-pagination]";
  var instances = new Map();
  var listeners = [];
  var observer = null;
  var destroyed = false;

  function listen(element, event, handler) {
    element.addEventListener(event, handler);

    listeners.push(function () {
      element.removeEventListener(event, handler);
    });
  }

  function makeElement(tag, className, label) {
    var element = document.createElement(tag);

    if (className) element.className = className;
    if (label != null) element.textContent = String(label);

    return element;
  }

  function getItems(record) {
    var selector = record.root.getAttribute("data-pagination-items") ||
      "[data-page-item]";

    try {
      return Array.from(record.root.querySelectorAll(selector)).filter(
        function (item) {
          return !item.hasAttribute("data-pagination-control");
        }
      );
    } catch (error) {
      return Array.from(record.root.querySelectorAll("[data-page-item]"));
    }
  }

  function getPageSize(record) {
    var selector = record.root.querySelector("[data-page-size]");
    var requested = selector ? Number(selector.value) : record.pageSize;

    if (!Number.isInteger(requested) || requested < 1) {
      requested = record.pageSize;
    }

    return Math.min(requested, record.maxPageSize);
  }

  function pageCount(record) {
    return Math.max(1, Math.ceil(record.items.length / record.pageSize));
  }

  function clampPage(record) {
    record.page = Math.max(1, Math.min(record.page, pageCount(record)));
  }

  function getControl(record, selector) {
    return record.root.querySelector(selector);
  }

  function createPageButton(record, label, page, options) {
    options = options || {};

    var button = makeElement(
      "button",
      options.className || "mo-pagination__page",
      label
    );

    button.type = "button";
    button.setAttribute("data-pagination-control", "");
    button.disabled = Boolean(options.disabled);

    if (options.current) {
      button.setAttribute("aria-current", "page");
      button.setAttribute("aria-label", "Page " + page + ", current page");
    } else if (typeof page === "number") {
      button.setAttribute("aria-label", "Go to page " + page);
    }

    button.addEventListener("click", function () {
      if (button.disabled) return;

      record.page = page;
      render(record, true);
    });

    return button;
  }

  function renderNumberedPages(record, container, totalPages) {
    var maxButtons = record.maxButtons;
    var start = Math.max(1, record.page - Math.floor(maxButtons / 2));
    var end = Math.min(totalPages, start + maxButtons - 1);

    start = Math.max(1, end - maxButtons + 1);

    if (start > 1) {
      container.appendChild(createPageButton(record, "1", 1));

      if (start > 2) {
        container.appendChild(makeElement("span", "mo-pagination__ellipsis", "…"));
      }
    }

    for (var page = start; page <= end; page += 1) {
      container.appendChild(createPageButton(
        record,
        String(page),
        page,
        { current: page === record.page }
      ));
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        container.appendChild(makeElement("span", "mo-pagination__ellipsis", "…"));
      }

      container.appendChild(
        createPageButton(record, String(totalPages), totalPages)
      );
    }
  }

  function updateItems(record) {
    var start = (record.page - 1) * record.pageSize;
    var end = start + record.pageSize;

    record.items.forEach(function (item, index) {
      item.hidden = index < start || index >= end;
      item.setAttribute("data-pagination-hidden", String(item.hidden));
    });
  }

  function updateStatus(record) {
    var total = record.items.length;
    var start = total ? (record.page - 1) * record.pageSize + 1 : 0;
    var end = Math.min(record.page * record.pageSize, total);
    var status = getControl(record, "[data-pagination-status]");

    if (status) {
      status.textContent = total
        ? "Showing " + start + "–" + end + " of " + total + " items."
        : "No items to display.";
    }

    var currentPage = getControl(record, "[data-pagination-current]");
    if (currentPage) {
      currentPage.textContent = record.page + " / " + pageCount(record);
    }

    var totalElement = getControl(record, "[data-pagination-total]");
    if (totalElement) {
      totalElement.textContent = String(total);
    }
  }

  function render(record, moveFocus) {
    if (!record.root.isConnected) return;

    record.items = getItems(record);
    record.pageSize = getPageSize(record);
    clampPage(record);

    updateItems(record);

    var totalPages = pageCount(record);
    var container = getControl(record, "[data-pagination-pages]");

    if (container) {
      container.replaceChildren();
      renderNumberedPages(record, container, totalPages);
    }

    var previous = getControl(record, "[data-pagination-prev]");
    var next = getControl(record, "[data-pagination-next]");

    if (previous) previous.disabled = record.page <= 1;
    if (next) next.disabled = record.page >= totalPages;

    var controls = getControl(record, "[data-pagination-controls]");

    if (controls) {
      controls.hidden = record.items.length <= record.pageSize;
    }

    var empty = getControl(record, "[data-pagination-empty]");

    if (empty) {
      empty.hidden = record.items.length > 0;
    }

    updateStatus(record);

    if (moveFocus) {
      var heading = getControl(record, "[data-pagination-heading]") ||
        record.root.querySelector("h2, h3, h4");

      if (heading) {
        if (!heading.hasAttribute("tabindex")) {
          heading.setAttribute("tabindex", "-1");
        }

        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ behavior: "auto", block: "nearest" });
      }
    }
  }

  function initialize(root) {
    if (instances.has(root)) return instances.get(root);

    var initialSize = Number(root.getAttribute("data-pagination-size")) || 10;
    var maxSize = Number(root.getAttribute("data-pagination-max-size")) || 100;
    var maxButtons = Number(root.getAttribute("data-pagination-max-buttons")) || 5;

    var record = {
      root: root,
      items: [],
      page: 1,
      pageSize: Math.min(initialSize, maxSize),
      maxPageSize: Math.min(Math.max(1, maxSize), 500),
      maxButtons: Math.min(Math.max(3, maxButtons), 11)
    };

    instances.set(root, record);

    var previous = getControl(record, "[data-pagination-prev]");
    var next = getControl(record, "[data-pagination-next]");
    var sizeSelect = getControl(record, "[data-page-size]");
    var form = getControl(record, "[data-pagination-form]");

    if (previous) {
      listen(previous, "click", function () {
        if (record.page > 1) {
          record.page -= 1;
          render(record, true);
        }
      });
    }

    if (next) {
      listen(next, "click", function () {
        if (record.page < pageCount(record)) {
          record.page += 1;
          render(record, true);
        }
      });
    }

    if (sizeSelect) {
      listen(sizeSelect, "change", function () {
        record.page = 1;
        render(record, false);
      });
    }

    if (form) {
      listen(form, "submit", function (event) {
        event.preventDefault();
        record.page = 1;
        render(record, false);
      });
    }

    render(record, false);

    return record;
  }

  function refresh() {
    if (destroyed) return;

    document.querySelectorAll(SELECTOR).forEach(initialize);

    instances.forEach(function (record, root) {
      if (!root.isConnected) instances.delete(root);
    });
  }

  function setItems(root, items) {
    var record = instances.get(root);

    if (!record || !Array.isArray(items)) return false;

    var container = root.querySelector("[data-pagination-list]");

    if (!container) return false;

    container.replaceChildren();

    items.forEach(function (item) {
      if (item instanceof Element) {
        container.appendChild(item);
      } else {
        var element = document.createElement("div");
        element.textContent = String(item == null ? "" : item);
        element.setAttribute("data-page-item", "");
        container.appendChild(element);
      }
    });

    record.page = 1;
    render(record, false);

    return true;
  }

  function destroy() {
    if (destroyed) return;

    if (observer) observer.disconnect();

    listeners.forEach(function (remove) {
      try {
        remove();
      } catch (error) {
        // Continue cleanup.
      }
    });

    instances.forEach(function (record) {
      record.items.forEach(function (item) {
        item.hidden = false;
        item.removeAttribute("data-pagination-hidden");
      });
    });

    listeners = [];
    instances.clear();
    destroyed = true;
  }

  var api = {
    version: "1.0.0",
    refresh: refresh,
    render: function (root) {
      var record = instances.get(root);
      if (record) render(record, false);
    },
    goToPage: function (root, page) {
      var record = instances.get(root);

      if (!record || !Number.isInteger(page)) return false;

      record.page = page;
      render(record, true);
      return true;
    },
    setItems: setItems,
    getState: function (root) {
      var record = instances.get(root);

      return record ? {
        page: record.page,
        pageSize: record.pageSize,
        totalItems: record.items.length,
        totalPages: pageCount(record)
      } : null;
    },
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsPagination = api;

  function boot() {
    refresh();

    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(function (mutations) {
        var changed = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && node.matches(SELECTOR)) ||
                (node.querySelector && node.querySelector(SELECTOR))
              );
          });
        });

        if (changed) refresh();
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
