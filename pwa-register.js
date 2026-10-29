/* Registers the MedOrbits PWA service worker without changing page layout. */
(() => {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .catch(error => console.warn("[MedOrbits PWA] Registration failed:", error));
  }, { once: true });
})();
