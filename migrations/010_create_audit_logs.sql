
-- =============================================================================
-- MedOrbits Migration 010: Audit Logs
-- File: /migrations/main/010_create_audit_logs.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- DEPENDENCIES:
--   001_create_users.sql
--
-- PURPOSE:
--   Maintain an audit trail of security-sensitive actions, administrative
--   changes, data access and business-critical events.
--
-- SECURITY:
-- - Never store credentials, session tokens, cookies, payment secrets,
--   full document contents or unnecessary personal information.
-- - Restrict audit-log access and treat records as append-only.
-- - Sanitize metadata before inserting it.
-- - Do not expose audit logs to ordinary users.
-- - CREATE TABLE IF NOT EXISTS does not modify existing definitions.
-- - MySQL DDL may implicitly commit.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- Generate using crypto.randomUUID() in trusted backend code.
    public_id CHAR(36) NOT NULL,

    -- NULL for anonymous or system-generated events.
    actor_user_id BIGINT UNSIGNED NULL,
    actor_type VARCHAR(30) NOT NULL DEFAULT 'user',
    actor_identifier VARCHAR(191) NULL,

    -- Stable machine-readable action and resource names.
    action VARCHAR(120) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(191) NULL,
    resource_public_id CHAR(36) NULL,

    -- Outcome of the attempted operation.
    outcome VARCHAR(30) NOT NULL DEFAULT 'success',

    -- Request correlation fields.
    request_id VARCHAR(150) NULL,
    correlation_id VARCHAR(150) NULL,
    http_method VARCHAR(10) NULL,
    route_template VARCHAR(255) NULL,
    http_status SMALLINT UNSIGNED NULL,

    -- Sanitized request context.
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(1024) NULL,

    -- Approved, sanitized information only.
    metadata JSON NOT NULL DEFAULT (JSON_OBJECT()),
    before_data JSON NULL,
    after_data JSON NULL,
    error_code VARCHAR(100) NULL,

    -- Event and persistence timestamps.
    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_audit_logs_public_id (public_id),

    KEY idx_audit_logs_actor_created (
        actor_user_id, created_at
    ),

    KEY idx_audit_logs_action_created (
        action, created_at
    ),

    KEY idx_audit_logs_resource (
        resource_type, resource_id, created_at
    ),

    KEY idx_audit_logs_resource_public_id (
        resource_type, resource_public_id, created_at
    ),

    KEY idx_audit_logs_request_id (request_id),
    KEY idx_audit_logs_correlation_id (correlation_id),

    KEY idx_audit_logs_outcome_created (
        outcome, created_at
    ),

    KEY idx_audit_logs_actor_type_created (
        actor_type, created_at
    ),

    KEY idx_audit_logs_ip_created (
        ip_address, created_at
    ),

    KEY idx_audit_logs_occurred_at (occurred_at),

    -- UUID validation.
    CONSTRAINT chk_audit_logs_public_id
        CHECK (
            CHAR_LENGTH(TRIM(public_id)) = 36
            AND public_id REGEXP
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_audit_logs_resource_public_id
        CHECK (
            resource_public_id IS NULL
            OR (
                CHAR_LENGTH(TRIM(resource_public_id)) = 36
                AND resource_public_id REGEXP
                    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
            )
        ),

    -- Supported actor classifications.
    CONSTRAINT chk_audit_logs_actor_type
        CHECK (
            actor_type IN (
                'user',
                'admin',
                'system',
                'service',
                'anonymous'
            )
        ),

    CONSTRAINT chk_audit_logs_action
        CHECK (CHAR_LENGTH(TRIM(action)) > 0),

    CONSTRAINT chk_audit_logs_resource_type
        CHECK (CHAR_LENGTH(TRIM(resource_type)) > 0),

    CONSTRAINT chk_audit_logs_outcome
        CHECK (
            outcome IN (
                'success',
                'failure',
                'denied',
                'error'
            )
        ),

    -- Optional identifiers must not be blank.
    CONSTRAINT chk_audit_logs_actor_identifier
        CHECK (
            actor_identifier IS NULL
            OR CHAR_LENGTH(TRIM(actor_identifier)) > 0
        ),

    CONSTRAINT chk_audit_logs_request_id
        CHECK (
            request_id IS NULL
            OR CHAR_LENGTH(TRIM(request_id)) > 0
        ),

    CONSTRAINT chk_audit_logs_correlation_id
        CHECK (
            correlation_id IS NULL
            OR CHAR_LENGTH(TRIM(correlation_id)) > 0
        ),

    CONSTRAINT chk_audit_logs_http_method
        CHECK (
            http_method IS NULL
            OR http_method IN (
                'GET',
                'POST',
                'PUT',
                'PATCH',
                'DELETE',
                'HEAD',
                'OPTIONS'
            )
        ),

    CONSTRAINT chk_audit_logs_http_status
        CHECK (
            http_status IS NULL
            OR http_status BETWEEN 100 AND 599
        ),

    CONSTRAINT chk_audit_logs_ip_address
        CHECK (
            ip_address IS NULL
            OR CHAR_LENGTH(TRIM(ip_address)) > 0
        ),

    CONSTRAINT chk_audit_logs_resource_id
        CHECK (
            resource_id IS NULL
            OR CHAR_LENGTH(TRIM(resource_id)) > 0
        ),

    CONSTRAINT chk_audit_logs_route_template
        CHECK (
            route_template IS NULL
            OR CHAR_LENGTH(TRIM(route_template)) > 0
        ),

    CONSTRAINT chk_audit_logs_error_code
        CHECK (
            error_code IS NULL
            OR CHAR_LENGTH(TRIM(error_code)) > 0
        ),

    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id)
        REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- VERIFICATION
-- =============================================================================

SHOW CREATE TABLE audit_logs;

SELECT
    outcome,
    COUNT(*) AS event_count,
    MAX(created_at) AS latest_event_at
FROM audit_logs
GROUP BY outcome
ORDER BY outcome;

-- Expected result: zero rows.
SELECT
    id,
    public_id,
    action,
    resource_type,
    outcome
FROM audit_logs
WHERE
    CHAR_LENGTH(TRIM(public_id)) <> 36
    OR CHAR_LENGTH(TRIM(action)) = 0
    OR CHAR_LENGTH(TRIM(resource_type)) = 0
    OR outcome NOT IN ('success', 'failure', 'denied', 'error');

-- =============================================================================
-- END OF MIGRATION 010
-- =============================================================================
