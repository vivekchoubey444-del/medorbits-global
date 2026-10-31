/* ============================================================
   MedOrbits PWA Registration
   File: /assets/js/pwa-register.js
   ============================================================ */

(() => {
  "use strict";

  if (!("serviceWorker" in navigator)) {
    console.info("[MedOrbits PWA] Service workers unsupported.");
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js",
        { scope: "/" }
      );

      console.info(
        "[MedOrbits PWA] Service worker registered:",
        registration.scope
      );
    } catch (error) {
      console.error(
        "[MedOrbits PWA] Registration failed:",
        error
      );
    }
  }, { once: true });
})();