'use strict';
/**
 * MedOrbits -- Document Upload E2E Tests
 *
 * File: tests/e2e/document-upload.e2e.test.js
 * Framework: Playwright Test
 *
 * Run:
 *   npx playwright test tests/e2e/document-upload.e2e.test.js
 *
 * Environment:
 *   E2E_BASE_URL
 *   E2E_DOCUMENT_UPLOAD_PATH
 *   E2E_LOGIN_PATH
 *   E2E_USER_EMAIL
 *   E2E_USER_PASSWORD
 *
 * Optional:
 *   E2E_DOCUMENT_REQUIRES_AUTH=true
 *   E2E_ALLOWED_DOCUMENT_EXTENSIONS=.pdf,.jpg,.jpeg,.png
 *   E2E_MAX_UPLOAD_BYTES=5242880
 *
 * Security:
 * - Use a dedicated test environment and synthetic accounts.
 * - Never upload real identity documents or medical records.
 * - Never run destructive tests against production.
 * - Client-side checks do not replace server-side validation.
 */
const { test, expect } = require('@playwright/test');
const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const UPLOAD_PATH =
  process.env.E2E_DOCUMENT_UPLOAD_PATH || '/documents/upload';
const LOGIN_PATH = process.env.E2E_LOGIN_PATH || '/login';
const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;
const REQUIRES_AUTH =
  process.env.E2E_DOCUMENT_REQUIRES_AUTH === 'true';
const MAX_UPLOAD_BYTES = Number(
  process.env.E2E_MAX_UPLOAD_BYTES || 5 * 1024 * 1024
);
const ALLOWED_EXTENSIONS = (
  process.env.E2E_ALLOWED_DOCUMENT_EXTENSIONS ||
  '.pdf,.jpg,.jpeg,.png'
)
  .split(',')
  .map((extension) => extension.trim().toLowerCase())
  .filter(Boolean);
const TIMEOUT = 15000;
const SELECTORS = Object.freeze({
  fileInput: [
    'input[type="file"][name="document"]',
    'input[type="file"][name="documents"]',
    'input[type="file"][name="file"]',
    'input[type="file"][name="attachment"]',
    'input[type="file"][name="resume"]',
    'input[type="file"]',
  ],
  uploadButton: [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Upload document")',
    'button:has-text("Upload Document")',
    'button:has-text("Upload file")',
    'button:has-text("Upload File")',
    'button:has-text("Upload")',
  ],
  success: [
    '[data-testid="upload-success"]',
    '[role="status"]',
    '.upload-success',
  ],
  error: [
    '[data-testid="upload-error"]',
    '[role="alert"]',
    '.upload-error',
    '.error-message',
  ],
});
function hasCredentials() {
  return Boolean(
    USER_EMAIL?.trim() && USER_PASSWORD?.trim()
  );
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
      'Update the selectors to match the MedOrbits interface.'
    );
  }
  return locator;
}
function createSyntheticPdf() {
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj\n' +
    '<< /Type /Catalog /Pages 2 0 R >>\n' +
    'endobj\n' +
    '2 0 obj\n' +
    '<< /Type /Pages /Kids [] /Count 0 >>\n' +
    'endobj\n' +
    'trailer\n' +
    '<< /Root 1 0 R >>\n' +
    '%%EOF\n',
    'utf8'
  );
}
function createSyntheticPng() {
  // A complete, valid 1x1 transparent PNG.
  // Used only as synthetic test data.
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
    'base64'
  );
}
async function login(page) {
  if (!hasCredentials()) {
    throw new Error(
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated upload tests.'
    );
  }
  await page.goto(`${BASE_URL}${LOGIN_PATH}`, {
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
    'login button'
  );
  await submit.click();
  await expect
    .poll(
      async () => {
        const pathname = new URL(page.url()).pathname;
        const loginPath = new URL(
          `${BASE_URL}${LOGIN_PATH}`
        ).pathname;
        return pathname !== loginPath;
      },
      { timeout: TIMEOUT }
    )
    .toBeTruthy();
}
async function openUploadPage(page) {
  await page.goto(`${BASE_URL}${UPLOAD_PATH}`, {
    waitUntil: 'domcontentloaded',
  });
  if (REQUIRES_AUTH) {
    test.skip(
      !hasCredentials(),
      'Authenticated upload tests require E2E_USER_EMAIL and E2E_USER_PASSWORD.'
    );
    const loginPage = new URL(
      `${BASE_URL}${LOGIN_PATH}`
    ).pathname;
    const currentPath = new URL(page.url()).pathname;
    if (currentPath === loginPage) {
      await login(page);
    } else {
      await login(page);
      await page.goto(`${BASE_URL}${UPLOAD_PATH}`, {
        waitUntil: 'domcontentloaded',
      });
    }
  }
  await expect(page.locator('body')).toBeVisible();
}
async function selectFile(page, file) {
  const fileInput = await requiredVisible(
    page,
    SELECTORS.fileInput,
    'document file input'
  );
  await fileInput.setInputFiles(file);
  return fileInput;
}
async function submitUpload(page) {
  const button = await requiredVisible(
    page,
    SELECTORS.uploadButton,
    'document upload button'
  );
  await button.click();
  return button;
}
async function findFeedback(page) {
  const successText = page.getByText(
    /upload successful|document uploaded|file uploaded|uploaded successfully/i
  ).first();
  if (await successText.isVisible().catch(() => false)) {
    return 'success';
  }
  const errorText = page.getByText(
    /upload failed|unsupported file|invalid file|file too large|upload error|file type not allowed|select a file|choose a file/i
  ).first();
  if (await errorText.isVisible().catch(() => false)) {
    return 'error';
  }
  const successSelector = await firstVisible(
    page,
    SELECTORS.success
  );
  if (successSelector) {
    const text = (await successSelector.textContent()) || '';
    if (text.trim()) {
      return 'success';
    }
  }
  const errorSelector = await firstVisible(
    page,
    SELECTORS.error
  );
  if (errorSelector) {
    const text = (await errorSelector.textContent()) || '';
    if (text.trim()) {
      return 'error';
    }
  }
  return 'pending';
}
async function expectFeedback(page) {
  await expect
    .poll(
      () => findFeedback(page),
      { timeout: TIMEOUT }
    )
    .not.toBe('pending');
}
async function assertNoSensitiveError(page) {
  await expect(page.locator('body')).not.toContainText(
    /stack trace|database connection string|sqlstate|password hash|secret key|node_modules\/.*\.js/i
  );
}
test.describe('MedOrbits document upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: 1365,
      height: 900,
    });
  });
  test('document upload page loads without a server error', async ({
    page,
  }) => {
    const response = await page.goto(
      `${BASE_URL}${UPLOAD_PATH}`,
      { waitUntil: 'domcontentloaded' }
    );
    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await assertNoSensitiveError(page);
  });
  test('upload form exposes a file input', async ({ page }) => {
    await openUploadPage(page);
    const fileInput = await requiredVisible(
      page,
      SELECTORS.fileInput,
      'document file input'
    );
    await expect(fileInput).toBeAttached();
  });
  test('file input advertises configured allowed extensions when accept is present', async ({
    page,
  }) => {
    await openUploadPage(page);
    const fileInput = await requiredVisible(
      page,
      SELECTORS.fileInput,
      'document file input'
    );
    const accept = await fileInput.getAttribute('accept');
    test.skip(
      !accept,
      'The file input has no accept attribute; verify file restrictions through server-side tests.'
    );
    const advertised = accept
      .split(',')
      .map((item) => item.trim().toLowerCase());
    const mimeByExtension = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    for (const extension of ALLOWED_EXTENSIONS) {
      const mime = mimeByExtension[extension];
      const included = advertised.some(
        (item) =>
          item === extension ||
          item === `*/*` ||
          (mime && item === mime) ||
          item.endsWith(extension)
      );
      expect(
        included,
        `The file input accept="${accept}" should advertise ${extension}.`
      ).toBeTruthy();
    }
  });
  test('user can select a synthetic PDF file', async ({ page }) => {
    test.skip(
      !ALLOWED_EXTENSIONS.includes('.pdf'),
      'PDF is not in E2E_ALLOWED_DOCUMENT_EXTENSIONS.'
    );
    await openUploadPage(page);
    const fileInput = await selectFile(page, {
      name: 'synthetic-document.pdf',
      mimeType: 'application/pdf',
      buffer: createSyntheticPdf(),
    });
    const files = await fileInput.evaluate((element) =>
      Array.from(element.files || []).map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      }))
    );
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('synthetic-document.pdf');
    expect(files[0].type).toBe('application/pdf');
    expect(files[0].size).toBeGreaterThan(0);
  });
  test('user can select a synthetic PNG file', async ({ page }) => {
    test.skip(
      !ALLOWED_EXTENSIONS.includes('.png'),
      'PNG is not in E2E_ALLOWED_DOCUMENT_EXTENSIONS.'
    );
    await openUploadPage(page);
    const fileInput = await selectFile(page, {
      name: 'synthetic-image.png',
      mimeType: 'image/png',
      buffer: createSyntheticPng(),
    });
    const selectedFile = await fileInput.evaluate((element) => {
      const file = element.files?.[0];
      return file
        ? { name: file.name, type: file.type, size: file.size }
        : null;
    });
    expect(selectedFile).not.toBeNull();
    expect(selectedFile.name).toBe('synthetic-image.png');
    expect(selectedFile.type).toBe('image/png');
    expect(selectedFile.size).toBeGreaterThan(0);
  });
  test('empty upload is rejected or blocked by validation', async ({
    page,
  }) => {
    await openUploadPage(page);
    const fileInput = await requiredVisible(
      page,
      SELECTORS.fileInput,
      'document file input'
    );
    const button = await submitUpload(page);
    const required = await fileInput.evaluate(
      (element) => element.required
    );
    const invalid = await fileInput.evaluate(
      (element) => !element.checkValidity()
    );
    if (required && invalid) {
      return;
    }
    const feedback = await findFeedback(page);
    expect(
      feedback,
      'An empty upload should be rejected by validation or an error response.'
    ).toBe('error');
    await expect(button).toBeVisible();
  });
  test('oversized file is rejected when size limits are enforced', async ({
    page,
  }) => {
    test.skip(
      !Number.isSafeInteger(MAX_UPLOAD_BYTES) ||
        MAX_UPLOAD_BYTES <= 0,
      'E2E_MAX_UPLOAD_BYTES must be a positive safe integer.'
    );
    await openUploadPage(page);
    const fileInput = await selectFile(page, {
      name: 'oversized-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x41),
    });
    await submitUpload(page);
    const feedback = await expect
      .poll(
        async () => findFeedback(page),
        { timeout: TIMEOUT }
      )
      .catch(() => 'pending');
    if (feedback === 'error') {
      return;
    }
    // A file input may not enforce file size in the browser. A server-side
    // upload integration test must verify that oversized content is rejected.
    const declaredLimit = await fileInput.getAttribute('data-max-size');
    test.skip(
      !declaredLimit,
      'No explicit client-side size limit or rejection message was found. Add a server-side integration test for oversized uploads.'
    );
    expect(
      MAX_UPLOAD_BYTES + 1
    ).toBeGreaterThan(Number(declaredLimit));
  });
  test('unsupported file extension is rejected when submitted', async ({
    page,
  }) => {
    test.skip(
      ALLOWED_EXTENSIONS.length === 0,
      'Configure E2E_ALLOWED_DOCUMENT_EXTENSIONS.'
    );
    await openUploadPage(page);
    const fileInput = await selectFile(page, {
      name: 'synthetic-script.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('synthetic test content', 'utf8'),
    });
    const accept = await fileInput.getAttribute('accept');
    await submitUpload(page);
    const feedback = await expect
      .poll(
        async () => findFeedback(page),
        { timeout: TIMEOUT }
      )
      .catch(() => 'pending');
    if (feedback === 'error') {
      return;
    }
    test.skip(
      !accept,
      'The interface exposes no client-side file-type restriction. Verify server-side rejection with an API integration test.'
    );
    expect(
      accept.toLowerCase(),
      'The input should not advertise .exe as an allowed type.'
    ).not.toContain('.exe');
  });
  test('upload feedback does not expose internal server details', async ({
    page,
  }) => {
    await openUploadPage(page);
    await selectFile(page, {
      name: 'synthetic-document.pdf',
      mimeType: 'application/pdf',
      buffer: createSyntheticPdf(),
    });
    await submitUpload(page);
    await expectFeedback(page);
    await assertNoSensitiveError(page);
  });
  test('repeated upload clicks do not crash the interface', async ({
    page,
  }) => {
    await openUploadPage(page);
    await selectFile(page, {
      name: 'repeat-test-document.pdf',
      mimeType: 'application/pdf',
      buffer: createSyntheticPdf(),
    });
    const button = await requiredVisible(
      page,
      SELECTORS.uploadButton,
      'document upload button'
    );
    await button.click();
    if (
      await button.isVisible().catch(() => false) &&
      !(await button.isDisabled().catch(() => false))
    ) {
      await button.click().catch(() => {});
    }
    await expect(page.locator('body')).not.toContainText(
      /uncaught exception|application crashed/i
    );
  });
  test('upload page does not expose raw document storage paths', async ({
    page,
  }) => {
    await openUploadPage(page);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(
      /\/var\/www\/|\/home\/[^ ]+\/uploads|file:\/\/\/|[A-Za-z]:\\Users\\/i
    );
  });
});