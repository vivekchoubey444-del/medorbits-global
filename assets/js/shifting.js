
/*!
 * MedOrbits | Shifting & Layout Movement
 * File: assets/js/shifting.js
 * Version: 1.0.0
 *
 * Features:
 * - Smooth section and panel movement
 * - Draggable, reorderable interface elements
 * - Accessible keyboard-based item shifting
 * - Responsive movement behaviour
 * - Optional auto-shift layouts
 * - Reduced-motion support
 * - Dynamic content support
 * - Safe lifecycle and cleanup
 *
 * Attributes:
 * data-mo-shift
 * data-mo-shift-item
 * data-mo-shift-handle
 * data-mo-shift-up
 * data-mo-shift-down
 * data-mo-shift-left
 * data-mo-shift-right
 * data-mo-shift-reset
 * data-mo-shift-container
 */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsShifting) return;

  const DEFAULTS = {
    duration: 280,
    easing: "cubic-bezier(.2,.75,.25,1)",
    threshold: 8,
    keyboardStep: 24,
    selectors: {
      target: "[data-mo-shift]",
      item: "[data-mo-shift-item]",
      handle: "[data-mo-shift-handle]",
      container: "[data-mo-shift-container]",
      up: "[data-mo-shift-up]",
      down: "[data-mo-shift-down]",
      left: "[data-mo-shift-left]",
      right: "[data-mo-shift-right]",
      reset: "[data-mo-shift-reset]"
    }
  };

  const state = {
    initialized: false,
    config: null,
    observer: null,
    listeners: [],
    records: new Map(),
    drag: null,
    resizeTimer: null
  };

  function configure(options) {
    const input = options || {};

    state.config = {
      ...DEFAULTS,
      ...input,
      selectors: {
        ...DEFAULTS.selectors,
        ...(input.selectors || {})
      }
    };

    return api;
  }

  function listen(element, event, handler, options) {
    element.addEventListener(event, handler, options);

    state.listeners.push(function () {
      element.removeEventListener(event, handler, options);
    });
  }

  function all(root, selector) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function reducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function emit(element, name, detail) {
    element.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail: detail || {}
    }));
  }

  function getRecord(element) {
    if (!state.records.has(element)) {
      state.records.set(element, {
        x: 0,
        y: 0,
        originalTransform: element.style.transform,
        originalTransition: element.style.transition,
        originalTouchAction: element.style.touchAction,
        originalTabindex: element.getAttribute("tabindex"),
        originalPosition: element.style.position,
        originalZIndex: element.style.zIndex,
        dragging: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0
      });
    }

    return state.records.get(element);
  }

  function applyTransform(element, record, animate) {
    if (animate && !reducedMotion()) {
      element.style.transition =
        "transform " + state.config.duration + "ms " +
        state.config.easing;
    } else {
      element.style.transition = "none";
    }

    element.style.transform =
      "translate3d(" + record.x + "px," + record.y + "px,0)";

    if (!animate || reducedMotion()) {
      element.style.transition = record.originalTransition;
    } else {
      const onEnd = function (event) {
        if (event.target !== element || event.propertyName !== "transform") {
          return;
        }

        element.style.transition = record.originalTransition;
        element.removeEventListener("transitionend", onEnd);
      };

      element.addEventListener("transitionend", onEnd);
    }
  }

  function move(element, x, y, options) {
    if (!element || !element.isConnected) return false;

    const opts = options || {};
    const record = getRecord(element);

    const nextX = Number.isFinite(x) ? x : record.x;
    const nextY = Number.isFinite(y) ? y : record.y;

    record.x = nextX;
    record.y = nextY;

    applyTransform(element, record, opts.animate !== false);

    emit(element, "medorbits:shift", {
      x: record.x,
      y: record.y,
      source: opts.source || "api"
    });

    return true;
  }

  function shiftBy(element, dx, dy, options) {
    const record = getRecord(element);

    return move(
      element,
      record.x + (Number(dx) || 0),
      record.y + (Number(dy) || 0),
      options
    );
  }

  function reset(element, options) {
    if (!element) return false;

    const record = getRecord(element);

    record.x = 0;
    record.y = 0;

    applyTransform(element, record, !options || options.animate !== false);

    emit(element, "medorbits:shiftreset", {
      x: 0,
      y: 0
    });

    return true;
  }

  function constrainMovement(element, x, y) {
    const container = element.closest(state.config.selectors.container);

    if (!container) return { x: x, y: y };

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const record = getRecord(element);

    const baseLeft = elementRect.left - record.x;
    const baseTop = elementRect.top - record.y;

    const minX = containerRect.left - baseLeft;
    const maxX = containerRect.right - baseLeft - elementRect.width;
    const minY = containerRect.top - baseTop;
    const maxY = containerRect.bottom - baseTop - elementRect.height;

    return {
      x: Math.max(Math.min(minX, maxX), Math.min(Math.max(minX, maxX), x)),
      y: Math.max(Math.min(minY, maxY), Math.min(Math.max(minY, maxY), y))
    };
  }

  function bindShiftControls(root) {
    const bindings = [
      [state.config.selectors.up, 0, -state.config.keyboardStep],
      [state.config.selectors.down, 0, state.config.keyboardStep],
      [state.config.selectors.left, -state.config.keyboardStep, 0],
      [state.config.selectors.right, state.config.keyboardStep, 0]
    ];

    bindings.forEach(function (binding) {
      all(root, binding[0]).forEach(function (button) {
        if (button.dataset.moShiftBound === "true") return;

        button.dataset.moShiftBound = "true";

        listen(button, "click", function () {
          const selector = button.getAttribute("data-target");
          const target = selector
            ? document.querySelector(selector)
            : button.closest("[data-mo-shift-group]")?.querySelector(
                state.config.selectors.target
              );

          if (!target) return;

          shiftBy(target, binding[1], binding[2], {
            source: "button"
          });
        });
      });
    });

    all(root, state.config.selectors.reset).forEach(function (button) {
      if (button.dataset.moShiftBound === "true") return;

      button.dataset.moShiftBound = "true";

      listen(button, "click", function () {
        const selector = button.getAttribute("data-target");
        const target = selector
          ? document.querySelector(selector)
          : button.closest("[data-mo-shift-group]")?.querySelector(
              state.config.selectors.target
            );

        if (target) reset(target);
      });
    });
  }

  function bindKeyboardMovement(element) {
    if (element.dataset.moShiftKeyboardBound === "true") return;

    element.dataset.moShiftKeyboardBound = "true";

    if (!element.hasAttribute("tabindex")) {
      element.setAttribute("tabindex", "0");
    }

    listen(element, "keydown", function (event) {
      if (!event.altKey) return;

      const step = event.shiftKey
        ? state.config.keyboardStep * 3
        : state.config.keyboardStep;

      let dx = 0;
      let dy = 0;

      switch (event.key) {
        case "ArrowUp":
          dy = -step;
          break;
        case "ArrowDown":
          dy = step;
          break;
        case "ArrowLeft":
          dx = -step;
          break;
        case "ArrowRight":
          dx = step;
          break;
        case "Home":
          event.preventDefault();
          reset(element);
          return;
        default:
          return;
      }

      event.preventDefault();

      const record = getRecord(element);
      const position = constrainMovement(
        element,
        record.x + dx,
        record.y + dy
      );

      move(element, position.x, position.y, {
        source: "keyboard"
      });
    });
  }

  function bindDraggable(element) {
    if (element.dataset.moShiftDragBound === "true") return;

    element.dataset.moShiftDragBound = "true";

    const handle = element.querySelector(state.config.selectors.handle) || element;

    if (handle === element && !element.hasAttribute("data-mo-shift-handle")) {
      // Dragging the whole element is opt-in only.
      if (!element.hasAttribute("data-mo-shift-draggable")) return;
    }

    const record = getRecord(element);

    listen(handle, "pointerdown", function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest("button, a, input, select, textarea")) return;

      record.dragging = true;
      record.pointerId = event.pointerId;
      record.startX = event.clientX;
      record.startY = event.clientY;
      record.originX = record.x;
      record.originY = record.y;

      state.drag = {
        element: element,
        handle: handle,
        record: record,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
      };

      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_) {
        // Pointer capture is not available in every environment.
      }

      emit(element, "medorbits:shiftstart", {
        x: record.x,
        y: record.y
      });
    });

    listen(handle, "pointermove", function (event) {
      const drag = state.drag;

      if (!drag || drag.element !== element) return;
      if (drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (
        !drag.moved &&
        Math.hypot(dx, dy) < state.config.threshold
      ) {
        return;
      }

      drag.moved = true;

      const next = constrainMovement(
        element,
        drag.record.originX + dx,
        drag.record.originY + dy
      );

      move(element, next.x, next.y, {
        animate: false,
        source: "pointer"
      });
    });

    function finishDrag(event) {
      const drag = state.drag;

      if (!drag || drag.element !== element) return;
      if (event && event.pointerId !== undefined &&
          drag.pointerId !== event.pointerId) return;

      state.drag = null;
      drag.record.dragging = false;

      emit(element, "medorbits:shiftend", {
        x: drag.record.x,
        y: drag.record.y,
        moved: drag.moved
      });
    }

    listen(handle, "pointerup", finishDrag);
    listen(handle, "pointercancel", finishDrag);
    listen(handle, "lostpointercapture", finishDrag);
  }

  function bindTargets(root) {
    all(root, state.config.selectors.target).forEach(function (element) {
      getRecord(element);
      bindKeyboardMovement(element);
      bindDraggable(element);
    });
  }

  function refresh(root) {
    const scope = root || document;

    bindTargets(scope);
    bindShiftControls(scope);

    return api;
  }

  function init(options) {
    if (state.initialized) {
      if (options) configure(options);
      refresh(document);
      return api;
    }

    configure(options);
    refresh(document);

    if ("MutationObserver" in window && document.documentElement) {
      state.observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
          record.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) refresh(node);
          });
        });
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    state.initialized = true;
    return api;
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.resizeTimer) {
      window.clearTimeout(state.resizeTimer);
      state.resizeTimer = null;
    }

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (_) {
        // Continue cleanup.
      }
    });

    state.listeners = [];

    state.records.forEach(function (record, element) {
      element.style.transform = record.originalTransform;
      element.style.transition = record.originalTransition;
      element.style.touchAction = record.originalTouchAction;
      element.style.position = record.originalPosition;
      element.style.zIndex = record.originalZIndex;

      if (record.originalTabindex === null) {
        element.removeAttribute("tabindex");
      } else {
        element.setAttribute("tabindex", record.originalTabindex);
      }

      delete element.dataset.moShiftDragBound;
      delete element.dataset.moShiftKeyboardBound;
    });

    state.records.clear();

    all(document, "[data-mo-shift-bound]").forEach(function (element) {
      delete element.dataset.moShiftBound;
    });

    state.drag = null;
    state.initialized = false;
  }

  const api = {
    init: init,
    refresh: refresh,
    move: move,
    shiftBy: shiftBy,
    reset: reset,
    destroy: destroy,

    getPosition: function (element) {
      if (!element) return null;

      const record = getRecord(element);

      return {
        x: record.x,
        y: record.y
      };
    },

    config: function () {
      return {
        ...state.config,
        selectors: { ...state.config.selectors }
      };
    }
  };

  window.MedOrbitsShifting = api;

  function boot() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
