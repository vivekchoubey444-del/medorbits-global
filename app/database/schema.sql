-- MedOrbits API submissions schema (PostgreSQL)
-- Apply with your normal migration process; do not expose this file publicly.
CREATE TABLE IF NOT EXISTS api_submissions (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('contact', 'lead')),
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_submissions_kind_created_idx
  ON api_submissions (kind, created_at DESC);
