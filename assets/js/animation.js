
/* =========================================================
   MEDORBITS | ANIMATION ENGINE
   File: assets/js/animation.js
   Version: 1.1.0
   Dependencies: None
   Namespace: window.MedOrbitsAnimation
   ========================================================= */

(function (window, document) {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_ANIMATION_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var DEFAULTS = {
    selector: "[data-mo-animate]",
    duration: 600,
    stagger: 90,
    threshold: 0.12,
    rootMargin: "0px 0px -40px 0px",
    respectReducedMotion: true,
    observeDynamically: true,
    animateOnce: true,
    counterDuration: 1200,
    scrollProgress: true,
    backToTop: true,
    backToTopThreshold: 400
  };

  var state = {
    options: Object.assign({}, DEFAULTS),
    records: new Map(),
    listeners: [],
    observer: null,
    counterObserver: null,
    mutationObserver: null,
    mediaQuery: null,
    progressElement: null,
    backToTopElement: null,
    createdElements: new Set(),
    counterAnimations: new Map(),
    rafId: null,
    started: false,
    reducedMotion: false
  };

  /* ---------------------------------------------------------
     BASIC HELPERS
     --------------------------------------------------------- */

  function queryAll(selector, root) {
    try {
      return Array.from((root || document).querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function query(selector, root) {
    try {
      return (root || document).querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function listen(target, event, callback, options) {
    if (!target || !target.addEventListener) {
      return function () {};
    }

    target.addEventListener(event, callback, options || false);

    var active = true;

    function remove() {
      if (!active) return;

      target.removeEventListener(event, callback, options || false);
      active = false;
    }

    state.listeners.push(remove);

    return remove;
  }

  function isReducedMotion() {
    return Boolean(
      state.options.respectReducedMotion &&
      state.mediaQuery &&
      state.mediaQuery.matches
    );
  }

  function isConnected(element) {
    return Boolean(element && element.isConnected);
  }

  function safeNumber(value, fallback, min, max) {
    var number = Number(value);

    if (!Number.isFinite(number)) return fallback;

    if (min != null) number = Math.max(min, number);
    if (max != null) number = Math.min(max, number);

    return number;
  }

  function getAnimationType(element) {
    var type = element.getAttribute("data-mo-animate") || "fade-up";

    var allowed = [
      "none",
      "fade",
      "fade-up",
      "fade-down",
      "fade-left",
      "fade-right",
      "zoom-in",
      "zoom-out",
      "slide-up",
      "slide-left",
      "flip-up"
    ];

    return allowed.includes(type) ? type : "fade-up";
  }

  function getDuration(element) {
    return safeNumber(
      element.getAttribute("data-mo-duration"),
      state.options.duration,
      0,
      10000
    );
  }

  function getDelay(element) {
    var custom = element.getAttribute("data-mo-delay");

    if (custom !== null) {
      return safeNumber(custom, 0, 0, 30000);
    }

    var index = safeNumber(
      element.getAttribute("data-mo-stagger-index"),
      0,
      0,
      1000
    );

    return Math.min(index * state.options.stagger, 30000);
  }

  function dispatch(element, eventName, detail) {
    if (!element) return;

    element.dispatchEvent(new CustomEvent(eventName, {
      bubbles: true,
      detail: detail || {}
    }));
  }

  /* ---------------------------------------------------------
     ANIMATION ELEMENTS
     --------------------------------------------------------- */

  function prepareElement(element) {
    if (!element || state.records.has(element)) return;

    var record = {
      originalStyle: element.getAttribute("style"),
      originalAnimated: element.getAttribute("data-mo-animated"),
      originalVisible: element.getAttribute("data-mo-visible"),
      revealed: false
    };

    state.records.set(element, record);

    var type = getAnimationType(element);

    if (type === "none" || state.reducedMotion) {
      reveal(element, true);
      return;
    }

    element.style.setProperty(
      "--mo-animation-duration",
      getDuration(element) + "ms"
    );

    element.style.setProperty(
      "--mo-animation-delay",
      getDelay(element) + "ms"
    );

    element.setAttribute("data-mo-animated", "pending");
    element.setAttribute("data-mo-visible", "false");

    if (state.observer) {
      state.observer.observe(element);
    } else {
      reveal(element, true);
    }
  }

  function reveal(element, immediate) {
    if (!element) return;

    var record = state.records.get(element);

    if (record && record.revealed && state.options.animateOnce) return;

    if (record) record.revealed = true;

    element.setAttribute("data-mo-animated", "true");
    element.setAttribute("data-mo-visible", "true");

    if (state.observer) {
      state.observer.unobserve(element);
    }

    if (immediate || state.reducedMotion) {
      element.style.setProperty("--mo-animation-duration", "0ms");
      element.style.setProperty("--mo-animation-delay", "0ms");
    }

    dispatch(element, "medorbits:animationrevealed", {
      immediate: Boolean(immediate)
    });
  }

  function replay(element) {
    if (!element || state.reducedMotion) return false;

    var record = state.records.get(element);

    if (!record) {
      prepareElement(element);
      record = state.records.get(element);
    }

    if (!record) return false;

    record.revealed = false;

    element.setAttribute("data-mo-animated", "pending");
    element.setAttribute("data-mo-visible", "false");

    if (state.observer) {
      state.observer.observe(element);
    } else {
      reveal(element, true);
    }

    return true;
  }

  function initializeObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.reducedMotion || !("IntersectionObserver" in window)) {
      state.records.forEach(function (record, element) {
        reveal(element, true);
      });

      return;
    }

    state.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        reveal(entry.target, false);
      });
    }, {
      threshold: state.options.threshold,
      rootMargin: state.options.rootMargin
    });

    state.records.forEach(function (record, element) {
      if (!isConnected(element)) return;

      if (!record.revealed || !state.options.animateOnce) {
        state.observer.observe(element);
      }
    });
  }

  /* ---------------------------------------------------------
     STAGGERED ANIMATIONS
     --------------------------------------------------------- */

  function prepareStaggeredElements() {
    queryAll("[data-mo-stagger]").forEach(function (container) {
      var selector = container.getAttribute("data-mo-stagger-selector") || "*";

      queryAll(selector, container).forEach(function (element, index) {
        if (element === container) return;

        if (!element.hasAttribute("data-mo-animate")) {
          element.setAttribute("data-mo-animate", "fade-up");
        }

        if (!element.hasAttribute("data-mo-stagger-index")) {
          element.setAttribute("data-mo-stagger-index", String(index));
        }

        prepareElement(element);
      });
    });
  }

  function refresh() {
    queryAll(state.options.selector).forEach(prepareElement);
    prepareStaggeredElements();
    setupCounters();
    pruneDetachedElements();

    return api;
  }

  function pruneDetachedElements() {
    state.records.forEach(function (record, element) {
      if (!isConnected(element)) {
        state.records.delete(element);
      }
    });
  }

  /* ---------------------------------------------------------
     NUMBER COUNTERS
     --------------------------------------------------------- */

  function renderCounter(element, value, decimals, prefix, suffix) {
    element.textContent = prefix + value.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }) + suffix;
  }

  function animateCounter(element) {
    if (!element || element.getAttribute("data-mo-counter-done") === "true") {
      return;
    }

    var target = Number(element.getAttribute("data-mo-counter"));

    if (!Number.isFinite(target)) return;

    var start = safeNumber(
      element.getAttribute("data-mo-counter-start"),
      0
    );

    var decimals = Math.round(safeNumber(
      element.getAttribute("data-mo-decimals"),
      0,
      0,
      8
    ));

    var duration = safeNumber(
      element.getAttribute("data-mo-counter-duration"),
      state.options.counterDuration,
      0,
      60000
    );

    var prefix = element.getAttribute("data-mo-prefix") || "";
    var suffix = element.getAttribute("data-mo-suffix") || "";

    element.setAttribute("data-mo-counter-done", "true");

    if (state.reducedMotion || duration === 0 || start === target) {
      renderCounter(element, target, decimals, prefix, suffix);
      dispatch(element, "medorbits:countercomplete", { value: target });
      return;
    }

    var previousFrame = state.counterAnimations.get(element);

    if (previousFrame) {
      window.cancelAnimationFrame(previousFrame);
    }

    var startTime = null;
    var frameId = null;

    function tick(timestamp) {
      if (!isConnected(element)) {
        state.counterAnimations.delete(element);
        return;
      }

      if (startTime === null) startTime = timestamp;

      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = start + (target - start) * eased;

      renderCounter(
        element,
        progress === 1 ? target : current,
        decimals,
        prefix,
        suffix
      );

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
        state.counterAnimations.set(element, frameId);
      } else {
        state.counterAnimations.delete(element);
        dispatch(element, "medorbits:countercomplete", {
          value: target
        });
      }
    }

    frameId = window.requestAnimationFrame(tick);
    state.counterAnimations.set(element, frameId);
  }

  function setupCounters() {
    var counters = queryAll("[data-mo-counter]");

    if (!counters.length) return;

    if (state.reducedMotion || !("IntersectionObserver" in window)) {
      counters.forEach(animateCounter);
      return;
    }

    if (!state.counterObserver) {
      state.counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          animateCounter(entry.target);
          state.counterObserver.unobserve(entry.target);
        });
      }, { threshold: 0.3 });
    }

    counters.forEach(function (counter) {
      if (counter.getAttribute("data-mo-counter-done") !== "true") {
        state.counterObserver.observe(counter);
      }
    });
  }

  /* ---------------------------------------------------------
     SCROLL PROGRESS INDICATOR
     --------------------------------------------------------- */

  function createProgressBar() {
    if (!state.options.scrollProgress || !document.body) return;

    var existing = query("[data-mo-scroll-progress]");

    if (existing) {
      state.progressElement = existing;
      return;
    }

    var bar = document.createElement("div");

    bar.setAttribute("data-mo-scroll-progress", "");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "Page scroll progress");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", "0");

    Object.assign(bar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0%",
      height: "3px",
      zIndex: "9999",
      pointerEvents: "none",
      background: "var(--mo-progress-color, var(--color-primary, #315b86))"
    });

    document.body.appendChild(bar);

    state.progressElement = bar;
    state.createdElements.add(bar);
  }

  function updateProgress() {
    var bar = state.progressElement;

    if (!bar) return;

    var root = document.documentElement;
    var maxScroll = root.scrollHeight - window.innerHeight;

    var progress = maxScroll > 0
      ? Math.max(0, Math.min(100, window.scrollY / maxScroll * 100))
      : 0;

    bar.style.width = progress + "%";
    bar.setAttribute("aria-valuenow", String(Math.round(progress)));
  }

  /* ---------------------------------------------------------
     BACK-TO-TOP CONTROL
     --------------------------------------------------------- */

  function createBackToTop() {
    if (!state.options.backToTop || !document.body) return;

    var existing = query("[data-mo-back-to-top]");

    if (existing) {
      state.backToTopElement = existing;
      return;
    }

    var button = document.createElement("button");

    button.type = "button";
    button.textContent = "↑";
    button.setAttribute("data-mo-back-to-top", "");
    button.setAttribute("aria-label", "Back to top");
    button.title = "Back to top";
    button.tabIndex = -1;

    Object.assign(button.style, {
      position: "fixed",
      right: "1.25rem",
      bottom: "1.25rem",
      zIndex: "999",
      width: "2.75rem",
      height: "2.75rem",
      borderRadius: "50%",
      border: "1px solid currentColor",
      background: "var(--mo-back-to-top-bg, #263c50)",
      color: "var(--mo-back-to-top-color, #ffffff)",
      cursor: "pointer",
      opacity: "0",
      visibility: "hidden",
      transform: "translateY(8px)",
      transition: "opacity 180ms ease, transform 180ms ease"
    });

    document.body.appendChild(button);

    state.backToTopElement = button;
    state.createdElements.add(button);

    listen(button, "click", function () {
      window.scrollTo({
        top: 0,
        behavior: state.reducedMotion ? "auto" : "smooth"
      });
    });
  }

  function updateBackToTop() {
    var button = state.backToTopElement;

    if (!button) return;

    var visible = window.scrollY > state.options.backToTopThreshold;

    button.style.opacity = visible ? "1" : "0";
    button.style.visibility = visible ? "visible" : "hidden";
    button.style.transform = visible ? "translateY(0)" : "translateY(8px)";
    button.tabIndex = visible ? 0 : -1;
  }

  function handleScroll() {
    if (state.rafId !== null) return;

    state.rafId = window.requestAnimationFrame(function () {
      state.rafId = null;
      updateProgress();
      updateBackToTop();
    });
  }

  /* ---------------------------------------------------------
     REDUCED MOTION PREFERENCE
     --------------------------------------------------------- */

  function handleMotionChange() {
    state.reducedMotion = isReducedMotion();

    if (state.reducedMotion) {
      initializeObserver();

      queryAll("[data-mo-counter]").forEach(function (counter) {
        var frame = state.counterAnimations.get(counter);

        if (frame) window.cancelAnimationFrame(frame);

        state.counterAnimations.delete(counter);

        var target = Number(counter.getAttribute("data-mo-counter"));

        if (Number.isFinite(target)) {
          var decimals = Math.round(safeNumber(
            counter.getAttribute("data-mo-decimals"),
            0,
            0,
            8
          ));

          renderCounter(
            counter,
            target,
            decimals,
            counter.getAttribute("data-mo-prefix") || "",
            counter.getAttribute("data-mo-suffix") || ""
          );

          counter.setAttribute("data-mo-counter-done", "true");
        }
      });
    } else {
      initializeObserver();
      refresh();
    }
  }

  /* ---------------------------------------------------------
     LIFECYCLE
     --------------------------------------------------------- */

  function configure(options) {
    options = options || {};

    Object.keys(options).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        state.options[key] = options[key];
      }
    });

    return Object.assign({}, state.options);
  }

  function init(options) {
    if (options) configure(options);

    if (state.started) {
      refresh();
      return api;
    }

    state.started = true;

    if (window.matchMedia) {
      state.mediaQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

      state.reducedMotion = isReducedMotion();

      listen(state.mediaQuery, "change", handleMotionChange);
    }

    initializeObserver();
    refresh();
    createProgressBar();
    createBackToTop();
    updateProgress();
    updateBackToTop();

    listen(window, "scroll", handleScroll, { passive: true });
    listen(window, "resize", handleScroll, { passive: true });

    if (state.options.observeDynamically && "MutationObserver" in window) {
      state.mutationObserver = new MutationObserver(function (mutations) {
        var hasAddedNodes = mutations.some(function (mutation) {
          return mutation.addedNodes.length > 0;
        });

        if (hasAddedNodes) refresh();
      });

      state.mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    return api;
  }

  function destroy() {
    if (state.observer) state.observer.disconnect();
    if (state.counterObserver) state.counterObserver.disconnect();
    if (state.mutationObserver) state.mutationObserver.disconnect();

    state.observer = null;
    state.counterObserver = null;
    state.mutationObserver = null;

    state.listeners.forEach(function (remove) {
      try {
        remove();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.listeners = [];

    if (state.rafId !== null) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    state.counterAnimations.forEach(function (frame) {
      window.cancelAnimationFrame(frame);
    });
    state.counterAnimations.clear();

    state.records.forEach(function (record, element) {
      if (!isConnected(element)) return;

      if (record.originalStyle === null) {
        element.removeAttribute("style");
      } else {
        element.setAttribute("style", record.originalStyle);
      }

      if (record.originalAnimated === null) {
        element.removeAttribute("data-mo-animated");
      } else {
        element.setAttribute("data-mo-animated", record.originalAnimated);
      }

      if (record.originalVisible === null) {
        element.removeAttribute("data-mo-visible");
      } else {
        element.setAttribute("data-mo-visible", record.originalVisible);
      }
    });

    state.createdElements.forEach(function (element) {
      element.remove();
    });

    state.createdElements.clear();
    state.records.clear();
    state.progressElement = null;
    state.backToTopElement = null;
    state.started = false;
  }

  var api = {
    version: "1.1.0",
    init: init,
    refresh: refresh,
    configure: configure,
    reveal: reveal,
    replay: replay,
    animateCounter: animateCounter,
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsAnimation = api;

  function start() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window, document);
