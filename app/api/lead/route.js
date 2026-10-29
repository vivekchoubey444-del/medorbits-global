
/**
 * MedOrbits -- Lead API
 * File: app/api/lead/route.js
 *
 * Runtime: Node.js
 * Database: PostgreSQL
 *
 * Required environment:
 *   DATABASE_URL
 *   ALLOWED_ORIGINS
 */

import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

const LIMITS = {
  name: 120,
  email: 254,
  phone: 30,
  course: 160,
  message: 5000
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9().\-\s]{7,30}$/;

let pool;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ...(process.env.NODE_ENV === "production"
      ? { ssl: { rejectUnauthorized: true } }
      : {})
  });

  return pool;
}

function json(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function allowedOrigin(request) {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // Fail closed in production if no allowlist has been configured.
  if (configured.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  const origin = request.headers.get("origin");

  // Requests without an Origin header may come from server-side clients.
  // Origin checks are not authentication.
  if (!origin) return true;

  return configured.includes(origin);
}

function textField(value, maxLength) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();

  if (normalized.length > maxLength) return null;

  return normalized;
}

function methodNotAllowed() {
  return json(
    { success: false, error: "Method not allowed." },
    405,
    { Allow: "POST" }
  );
}

export async function POST(request) {
  if (!allowedOrigin(request)) {
    return json(
      { success: false, error: "Origin not allowed." },
      403
    );
  }

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return json(
      { success: false, error: "Content-Type must be application/json." },
      415
    );
  }

  const declaredLength = Number(
    request.headers.get("content-length") || 0
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_BODY_BYTES
  ) {
    return json(
      { success: false, error: "Request body too large." },
      413
    );
  }

  let rawBody;

  try {
    rawBody = await request.text();
  } catch {
    return json(
      { success: false, error: "Unable to read request body." },
      400
    );
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json(
      { success: false, error: "Request body too large." },
      413
    );
  }

  let body;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return json(
      { success: false, error: "Invalid JSON body." },
      400
    );
  }

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return json(
      { success: false, error: "JSON body must be an object." },
      400
    );
  }

  // Honeypot: silently accept bot submissions without storing them.
  if (
    typeof body.website === "string" &&
    body.website.trim() !== ""
  ) {
    return json({
      success: true,
      message: "Lead submitted successfully."
    }, 201);
  }

  const name = textField(body.name, LIMITS.name);
  const email = textField(body.email, LIMITS.email);
  const phone = body.phone === undefined || body.phone === ""
    ? ""
    : textField(body.phone, LIMITS.phone);
  const course = textField(body.course, LIMITS.course);
  const message = body.message === undefined || body.message === ""
    ? ""
    : textField(body.message, LIMITS.message);

  if (
    name === null ||
    email === null ||
    course === null ||
    phone === null ||
    message === null
  ) {
    return json(
      {
        success: false,
        error: "One or more fields are invalid or exceed their length limit."
      },
      400
    );
  }

  if (!name || !email || !course) {
    return json(
      {
        success: false,
        error: "Name, email, and course are required."
      },
      400
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return json(
      { success: false, error: "Enter a valid email address." },
      400
    );
  }

  if (phone && !PHONE_REGEX.test(phone)) {
    return json(
      { success: false, error: "Enter a valid phone number." },
      400
    );
  }

  try {
    const result = await getPool().query(
      `INSERT INTO leads
        (name, email, phone, course, message, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [
        name,
        email,
        phone || null,
        course,
        message || null
      ]
    );

    return json(
      {
        success: true,
        message: "Lead submitted successfully.",
        id: result.rows[0].id
      },
      201
    );
  } catch (error) {
    // Do not expose database details or submitted personal information.
    console.error(
      "[medorbits-lead-api] Database submission failed:",
      error?.code || "UNKNOWN_ERROR"
    );

    return json(
      {
        success: false,
        error: "Unable to submit your enquiry right now."
      },
      503
    );
  }
}

export async function GET() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
