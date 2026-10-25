
-- =============================================================================
-- MedOrbits: Audit Log Queries
-- File: database/queries/audit-log.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- PURPOSE
--   Reusable queries for application audit events and security investigations.
--
-- EXPECTED TABLE
--   audit_logs
--
-- EXPECTED COLUMNS
--   id, event_id, actor_id, action, resource_type, resource_id, outcome,
--   request_id, ip_address, user_agent, metadata, created_at
--
-- SECURITY
--   Audit access must be restricted to explicitly authorized roles.
--   Use prepared statements and bound parameters.
--   Never log passwords, access tokens, session cookies, or document contents.
--   Do not allow ordinary application users to modify or delete audit records.
--
-- NOTE
--   Query templates use MySQL prepared-statement placeholders (?).
--   Bind all values using the database driver.
-- =============================================================================


-- =============================================================================
-- 1. RECORD AN AUDIT EVENT
--
-- Parameters:
--   1. event UUID
--   2. actor ID, or NULL for a system event
--   3. action
--   4. resource type
--   5. resource ID, or NULL
--   6. outcome: success, failure, denied, error
--   7. request ID, or NULL
--   8. client IP address, or NULL
--   9. user-agent string, or NULL
--  10. sanitized JSON metadata
--
-- IMPORTANT:
--   Generate the event UUID in the application or use UUID().
--   Validate outcome and sanitize metadata before insertion.
--   actor_id is TEXT in the documented MedOrbits schema.
-- =============================================================================

INSERT INTO audit_logs (
    event_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    outcome,
    request_id,
    ip_address,
    user_agent,
    metadata,
    created_at
)
VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    CURRENT_TIMESTAMP(3)
);


-- =============================================================================
-- 2. FETCH AN EVENT BY EVENT UUID
--
-- Parameters:
--   1. event_id
--
-- Authorization:
--   Restrict to users with audit_logs.read permission.
-- =============================================================================

SELECT
    id,
    event_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    outcome,
    request_id,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM audit_logs
WHERE event_id = ?
LIMIT 1;


-- =============================================================================
-- 3. FETCH AUDIT EVENTS FOR A RESOURCE
--
-- Parameters:
--   1. resource_type
--   2. resource_id
--   3. page size
--   4. offset
--
-- Example resource types:
--   application, user, course, college, document, payment
-- =============================================================================

SELECT
    id,
    event_id,
    actor_id,
    action,
    outcome,
    request_id,
    metadata,
    created_at
FROM audit_logs
WHERE resource_type = ?
  AND resource_id = ?
ORDER BY created_at DESC, id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 4. FETCH EVENTS FOR AN ACTOR
--
-- Parameters:
--   1. actor_id
--   2. start timestamp, or NULL
--   3. start timestamp again
--   4. end timestamp, or NULL
--   5. end timestamp again
--   6. page size
--   7. offset
--
-- Use an exclusive end timestamp for predictable date-range filtering.
-- =============================================================================

SELECT
    id,
    event_id,
    action,
    resource_type,
    resource_id,
    outcome,
    request_id,
    ip_address,
    created_at
FROM audit_logs
WHERE actor_id = ?
  AND (? IS NULL OR created_at >= ?)
  AND (? IS NULL OR created_at < ?)
ORDER BY created_at DESC, id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 5. SEARCH AUDIT EVENTS BY OUTCOME
--
-- Parameters:
--   1. outcome
--   2. start timestamp, or NULL
--   3. start timestamp again
--   4. end timestamp, or NULL
--   5. end timestamp again
--   6. page size
--   7. offset
--
-- Valid outcomes:
--   success, failure, denied, error
-- =============================================================================

SELECT
    id,
    event_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    request_id,
    ip_address,
    metadata,
    created_at
FROM audit_logs
WHERE outcome = ?
  AND (? IS NULL OR created_at >= ?)
  AND (? IS NULL OR created_at < ?)
ORDER BY created_at DESC, id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 6. REVIEW ACCESS-DENIED EVENTS
--
-- Parameters:
--   1. start timestamp
--   2. exclusive end timestamp
--   3. page size
--   4. offset
--
-- Useful for investigating authorization failures.
-- =============================================================================

SELECT
    id,
    event_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    request_id,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM audit_logs
WHERE outcome = 'denied'
  AND created_at >= ?
  AND created_at < ?
ORDER BY created_at DESC, id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 7. REVIEW FAILED OR ERRORED OPERATIONS
--
-- Parameters:
--   1. start timestamp
--   2. exclusive end timestamp
--   3. page size
--   4. offset
-- =============================================================================

SELECT
    id,
    event_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    request_id,
    ip_address,
    metadata,
    created_at
FROM audit_logs
WHERE outcome IN ('failure', 'error')
  AND created_at >= ?
  AND created_at < ?
ORDER BY created_at DESC, id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 8. SECURITY EVENT SUMMARY
--
-- Parameters:
--   1. start timestamp
--   2. exclusive end timestamp
--
-- Returns counts grouped by outcome and action.
-- =============================================================================

SELECT
    outcome,
    action,
    COUNT(*) AS event_count,
    MIN(created_at) AS first_event_at,
    MAX(created_at) AS last_event_at
FROM audit_logs
WHERE created_at >= ?
  AND created_at < ?
GROUP BY outcome, action
ORDER BY event_count DESC, outcome, action;


-- =============================================================================
-- 9. FIND REPEATED DENIED EVENTS BY IP ADDRESS
--
-- Parameters:
--   1. start timestamp
--   2. exclusive end timestamp
--   3. minimum event count
--
-- This is an investigation aid, not proof of malicious activity.
-- Multiple users may share an IP address.
-- =============================================================================

SELECT
    ip_address,
    COUNT(*) AS denied_event_count,
    COUNT(DISTINCT actor_id) AS distinct_actor_count,
    MIN(created_at) AS first_seen_at,
    MAX(created_at) AS last_seen_at
FROM audit_logs
WHERE outcome = 'denied'
  AND ip_address IS NOT NULL
  AND created_at >= ?
  AND created_at < ?
GROUP BY ip_address
HAVING COUNT(*) >= ?
ORDER BY denied_event_count DESC, last_seen_at DESC;


-- =============================================================================
-- 10. FETCH EVENTS FOR A REQUEST
--
-- Parameters:
--   1. request_id
--
-- Useful for correlating events from one HTTP request or workflow operation.
-- A request ID is not an authorization credential.
-- =============================================================================

SELECT
    id,
    event_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    outcome,
    ip_address,
    metadata,
    created_at
FROM audit_logs
WHERE request_id = ?
ORDER BY created_at ASC, id ASC;


-- =============================================================================
-- 11. FETCH APPLICATION AUDIT HISTORY
--
-- Parameters:
--   1. resource ID
--   2. page size
--   3. offset
--
-- Assumes application audit events use resource_type = 'application'.
-- =============================================================================

SELECT
    id,
    event_id,
    actor_id,
    action,
    outcome,
    request_id,
    metadata,
    created_at
FROM audit_logs
WHERE resource_type = 'application'
  AND resource_id = ?
ORDER BY created_at ASC, id ASC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 12. COUNT AUDIT EVENTS BY ACTOR
--
-- Parameters:
--   1. start timestamp
--   2. exclusive end timestamp
--
-- Useful for operational reporting. Restrict access because actor activity
-- can contain sensitive behavioural information.
-- =============================================================================

SELECT
    actor_id,
    COUNT(*) AS total_events,
    SUM(outcome = 'success') AS successful_events,
    SUM(outcome = 'failure') AS failed_events,
    SUM(outcome = 'denied') AS denied_events,
    SUM(outcome = 'error') AS error_events,
    MAX(created_at) AS last_event_at
FROM audit_logs
WHERE created_at >= ?
  AND created_at < ?
GROUP BY actor_id
ORDER BY total_events DESC, last_event_at DESC;


-- =============================================================================
-- 13. CHECK EVENT UUID DUPLICATES
--
-- Expected result: no rows.
-- =============================================================================

SELECT
    event_id,
    COUNT(*) AS duplicate_count
FROM audit_logs
GROUP BY event_id
HAVING COUNT(*) > 1;


-- =============================================================================
-- 14. CHECK REQUIRED AUDIT FIELDS
--
-- Expected result: no rows for records required to have these fields.
-- Adjust nullable-field rules to match the application contract.
-- =============================================================================

SELECT
    id,
    event_id,
    action,
    outcome,
    created_at
FROM audit_logs
WHERE event_id IS NULL
   OR action IS NULL
   OR outcome IS NULL
   OR created_at IS NULL;


-- =============================================================================
-- 15. RECOMMENDED INDEXES
--
-- Review existing indexes before adding these.
-- Run CREATE INDEX statements through a reviewed migration, not on every
-- application startup.
-- =============================================================================

-- CREATE UNIQUE INDEX uq_audit_logs_event_id
--     ON audit_logs (event_id);
--
-- CREATE INDEX idx_audit_logs_created
--     ON audit_logs (created_at, id);
--
-- CREATE INDEX idx_audit_logs_actor_created
--     ON audit_logs (actor_id, created_at, id);
--
-- CREATE INDEX idx_audit_logs_resource_created
--     ON audit_logs (resource_type, resource_id, created_at, id);
--
-- CREATE INDEX idx_audit_logs_outcome_created
--     ON audit_logs (outcome, created_at, id);
--
-- CREATE INDEX idx_audit_logs_request
--     ON audit_logs (request_id);


-- =============================================================================
-- 16. IMMUTABILITY AND RETENTION POLICY
--
-- Do not add routine UPDATE or DELETE statements for audit records here.
--
-- Recommended controls:
--   - Give the application audit writer INSERT-only permissions where feasible.
--   - Give audit readers SELECT-only permissions.
--   - Restrict schema and retention operations to designated administrators.
--   - Store sanitized metadata and avoid credentials or unnecessary PII.
--   - Define a documented retention and archival policy.
--   - Consider external, tamper-resistant log storage for critical security
--     events.
--
-- =============================================================================
-- END OF AUDIT LOG QUERIES
-- =============================================================================
