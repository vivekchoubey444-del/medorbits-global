'use strict';
/**
 * MedOrbits -- Payment Checkout E2E Tests
 *
 * File: tests/e2e/payment-checkout.e2e.test.js
 * Framework: Playwright Test
 *
 * Run:
 *   npx playwright test tests/e2e/payment-checkout.e2e.test.js
 *
 * Environment:
 *   E2E_BASE_URL
 *   E2E_CHECKOUT_PATH
 *   E2E_LOGIN_PATH
 *   E2E_USER_EMAIL
 *   E2E_USER_PASSWORD
 *
 * Optional:
 *   E2E_CHECKOUT_REQUIRES_AUTH=true
 *   E2E_PAYMENT_MODE=mock
 *   E2E_ALLOW_PAYMENT_SUBMISSION=true
 *
 * Security:
 * - Use a dedicated test environment and synthetic accounts.
 * - Use deterministic mock payments or provider sandbox credentials.
 * - Never use live payment credentials or real card details.
 * - Never treat a redirect or browser message as proof of settlement.
 * - Verify amount, currency, ownership, and final status server-side.
 */
const { test, expect } = require('@playwright/test');
const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const ROUTES = Object.freeze({
  checkout: process.env.E2E_CHECKOUT_PATH || '/checkout',
  login: process.env.E2E_LOGIN_PATH || '/login',
});
const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;
const REQUIRES_AUTH =
  process.env.E2E_CHECKOUT_REQUIRES_AUTH === 'true';
const PAYMENT_MODE = (
  process.env.E2E_PAYMENT_MODE || 'mock'
).trim().toLowerCase();
const ALLOW_PAYMENT_SUBMISSION =
  process.env.E2E_ALLOW_PAYMENT_SUBMISSION === 'true';
const TIMEOUT = 15000;
const SELECTORS = Object.freeze({
  checkoutForm: [
    'form[data-testid="checkout-form"]',
    'form#checkout-form',
    'form[name="checkout"]',
    'form',
  ],
  amount: [
    '[data-testid="checkout-amount"]',
    '[data-testid="payment-amount"]',
    '[name="amount"]',
    '#amount',
    '.checkout-amount',
  ],
  currency: [
    '[data-testid="checkout-currency"]',
    '[name="currency"]',
    '#currency',
  ],
  submit: [
    'button[data-testid="pay-button"]',
    'button[type="submit"]',
    'button:has-text("Pay now")',
    'button:has-text("Pay Now")',
    'button:has-text("Proceed to payment")',
    'button:has-text("Continue to payment")',
  ],
  success: [
    '[data-testid="payment-success"]',
    '.payment-success',
  ],
  failure: [
    '[data-testid="payment-error"]',
    '.payment-error',
  ],
  cancel: [
    '[data-testid="cancel-payment"]',
    'a:has-text("Cancel")',
    'button:has-text("Cancel payment")',
    'button:has-text("Cancel Payment")',
  ],
});
function hasCredentials() {
  return Boolean(
    USER_EMAIL?.trim() && USER_PASSWORD?.trim()
  );
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function normalizedPath(path) {
  return path.replace(/\/+$/, '') || '/';
}
function currentPath(page) {
  return normalizedPath(new URL(page.url()).pathname);
}
function loginPath() {
  return normalizedPath(
    new URL(`${BASE_URL}${ROUTES.login}`).pathname
  );
}
function isLoginPage(page) {
  const path = currentPath(page);
  const login = loginPath();
  return path === login || path.startsWith(`${login}/`);
}
async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  return null;
}
async function requiredVisible(page, selectors, description) {
  const locator = await firstVisible(page, selectors);
  if (!locator) {
    throw new Error(
      `Could not locate ${description}. ` +
      'Update the selectors to match the MedOrbits checkout interface.'
    );
  }
  return locator;
}
async function login(page) {
  if (!hasCredentials()) {
    throw new Error(
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated checkout tests.'
    );
  }
  await page.goto(`${BASE_URL}${ROUTES.login}`, {
    waitUntil: 'domcontentloaded',
  });
  const email = await requiredVisible(
    page,
    ['input[name="email"]', 'input[type="email"]', '#email'],
    'login email field'
  );
  const password = await requiredVisible(
    page,
    ['input[name="password"]', 'input[type="password"]', '#password'],
    'login password field'
  );
  await email.fill(USER_EMAIL);
  await password.fill(USER_PASSWORD);
  const submit = await requiredVisible(
    page,
    [
      'button[type="submit"]',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
      'button:has-text("Login")',
    ],
    'login submit button'
  );
  await submit.click();
  await expect
    .poll(
      () => !isLoginPage(page),
      { timeout: TIMEOUT }
    )
    .toBeTruthy();
}
async function openCheckout(page) {
  await page.goto(`${BASE_URL}${ROUTES.checkout}`, {
    waitUntil: 'domcontentloaded',
  });
  if (REQUIRES_AUTH && isLoginPage(page)) {
    test.skip(
      !hasCredentials(),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated checkout tests.'
    );
    await login(page);
    await page.goto(`${BASE_URL}${ROUTES.checkout}`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await expect(page.locator('body')).toBeVisible();
}
async function readAmount(page) {
  const element = await firstVisible(page, SELECTORS.amount);
  if (!element) return null;
  const tagName = await element.evaluate(
    (node) => node.tagName.toLowerCase()
  );
  if (['input', 'select', 'textarea'].includes(tagName)) {
    const value = await element.inputValue().catch(() => '');
    if (value.trim()) return value.trim();
  }
  const text = await element.textContent();
  return text?.trim() || null;
}
async function readCurrency(page) {
  const element = await firstVisible(page, SELECTORS.currency);
  if (!element) return null;
  const tagName = await element.evaluate(
    (node) => node.tagName.toLowerCase()
  );
  if (['input', 'select', 'textarea'].includes(tagName)) {
    const value = await element.inputValue().catch(() => '');
    if (value.trim()) return value.trim();
  }
  const text = await element.textContent();
  return text?.trim() || null;
}
async function assertNoSensitiveError(page) {
  await expect(page.locator('body')).not.toContainText(
    /stack trace|sqlstate|database connection string|password hash|webhook signing secret/i
  );
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(
    /\bsk_live_[A-Za-z0-9]+\b|\brk_live_[A-Za-z0-9]+\b/
  );
}
async function assertPaymentModeIsSafe() {
  expect(
    ['mock', 'sandbox'].includes(PAYMENT_MODE),
    'E2E_PAYMENT_MODE must be "mock" or "sandbox". Live payment tests are prohibited.'
  ).toBe(true);
}
async function requireSafeSubmissionTest() {
  await assertPaymentModeIsSafe();
  test.skip(
    !ALLOW_PAYMENT_SUBMISSION,
    'Set E2E_ALLOW_PAYMENT_SUBMISSION=true only in a dedicated test environment with a mock or sandbox payment provider.'
  );
}
test.describe('MedOrbits payment checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: 1365,
      height: 900,
    });
  });
  test('checkout page loads without a server error', async ({ page }) => {
    await openCheckout(page);
    await expect(page.locator('body')).not.toContainText(
      /internal server error|uncaught exception|application crashed/i
    );
    await assertNoSensitiveError(page);
  });
  test('checkout displays a payment amount', async ({ page }) => {
    await openCheckout(page);
    const amount = await readAmount(page);
    expect(
      amount,
      'Checkout should display an amount using a configured selector.'
    ).not.toBeNull();
    expect(amount.trim()).not.toBe('');
  });
  test('checkout displays a non-negative monetary amount', async ({
    page,
  }) => {
    await openCheckout(page);
    const amountText = await readAmount(page);
    test.skip(
      !amountText,
      'No checkout amount is exposed by the configured selectors.'
    );
    const match = amountText
      .replace(/,/g, '')
      .match(/-?\d+(?:\.\d{1,2})?/);
    expect(
      match,
      `Could not parse a monetary amount from "${amountText}".`
    ).not.toBeNull();
    const amount = Number(match[0]);
    expect(Number.isFinite(amount)).toBe(true);
    expect(amount).toBeGreaterThanOrEqual(0);
  });
  test('checkout displays a currency when the UI exposes one', async ({
    page,
  }) => {
    await openCheckout(page);
    const currency = await readCurrency(page);
    test.skip(
      !currency,
      'No currency field or display element is configured.'
    );
    expect(currency.trim()).not.toBe('');
  });
  test('checkout provides a payment action', async ({ page }) => {
    await openCheckout(page);
    const submit = await requiredVisible(
      page,
      SELECTORS.submit,
      'checkout payment button'
    );
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });
  test('checkout does not expose payment secrets', async ({ page }) => {
    await openCheckout(page);
    await assertNoSensitiveError(page);
  });
  test('checkout form blocks empty required fields', async ({ page }) => {
    await openCheckout(page);
    const form = await firstVisible(page, SELECTORS.checkoutForm);
    test.skip(
      !form,
      'No checkout form is exposed; payment may be provider-hosted.'
    );
    const submit = await firstVisible(page, SELECTORS.submit);
    test.skip(
      !submit,
      'No checkout submit control is available.'
    );
    const requiredInputs = form.locator(
      'input[required], select[required], textarea[required]'
    );
    const requiredCount = await requiredInputs.count();
    test.skip(
      requiredCount === 0,
      'The checkout form has no native required fields; configure custom validation assertions.'
    );
    await submit.click();
    const invalidCount = await requiredInputs.evaluateAll(
      (elements) =>
        elements.filter((element) => !element.checkValidity()).length
    );
    const error = page.getByText(
      /required field|please enter|please select|complete this field/i
    ).first();
    const hasError = await error.isVisible().catch(() => false);
    expect(
      invalidCount > 0 || hasError,
      'Expected checkout validation to block an incomplete submission.'
    ).toBeTruthy();
  });
  test('cancel action does not report a successful payment', async ({
    page,
  }) => {
    await openCheckout(page);
    const cancel = await firstVisible(page, SELECTORS.cancel);
    test.skip(
      !cancel,
      'No cancellation control exists on this checkout screen.'
    );
    await cancel.click();
    const success = await firstVisible(page, SELECTORS.success);
    expect(
      success,
      'A cancelled checkout must not show the configured payment-success element.'
    ).toBeNull();
  });
  test('payment submission is explicitly restricted to mock or sandbox mode', async () => {
    await assertPaymentModeIsSafe();
  });
  test('payment submission can be exercised only when explicitly enabled', async ({
    page,
  }) => {
    await requireSafeSubmissionTest();
    test.skip(
      REQUIRES_AUTH && !hasCredentials(),
      'Authenticated checkout requires E2E_USER_EMAIL and E2E_USER_PASSWORD.'
    );
    await openCheckout(page);
    const submit = await requiredVisible(
      page,
      SELECTORS.submit,
      'checkout payment button'
    );
    // This test deliberately does not click the payment button.
    // Actual payment submission needs a deterministic mock/sandbox
    // adapter and a server-side status assertion.
    await expect(submit).toBeVisible();
    test.skip(
      true,
      'Add the configured mock/sandbox payment flow and verify the resulting server-side payment status before enabling this test.'
    );
  });
  test('unauthenticated users cannot access a protected checkout', async ({
    page,
  }) => {
    test.skip(
      !REQUIRES_AUTH,
      'Set E2E_CHECKOUT_REQUIRES_AUTH=true if checkout requires authentication.'
    );
    const response = await page.goto(
      `${BASE_URL}${ROUTES.checkout}`,
      { waitUntil: 'domcontentloaded' }
    );
    const currentPath = currentPathname(page);
    const login = loginPath();
    const redirectedToLogin =
      currentPath === login || currentPath.startsWith(`${login}/`);
    const deniedStatus = [401, 403].includes(response?.status());
    const deniedMessage = page.getByText(
      /access denied|not authorized|forbidden|please log in|sign in to continue/i
    ).first();
    const messageVisible = await deniedMessage
      .isVisible()
      .catch(() => false);
    expect(
      redirectedToLogin || deniedStatus || messageVisible,
      `Expected unauthenticated checkout access to be denied. URL: ${page.url()}`
    ).toBeTruthy();
  });
});
function currentPathname(page) {
  return new URL(page.url()).pathname.replace(/\/+$/, '') || '/';
}
function loginPath() {
  return new URL(`${BASE_URL}${ROUTES.login}`)
    .pathname.replace(/\/+$/, '') || '/';
}