
/**
 * MedOrbits -- Contact API
 * File: app/api/contact/routes.js
 *
 * Runtime: Next.js App Router (Node.js)
 *
 * Required environment variables:
 *   DATABASE_URL
 *   ALLOWED_ORIGINS (comma-separated, optional)
 *
 * POST /api/contact
 *   Validates and stores a contact enquiry in PostgreSQL.
 *
 * GET /api/contact
 *   Returns 405; submissions are write-only through this route.
 */

import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 180;
const MAX_MESSAGE_LENGTH = 5000;

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ...(process.env.NODE_ENV === "production"
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
    });
  }

  return pool;
}

function json(data, status = 200, headers = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function checkOrigin(request) {
  const allowed = getAllowedOrigins();

  // If configured, enforce the allowlist for browser-origin requests.
  const origin = request.headers.get("origin");

  if (origin && allowed.length > 0 && !allowed.includes(origin)) {
    return false;
  }

  return true;
}

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function validEmail(email) {
  return (
    email.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

export async function POST(request) {
  if (!checkOrigin(request)) {
    return json({ error: "Origin not allowed." }, 403);
  }

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);

  if (declaredLength > MAX_BODY_BYTES) {
    return json({ error: "Request body is too large." }, 413);
  }

  let rawBody;

  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "Unable to read request body." }, 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "Request body is too large." }, 413);
  }

  let body;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Request body must be a JSON object." }, 400);
  }

  const name = normalizeText(body.name, MAX_NAME_LENGTH);
  const email = normalizeText(body.email, MAX_EMAIL_LENGTH).toLowerCase();
  const subject = normalizeText(body.subject, MAX_SUBJECT_LENGTH);
  const message = normalizeText(body.message, MAX_MESSAGE_LENGTH);

  if (!name || !email || !subject || !message) {
    return json(
      { error: "Name, email, subject, and message are required." },
      400,
    );
  }

  if (!validEmail(email)) {
    return json({ error: "Please provide a valid email address." }, 400);
  }

  if (
    name.length > MAX_NAME_LENGTH ||
    subject.length > MAX_SUBJECT_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return json({ error: "One or more fields exceed the allowed length." }, 400);
  }

  // Optional honeypot field for simple bot filtering.
  if (typeof body.website === "string" && body.website.trim()) {
    // Do not reveal honeypot detection to automated submitters.
    return json({ success: true, message: "Contact request received." }, 201);
  }

  try {
    const db = getPool();

    const result = await db.query(
      `INSERT INTO contact_messages
         (name, email, subject, message, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [name, email, subject, message],
    );

    return json(
      {
        success: true,
        message: "Your contact request has been received.",
        id: result.rows[0].id,
      },
      201,
    );
  } catch (error) {
    // Keep database details out of client responses.
    console.error("[contact-api] Submission failed:", error.message);

    return json(
      { error: "Unable to submit your request right now. Please try again later." },
      503,
    );
  }
}

export async function GET() {
  return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
}

export async function PUT() {
  return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
}

export async function PATCH() {
  return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
}

export async function DELETE() {
  return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
}
