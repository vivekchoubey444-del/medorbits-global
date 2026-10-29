
/**
 * MedOrbits -- Lead API Route Tests
 * File: app/api/lead/route.test.js
 *
 * Framework: Jest
 * Environment: Node.js
 *
 * Run:
 *   npx jest app/api/lead/route.test.js --runInBand
 *
 * These tests mock the database layer and do not connect to production
 * services or modify real customer data.
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockQuery = jest.fn();

jest.unstable_mockModule("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: jest.fn(),
  })),
}));

const { POST, GET, PUT, PATCH, DELETE } = await import("./route.js");

function makeRequest({
  method = "POST",
  body,
  headers = {},
} = {}) {
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  return new Request("http://localhost/api/lead", {
    method,
    headers: requestHeaders,
    ...(body !== undefined
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
}

const validLead = {
  name: "Example User",
  email: "user@example.com",
  phone: "+919876543210",
  course: "MBBS",
  message: "Please provide admission guidance.",
};

describe("MedOrbits Lead API", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.DATABASE_URL =
      "postgresql://test:test@localhost:5432/medorbits_test";

    delete process.env.ALLOWED_ORIGINS;

    mockQuery.mockResolvedValue({
      rows: [{ id: "lead-test-1" }],
      rowCount: 1,
    });
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }

    Object.assign(process.env, originalEnv);
  });

  test("accepts a valid lead and returns 201", async () => {
    const response = await POST(makeRequest({ body: validLead }));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.success).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("uses parameterized SQL rather than interpolating user input", async () => {
    await POST(makeRequest({ body: validLead }));

    const [sql, values] = mockQuery.mock.calls[0];

    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
    expect(values).toEqual(expect.arrayContaining([
      validLead.name,
      validLead.email,
    ]));
  });

  test("rejects malformed JSON", async () => {
    const response = await POST(
      makeRequest({
        body: "{invalid-json",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects a non-object JSON body", async () => {
    const response = await POST(makeRequest({ body: ["unexpected"] }));

    expect(response.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects missing required fields", async () => {
    const response = await POST(
      makeRequest({ body: { name: "Example User" } }),
    );

    expect(response.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects an invalid email address", async () => {
    const response = await POST(
      makeRequest({
        body: { ...validLead, email: "not-an-email" },
      }),
    );

    expect(response.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects non-JSON content types", async () => {
    const response = await POST(
      makeRequest({
        body: "name=Example",
        headers: { "content-type": "text/plain" },
      }),
    );

    expect(response.status).toBe(415);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects requests above the declared size limit", async () => {
    const response = await POST(
      makeRequest({
        body: validLead,
        headers: { "content-length": String(1024 * 1024) },
      }),
    );

    expect(response.status).toBe(413);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects a disallowed browser origin when an allowlist is configured", async () => {
    process.env.ALLOWED_ORIGINS = "https://medorbits.in";

    const response = await POST(
      makeRequest({
        body: validLead,
        headers: { origin: "https://malicious.example" },
      }),
    );

    expect(response.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("accepts an allowed browser origin", async () => {
    process.env.ALLOWED_ORIGINS = "https://medorbits.in";

    const response = await POST(
      makeRequest({
        body: validLead,
        headers: { origin: "https://medorbits.in" },
      }),
    );

    expect(response.status).toBe(201);
  });

  test("returns 503 when database insertion fails", async () => {
    mockQuery.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST(makeRequest({ body: validLead }));
    const result = await response.json();

    expect(response.status).toBe(503);
    expect(result.error).not.toContain("database unavailable");
  });

  test.each([
    ["GET", GET],
    ["PUT", PUT],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
  ])("%s is not allowed", async (_method, handler) => {
    const response = await handler();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  test("responses include a no-store cache policy", async () => {
    const response = await POST(makeRequest({ body: validLead }));

    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
