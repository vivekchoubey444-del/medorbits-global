
-- =============================================================================
-- MedOrbits Migration 009: Notifications Infrastructure
-- File: /migrations/main/009_create_notifications.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- Dependencies:
--   001_create_users.sql
--
-- Tables:
--   notification_templates
--   notification_preferences
--   notifications
--   notification_deliveries
--   notification_delivery_attempts
--   notification_provider_events
--
-- Security:
-- - Never store credentials, session tokens, cookies, payment secrets,
--   raw documents or unnecessary personal information.
-- - Generate public UUIDs in trusted backend code.
-- - Validate URLs, template variables and recipients server-side.
-- - Use atomic worker claims and idempotent provider-event processing.
-- - Protect provider payloads and apply a retention policy.
-- - CREATE TABLE IF NOT EXISTS does not modify existing definitions.
-- - MySQL DDL may implicitly commit.
-- =============================================================================


-- =============================================================================
-- TABLE: notification_templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    template_key VARCHAR(120) NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    channel VARCHAR(20) NOT NULL,
    locale VARCHAR(20) NOT NULL DEFAULT 'en',
    subject_template VARCHAR(255) NULL,
    title_template VARCHAR(200) NULL,
    body_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_templates_public_id (public_id),
    UNIQUE KEY uq_notification_template_version (
        template_key, channel, locale, version
    ),

    KEY idx_notification_templates_active (
        template_key, channel, locale, is_active
    ),

    CONSTRAINT chk_notification_templates_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_notification_templates_version
        CHECK (version > 0),

    CONSTRAINT chk_notification_templates_key
        CHECK (CHAR_LENGTH(TRIM(template_key)) > 0),

    CONSTRAINT chk_notification_templates_channel
        CHECK (channel IN ('in_app', 'email', 'sms', 'push')),

    CONSTRAINT chk_notification_templates_locale
        CHECK (CHAR_LENGTH(TRIM(locale)) > 0),

    CONSTRAINT chk_notification_templates_body
        CHECK (CHAR_LENGTH(TRIM(body_template)) > 0),

    CONSTRAINT chk_notification_templates_subject
        CHECK (
            subject_template IS NULL
            OR CHAR_LENGTH(TRIM(subject_template)) > 0
        ),

    CONSTRAINT chk_notification_templates_title
        CHECK (
            title_template IS NULL
            OR CHAR_LENGTH(TRIM(title_template)) > 0
        )

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: notification_preferences
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    notification_category VARCHAR(100) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_preferences_user_category_channel (
        user_id, notification_category, channel
    ),

    KEY idx_notification_preferences_category (
        notification_category, channel, is_enabled
    ),

    CONSTRAINT chk_notification_preferences_category
        CHECK (CHAR_LENGTH(TRIM(notification_category)) > 0),

    CONSTRAINT chk_notification_preferences_channel
        CHECK (channel IN ('in_app', 'email', 'sms', 'push')),

    CONSTRAINT fk_notification_preferences_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: notifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,

    notification_type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    action_url VARCHAR(2048) NULL,

    entity_type VARCHAR(80) NULL,
    entity_public_id CHAR(36) NULL,
    template_id BIGINT UNSIGNED NULL,

    payload JSON NULL,

    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at DATETIME(3) NULL,

    scheduled_at DATETIME(3) NULL,
    sent_at DATETIME(3) NULL,
    expires_at DATETIME(3) NULL,
    deleted_at DATETIME(3) NULL,

    deduplication_key VARCHAR(191) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_notifications_public_id (public_id),

    UNIQUE KEY uq_notifications_user_dedup (
        user_id, deduplication_key
    ),

    KEY idx_notifications_user_feed (
        user_id, deleted_at, created_at
    ),

    KEY idx_notifications_user_unread (
        user_id, is_read, deleted_at, created_at
    ),

    KEY idx_notifications_status_schedule (status, scheduled_at),
    KEY idx_notifications_category (user_id, category, created_at),
    KEY idx_notifications_expiration (expires_at, deleted_at),
    KEY idx_notifications_template (template_id),

    CONSTRAINT chk_notifications_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_notifications_type
        CHECK (CHAR_LENGTH(TRIM(notification_type)) > 0),

    CONSTRAINT chk_notifications_category
        CHECK (CHAR_LENGTH(TRIM(category)) > 0),

    CONSTRAINT chk_notifications_title
        CHECK (CHAR_LENGTH(TRIM(title)) > 0),

    CONSTRAINT chk_notifications_body
        CHECK (CHAR_LENGTH(TRIM(body)) > 0),

    CONSTRAINT chk_notifications_action_url
        CHECK (
            action_url IS NULL
            OR CHAR_LENGTH(TRIM(action_url)) > 0
        ),

    CONSTRAINT chk_notifications_entity_type
        CHECK (
            entity_type IS NULL
            OR CHAR_LENGTH(TRIM(entity_type)) > 0
        ),

    CONSTRAINT chk_notifications_priority
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    CONSTRAINT chk_notifications_status
        CHECK (
            status IN (
                'pending', 'processing', 'sent', 'failed', 'cancelled'
            )
        ),

    CONSTRAINT chk_notifications_read_state
        CHECK (
            (is_read = FALSE AND read_at IS NULL)
            OR (is_read = TRUE AND read_at IS NOT NULL)
        ),

    CONSTRAINT chk_notifications_sent_timestamp
        CHECK (
            status <> 'sent' OR sent_at IS NOT NULL
        ),

    CONSTRAINT chk_notifications_expiration
        CHECK (
            expires_at IS NULL OR expires_at > created_at
        ),

    CONSTRAINT chk_notifications_entity_public_id
        CHECK (
            entity_public_id IS NULL
            OR entity_public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_notifications_template
        FOREIGN KEY (template_id)
        REFERENCES notification_templates (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: notification_deliveries
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,

    notification_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(20) NOT NULL,

    provider VARCHAR(60) NULL,
    provider_message_id VARCHAR(255) NULL,
    recipient_reference VARCHAR(255) NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    scheduled_at DATETIME(3) NULL,
    next_attempt_at DATETIME(3) NULL,

    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts INT UNSIGNED NOT NULL DEFAULT 5,

    -- Workers must claim and complete work using the current lease token.
    lease_token CHAR(36) NULL,
    lease_expires_at DATETIME(3) NULL,

    last_attempt_at DATETIME(3) NULL,
    sent_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    failed_at DATETIME(3) NULL,

    last_error_code VARCHAR(100) NULL,
    last_error_message TEXT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_deliveries_public_id (public_id),

    UNIQUE KEY uq_notification_channel (
        notification_id, channel
    ),

    UNIQUE KEY uq_notification_provider_message (
        provider, provider_message_id
    ),

    KEY idx_notification_delivery_queue (
        status, scheduled_at, next_attempt_at
    ),

    KEY idx_notification_delivery_lease (
        status, lease_expires_at
    ),

    KEY idx_notification_delivery_provider (
        provider, status
    ),

    CONSTRAINT chk_notification_deliveries_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_notification_deliveries_channel
        CHECK (channel IN ('in_app', 'email', 'sms', 'push')),

    CONSTRAINT chk_notification_deliveries_status
        CHECK (
            status IN (
                'pending', 'processing', 'sent', 'delivered',
                'failed', 'cancelled', 'bounced'
            )
        ),

    CONSTRAINT chk_notification_deliveries_attempts
        CHECK (
            max_attempts > 0
            AND attempt_count <= max_attempts
        ),

    CONSTRAINT chk_notification_deliveries_lease
        CHECK (
            (lease_token IS NULL AND lease_expires_at IS NULL)
            OR (
                lease_token IS NOT NULL
                AND lease_expires_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_notification_deliveries_sent
        CHECK (
            status NOT IN ('sent', 'delivered')
            OR sent_at IS NOT NULL
        ),

    CONSTRAINT chk_notification_deliveries_delivered
        CHECK (
            status <> 'delivered'
            OR delivered_at IS NOT NULL
        ),

    CONSTRAINT chk_notification_deliveries_failed
        CHECK (
            status <> 'failed'
            OR failed_at IS NOT NULL
        ),

    CONSTRAINT chk_notification_deliveries_provider
        CHECK (
            provider IS NULL
            OR CHAR_LENGTH(TRIM(provider)) > 0
        ),

    CONSTRAINT chk_notification_deliveries_message_id
        CHECK (
            provider_message_id IS NULL
            OR CHAR_LENGTH(TRIM(provider_message_id)) > 0
        ),

    CONSTRAINT chk_notification_deliveries_recipient
        CHECK (
            recipient_reference IS NULL
            OR CHAR_LENGTH(TRIM(recipient_reference)) > 0
        ),

    CONSTRAINT fk_notification_deliveries_notification
        FOREIGN KEY (notification_id)
        REFERENCES notifications (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: notification_delivery_attempts
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,

    delivery_id BIGINT UNSIGNED NOT NULL,
    attempt_number INT UNSIGNED NOT NULL,

    provider VARCHAR(60) NULL,
    provider_message_id VARCHAR(255) NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'processing',

    started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at DATETIME(3) NULL,

    error_code VARCHAR(100) NULL,
    error_message TEXT NULL,
    provider_response JSON NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_attempt_public_id (public_id),

    UNIQUE KEY uq_notification_attempt_number (
        delivery_id, attempt_number
    ),

    KEY idx_notification_attempt_status (delivery_id, status),

    KEY idx_notification_attempt_provider_message (
        provider, provider_message_id
    ),

    KEY idx_notification_attempt_started (started_at),

    CONSTRAINT chk_notification_attempt_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_notification_attempt_number
        CHECK (attempt_number > 0),

    CONSTRAINT chk_notification_attempt_status
        CHECK (
            status IN (
                'processing', 'sent', 'delivered',
                'failed', 'bounced', 'cancelled'
            )
        ),

    CONSTRAINT chk_notification_attempt_completion
        CHECK (
            (status = 'processing' AND completed_at IS NULL)
            OR (
                status <> 'processing'
                AND completed_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_notification_attempt_provider
        CHECK (
            provider IS NULL
            OR CHAR_LENGTH(TRIM(provider)) > 0
        ),

    CONSTRAINT chk_notification_attempt_message_id
        CHECK (
            provider_message_id IS NULL
            OR CHAR_LENGTH(TRIM(provider_message_id)) > 0
        ),

    CONSTRAINT fk_notification_attempt_delivery
        FOREIGN KEY (delivery_id)
        REFERENCES notification_deliveries (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: notification_provider_events
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_provider_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    provider VARCHAR(60) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(120) NOT NULL,

    delivery_id BIGINT UNSIGNED NULL,
    delivery_attempt_id BIGINT UNSIGNED NULL,

    processing_status VARCHAR(30) NOT NULL DEFAULT 'received',

    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,

    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,

    -- Store only fields needed for verification and processing.
    event_payload JSON NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_provider_event (
        provider, provider_event_id
    ),

    KEY idx_notification_provider_event_queue (
        processing_status, received_at
    ),

    KEY idx_notification_provider_event_delivery (delivery_id),
    KEY idx_notification_provider_event_attempt (delivery_attempt_id),

    CONSTRAINT chk_notification_provider_event_status
        CHECK (
            processing_status IN (
                'received', 'processing', 'processed', 'failed', 'ignored'
            )
        ),

    CONSTRAINT chk_notification_provider_event_attempts
        CHECK (attempt_count >= 0),

    CONSTRAINT chk_notification_provider_event_completion
        CHECK (
            (
                processing_status IN ('processed', 'ignored')
                AND processed_at IS NOT NULL
            )
            OR (
                processing_status IN (
                    'received', 'processing', 'failed'
                )
                AND processed_at IS NULL
            )
        ),

    CONSTRAINT chk_notification_provider_event_provider
        CHECK (CHAR_LENGTH(TRIM(provider)) > 0),

    CONSTRAINT chk_notification_provider_event_id
        CHECK (CHAR_LENGTH(TRIM(provider_event_id)) > 0),

    CONSTRAINT chk_notification_provider_event_type
        CHECK (CHAR_LENGTH(TRIM(event_type)) > 0),

    CONSTRAINT fk_notification_provider_event_delivery
        FOREIGN KEY (delivery_id)
        REFERENCES notification_deliveries (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,

    CONSTRAINT fk_notification_provider_event_attempt
        FOREIGN KEY (delivery_attempt_id)
        REFERENCES notification_delivery_attempts (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- VERIFICATION
-- =============================================================================

SHOW CREATE TABLE notification_templates;
SHOW CREATE TABLE notification_preferences;
SHOW CREATE TABLE notifications;
SHOW CREATE TABLE notification_deliveries;
SHOW CREATE TABLE notification_delivery_attempts;
SHOW CREATE TABLE notification_provider_events;

SELECT
    'notification_templates' AS table_name,
    COUNT(*) AS row_count
FROM notification_templates

UNION ALL

SELECT
    'notification_preferences',
    COUNT(*)
FROM notification_preferences

UNION ALL

SELECT
    'notifications',
    COUNT(*)
FROM notifications

UNION ALL

SELECT
    'notification_deliveries',
    COUNT(*)
FROM notification_deliveries

UNION ALL

SELECT
    'notification_delivery_attempts',
    COUNT(*)
FROM notification_delivery_attempts

UNION ALL

SELECT
    'notification_provider_events',
    COUNT(*)
FROM notification_provider_events;

-- Expected result: zero rows.
SELECT
    id,
    public_id,
    status,
    lease_token,
    lease_expires_at
FROM notification_deliveries
WHERE
    (lease_token IS NULL AND lease_expires_at IS NOT NULL)
    OR
    (lease_token IS NOT NULL AND lease_expires_at IS NULL);

-- Expected result: zero rows.
SELECT
    id,
    processing_status,
    processed_at
FROM notification_provider_events
WHERE
    (
        processing_status IN ('processed', 'ignored')
        AND processed_at IS NULL
    )
    OR (
        processing_status IN (
            'received', 'processing', 'failed'
        )
        AND processed_at IS NOT NULL
    );

-- =============================================================================
-- END OF MIGRATION 009
-- =============================================================================
