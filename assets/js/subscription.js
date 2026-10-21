
// File: /assets/js/subscription.js
(function (window, document) {
  "use strict";

  if (window.MedOrbitsSubscription) return;

  const CONFIG = window.MedOrbitsConfig || {};
  const API_BASE = String(CONFIG.API_BASE_URL || CONFIG.apiBaseUrl || "/api")
    .replace(/\/+$/, "");

  const ENDPOINTS = {
    plans: "/subscriptions/plans",
    current: "/subscriptions/current",
    subscribe: "/subscriptions/subscribe",
    cancel: "/subscriptions/cancel",
    change: "/subscriptions/change",
    history: "/subscriptions/history"
  };

  const EVENTS = Object.freeze({
    LOADED: "medorbits:subscription:loaded",
    UPDATED: "medorbits:subscription:updated",
    CANCELLED: "medorbits:subscription:cancelled",
    ERROR: "medorbits:subscription:error"
  });

  const state = {
    plans: [],
    current: null,
    history: [],
    loading: false
  };

  let initialized = false;
  let activeRequests = 0;

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function getToken() {
    try {
      const auth = window.MedOrbitsAuth;

      return auth?.getToken?.() ||
        auth?.getAccessToken?.() ||
        "";
    } catch {
      return "";
    }
  }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let response;

    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: options.method || "GET",
        headers,
        credentials: "same-origin",
        cache: "no-store",
        signal: options.signal,
        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body)
      });
    } catch (error) {
      emit(EVENTS.ERROR, { message: error.message, endpoint: path });
      throw error;
    }

    const contentType = response.headers.get("content-type") || "";
    let result = null;

    if (contentType.includes("application/json")) {
      result = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
      result = text ? { message: text } : null;
    }

    if (!response.ok) {
      const error = new Error(
        result?.message || `Subscription request failed (${response.status}).`
      );

      error.status = response.status;
      error.data = result;

      emit(EVENTS.ERROR, {
        message: error.message,
        status: error.status,
        endpoint: path
      });

      try {
        window.MedOrbitsErrorHandler?.notify?.(error, {
          module: "subscription",
          endpoint: path
        });
      } catch {
        // Error reporting must not interrupt the request flow.
      }

      throw error;
    }

    return result;
  }

  function unwrap(data) {
    return data && typeof data === "object" && data.data !== undefined
      ? data.data
      : data;
  }

  function normalizePlans(data) {
    const payload = unwrap(data);
    const plans = Array.isArray(payload)
      ? payload
      : payload?.plans;

    return Array.isArray(plans)
      ? plans.filter((plan) => plan && typeof plan === "object")
      : [];
  }

  function normalizeSubscription(data) {
    const payload = unwrap(data);

    if (!payload || typeof payload !== "object") return null;

    return payload.subscription ||
      payload.currentSubscription ||
      payload;
  }

  function normalizeHistory(data) {
    const payload = unwrap(data);

    if (Array.isArray(payload)) return payload;

    return Array.isArray(payload?.history) ? payload.history : [];
  }

  async function loadPlans() {
    state.plans = normalizePlans(await request(ENDPOINTS.plans));
    renderPlans();

    emit(EVENTS.LOADED, {
      type: "plans",
      plans: state.plans.slice()
    });

    return state.plans.slice();
  }

  async function loadCurrent() {
    state.current = normalizeSubscription(await request(ENDPOINTS.current));
    renderCurrent();

    emit(EVENTS.LOADED, {
      type: "current",
      subscription: state.current
    });

    return state.current;
  }

  async function loadHistory() {
    state.history = normalizeHistory(await request(ENDPOINTS.history));
    renderHistory();

    emit(EVENTS.LOADED, {
      type: "history",
      history: state.history.slice()
    });

    return state.history.slice();
  }

  function checkout(payload) {
    const target = payload?.checkoutUrl || payload?.paymentUrl;
    if (!target) return false;

    let url;

    try {
      url = new URL(target, window.location.origin);
    } catch {
      throw new Error("The checkout URL is invalid.");
    }

    if (
      url.protocol !== "https:" &&
      url.origin !== window.location.origin
    ) {
      throw new Error("The checkout URL is not permitted.");
    }

    window.location.assign(url.href);
    return true;
  }

  async function subscribe(planId, options = {}) {
    if (!planId) throw new Error("Select a subscription plan first.");

    const data = await request(ENDPOINTS.subscribe, {
      method: "POST",
      body: {
        planId,
        billingCycle: options.billingCycle || "monthly"
      }
    });

    const payload = unwrap(data);

    if (checkout(payload)) return payload;

    state.current = normalizeSubscription(payload);
    renderCurrent();
    renderPlans();

    emit(EVENTS.UPDATED, {
      subscription: state.current,
      response: payload
    });

    return payload;
  }

  async function changePlan(planId, options = {}) {
    if (!planId) throw new Error("Select a subscription plan first.");

    const payload = unwrap(await request(ENDPOINTS.change, {
      method: "POST",
      body: {
        planId,
        billingCycle: options.billingCycle || "monthly"
      }
    }));

    if (checkout(payload)) return payload;

    state.current = normalizeSubscription(payload);
    renderCurrent();
    renderPlans();

    emit(EVENTS.UPDATED, {
      subscription: state.current,
      response: payload
    });

    return payload;
  }

  async function cancel(options = {}) {
    const confirmed = options.confirm === false ||
      window.confirm("Are you sure you want to cancel your subscription?");

    if (!confirmed) return false;

    const payload = unwrap(await request(ENDPOINTS.cancel, {
      method: "POST",
      body: {
        reason: options.reason || "",
        immediate: Boolean(options.immediate)
      }
    }));

    state.current = normalizeSubscription(payload);
    renderCurrent();
    renderPlans();

    emit(EVENTS.CANCELLED, {
      subscription: state.current,
      response: payload
    });

    return payload;
  }

  function formatCurrency(amount, currency = "INR") {
    const value = Number(amount);
    if (!Number.isFinite(value)) return "--";

    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  function formatDate(value) {
    if (!value) return "--";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";

    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function getPlanPrice(plan, cycle = "monthly") {
    const prices = plan?.prices || plan?.pricing || {};

    return prices[cycle] ??
      plan?.[`${cycle}Price`] ??
      plan?.price ??
      null;
  }

  function renderPlans() {
    document.querySelectorAll("[data-subscription-plans]").forEach((container) => {
      const cycle = container.dataset.billingCycle || "monthly";

      if (!state.plans.length) {
        container.innerHTML =
          '<p class="subscription-empty">No subscription plans are available.</p>';
        return;
      }

      container.innerHTML = state.plans.map((plan) => {
        const id = plan.id ?? plan.planId ?? "";
        const name = plan.name || plan.title || "Subscription plan";
        const price = getPlanPrice(plan, cycle);
        const currency = plan.currency || "INR";
        const features = Array.isArray(plan.features) ? plan.features : [];

        const currentPlanId = state.current?.planId ??
          state.current?.plan_id ??
          state.current?.plan?.id;

        const selected = currentPlanId != null &&
          String(currentPlanId) === String(id);

        const featureList = features.length
          ? `<ul class="subscription-plan__features">${features.map((feature) => {
              const label = typeof feature === "string"
                ? feature
                : feature?.name || "";

              return `<li>${escapeHTML(label)}</li>`;
            }).join("")}</ul>`
          : "";

        return `
          <article class="subscription-plan${selected ? " is-current" : ""}">
            <h3>${escapeHTML(name)}</h3>
            <p>${escapeHTML(plan.description || "")}</p>
            <p class="subscription-plan__price">
              ${escapeHTML(price == null ? "Contact us" : formatCurrency(price, currency))}
              ${price == null ? "" : `<span> / ${escapeHTML(cycle)}</span>`}
            </p>
            ${featureList}
            <button type="button"
              class="subscription-plan__button"
              data-subscribe-plan="${escapeHTML(id)}"
              ${selected || id === "" ? "disabled" : ""}>
              ${selected ? "Current Plan" : "Choose Plan"}
            </button>
          </article>`;
      }).join("");
    });
  }

  function renderCurrent() {
    document.querySelectorAll("[data-subscription-current]").forEach((container) => {
      const subscription = state.current;

      if (!subscription) {
        container.innerHTML =
          '<p class="subscription-empty">You do not have an active subscription.</p>';
        return;
      }

      const name = subscription.planName ||
        subscription.plan_name ||
        subscription.plan?.name ||
        "Subscription";

      const amount = subscription.amount ?? subscription.price;
      const currency = subscription.currency || "INR";
      const status = subscription.status || "unknown";
      const started = subscription.startedAt ||
        subscription.started_at ||
        subscription.startDate;

      const renewal = subscription.renewsAt ||
        subscription.renews_at ||
        subscription.expiresAt ||
        subscription.expires_at;

      container.innerHTML = `
        <section class="subscription-summary">
          <h3>${escapeHTML(name)}</h3>
          <p>Status: <strong>${escapeHTML(status)}</strong></p>
          ${amount == null ? "" : `<p>Price: ${escapeHTML(formatCurrency(amount, currency))}</p>`}
          <p>Started: ${escapeHTML(formatDate(started))}</p>
          <p>Renews / expires: ${escapeHTML(formatDate(renewal))}</p>
        </section>`;
    });

    const status = String(state.current?.status || "").toLowerCase();
    const cancellable = Boolean(state.current) &&
      !["cancelled", "canceled", "expired", "inactive"].includes(status);

    document.querySelectorAll("[data-cancel-subscription]").forEach((button) => {
      button.hidden = !cancellable;
    });
  }

  function renderHistory() {
    document.querySelectorAll("[data-subscription-history]").forEach((container) => {
      if (!state.history.length) {
        container.innerHTML =
          '<p class="subscription-empty">No subscription history found.</p>';
        return;
      }

      container.innerHTML = `
        <div class="subscription-history-list">
          ${state.history.map((item) => {
            const name = item.planName ||
              item.plan_name ||
              item.name ||
              "Subscription";

            const amount = item.amount ?? item.price;

            return `
              <article class="subscription-history-item">
                <h4>${escapeHTML(name)}</h4>
                <p>Status: ${escapeHTML(item.status || "unknown")}</p>
                ${amount == null ? "" : `<p>Amount: ${escapeHTML(formatCurrency(amount, item.currency || "INR"))}</p>`}
                <p>Date: ${escapeHTML(formatDate(item.createdAt || item.created_at || item.date))}</p>
              </article>`;
          }).join("")}
        </div>`;
    });
  }

  function setLoading(loading) {
    activeRequests = Math.max(0, activeRequests + (loading ? 1 : -1));
    state.loading = activeRequests > 0;

    document.querySelectorAll("[data-subscription-submit]").forEach((button) => {
      button.disabled = state.loading;
      button.setAttribute("aria-busy", String(state.loading));
    });
  }

  function showMessage(message, isError = false) {
    document.querySelectorAll("[data-subscription-message]").forEach((element) => {
      element.textContent = message;
      element.hidden = !message;
      element.setAttribute("role", isError ? "alert" : "status");
    });
  }

  function handleError(error) {
    showMessage(
      error?.message || "Unable to complete the subscription request.",
      true
    );
  }

  async function withLoading(callback) {
    setLoading(true);
    showMessage("");

    try {
      return await callback();
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);

    try {
      await Promise.allSettled([
        loadPlans(),
        loadCurrent(),
        loadHistory()
      ]);

      return getState();
    } finally {
      setLoading(false);
    }
  }

  function getState() {
    return {
      plans: state.plans.slice(),
      current: state.current,
      history: state.history.slice(),
      loading: state.loading
    };
  }

  function bindEvents() {
    document.addEventListener("click", async (event) => {
      const subscribeButton = event.target.closest("[data-subscribe-plan]");
      const cancelButton = event.target.closest("[data-cancel-subscription]");

      if (subscribeButton) {
        const planId = subscribeButton.dataset.subscribePlan;
        const container = subscribeButton.closest("[data-subscription-plans]");
        const billingCycle = container?.dataset.billingCycle || "monthly";

        try {
          await withLoading(() => subscribe(planId, { billingCycle }));
          showMessage("Subscription request completed.");
        } catch {
          // The error is already displayed.
        }

        return;
      }

      if (cancelButton) {
        try {
          const result = await withLoading(() => cancel());

          if (result !== false) {
            showMessage("Subscription cancellation request completed.");
          }
        } catch {
          // The error is already displayed.
        }
      }
    });

    document.addEventListener("change", (event) => {
      const control = event.target.closest("[data-subscription-billing-cycle]");
      if (!control) return;

      const container = control.closest("[data-subscription-plans]");
      if (!container) return;

      container.dataset.billingCycle = control.value || "monthly";
      renderPlans();
    });
  }

  function init() {
    if (initialized) return;

    const hasUI = document.querySelector(
      "[data-subscription-plans], [data-subscription-current], " +
      "[data-subscription-history], [data-subscription-submit], " +
      "[data-cancel-subscription]"
    );

    if (!hasUI) return;

    initialized = true;
    bindEvents();

    refresh().catch(handleError);
  }

  const api = Object.freeze({
    loadPlans,
    loadCurrent,
    loadHistory,
    subscribe,
    changePlan,
    cancel,
    refresh,
    getState,
    formatCurrency,
    formatDate,
    renderPlans,
    renderCurrent,
    renderHistory,
    events: EVENTS
  });

  window.MedOrbitsSubscription = api;
  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Subscription = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
