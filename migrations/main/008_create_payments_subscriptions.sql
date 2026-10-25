
-- =============================================================================
-- MedOrbits Migration 008: Payments and Subscriptions
-- File: /migrations/main/008_create_payments_subscriptions.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- DEPENDENCIES:
--   001_create_users.sql
--
-- TABLES:
--   subscriptions
--   payments
--   payment_refunds
--   payment_provider_events
--
-- SECURITY AND FINANCIAL INTEGRITY:
-- - Monetary amounts use integer minor units (paise for INR).
-- - Verify provider signatures and payment status server-side.
-- - Never trust browser redirects as proof of payment.
-- - Never store card numbers, CVVs, UPI PINs, credentials or API secrets.
-- - Use idempotency keys for payment initiation and webhook processing.
-- - Enforce refund limits and provider reconciliation in trusted services.
-- - Protect provider payloads because they may contain personal information.
-- - CREATE TABLE IF NOT EXISTS does not update existing definitions.
-- - MySQL DDL may implicitly commit.
-- =============================================================================


-- =============================================================================
-- TABLE: subscriptions
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,

    user_id BIGINT UNSIGNED NOT NULL,

    -- Snapshot of the purchased plan at subscription creation.
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

    -- Provider identifiers are not secret credentials.
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
            provider IS NULL
            OR CHAR_LENGTH(TRIM(provider)) > 0
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
                'monthly',
                'quarterly',
                'yearly',
                'one_time'
            )
        ),

    CONSTRAINT chk_subscriptions_status
        CHECK (
            status IN (
                'pending',
                'trialing',
                'active',
                'past_due',
                'cancelled',
                'expired',
                'suspended'
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
            cancelled_at IS NULL
            OR status = 'cancelled'
        ),

    CONSTRAINT chk_subscriptions_cancelled_timestamp
        CHECK (
            status <> 'cancelled'
            OR cancelled_at IS NOT NULL
        ),

    CONSTRAINT chk_subscriptions_ended
        CHECK (
            status <> 'expired'
            OR ended_at IS NOT NULL
        ),

    CONSTRAINT chk_subscriptions_provider_pair
        CHECK (
            provider_subscription_id IS NULL
            OR provider IS NOT NULL
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

    -- Unique per user when supplied.
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
        provider,
        provider_payment_id
    ),

    UNIQUE KEY uq_payments_idempotency (
        user_id,
        idempotency_key
    ),

    KEY idx_payments_user_id (user_id),
    KEY idx_payments_subscription_id (subscription_id),
    KEY idx_payments_status (status),
    KEY idx_payments_created_at (created_at),

    KEY idx_payments_user_status_created (
        user_id,
        status,
        created_at
    ),

    KEY idx_payments_provider_order (
        provider,
        provider_order_id
    ),

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
                'pending',
                'processing',
                'successful',
                'failed',
                'cancelled',
                'partially_refunded',
                'refunded'
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

    CONSTRAINT chk_payments_provider_order_id
        CHECK (
            provider_order_id IS NULL
            OR CHAR_LENGTH(TRIM(provider_order_id)) > 0
        ),

    CONSTRAINT chk_payments_idempotency_key
        CHECK (
            idempotency_key IS NULL
            OR CHAR_LENGTH(TRIM(idempotency_key)) > 0
        ),

    -- Successful payments and refunded payments must have paid_at.
    CONSTRAINT chk_payments_paid_timestamp
        CHECK (
            status NOT IN (
                'successful',
                'partially_refunded',
                'refunded'
            )
            OR paid_at IS NOT NULL
        ),

    CONSTRAINT chk_payments_failed_timestamp
        CHECK (
            status <> 'failed'
            OR (
                failed_at IS NOT NULL
                AND paid_at IS NULL
            )
        ),

    CONSTRAINT chk_payments_cancelled_timestamp
        CHECK (
            status <> 'cancelled'
            OR (
                cancelled_at IS NOT NULL
                AND paid_at IS NULL
            )
        ),

    -- A successful payment cannot simultaneously be marked failed/cancelled.
    CONSTRAINT chk_payments_success_timestamp_consistency
        CHECK (
            status NOT IN (
                'successful',
                'partially_refunded',
                'refunded'
            )
            OR (
                failed_at IS NULL
                AND cancelled_at IS NULL
            )
        ),

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

    KEY idx_payment_refunds_payment_status (
        payment_id,
        status
    ),

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
                'pending',
                'processing',
                'successful',
                'failed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_payment_refunds_processed
        CHECK (
            (
                status = 'successful'
                AND processed_at IS NOT NULL
            )
            OR
            (
                status <> 'successful'
                AND processed_at IS NULL
            )
        ),

    CONSTRAINT chk_payment_refunds_provider_id
        CHECK (
            provider_refund_id IS NULL
            OR CHAR_LENGTH(TRIM(provider_refund_id)) > 0
        ),

    CONSTRAINT chk_payment_refunds_reason
        CHECK (
            reason IS NULL
            OR CHAR_LENGTH(TRIM(reason)) > 0
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

    -- Store only the payload fields required for verification and processing.
    -- Apply access controls and a defined retention policy.
    event_payload JSON NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_payment_provider_event (
        provider,
        provider_event_id
    ),

    KEY idx_provider_events_status_received (
        processing_status,
        received_at
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
                'received',
                'processing',
                'processed',
                'failed',
                'ignored'
            )
        ),

    CONSTRAINT chk_provider_events_completion
        CHECK (
            (
                processing_status IN ('processed', 'ignored')
                AND processed_at IS NOT NULL
            )
            OR
            (
                processing_status IN (
                    'received',
                    'processing',
                    'failed'
                )
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

SHOW CREATE TABLE subscriptions;
SHOW CREATE TABLE payments;
SHOW CREATE TABLE payment_refunds;
SHOW CREATE TABLE payment_provider_events;

SELECT
    'subscriptions' AS table_name,
    COUNT(*) AS row_count
FROM subscriptions

UNION ALL

SELECT
    'payments',
    COUNT(*)
FROM payments

UNION ALL

SELECT
    'payment_refunds',
    COUNT(*)
FROM payment_refunds

UNION ALL

SELECT
    'payment_provider_events',
    COUNT(*)
FROM payment_provider_events;

-- Expected result: zero rows.
SELECT
    id,
    public_id,
    status,
    paid_at,
    failed_at,
    cancelled_at
FROM payments
WHERE
    (
        status IN (
            'successful',
            'partially_refunded',
            'refunded'
        )
        AND (
            paid_at IS NULL
            OR failed_at IS NOT NULL
            OR cancelled_at IS NOT NULL
        )
    )
    OR (
        status = 'failed'
        AND (
            failed_at IS NULL
            OR paid_at IS NOT NULL
        )
    )
    OR (
        status = 'cancelled'
        AND (
            cancelled_at IS NULL
            OR paid_at IS NOT NULL
        )
    );

-- Expected result: zero rows.
SELECT
    id,
    public_id,
    status,
    cancelled_at,
    ended_at
FROM subscriptions
WHERE
    (status = 'cancelled' AND cancelled_at IS NULL)
    OR (status = 'expired' AND ended_at IS NULL);

-- Expected result: zero rows.
SELECT
    id,
    provider,
    provider_event_id,
    processing_status,
    processed_at
FROM payment_provider_events
WHERE
    (
        processing_status IN ('processed', 'ignored')
        AND processed_at IS NULL
    )
    OR (
        processing_status IN ('received', 'processing', 'failed')
        AND processed_at IS NOT NULL
    );

-- =============================================================================
-- END OF MIGRATION 008
-- =============================================================================
