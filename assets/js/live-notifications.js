(() => {
  "use strict";

  const FEED_URL = "/assets/data/live-notifications.json";
  const ROTATION_MS = 6500;
  const REFRESH_MS = 300000;
  const FALLBACK_URL = "/notifications.html";

  const textNode = document.getElementById("moNotificationText");
  const linkNode = document.getElementById("moNotificationLink");
  const pauseButton = document.getElementById("moNotificationPause");
  const ticker = document.getElementById("moNotification");

  if (!textNode || !linkNode || !pauseButton || !ticker) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let notifications = [];
  let currentIndex = 0;
  let rotationTimer = null;
  let refreshTimer = null;
  let paused = reducedMotion.matches;
  let pageVisible = document.visibilityState === "visible";

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

  function isCurrent(item, now) {
    if (!item || item.active === false) return false;
    const publishAt = parseDate(item.publishAt);
    const expiresAt = parseDate(item.expiresAt);
    return (!publishAt || publishAt <= now) && (!expiresAt || expiresAt >= now);
  }

  function normalizeFeed(data) {
    const source = Array.isArray(data) ? data : data && Array.isArray(data.notifications) ? data.notifications : [];
    const now = new Date();
    return source
      .filter(item => item && typeof item.title === "string" && item.title.trim() && isCurrent(item, now))
      .map(item => ({
        title: item.title.trim(),
        url: safeUrl(item.url || item.link),
        priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
        publishAt: parseDate(item.publishAt)?.getTime() || 0
      }))
      .sort((a, b) => b.priority - a.priority || b.publishAt - a.publishAt);
  }

  function showNotification(index) {
    if (!notifications.length) {
      textNode.textContent = "View the latest MedOrbits announcements and updates.";
      linkNode.href = FALLBACK_URL;
      linkNode.setAttribute("aria-label", "View all MedOrbits updates");
      return;
    }
    currentIndex = ((index % notifications.length) + notifications.length) % notifications.length;
    const item = notifications[currentIndex];
    textNode.textContent = item.title;
    linkNode.href = item.url;
    linkNode.setAttribute("aria-label", `${item.title} â open announcement`);
  }

  function stopRotation() {
    if (rotationTimer !== null) window.clearTimeout(rotationTimer);
    rotationTimer = null;
  }

  function scheduleRotation() {
    stopRotation();
    if (paused || !pageVisible || notifications.length < 2) return;
    rotationTimer = window.setTimeout(() => {
      showNotification(currentIndex + 1);
      scheduleRotation();
    }, ROTATION_MS);
  }

  function updatePauseButton() {
    pauseButton.textContent = paused ? "Resume updates" : "Pause updates";
    pauseButton.setAttribute("aria-pressed", String(paused));
  }

  async function loadFeed() {
    try {
      const response = await fetch(FEED_URL, {
        cache: "no-cache",
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
      const data = await response.json();
      notifications = normalizeFeed(data);
      showNotification(0);
      scheduleRotation();
    } catch (error) {
      console.warn("[MedOrbits notifications] Could not load feed.", error);
      notifications = [];
      showNotification(0);
      stopRotation();
    }
  }

  pauseButton.addEventListener("click", () => {
    paused = !paused;
    updatePauseButton();
    if (paused) stopRotation();
    else scheduleRotation();
  });

  document.addEventListener("visibilitychange", () => {
    pageVisible = document.visibilityState === "visible";
    if (pageVisible) {
      loadFeed();
    } else {
      stopRotation();
    }
  });

  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener("change", event => {
      if (event.matches) {
        paused = true;
        stopRotation();
      }
      updatePauseButton();
      scheduleRotation();
    });
  }

  updatePauseButton();
  loadFeed();
  refreshTimer = window.setInterval(loadFeed, REFRESH_MS);
  window.addEventListener("pagehide", () => {
    stopRotation();
    if (refreshTimer !== null) window.clearInterval(refreshTimer);
  }, { once: true });
})();