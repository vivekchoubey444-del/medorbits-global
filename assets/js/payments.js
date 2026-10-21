
/* =========================================================
   MedOrbits -- Payments Manager
   File: /assets/js/payments.js
   Version: 1.1.0

   Payment history, checkout, invoices, subscriptions,
   payment status, refunds and payment methods.

   IMPORTANT:
   All payment authorization, pricing, refunds, signatures,
   and subscription changes must be validated server-side.
   ========================================================= */
(function (window, document) {
  "use strict";

  if (window.MedOrbitsPayments) return;

  const CONFIG = window.MedOrbitsConfig || {};
  const API_BASE = String(
    CONFIG.API_BASE_URL ||
    CONFIG.apiBaseUrl ||
    "/api"
  ).replace(/\/+$/, "");

  const DEFAULT_PAGE_SIZE = 10;
  const MAX_PAGE_SIZE = 100;
  const MAX_DESCRIPTION_LENGTH = 500;
  const MAX_REASON_LENGTH = 1000;

  const state = {
    payments: [],
    paymentMethods: [],
    invoices: [],
    subscriptions: [],
    activePayment: null,
    loading: false,
    processing: false,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    initialized: false,
    activeRequests: new Map()
  };

  const listeners = new Map();
  const boundForms = new WeakSet();
  const boundControls = new WeakSet();
  const boundRoots = new WeakSet();

  const PAYMENT_STATUSES = Object.freeze([
    "pending",
    "processing",
    "completed",
    "failed",
    "cancelled",
    "refunded",
    "partially_refunded"
  ]);

  const utils = {
    escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, function (char) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[char];
      });
    },

    dispatch(name, detail) {
      const payload = detail || {};

      document.dispatchEvent(
        new CustomEvent("medorbits:payments:" + name, {
          detail: payload
        })
      );

      const callbacks = listeners.get(name);

      if (callbacks) {
        callbacks.forEach(function (callback) {
          try {
            callback(payload);
          } catch (error) {
            console.error("[MedOrbits Payments] Listener error:", error);
          }
        });
      }
    },

    notify(message, type) {
      if (window.MedOrbitsErrorHandler?.notify) {
        window.MedOrbitsErrorHandler.notify(message, type || "info");
        return;
      }

      if (window.MedOrbits?.toast?.show) {
        window.MedOrbits.toast.show(message, { type: type || "info" });
        return;
      }

      if (window.MedOrbitsApp?.notify) {
        window.MedOrbitsApp.notify(message, type || "info");
        return;
      }

      console.info("[MedOrbits Payments] " + message);
    },

    formatCurrency(amount, currency) {
      const value = Number(amount);

      if (!Number.isFinite(value)) return "--";

      const code = String(currency || "INR").toUpperCase();

      try {
        return new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: code,
          maximumFractionDigits: 2
        }).format(value);
      } catch (_) {
        return code + " " + value.toFixed(2);
      }
    },

    formatDate(value) {
      if (!value) return "--";

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) return "--";

      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);
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

    normalizeStatus(status) {
      return String(status || "pending")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    },

    safeUrl(value) {
      if (typeof value !== "string" || !value.trim()) {
        return "";
      }

      try {
        const url = new URL(value, window.location.origin);

        if (!["http:", "https:"].includes(url.protocol)) {
          return "";
        }

        // Only allow internal redirects and links.
        if (url.origin !== window.location.origin) {
          return "";
        }

        return url.href;
      } catch (_) {
        return "";
      }
    },

    id(value) {
      return String(value ?? "").trim();
    },

    isObject(value) {
      return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);
    },

    unwrap(response, key) {
      if (!utils.isObject(response)) return response;

      return response?.data?.[key] ??
        response?.[key] ??
        response?.data ??
        response;
    }
  };

  /* ---------------------------------------------------------
     HTTP requests
  --------------------------------------------------------- */

  function buildApiUrl(path) {
    const normalized = String(path || "").replace(/^\/+/, "");
    return API_BASE + "/" + normalized;
  }

  function getAuthHeaders() {
    const headers = new Headers({
      Accept: "application/json"
    });

    const token =
      window.MedOrbitsAuth?.getToken?.() ||
      window.MedOrbitsAuth?.getAccessToken?.();

    if (token) {
      headers.set("Authorization", "Bearer " + token);
    }

    const csrf = document.querySelector(
      'meta[name="csrf-token"]'
    )?.getAttribute("content");

    if (csrf) {
      headers.set("X-CSRF-Token", csrf);
    }

    return headers;
  }

  async function request(path, options) {
    const settings = options || {};
    const headers = getAuthHeaders();

    new Headers(settings.headers || {}).forEach(function (value, key) {
      headers.set(key, value);
    });

    const body = settings.body;
    const isFormData = body instanceof FormData;

    const fetchOptions = {
      method: settings.method || "GET",
      headers,
      credentials: "same-origin",
      cache: "no-store",
      signal: settings.signal
    };

    if (body !== undefined && body !== null) {
      if (isFormData || body instanceof Blob) {
        fetchOptions.body = body;
      } else if (typeof body === "string") {
        fetchOptions.body = body;
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      } else {
        headers.set("Content-Type", "application/json");
        fetchOptions.body = JSON.stringify(body);
      }
    }

    const response = await fetch(buildApiUrl(path), fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    let data = null;

    if (response.status === 204) {
      data = null;
    } else if (
      settings.responseType === "blob" &&
      response.ok
    ) {
      data = await response.blob();
    } else if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => "");
    }

    if (!response.ok) {
      const message = utils.isObject(data)
        ? data.message || data.error
        : "";

      const error = new Error(
        message ||
        "Payment request failed (" + response.status + ")."
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  async function deduplicatedRequest(key, path, options) {
    const existing = state.activeRequests.get(key);

    if (existing) return existing;

    const promise = request(path, options)
      .finally(function () {
        if (state.activeRequests.get(key) === promise) {
          state.activeRequests.delete(key);
        }
      });

    state.activeRequests.set(key, promise);

    return promise;
  }

  /* ---------------------------------------------------------
     Data normalization
  --------------------------------------------------------- */

  function normalizePayment(item) {
    const payment = utils.isObject(item) ? item : {};

    const amount = Number(
      payment.amount ?? payment.total ?? 0
    );

    const refundAmount = Number(
      payment.refundAmount ??
      payment.refund_amount ??
      0
    );

    return {
      id: utils.id(
        payment.id ||
        payment._id ||
        payment.paymentId
      ),

      orderId: utils.id(
        payment.orderId ||
        payment.order_id ||
        payment.gatewayOrderId
      ),

      transactionId: utils.id(
        payment.transactionId ||
        payment.transaction_id ||
        payment.gatewayTransactionId
      ),

      description: String(
        payment.description ||
        payment.title ||
        payment.purpose ||
        "Payment"
      ).slice(0, MAX_DESCRIPTION_LENGTH),

      amount: Number.isFinite(amount) ? amount : 0,

      currency: String(payment.currency || "INR").toUpperCase(),

      status: utils.normalizeStatus(payment.status),

      method: String(
        payment.method ||
        payment.paymentMethod ||
        payment.payment_method ||
        ""
      ),

      createdAt:
        payment.createdAt ||
        payment.created_at ||
        payment.date ||
        null,

      updatedAt:
        payment.updatedAt ||
        payment.updated_at ||
        null,

      invoiceId: utils.id(
        payment.invoiceId ||
        payment.invoice_id
      ),

      invoiceUrl: utils.safeUrl(
        payment.invoiceUrl ||
        payment.invoice_url ||
        ""
      ),

      receiptUrl: utils.safeUrl(
        payment.receiptUrl ||
        payment.receipt_url ||
        ""
      ),

      refundAmount: Number.isFinite(refundAmount)
        ? refundAmount
        : 0,

      metadata: utils.isObject(payment.metadata)
        ? payment.metadata
        : {}
    };
  }

  function normalizePaymentMethod(item) {
    const method = utils.isObject(item) ? item : {};

    return {
      id: utils.id(method.id || method._id),

      type: String(method.type || method.method || "unknown"),

      brand: String(method.brand || ""),

      last4: /^\d{4}$/.test(String(
        method.last4 || method.last_four || ""
      ))
        ? String(method.last4 || method.last_four)
        : "",

      expiryMonth: method.expiryMonth ||
        method.expiry_month ||
        null,

      expiryYear: method.expiryYear ||
        method.expiry_year ||
        null,

      isDefault: Boolean(
        method.isDefault || method.is_default
      ),

      displayName: String(
        method.displayName || method.name || ""
      )
    };
  }

  function normalizeSubscription(item) {
    const subscription = utils.isObject(item) ? item : {};
    const amount = Number(subscription.amount ?? 0);

    return {
      id: utils.id(subscription.id || subscription._id),

      planId: utils.id(
        subscription.planId || subscription.plan_id
      ),

      planName: String(
        subscription.planName ||
        subscription.plan_name ||
        subscription.name ||
        "Subscription"
      ),

      amount: Number.isFinite(amount) ? amount : 0,

      currency: String(
        subscription.currency || "INR"
      ).toUpperCase(),

      status: utils.normalizeStatus(subscription.status),

      interval: String(
        subscription.interval ||
        subscription.billingInterval ||
        "monthly"
      ),

      startDate:
        subscription.startDate ||
        subscription.start_date ||
        null,

      nextBillingDate:
        subscription.nextBillingDate ||
        subscription.next_billing_date ||
        null,

      cancelAtPeriodEnd: Boolean(
        subscription.cancelAtPeriodEnd ||
        subscription.cancel_at_period_end
      )
    };
  }

  function normalizeList(response, key) {
    if (Array.isArray(response)) return response;

    const candidates = [
      response?.data?.[key],
      response?.[key],
      response?.data?.items,
      response?.items,
      response?.data
    ];

    return candidates.find(Array.isArray) || [];
  }

  /* ---------------------------------------------------------
     UI state
  --------------------------------------------------------- */

  function setLoading(loading) {
    state.loading = Boolean(loading);

    document.querySelectorAll("[data-payments-loading]").forEach(
      function (element) {
        element.hidden = !state.loading;
        element.setAttribute(
          "aria-hidden",
          String(!state.loading)
        );
      }
    );

    utils.dispatch("loading", {
      loading: state.loading
    });
  }

  function setProcessing(processing) {
    state.processing = Boolean(processing);

    document.querySelectorAll("[data-payment-submit]").forEach(
      function (button) {
        button.disabled = state.processing;
        button.setAttribute(
          "aria-busy",
          String(state.processing)
        );

        const label = button.querySelector(
          "[data-payment-button-label]"
        );

        if (label) {
          if (!button.dataset.originalLabel) {
            button.dataset.originalLabel = label.textContent;
          }

          label.textContent = state.processing
            ? "Processing…"
            : button.dataset.originalLabel;
        }
      }
    );

    utils.dispatch("processing", {
      processing: state.processing
    });
  }

  /* ---------------------------------------------------------
     Payment history
  --------------------------------------------------------- */

  async function loadPayments(options) {
    const settings = options || {};

    const page = Math.max(
      1,
      Number.parseInt(settings.page ?? state.page, 10) || 1
    );

    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(settings.limit ?? state.pageSize, 10) ||
          DEFAULT_PAGE_SIZE
      )
    );

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    });

    ["status", "search", "from", "to"].forEach(function (key) {
      if (settings[key]) {
        params.set(key, String(settings[key]));
      }
    });

    setLoading(true);

    try {
      const response = await request(
        "/payments?" + params.toString()
      );

      const payments = normalizeList(response, "payments")
        .map(normalizePayment)
        .filter((payment) => payment.id);

      state.payments = payments;
      state.page = page;
      state.pageSize = limit;

      state.total = Number(
        response?.total ??
        response?.data?.total ??
        response?.meta?.total ??
        payments.length
      );

      if (!Number.isFinite(state.total) || state.total < 0) {
        state.total = payments.length;
      }

      renderPayments(settings.container);

      utils.dispatch("payments-loaded", {
        payments: state.payments.slice(),
        total: state.total,
        page: state.page
      });

      return state.payments.slice();
    } catch (error) {
      utils.notify(
        error.message || "Unable to load payment history.",
        "error"
      );

      utils.dispatch("error", {
        error,
        action: "load-payments"
      });

      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function loadPayment(paymentId) {
    const id = utils.id(paymentId);

    if (!id) {
      throw new Error("A payment ID is required.");
    }

    setLoading(true);

    try {
      const response = await deduplicatedRequest(
        "payment:" + id,
        "/payments/" + encodeURIComponent(id)
      );

      const raw =
        response?.data?.payment ||
        response?.payment ||
        response?.data ||
        response;

      state.activePayment = normalizePayment(raw);

      utils.dispatch("payment-loaded", {
        payment: state.activePayment
      });

      return state.activePayment;
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------------------
     Checkout and verification
  --------------------------------------------------------- */

  async function createCheckout(payload) {
    const data = payload || {};

    if (
      !data.productId &&
      !data.planId &&
      !data.applicationId
    ) {
      throw new Error(
        "A valid product, plan or application is required."
      );
    }

    if (
      data.amount !== undefined &&
      data.amount !== null &&
      data.amount !== ""
    ) {
      const amount = Number(data.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
          "The payment amount must be greater than zero."
        );
      }
    }

    const successUrl = data.successUrl
      ? utils.safeUrl(data.successUrl)
      : "";

    const cancelUrl = data.cancelUrl
      ? utils.safeUrl(data.cancelUrl)
      : "";

    if (data.successUrl && !successUrl) {
      throw new Error("The success URL must belong to this website.");
    }

    if (data.cancelUrl && !cancelUrl) {
      throw new Error("The cancel URL must belong to this website.");
    }

    const body = {
      productId: data.productId || null,
      planId: data.planId || null,
      applicationId: data.applicationId || null,
      currency: String(data.currency || "INR").toUpperCase(),
      description: String(data.description || "")
        .slice(0, MAX_DESCRIPTION_LENGTH),
      successUrl: successUrl || null,
      cancelUrl: cancelUrl || null,
      metadata: utils.isObject(data.metadata)
        ? data.metadata
        : {}
    };

    // The backend must determine the authoritative price.
    // The client amount is only a request, never proof of price.
    if (data.amount !== undefined && data.amount !== "") {
      body.amount = Number(data.amount);
    }

    setProcessing(true);

    try {
      const response = await request("/payments/checkout", {
        method: "POST",
        body
      });

      const checkout =
        response?.data?.checkout ||
        response?.checkout ||
        response?.data ||
        response;

      const checkoutUrl = utils.safeUrl(
        checkout.checkoutUrl ||
        checkout.checkout_url ||
        checkout.paymentUrl ||
        checkout.payment_url ||
        ""
      );

      utils.dispatch("checkout-created", {
        checkout
      });

      if (checkoutUrl && data.redirect !== false) {
        window.location.assign(checkoutUrl);
      }

      return checkout;
    } catch (error) {
      utils.dispatch("error", {
        error,
        action: "create-checkout"
      });

      throw error;
    } finally {
      setProcessing(false);
    }
  }

  async function verifyPayment(payload) {
    const data = payload || {};

    if (
      !data.paymentId &&
      !data.orderId &&
      !data.transactionId
    ) {
      throw new Error(
        "Payment verification details are required."
      );
    }

    setProcessing(true);

    try {
      const response = await request("/payments/verify", {
        method: "POST",
        body: {
          paymentId: data.paymentId || null,
          orderId: data.orderId || null,
          transactionId: data.transactionId || null,
          provider: data.provider || null
        }
      });

      const raw =
        response?.data?.payment ||
        response?.payment ||
        response?.data ||
        response;

      const payment = normalizePayment(raw);

      if (payment.id) {
        const index = state.payments.findIndex(
          (item) => item.id === payment.id
        );

        if (index >= 0) {
          state.payments[index] = payment;
        } else {
          state.payments.unshift(payment);
        }
      }

      state.activePayment = payment;

      renderPayments();

      utils.dispatch("payment-verified", {
        payment
      });

      return payment;
    } catch (error) {
      utils.dispatch("error", {
        error,
        action: "verify-payment"
      });

      throw error;
    } finally {
      setProcessing(false);
    }
  }

  async function cancelPayment(paymentId, reason) {
    const id = utils.id(paymentId);

    if (!id) {
      throw new Error("A payment ID is required.");
    }

    const response = await request(
      "/payments/" + encodeURIComponent(id) + "/cancel",
      {
        method: "POST",
        body: {
          reason: String(reason || "").slice(0, 500)
        }
      }
    );

    const raw =
      response?.data?.payment ||
      response?.payment ||
      response?.data ||
      response;

    const index = state.payments.findIndex(
      (item) => item.id === id
    );

    if (index >= 0) {
      state.payments[index] = normalizePayment(raw);
    }

    if (state.activePayment?.id === id) {
      state.activePayment = normalizePayment(raw);
    }

    renderPayments();

    utils.dispatch("payment-cancelled", {
      paymentId: id,
      response
    });

    return response;
  }

  async function requestRefund(paymentId, payload) {
    const id = utils.id(paymentId);
    const data = payload || {};

    if (!id) {
      throw new Error("A payment ID is required.");
    }

    const payment = state.payments.find(
      (item) => item.id === id
    ) || (
      state.activePayment?.id === id
        ? state.activePayment
        : null
    );

    if (
      payment &&
      !["completed", "partially_refunded"].includes(payment.status)
    ) {
      throw new Error(
        "Only completed or partially refunded payments can be refunded."
      );
    }

    if (!window.confirm("Submit a refund request for this payment?")) {
      return null;
    }

    let amount;

    if (data.amount !== undefined && data.amount !== "") {
      amount = Number(data.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid refund amount.");
      }

      if (payment && amount > payment.amount - payment.refundAmount) {
        throw new Error(
          "The refund amount exceeds the remaining refundable balance."
        );
      }
    }

    const body = {
      reason: String(data.reason || "").slice(0, MAX_REASON_LENGTH)
    };

    if (amount !== undefined) {
      body.amount = amount;
    }

    const response = await request(
      "/payments/" + encodeURIComponent(id) + "/refund",
      {
        method: "POST",
        body
      }
    );

    utils.dispatch("refund-requested", {
      paymentId: id,
      response
    });

    return response;
  }

  /* ---------------------------------------------------------
     Invoices
  --------------------------------------------------------- */

  async function loadInvoices(options) {
    const settings = options || {};
    const params = new URLSearchParams();

    if (settings.page) params.set("page", String(settings.page));
    if (settings.limit) params.set("limit", String(settings.limit));
    if (settings.status) params.set("status", String(settings.status));

    const query = params.toString();

    const response = await request(
      "/payments/invoices" + (query ? "?" + query : "")
    );

    state.invoices = normalizeList(response, "invoices")
      .filter(utils.isObject);

    renderInvoices(settings.container);

    utils.dispatch("invoices-loaded", {
      invoices: state.invoices.slice()
    });

    return state.invoices.slice();
  }

  async function downloadInvoice(invoiceId, filename) {
    const id = utils.id(invoiceId);

    if (!id) {
      throw new Error("An invoice ID is required.");
    }

    const blob = await request(
      "/payments/invoices/" +
      encodeURIComponent(id) +
      "/download",
      {
        method: "GET",
        responseType: "blob"
      }
    );

    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error("The invoice file is empty or invalid.");
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = String(filename || "invoice-" + id + ".pdf")
      .replace(/[\\/:*?"<>|]/g, "_");
    link.hidden = true;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(function () {
      URL.revokeObjectURL(objectUrl);
    }, 1000);

    utils.dispatch("invoice-downloaded", {
      invoiceId: id
    });

    return true;
  }

  /* ---------------------------------------------------------
     Payment methods
  --------------------------------------------------------- */

  async function loadPaymentMethods() {
    const response = await request("/payments/methods");

    state.paymentMethods = normalizeList(
      response,
      "paymentMethods"
    )
      .map(normalizePaymentMethod)
      .filter((method) => method.id);

    renderPaymentMethods();

    utils.dispatch("payment-methods-loaded", {
      paymentMethods: state.paymentMethods.slice()
    });

    return state.paymentMethods.slice();
  }

  async function setDefaultPaymentMethod(methodId) {
    const id = utils.id(methodId);

    if (!id) {
      throw new Error("A payment method ID is required.");
    }

    if (!state.paymentMethods.some((method) => method.id === id)) {
      throw new Error("The requested payment method was not found.");
    }

    await request(
      "/payments/methods/" + encodeURIComponent(id) + "/default",
      {
        method: "PATCH",
        body: {}
      }
    );

    state.paymentMethods = state.paymentMethods.map((method) => ({
      ...method,
      isDefault: method.id === id
    }));

    renderPaymentMethods();

    utils.dispatch("payment-method-default-changed", {
      methodId: id
    });

    return true;
  }

  async function removePaymentMethod(methodId) {
    const id = utils.id(methodId);

    if (!id) {
      throw new Error("A payment method ID is required.");
    }

    const method = state.paymentMethods.find(
      (item) => item.id === id
    );

    if (!method) {
      throw new Error("The requested payment method was not found.");
    }

    if (!window.confirm("Remove this saved payment method?")) {
      return false;
    }

    await request(
      "/payments/methods/" + encodeURIComponent(id),
      { method: "DELETE" }
    );

    state.paymentMethods = state.paymentMethods.filter(
      (item) => item.id !== id
    );

    renderPaymentMethods();

    utils.dispatch("payment-method-removed", {
      methodId: id
    });

    return true;
  }

  /* ---------------------------------------------------------
     Subscriptions
  --------------------------------------------------------- */

  async function loadSubscriptions() {
    const response = await request("/subscriptions");

    state.subscriptions = normalizeList(
      response,
      "subscriptions"
    )
      .map(normalizeSubscription)
      .filter((subscription) => subscription.id);

    renderSubscriptions();

    utils.dispatch("subscriptions-loaded", {
      subscriptions: state.subscriptions.slice()
    });

    return state.subscriptions.slice();
  }

  async function cancelSubscription(subscriptionId, options) {
    const id = utils.id(subscriptionId);
    const settings = options || {};

    if (!id) {
      throw new Error("A subscription ID is required.");
    }

    const response = await request(
      "/subscriptions/" + encodeURIComponent(id) + "/cancel",
      {
        method: "POST",
        body: {
          immediately: Boolean(settings.immediately),
          reason: String(settings.reason || "").slice(0, 500)
        }
      }
    );

    const raw =
      response?.data?.subscription ||
      response?.subscription ||
      response?.data ||
      response;

    const index = state.subscriptions.findIndex(
      (item) => item.id === id
    );

    if (index >= 0) {
      state.subscriptions[index] = normalizeSubscription(raw);
    }

    renderSubscriptions();

    utils.dispatch("subscription-cancelled", {
      subscriptionId: id,
      response
    });

    return response;
  }

  /* ---------------------------------------------------------
     Rendering
  --------------------------------------------------------- */

  function statusLabel(status) {
    return utils.normalizeStatus(status)
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function renderPayments(target) {
    const containers = target
      ? [utils.getElement(target)]
      : Array.from(document.querySelectorAll("[data-payments-list]"));

    containers.filter(Boolean).forEach((container) => {
      if (!state.payments.length) {
        container.replaceChildren(
          Object.assign(document.createElement("div"), {
            className: "mo-payments-empty",
            textContent: "No payment records found."
          })
        );
        return;
      }

      const fragment = document.createDocumentFragment();

      state.payments.forEach((payment) => {
        const article = document.createElement("article");
        article.className = "mo-payment-item";
        article.dataset.paymentId = payment.id;

        const heading = document.createElement("h3");
        heading.textContent = payment.description;

        const reference = document.createElement("p");
        reference.className = "mo-payment-reference";
        reference.textContent = payment.transactionId
          ? "Transaction: " + payment.transactionId
          : "Payment reference: " + payment.id;

        const time = document.createElement("time");
        time.dateTime = payment.createdAt || "";
        time.textContent = utils.formatDate(payment.createdAt);

        const amount = document.createElement("strong");
        amount.textContent = utils.formatCurrency(
          payment.amount,
          payment.currency
        );

        const status = document.createElement("span");
        status.className = "mo-payment-status status-" +
          (
            PAYMENT_STATUSES.includes(payment.status)
              ? payment.status.replace(/_/g, "-")
              : "unknown"
          );
        status.textContent = statusLabel(payment.status);

        const main = document.createElement("div");
        main.className = "mo-payment-main";
        main.append(heading, reference, time);

        const amountBox = document.createElement("div");
        amountBox.className = "mo-payment-amount";
        amountBox.append(amount, status);

        const actions = document.createElement("div");
        actions.className = "mo-payment-actions";

        function addAction(label, attribute, value) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.setAttribute(attribute, value);
          actions.appendChild(button);
        }

        addAction("Details", "data-payment-view", payment.id);

        if (payment.invoiceId) {
          addAction(
            "Download invoice",
            "data-payment-invoice",
            payment.invoiceId
          );
        }

        if (payment.status === "pending") {
          addAction(
            "Cancel",
            "data-payment-cancel",
            payment.id
          );
        }

        if (
          ["completed", "partially_refunded"].includes(payment.status)
        ) {
          addAction(
            "Request refund",
            "data-payment-refund",
            payment.id
          );
        }

        article.append(main, amountBox, actions);
        fragment.appendChild(article);
      });

      container.replaceChildren(fragment);
    });
  }

  function renderInvoices(target) {
    const containers = target
      ? [utils.getElement(target)]
      : Array.from(document.querySelectorAll("[data-invoices-list]"));

    containers.filter(Boolean).forEach((container) => {
      if (!state.invoices.length) {
        container.textContent = "No invoices found.";
        return;
      }

      const fragment = document.createDocumentFragment();

      state.invoices.forEach((invoice) => {
        const id = utils.id(
          invoice.id ||
          invoice._id ||
          invoice.invoiceId
        );

        const article = document.createElement("article");
        article.className = "mo-invoice-item";
        article.dataset.invoiceId = id;

        const title = document.createElement("strong");
        title.textContent = String(
          invoice.invoiceNumber || invoice.number || id
        );

        const date = document.createElement("time");
        date.textContent = utils.formatDate(
          invoice.createdAt ||
          invoice.created_at ||
          invoice.date
        );

        const amount = document.createElement("strong");
        amount.textContent = utils.formatCurrency(
          invoice.amount ?? invoice.total ?? 0,
          invoice.currency || "INR"
        );

        const download = document.createElement("button");
        download.type = "button";
        download.textContent = "Download PDF";
        download.dataset.paymentInvoice = id;

        article.append(title, date, amount, download);
        fragment.appendChild(article);
      });

      container.replaceChildren(fragment);
    });
  }

  function renderPaymentMethods(target) {
    const containers = target
      ? [utils.getElement(target)]
      : Array.from(document.querySelectorAll("[data-payment-methods]"));

    containers.filter(Boolean).forEach((container) => {
      if (!state.paymentMethods.length) {
        container.textContent = "No saved payment methods.";
        return;
      }

      const fragment = document.createDocumentFragment();

      state.paymentMethods.forEach((method) => {
        const article = document.createElement("article");
        article.className = "mo-payment-method";
        article.dataset.paymentMethodId = method.id;

        const label = [
          method.brand,
          method.last4 ? "•••• " + method.last4 : "",
          method.displayName
        ].filter(Boolean).join(" ");

        const title = document.createElement("strong");
        title.textContent = label || method.type;
        article.appendChild(title);

        if (method.isDefault) {
          const badge = document.createElement("span");
          badge.className = "mo-payment-default";
          badge.textContent = "Default";
          article.appendChild(badge);
        } else {
          const makeDefault = document.createElement("button");
          makeDefault.type = "button";
          makeDefault.textContent = "Set default";
          makeDefault.dataset.paymentMethodDefault = method.id;
          article.appendChild(makeDefault);
        }

        if (method.expiryMonth && method.expiryYear) {
          const expiry = document.createElement("small");
          expiry.textContent =
            "Expires " + method.expiryMonth + "/" + method.expiryYear;
          article.appendChild(expiry);
        }

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.dataset.paymentMethodRemove = method.id;
        article.appendChild(remove);

        fragment.appendChild(article);
      });

      container.replaceChildren(fragment);
    });
  }

  function renderSubscriptions(target) {
    const containers = target
      ? [utils.getElement(target)]
      : Array.from(document.querySelectorAll("[data-subscriptions-list]"));

    containers.filter(Boolean).forEach((container) => {
      if (!state.subscriptions.length) {
        container.textContent = "No subscriptions found.";
        return;
      }

      const fragment = document.createDocumentFragment();

      state.subscriptions.forEach((subscription) => {
        const article = document.createElement("article");
        article.className = "mo-subscription-item";
        article.dataset.subscriptionId = subscription.id;

        const heading = document.createElement("h3");
        heading.textContent = subscription.planName;

        const amount = document.createElement("strong");
        amount.textContent = utils.formatCurrency(
          subscription.amount,
          subscription.currency
        );

        const interval = document.createElement("span");
        interval.textContent = subscription.interval;

        const status = document.createElement("span");
        status.className = "mo-subscription-status";
        status.textContent = statusLabel(subscription.status);

        article.append(heading, amount, interval, status);

        if (subscription.nextBillingDate) {
          const nextBilling = document.createElement("p");
          nextBilling.textContent =
            "Next billing: " +
            utils.formatDate(subscription.nextBillingDate);
          article.appendChild(nextBilling);
        }

        if (
          ["active", "trialing"].includes(subscription.status) &&
          !subscription.cancelAtPeriodEnd
        ) {
          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.textContent = "Cancel subscription";
          cancel.dataset.subscriptionCancel = subscription.id;
          article.appendChild(cancel);
        }

        fragment.appendChild(article);
      });

      container.replaceChildren(fragment);
    });
  }

  function renderPaymentDetails(payment, target) {
    const container = utils.getElement(
      target || "[data-payment-details]"
    );

    if (!container || !payment) return;

    const section = document.createElement("div");
    section.className = "mo-payment-details";

    const heading = document.createElement("h2");
    heading.textContent = payment.description;
    section.appendChild(heading);

    const list = document.createElement("dl");

    const fields = [
      ["Amount", utils.formatCurrency(payment.amount, payment.currency)],
      ["Status", statusLabel(payment.status)],
      ["Payment ID", payment.id],
      ["Transaction ID", payment.transactionId || "--"],
      ["Payment method", payment.method || "--"],
      ["Date", utils.formatDate(payment.createdAt)]
    ];

    if (payment.refundAmount) {
      fields.push([
        "Refunded",
        utils.formatCurrency(payment.refundAmount, payment.currency)
      ]);
    }

    fields.forEach(([label, value]) => {
      const term = document.createElement("dt");
      term.textContent = label;

      const description = document.createElement("dd");
      description.textContent = value;

      list.append(term, description);
    });

    section.appendChild(list);
    container.replaceChildren(section);
  }

  /* ---------------------------------------------------------
     Event binding
  --------------------------------------------------------- */

  function bindActions() {
    if (boundRoots.has(document)) return;
    boundRoots.add(document);

    document.addEventListener("click", async function (event) {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const viewButton = target.closest("[data-payment-view]");

      if (viewButton) {
        try {
          const payment = await loadPayment(
            viewButton.dataset.paymentView
          );

          renderPaymentDetails(payment);

          utils.dispatch("details-requested", { payment });
        } catch (error) {
          utils.notify(
            error.message || "Unable to load payment details.",
            "error"
          );
        }

        return;
      }

      const invoiceButton = target.closest("[data-payment-invoice]");

      if (invoiceButton) {
        try {
          await downloadInvoice(
            invoiceButton.dataset.paymentInvoice
          );
        } catch (error) {
          utils.notify(
            error.message || "Invoice download failed.",
            "error"
          );
        }

        return;
      }

      const cancelButton = target.closest("[data-payment-cancel]");

      if (cancelButton) {
        const id = cancelButton.dataset.paymentCancel;

        if (!window.confirm("Cancel this pending payment?")) return;

        try {
          await cancelPayment(id);
          utils.notify("Payment cancellation requested.", "success");
          await loadPayments();
        } catch (error) {
          utils.notify(
            error.message || "Unable to cancel payment.",
            "error"
          );
        }

        return;
      }

      const refundButton = target.closest("[data-payment-refund]");

      if (refundButton) {
        try {
          await requestRefund(
            refundButton.dataset.paymentRefund,
            {}
          );

          utils.notify("Refund request submitted.", "success");
        } catch (error) {
          utils.notify(
            error.message || "Unable to request refund.",
            "error"
          );
        }

        return;
      }

      const defaultButton = target.closest(
        "[data-payment-method-default]"
      );

      if (defaultButton) {
        try {
          await setDefaultPaymentMethod(
            defaultButton.dataset.paymentMethodDefault
          );

          utils.notify("Default payment method updated.", "success");
        } catch (error) {
          utils.notify(
            error.message || "Unable to update payment method.",
            "error"
          );
        }

        return;
      }

      const removeButton = target.closest(
        "[data-payment-method-remove]"
      );

      if (removeButton) {
        try {
          const removed = await removePaymentMethod(
            removeButton.dataset.paymentMethodRemove
          );

          if (removed) {
            utils.notify("Payment method removed.", "success");
          }
        } catch (error) {
          utils.notify(
            error.message || "Unable to remove payment method.",
            "error"
          );
        }

        return;
      }

      const cancelSubscriptionButton = target.closest(
        "[data-subscription-cancel]"
      );

      if (cancelSubscriptionButton) {
        if (!window.confirm("Cancel this subscription?")) return;

        try {
          await cancelSubscription(
            cancelSubscriptionButton.dataset.subscriptionCancel
          );

          utils.notify(
            "Subscription cancellation requested.",
            "success"
          );
        } catch (error) {
          utils.notify(
            error.message || "Unable to cancel subscription.",
            "error"
          );
        }

        return;
      }

      const refreshButton = target.closest("[data-payments-refresh]");

      if (refreshButton) {
        loadPayments().catch(() => {});
      }
    });
  }

  function bindCheckoutForms() {
    document.querySelectorAll("[data-payment-checkout]").forEach((form) => {
      if (boundForms.has(form)) return;
      boundForms.add(form);

      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const formData = new FormData(form);

        const payload = {
          productId: formData.get("productId"),
          planId: formData.get("planId"),
          applicationId: formData.get("applicationId"),
          amount: formData.get("amount") || undefined,
          currency: formData.get("currency") || "INR",
          description: formData.get("description") || "",
          successUrl: formData.get("successUrl") || "",
          cancelUrl: formData.get("cancelUrl") || ""
        };

        const button = form.querySelector(
          'button[type="submit"], input[type="submit"]'
        );

        if (button) button.disabled = true;

        try {
          await createCheckout(payload);
        } catch (error) {
          utils.notify(
            error.message || "Unable to start checkout.",
            "error"
          );
        } finally {
          if (button) button.disabled = false;
        }
      });
    });
  }

  function bindPaymentFilters() {
    document.querySelectorAll("[data-payment-filter]").forEach((control) => {
      if (boundControls.has(control)) return;
      boundControls.add(control);

      control.addEventListener("change", function () {
        loadPayments({
          page: 1,
          status: control.value || "",
          container: control.dataset.target || undefined
        }).catch(() => {});
      });
    });
  }

  /* ---------------------------------------------------------
     Public event subscriptions
  --------------------------------------------------------- */

  function on(eventName, callback) {
    if (typeof callback !== "function") {
      throw new TypeError("A callback function is required.");
    }

    const name = String(eventName || "").replace(
      /^medorbits:payments:/,
      ""
    );

    if (!name) {
      throw new TypeError("An event name is required.");
    }

    if (!listeners.has(name)) {
      listeners.set(name, new Set());
    }

    listeners.get(name).add(callback);

    return function unsubscribe() {
      off(name, callback);
    };
  }

  function off(eventName, callback) {
    const name = String(eventName || "").replace(
      /^medorbits:payments:/,
      ""
    );

    if (!listeners.has(name)) return;

    if (callback) {
      listeners.get(name).delete(callback);
    } else {
      listeners.delete(name);
    }
  }

  /* ---------------------------------------------------------
     Initialization and teardown
  --------------------------------------------------------- */

  async function init(options) {
    const settings = options || {};

    if (state.initialized && !settings.force) {
      return api;
    }

    bindActions();
    bindCheckoutForms();
    bindPaymentFilters();

    const tasks = [];

    if (
      settings.payments !== false &&
      document.querySelector("[data-payments-list]")
    ) {
      tasks.push(loadPayments().catch(() => []));
    }

    if (
      settings.invoices !== false &&
      document.querySelector("[data-invoices-list]")
    ) {
      tasks.push(loadInvoices().catch(() => []));
    }

    if (
      settings.paymentMethods !== false &&
      document.querySelector("[data-payment-methods]")
    ) {
      tasks.push(loadPaymentMethods().catch(() => []));
    }

    if (
      settings.subscriptions !== false &&
      document.querySelector("[data-subscriptions-list]")
    ) {
      tasks.push(loadSubscriptions().catch(() => []));
    }

    await Promise.allSettled(tasks);

    state.initialized = true;

    utils.dispatch("initialized");

    return api;
  }

  function destroy() {
    listeners.clear();
    state.initialized = false;
    state.activeRequests.clear();
  }

  const api = {
    version: "1.1.0",

    init,
    destroy,
    on,
    off,

    loadPayments,
    loadPayment,
    createCheckout,
    verifyPayment,
    cancelPayment,
    requestRefund,

    loadInvoices,
    downloadInvoice,

    loadPaymentMethods,
    setDefaultPaymentMethod,
    removePaymentMethod,

    loadSubscriptions,
    cancelSubscription,

    renderPayments,
    renderInvoices,
    renderPaymentMethods,
    renderSubscriptions,
    renderPaymentDetails,

    formatCurrency: utils.formatCurrency,
    formatDate: utils.formatDate,
    statusLabel,

    getPayments: () => state.payments.slice(),
    getPaymentMethods: () => state.paymentMethods.slice(),
    getInvoices: () => state.invoices.slice(),
    getSubscriptions: () => state.subscriptions.slice(),
    getActivePayment: () => state.activePayment,

    getState: () => ({
      payments: state.payments.slice(),
      paymentMethods: state.paymentMethods.slice(),
      invoices: state.invoices.slice(),
      subscriptions: state.subscriptions.slice(),
      activePayment: state.activePayment,
      loading: state.loading,
      processing: state.processing,
      page: state.page,
      pageSize: state.pageSize,
      total: state.total
    }),

    constants: Object.freeze({
      DEFAULT_PAGE_SIZE,
      PAYMENT_STATUSES
    })
  };

  window.MedOrbitsPayments = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Payments = api;

  function autoInit() {
    if (
      document.querySelector(
        "[data-payments-list], [data-invoices-list], " +
        "[data-payment-methods], [data-subscriptions-list], " +
        "[data-payment-checkout], [data-payments-refresh]"
      )
    ) {
      init();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, {
      once: true
    });
  } else {
    autoInit();
  }
})(window, document);
