
-- =============================================================================
-- MedOrbits Migration 008: Payments and Subscriptions
-- File: /database/migrations/008_create_subscriptions_payments.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- Dependencies:
--   001_create_users.sql
--
-- Tables:
--   subscriptions
--   payments
--   payment_refunds
--   payment_provider_events
--
-- Monetary values use integer minor units (paise for INR).
-- Verify provider payments server-side; never trust browser redirects.
-- Never store card numbers, CVVs, UPI PINs, credentials or API secrets.
-- =============================================================================

-- =============================================================================
-- TABLE: subscriptions
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    plan_code VARCHAR(80) NOT NULL,
    plan_name VARCHAR(150) NOT NULL,
    amount_minor BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    starts_at DATETIME(3) NULL,
    current_period_start DATETIME(3) NULL,
    current_period_end DATETIME(3) NULL,
    trial_ends_at DATETIME(3) NULL,
    next_billing_at DATETIME(3) NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at DATETIME(3) NULL,
    ended_at DATETIME(3) NULL,
    provider VARCHAR(60) NULL,
    provider_customer_id VARCHAR(255) NULL,
    provider_subscription_id VARCHAR(255) NULL,
    metadata JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_subscriptions_public_id (public_id),
    UNIQUE KEY uq_subscriptions_provider_subscription (
        provider,
        provider_subscription_id
    ),
    KEY idx_subscriptions_user_id (user_id),
    KEY idx_subscriptions_status (status),
    KEY idx_subscriptions_period_end (current_period_end),
    KEY idx_subscriptions_next_billing (status, next_billing_at),
    KEY idx_subscriptions_user_status (user_id, status),
    KEY idx_subscriptions_provider_customer (
        provider,
        provider_customer_id
    ),

    CONSTRAINT chk_subscriptions_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),
    CONSTRAINT chk_subscriptions_amount
        CHECK (amount_minor >= 0),
    CONSTRAINT chk_subscriptions_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),
    CONSTRAINT chk_subscriptions_plan_code
        CHECK (CHAR_LENGTH(TRIM(plan_code)) > 0),
    CONSTRAINT chk_subscriptions_plan_name
        CHECK (CHAR_LENGTH(TRIM(plan_name)) > 0),
    CONSTRAINT chk_subscriptions_provider
        CHECK (
            provider IS NULL OR CHAR_LENGTH(TRIM(provider)) > 0
        ),
    CONSTRAINT chk_subscriptions_provider_customer
        CHECK (
            provider_customer_id IS NULL
            OR CHAR_LENGTH(TRIM(provider_customer_id)) > 0
        ),
    CONSTRAINT chk_subscriptions_provider_subscription
        CHECK (
            provider_subscription_id IS NULL
            OR CHAR_LENGTH(TRIM(provider_subscription_id)) > 0
        ),
    CONSTRAINT chk_subscriptions_interval
        CHECK (
            billing_interval IN (
                'monthly', 'quarterly', 'yearly', 'one_time'
            )
        ),
    CONSTRAINT chk_subscriptions_status
        CHECK (
            status IN (
                'pending', 'trialing', 'active', 'past_due',
                'cancelled', 'expired', 'suspended'
            )
        ),
    CONSTRAINT chk_subscriptions_period
        CHECK (
            current_period_start IS NULL
            OR current_period_end IS NULL
            OR current_period_end > current_period_start
        ),
    CONSTRAINT chk_subscriptions_trial
        CHECK (
            trial_ends_at IS NULL
            OR starts_at IS NULL
            OR trial_ends_at >= starts_at
        ),
    CONSTRAINT chk_subscriptions_cancellation
        CHECK (
            cancel_at_period_end = FALSE
            OR cancelled_at IS NULL
            OR status = 'cancelled'
        ),
    CONSTRAINT chk_subscriptions_ended
        CHECK (
            status <> 'expired' OR ended_at IS NOT NULL
        ),

    CONSTRAINT fk_subscriptions_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: payments
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    subscription_id BIGINT UNSIGNED NULL,
    payment_reference VARCHAR(100) NOT NULL,
    provider VARCHAR(60) NOT NULL,
    provider_payment_id VARCHAR(255) NULL,
    provider_order_id VARCHAR(255) NULL,
    amount_minor BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(60) NULL,
    initiated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    paid_at DATETIME(3) NULL,
    failed_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    idempotency_key VARCHAR(150) NULL,
    failure_code VARCHAR(100) NULL,
    failure_message TEXT NULL,
    provider_metadata JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_public_id (public_id),
    UNIQUE KEY uq_payments_reference (payment_reference),
    UNIQUE KEY uq_payments_provider_payment (
        provider, provider_payment_id
    ),
    UNIQUE KEY uq_payments_idempotency (
        user_id, idempotency_key
    ),
    KEY idx_payments_user_id (user_id),
    KEY idx_payments_subscription_id (subscription_id),
    KEY idx_payments_status (status),
    KEY idx_payments_created_at (created_at),
    KEY idx_payments_user_status_created (
        user_id, status, created_at
    ),
    KEY idx_payments_provider_order (provider, provider_order_id),

    CONSTRAINT chk_payments_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),
    CONSTRAINT chk_payments_amount
        CHECK (amount_minor > 0),
    CONSTRAINT chk_payments_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),
    CONSTRAINT chk_payments_provider
        CHECK (CHAR_LENGTH(TRIM(provider)) > 0),
    CONSTRAINT chk_payments_reference
        CHECK (CHAR_LENGTH(TRIM(payment_reference)) > 0),
    CONSTRAINT chk_payments_status
        CHECK (
            status IN (
                'pending', 'processing', 'successful', 'failed',
                'cancelled', 'partially_refunded', 'refunded'
            )
        ),
    CONSTRAINT chk_payments_method
        CHECK (
            payment_method IS NULL
            OR CHAR_LENGTH(TRIM(payment_method)) > 0
        ),
    CONSTRAINT chk_payments_provider_payment_id
        CHECK (
            provider_payment_id IS NULL
            OR CHAR_LENGTH(TRIM(provider_payment_id)) > 0
        ),
    CONSTRAINT chk_payments_paid_timestamp
        CHECK (
            status NOT IN (
                'successful', 'partially_refunded', 'refunded'
            )
            OR paid_at IS NOT NULL
        ),
    CONSTRAINT chk_payments_failed_timestamp
        CHECK (status <> 'failed' OR failed_at IS NOT NULL),
    CONSTRAINT chk_payments_cancelled_timestamp
        CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL),

    CONSTRAINT fk_payments_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_payments_subscription
        FOREIGN KEY (subscription_id)
        REFERENCES subscriptions (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: payment_refunds
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    payment_id BIGINT UNSIGNED NOT NULL,
    refund_reference VARCHAR(100) NOT NULL,
    provider_refund_id VARCHAR(255) NULL,
    amount_minor BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    reason VARCHAR(500) NULL,
    requested_by BIGINT UNSIGNED NULL,
    requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    provider_metadata JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_refunds_public_id (public_id),
    UNIQUE KEY uq_payment_refunds_reference (refund_reference),
    UNIQUE KEY uq_payment_refunds_provider_id (provider_refund_id),
    KEY idx_payment_refunds_payment_status (payment_id, status),
    KEY idx_payment_refunds_requested_by (requested_by),
    KEY idx_payment_refunds_created_at (created_at),

    CONSTRAINT chk_payment_refunds_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),
    CONSTRAINT chk_payment_refunds_amount
        CHECK (amount_minor > 0),
    CONSTRAINT chk_payment_refunds_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),
    CONSTRAINT chk_payment_refunds_reference
        CHECK (CHAR_LENGTH(TRIM(refund_reference)) > 0),
    CONSTRAINT chk_payment_refunds_status
        CHECK (
            status IN (
                'pending', 'processing', 'successful', 'failed', 'cancelled'
            )
        ),
    CONSTRAINT chk_payment_refunds_processed
        CHECK (
            status <> 'successful' OR processed_at IS NOT NULL
        ),
    CONSTRAINT chk_payment_refunds_provider_id
        CHECK (
            provider_refund_id IS NULL
            OR CHAR_LENGTH(TRIM(provider_refund_id)) > 0
        ),

    CONSTRAINT fk_payment_refunds_payment
        FOREIGN KEY (payment_id)
        REFERENCES payments (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_payment_refunds_requester
        FOREIGN KEY (requested_by)
        REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: payment_provider_events
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_provider_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider VARCHAR(60) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(150) NOT NULL,
    processing_status VARCHAR(30) NOT NULL DEFAULT 'received',
    payment_id BIGINT UNSIGNED NULL,
    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    event_payload JSON NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_provider_event (
        provider, provider_event_id
    ),
    KEY idx_provider_events_status_received (
        processing_status, received_at
    ),
    KEY idx_provider_events_payment_id (payment_id),

    CONSTRAINT chk_provider_events_provider
        CHECK (CHAR_LENGTH(TRIM(provider)) > 0),
    CONSTRAINT chk_provider_events_event_id
        CHECK (CHAR_LENGTH(TRIM(provider_event_id)) > 0),
    CONSTRAINT chk_provider_events_type
        CHECK (CHAR_LENGTH(TRIM(event_type)) > 0),
    CONSTRAINT chk_provider_events_status
        CHECK (
            processing_status IN (
                'received', 'processing', 'processed', 'failed', 'ignored'
            )
        ),
    CONSTRAINT chk_provider_events_attempts
        CHECK (attempt_count >= 0),
    CONSTRAINT chk_provider_events_completion
        CHECK (
            (
                processing_status IN ('processed', 'ignored')
                AND processed_at IS NOT NULL
            )
            OR
            (
                processing_status IN ('received', 'processing', 'failed')
                AND processed_at IS NULL
            )
        ),

    CONSTRAINT fk_provider_events_payment
        FOREIGN KEY (payment_id)
        REFERENCES payments (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 'subscriptions' AS table_name, COUNT(*) AS row_count
FROM subscriptions
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'payment_refunds', COUNT(*) FROM payment_refunds
UNION ALL
SELECT 'payment_provider_events', COUNT(*) FROM payment_provider_events;

-- =============================================================================
-- END OF MIGRATION 008
-- =============================================================================
