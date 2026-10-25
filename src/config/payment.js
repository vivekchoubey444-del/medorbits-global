
/**
 * MedOrbits -- Payment Provider Configuration
 * File: src/config/payment.js
 *
 * Node.js: >=20
 * Module system: ES Modules
 *
 * Responsibilities:
 * - Centralize payment provider configuration.
 * - Validate provider selection and required credentials.
 * - Prevent ambiguous multi-provider configuration.
 * - Validate payment mode, currency, and provider environment.
 * - Detect common test/live credential mismatches.
 * - Expose immutable internal configuration.
 * - Provide a secret-free public configuration summary.
 *
 * Supported providers:
 * - Razorpay
 * - Cashfree
 * - Stripe
 *
 * IMPORTANT:
 * This module does not create orders, verify payment signatures,
 * process webhooks, issue refunds, or confirm settlements.
 *
 * Payment confirmation must be performed server-side using the
 * provider's official SDK/API and signature-verification procedures.
 */

import { env } from "./env.js";

const SUPPORTED_PROVIDERS = Object.freeze([
  "razorpay",
  "cashfree",
  "stripe",
]);

const SUPPORTED_CURRENCIES = new Set([
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
]);

const SUPPORTED_MODES = new Set([
  "test",
  "live",
]);

const CASHFREE_ENVIRONMENTS = new Set([
  "sandbox",
  "production",
]);

const PROVIDER_ENVIRONMENT_MAP = Object.freeze({
  test: {
    razorpay: "test",
    cashfree: "sandbox",
    stripe: "test",
  },
  live: {
    razorpay: "live",
    cashfree: "production",
    stripe: "live",
  },
});

function isPresent(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function normalizeString(value, fallback = "") {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function requireValue(value, name) {
  if (!isPresent(value)) {
    throw new Error(
      `${name} is required for the enabled payment provider.`,
    );
  }

  return value.trim();
}

/**
 * Recursively freeze plain configuration objects.
 *
 * This prevents accidental mutation of the configuration object.
 * It does not make JavaScript strings or secrets cryptographically
 * secure and does not replace access controls.
 */
function deepFreeze(value) {
  if (
    value !== null &&
    typeof value === "object" &&
    !Object.isFrozen(value)
  ) {
    Object.freeze(value);

    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }

  return value;
}

/**
 * Read the internal payment configuration.
 *
 * WARNING:
 * This object contains payment credentials.
 * Never return it from a public API, serialize it into logs, or expose
 * it to frontend code.
 */
export function getPaymentConfig() {
  const currency = normalizeString(
    env.PAYMENT_CURRENCY,
    "INR",
  ).toUpperCase();

  const mode = normalizeString(
    env.PAYMENT_MODE,
    "test",
  ).toLowerCase();

  const config = {
    enabled: env.PAYMENTS_ENABLED === true,
    mode,
    currency,

    razorpay: {
      enabled: env.RAZORPAY_ENABLED === true,
      keyId: normalizeString(env.RAZORPAY_KEY_ID),
      keySecret: normalizeString(env.RAZORPAY_KEY_SECRET),
      webhookSecret: normalizeString(
        env.RAZORPAY_WEBHOOK_SECRET,
      ),
    },

    cashfree: {
      enabled: env.CASHFREE_ENABLED === true,
      appId: normalizeString(env.CASHFREE_APP_ID),
      secretKey: normalizeString(env.CASHFREE_SECRET_KEY),
      webhookSecret: normalizeString(
        env.CASHFREE_WEBHOOK_SECRET,
      ),
      environment: normalizeString(
        env.CASHFREE_ENVIRONMENT,
        mode === "live" ? "production" : "sandbox",
      ).toLowerCase(),
    },

    stripe: {
      enabled: env.STRIPE_ENABLED === true,
      secretKey: normalizeString(env.STRIPE_SECRET_KEY),
      webhookSecret: normalizeString(
        env.STRIPE_WEBHOOK_SECRET,
      ),
    },
  };

  return deepFreeze(config);
}

/**
 * Validate payment mode.
 */
export function validateMode(mode) {
  if (!SUPPORTED_MODES.has(mode)) {
    throw new Error(
      `PAYMENT_MODE must be one of: ${[
        ...SUPPORTED_MODES,
      ].join(", ")}.`,
    );
  }

  return true;
}

/**
 * Validate the configured currency.
 *
 * This is an application allowlist, not a guarantee that every
 * provider, merchant account, or payment method supports the currency.
 */
export function validateCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    throw new Error(
      `Unsupported PAYMENT_CURRENCY "${currency}".`,
    );
  }

  return true;
}

/**
 * Require exactly one enabled provider.
 */
export function validateProviderSelection(config) {
  const enabledProviders = SUPPORTED_PROVIDERS.filter(
    (provider) => config[provider]?.enabled === true,
  );

  if (enabledProviders.length !== 1) {
    throw new Error(
      "Enable exactly one payment provider when PAYMENTS_ENABLED=true.",
    );
  }

  return enabledProviders[0];
}

/**
 * Detect common test/live credential mismatches.
 *
 * These checks are limited to providers whose key IDs have documented
 * environment prefixes. They do not prove that a credential is valid.
 */
export function validateModeConsistency(
  credential,
  mode,
  variableName,
) {
  const prefixRules = {
    STRIPE_SECRET_KEY: {
      test: "sk_test_",
      live: "sk_live_",
    },

    RAZORPAY_KEY_ID: {
      test: "rzp_test_",
      live: "rzp_live_",
    },
  };

  const rules = prefixRules[variableName];

  if (!rules) {
    return true;
  }

  const expectedPrefix = rules[mode];

  if (!expectedPrefix || !credential.startsWith(expectedPrefix)) {
    throw new Error(
      `${variableName} does not match PAYMENT_MODE=${mode}.`,
    );
  }

  return true;
}

/**
 * Validate Cashfree environment selection.
 *
 * Cashfree credentials should not be assumed to identify the target
 * environment from their format alone. Configure the environment
 * explicitly and ensure the payment integration uses the matching
 * provider API endpoint.
 */
function validateCashfreeEnvironment(payment, mode) {
  if (!CASHFREE_ENVIRONMENTS.has(payment.environment)) {
    throw new Error(
      "CASHFREE_ENVIRONMENT must be sandbox or production.",
    );
  }

  const expectedEnvironment =
    PROVIDER_ENVIRONMENT_MAP[mode].cashfree;

  if (payment.environment !== expectedEnvironment) {
    throw new Error(
      `CASHFREE_ENVIRONMENT must be ${expectedEnvironment} when PAYMENT_MODE=${mode}.`,
    );
  }
}

/**
 * Validate credentials for the selected provider.
 */
export function validateProviderCredentials(config, provider) {
  switch (provider) {
    case "razorpay": {
      const payment = config.razorpay;

      requireValue(payment.keyId, "RAZORPAY_KEY_ID");
      requireValue(
        payment.keySecret,
        "RAZORPAY_KEY_SECRET",
      );
      requireValue(
        payment.webhookSecret,
        "RAZORPAY_WEBHOOK_SECRET",
      );

      validateModeConsistency(
        payment.keyId,
        config.mode,
        "RAZORPAY_KEY_ID",
      );

      break;
    }

    case "cashfree": {
      const payment = config.cashfree;

      requireValue(payment.appId, "CASHFREE_APP_ID");
      requireValue(
        payment.secretKey,
        "CASHFREE_SECRET_KEY",
      );
      requireValue(
        payment.webhookSecret,
        "CASHFREE_WEBHOOK_SECRET",
      );

      validateCashfreeEnvironment(payment, config.mode);

      break;
    }

    case "stripe": {
      const payment = config.stripe;

      requireValue(
        payment.secretKey,
        "STRIPE_SECRET_KEY",
      );
      requireValue(
        payment.webhookSecret,
        "STRIPE_WEBHOOK_SECRET",
      );

      validateModeConsistency(
        payment.secretKey,
        config.mode,
        "STRIPE_SECRET_KEY",
      );

      break;
    }

    default:
      throw new Error("Unsupported payment provider.");
  }

  return true;
}

/**
 * Validate the full payment configuration.
 *
 * When payments are disabled, provider credentials are not required.
 * Enabled provider flags must still be reviewed by deployment policy;
 * this implementation permits them to be configured while the global
 * payment switch is off.
 */
export function validatePaymentConfiguration() {
  const config = getPaymentConfig();

  if (!config.enabled) {
    return {
      valid: true,
      enabled: false,
      provider: null,
      mode: config.mode,
      currency: config.currency,
    };
  }

  validateMode(config.mode);
  validateCurrency(config.currency);

  const provider = validateProviderSelection(config);

  validateProviderCredentials(config, provider);

  return {
    valid: true,
    enabled: true,
    provider,
    mode: config.mode,
    currency: config.currency,
  };
}

/**
 * Return a safe summary for diagnostics or internal health endpoints.
 *
 * No payment keys, API secrets, or webhook secrets are returned.
 */
export function getPaymentStatus() {
  const config = getPaymentConfig();

  return Object.freeze({
    enabled: config.enabled,
    mode: config.mode,
    currency: config.currency,
    provider: config.enabled
      ? SUPPORTED_PROVIDERS.find(
          (provider) => config[provider].enabled,
        ) ?? null
      : null,
  });
}

const paymentConfigService = Object.freeze({
  getPaymentConfig,
  validatePaymentConfiguration,
  validateProviderSelection,
  validateProviderCredentials,
  validateModeConsistency,
  validateMode,
  validateCurrency,
  getPaymentStatus,
});

export default paymentConfigService;
