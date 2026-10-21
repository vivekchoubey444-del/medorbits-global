
/* =========================================================
   MedOrbits -- assets/js/animations.js
   Scroll animations, reveal effects, counters, and motion
   ========================================================= */
(function (window, document) {
  "use strict";

  const CONFIG = window.MedOrbitsConfig || {};

  const settings = {
    enabled: CONFIG.ANIMATIONS_ENABLED !== false,
    duration: 700,
    stagger: 100,
    threshold: 0.12,
    counterDuration: 1800,
    rootMargin: "0px 0px -40px 0px"
  };

  const state = {
    initialized: false,
    observer: null,
    counters: new WeakSet(),
    animatedElements: new WeakSet(),
    counterObservers: new WeakMap(),
    parallaxElements: new Set(),
    mutationObserver: null,
    motionQuery: null,
    parallaxFrame: null,
    counterFrames: new WeakMap(),
    destroyed: false
  };

  const SELECTORS = {
    reveal: "[data-animate], .animate-on-scroll, .reveal",
    counter: "[data-counter]",
    stagger: "[data-animate-stagger]",
    parallax: "[data-parallax]"
  };

  const AUTO_REVEAL = [
    ".hero-grid > div",
    ".section-head",
    ".cta-inner",
    ".pillar",
    ".faq",
    ".footer-grid > div:not(.footer-brand)"
  ].join(", ");

  const HOVER_SELECTOR = "[data-hover-effect]";

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isAnimationEnabled() {
    return settings.enabled && !prefersReducedMotion();
  }

  function queryAll(root, selector) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }

    const elements = Array.from(root.querySelectorAll(selector));

    if (
      root.nodeType === 1 &&
      typeof root.matches === "function" &&
      root.matches(selector)
    ) {
      elements.unshift(root);
    }

    return elements;
  }

  function dispatchEvent(element, name, detail) {
    if (!element || typeof element.dispatchEvent !== "function") {
      return;
    }

    element.dispatchEvent(
      new window.CustomEvent(name, {
        bubbles: true,
        detail
      })
    );
  }

  function injectStyles() {
    if (document.getElementById("medorbits-animation-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "medorbits-animation-styles";

    style.textContent = `
      :root {
        --mo-animation-duration: 700ms;
      }

      [data-animate],
      .animate-on-scroll,
      .reveal {
        opacity: 0;
        transition:
          opacity var(--mo-animation-duration, 700ms) ease,
          transform var(--mo-animation-duration, 700ms) ease;
        will-change: opacity, transform;
      }

      [data-animate="fade-up"],
      .reveal,
      .animate-on-scroll {
        transform: translate3d(0, 28px, 0);
      }

      [data-animate="fade-down"] {
        transform: translate3d(0, -24px, 0);
      }

      [data-animate="fade-left"] {
        transform: translate3d(28px, 0, 0);
      }

      [data-animate="fade-right"] {
        transform: translate3d(-28px, 0, 0);
      }

      [data-animate="zoom-in"] {
        transform: scale(0.94);
      }

      [data-animate="zoom-out"] {
        transform: scale(1.06);
      }

      [data-animate="flip-up"] {
        transform: perspective(800px) rotateX(12deg);
        transform-origin: center bottom;
      }

      [data-animate="blur-in"] {
        filter: blur(8px);
        transform: translate3d(0, 12px, 0);
      }

      .mo-animated {
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
        will-change: auto;
      }

      [data-animate-stagger] > * {
        opacity: 0;
        transform: translate3d(0, 18px, 0);
        transition:
          opacity var(--mo-animation-duration, 700ms) ease,
          transform var(--mo-animation-duration, 700ms) ease;
      }

      [data-animate-stagger].mo-animated > * {
        opacity: 1;
        transform: none;
        transition-delay: var(--mo-stagger-delay, 0ms);
      }

      [data-hover-effect="lift"] {
        transition: transform 250ms ease, box-shadow 250ms ease;
      }

      [data-hover-effect="scale"] {
        transition: transform 250ms ease;
      }

      [data-hover-effect="glow"] {
        transition: box-shadow 250ms ease;
      }

      [data-hover-effect="lift"].mo-hover-active {
        transform: translateY(-5px);
      }

      [data-hover-effect="scale"].mo-hover-active {
        transform: scale(1.025);
      }

      [data-hover-effect="glow"].mo-hover-active {
        box-shadow: 0 0 24px rgba(212, 181, 109, 0.24);
      }

      @media (hover: hover) and (pointer: fine) {
        [data-hover-effect="lift"]:hover {
          transform: translateY(-5px);
        }

        [data-hover-effect="scale"]:hover {
          transform: scale(1.025);
        }

        [data-hover-effect="glow"]:hover {
          box-shadow: 0 0 24px rgba(212, 181, 109, 0.24);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        [data-animate],
        .animate-on-scroll,
        .reveal,
        [data-animate-stagger] > *,
        [data-hover-effect] {
          opacity: 1 !important;
          transform: none !important;
          filter: none !important;
          transition: none !important;
          animation: none !important;
          scroll-behavior: auto !important;
          will-change: auto !important;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function applyStagger(element) {
    if (!element || !element.hasAttribute("data-animate-stagger")) {
      return;
    }

    Array.from(element.children).forEach((child, index) => {
      child.style.setProperty(
        "--mo-stagger-delay",
        `${index * settings.stagger}ms`
      );
    });
  }

  function revealElement(element) {
    if (!element || state.animatedElements.has(element)) {
      return;
    }

    state.animatedElements.add(element);

    applyStagger(element);
    element.classList.add("mo-animated");

    if (state.observer) {
      state.observer.unobserve(element);
    }

    dispatchEvent(element, "medorbits:animation-complete");
  }

  function observeElement(element) {
    if (
      !element ||
      element.classList.contains("mo-animated") ||
      state.animatedElements.has(element)
    ) {
      return;
    }

    if (!isAnimationEnabled() || !state.observer) {
      revealElement(element);
      return;
    }

    state.observer.observe(element);
  }

  function initRevealAnimations(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    queryAll(root, AUTO_REVEAL).forEach(element => {
      if (!element.hasAttribute("data-animate")) {
        element.setAttribute("data-animate", "fade-up");
      }
    });

    queryAll(root, ".cards:not([data-no-catalog-slider])").forEach(element => {
      if (!element.hasAttribute("data-animate-stagger")) {
        element.setAttribute("data-animate-stagger", "");
      }
    });

    queryAll(root, SELECTORS.stagger).forEach(applyStagger);
    queryAll(root, SELECTORS.reveal).forEach(observeElement);
    queryAll(root, SELECTORS.stagger).forEach(observeElement);
  }

  function parseNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value ?? "")
      .replace(/,/g, "")
      .trim();

    if (!normalized) {
      return 0;
    }

    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCounter(value, element) {
    const requestedDecimals = Number(element.dataset.decimals);
    const decimals = Number.isFinite(requestedDecimals)
      ? Math.max(0, Math.min(10, Math.floor(requestedDecimals)))
      : 0;

    const prefix = element.dataset.prefix || "";
    const suffix = element.dataset.suffix || "";
    const locale = element.dataset.locale || "en-IN";

    let formatted;

    try {
      formatted = value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    } catch {
      formatted = value.toFixed(decimals);
    }

    return `${prefix}${formatted}${suffix}`;
  }

  function cancelCounter(element) {
    const frame = state.counterFrames.get(element);

    if (frame !== undefined) {
      window.cancelAnimationFrame(frame);
      state.counterFrames.delete(element);
    }
  }

  function animateCounter(element) {
    if (!element || state.counters.has(element)) {
      return;
    }

    state.counters.add(element);

    const target = parseNumber(
      element.dataset.counter ?? element.textContent
    );

    const start = parseNumber(element.dataset.counterStart || 0);
    const requestedDuration = Number(element.dataset.counterDuration);

    const duration = Math.max(
      0,
      Number.isFinite(requestedDuration) && requestedDuration > 0
        ? requestedDuration
        : settings.counterDuration
    );

    if (!isAnimationEnabled() || duration === 0) {
      element.textContent = formatCounter(target, element);

      dispatchEvent(element, "medorbits:counter-complete", {
        value: target
      });

      return;
    }

    let startTime = null;

    function frame(timestamp) {
      if (!element.isConnected) {
        cancelCounter(element);
        return;
      }

      if (startTime === null) {
        startTime = timestamp;
      }

      const progress = Math.min(
        1,
        Math.max(0, (timestamp - startTime) / duration)
      );

      const eased = 1 - Math.pow(1 - progress, 4);
      const current = start + (target - start) * eased;

      element.textContent = formatCounter(
        progress >= 1 ? target : current,
        element
      );

      if (progress < 1 && isAnimationEnabled()) {
        state.counterFrames.set(
          element,
          window.requestAnimationFrame(frame)
        );
      } else {
        state.counterFrames.delete(element);
        element.textContent = formatCounter(target, element);

        dispatchEvent(element, "medorbits:counter-complete", {
          value: target
        });
      }
    }

    element.textContent = formatCounter(start, element);

    state.counterFrames.set(
      element,
      window.requestAnimationFrame(frame)
    );
  }

  function initCounters(root = document) {
    queryAll(root, SELECTORS.counter).forEach(element => {
      if (
        state.counters.has(element) ||
        state.counterObservers.has(element)
      ) {
        return;
      }

      if (
        !isAnimationEnabled() ||
        !("IntersectionObserver" in window)
      ) {
        animateCounter(element);
        return;
      }

      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            return;
          }

          observer.unobserve(entry.target);
          state.counterObservers.delete(entry.target);
          animateCounter(entry.target);
        });
      }, {
        threshold: settings.threshold
      });

      state.counterObservers.set(element, observer);
      observer.observe(element);
    });
  }

  function stopParallax() {
    if (state.parallaxFrame !== null) {
      window.cancelAnimationFrame(state.parallaxFrame);
      state.parallaxFrame = null;
    }

    state.parallaxElements.forEach(element => {
      element.style.removeProperty("--mo-parallax-offset");
      element.style.removeProperty("transform");
    });

    state.parallaxElements.clear();
  }

  function updateParallax() {
    state.parallaxFrame = null;

    if (!isAnimationEnabled()) {
      stopParallax();
      return;
    }

    const viewportHeight = window.innerHeight;

    state.parallaxElements.forEach(element => {
      if (!element.isConnected) {
        state.parallaxElements.delete(element);
        return;
      }

      const speedValue = Number(element.dataset.parallax);
      const speed = Number.isFinite(speedValue)
        ? Math.max(-1, Math.min(1, speedValue))
        : 0.15;

      const rect = element.getBoundingClientRect();

      if (rect.bottom < 0 || rect.top > viewportHeight) {
        return;
      }

      const offset = (rect.top - viewportHeight / 2) * speed;

      element.style.setProperty(
        "--mo-parallax-offset",
        `${offset.toFixed(2)}px`
      );
    });
  }

  function scheduleParallaxUpdate() {
    if (state.parallaxFrame !== null) {
      return;
    }

    state.parallaxFrame = window.requestAnimationFrame(updateParallax);
  }

  function initParallax(root = document) {
    queryAll(root, SELECTORS.parallax).forEach(element => {
      state.parallaxElements.add(element);
    });

    if (!state.parallaxElements.size) {
      return;
    }

    if (!isAnimationEnabled()) {
      stopParallax();
      return;
    }

    state.parallaxElements.forEach(element => {
      if (element.isConnected) {
        element.style.setProperty(
          "transform",
          "translate3d(0, var(--mo-parallax-offset, 0px), 0)"
        );
      }
    });

    scheduleParallaxUpdate();
  }

  function initHoverEffects(root = document) {
    queryAll(root, HOVER_SELECTOR).forEach(element => {
      if (element.dataset.hoverInitialized === "true") {
        return;
      }

      element.dataset.hoverInitialized = "true";

      element.addEventListener("pointerenter", () => {
        if (isAnimationEnabled()) {
          element.classList.add("mo-hover-active");
        }
      });

      element.addEventListener("pointerleave", () => {
        element.classList.remove("mo-hover-active");
      });

      element.addEventListener("focusin", () => {
        if (isAnimationEnabled()) {
          element.classList.add("mo-hover-active");
        }
      });

      element.addEventListener("focusout", event => {
        if (!element.contains(event.relatedTarget)) {
          element.classList.remove("mo-hover-active");
        }
      });
    });
  }

  function refresh(root = document) {
    initRevealAnimations(root);
    initCounters(root);
    initParallax(root);
    initHoverEffects(root);

    return api;
  }

  function revealAll() {
    queryAll(document, `${SELECTORS.reveal}, ${SELECTORS.stagger}`)
      .forEach(revealElement);
  }

  function finishCountersImmediately() {
    queryAll(document, SELECTORS.counter).forEach(element => {
      if (state.counters.has(element)) {
        cancelCounter(element);
        element.textContent = formatCounter(
          parseNumber(element.dataset.counter ?? element.textContent),
          element
        );
        return;
      }

      animateCounter(element);
    });
  }

  function configure(options = {}) {
    if (typeof options.enabled === "boolean") {
      settings.enabled = options.enabled;
    }

    if (
      options.duration !== undefined &&
      Number.isFinite(Number(options.duration))
    ) {
      settings.duration = Math.max(0, Number(options.duration));
    }

    if (
      options.stagger !== undefined &&
      Number.isFinite(Number(options.stagger))
    ) {
      settings.stagger = Math.max(0, Number(options.stagger));
    }

    if (
      options.threshold !== undefined &&
      Number.isFinite(Number(options.threshold))
    ) {
      settings.threshold = Math.max(
        0,
        Math.min(1, Number(options.threshold))
      );
    }

    if (
      options.counterDuration !== undefined &&
      Number.isFinite(Number(options.counterDuration))
    ) {
      settings.counterDuration = Math.max(
        0,
        Number(options.counterDuration)
      );
    }

    document.documentElement.style.setProperty(
      "--mo-animation-duration",
      `${settings.duration}ms`
    );

    if (!isAnimationEnabled()) {
      revealAll();
      finishCountersImmediately();
      stopParallax();
    } else if (state.initialized) {
      refresh();
    }

    return getSettings();
  }

  function getSettings() {
    return {
      ...settings,
      reducedMotionPreferred: prefersReducedMotion()
    };
  }

  function handleMotionPreferenceChange() {
    if (!isAnimationEnabled()) {
      revealAll();
      finishCountersImmediately();
      stopParallax();
    } else if (state.initialized) {
      refresh();
    }
  }

  function init(options = {}) {
    if (state.initialized) {
      configure(options);
      return api;
    }

    configure(options);
    injectStyles();

    if (
      isAnimationEnabled() &&
      "IntersectionObserver" in window
    ) {
      state.observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            revealElement(entry.target);
          }
        });
      }, {
        threshold: settings.threshold,
        rootMargin: settings.rootMargin
      });
    }

    refresh();

    state.motionQuery = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    if (state.motionQuery) {
      if (typeof state.motionQuery.addEventListener === "function") {
        state.motionQuery.addEventListener(
          "change",
          handleMotionPreferenceChange
        );
      } else if (typeof state.motionQuery.addListener === "function") {
        state.motionQuery.addListener(handleMotionPreferenceChange);
      }
    }

    if ("MutationObserver" in window && document.body) {
      state.mutationObserver = new MutationObserver(records => {
        records.forEach(record => {
          record.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              refresh(node);
            }
          });
        });
      });

      state.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    window.addEventListener(
      "scroll",
      scheduleParallaxUpdate,
      { passive: true }
    );

    window.addEventListener(
      "resize",
      scheduleParallaxUpdate,
      { passive: true }
    );

    state.initialized = true;

    dispatchEvent(document, "medorbits:animations-ready");

    return api;
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
      state.mutationObserver = null;
    }

    state.parallaxElements.clear();

    if (state.parallaxFrame !== null) {
      window.cancelAnimationFrame(state.parallaxFrame);
      state.parallaxFrame = null;
    }

    window.removeEventListener("scroll", scheduleParallaxUpdate);
    window.removeEventListener("resize", scheduleParallaxUpdate);

    if (state.motionQuery) {
      if (typeof state.motionQuery.removeEventListener === "function") {
        state.motionQuery.removeEventListener(
          "change",
          handleMotionPreferenceChange
        );
      } else if (typeof state.motionQuery.removeListener === "function") {
        state.motionQuery.removeListener(handleMotionPreferenceChange);
      }
    }

    queryAll(document, SELECTORS.counter).forEach(cancelCounter);

    state.initialized = false;
    state.destroyed = true;
  }

  const api = {
    init,
    refresh,
    configure,
    getSettings,
    revealElement,
    animateCounter,
    initRevealAnimations,
    initCounters,
    initParallax,
    initHoverEffects,
    destroy
  };

  window.MedOrbitsAnimations = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), {
      once: true
    });
  } else {
    init();
  }
})(window, document);
