
-- =============================================================================
-- MedOrbits: User Management Queries
-- File: database/queries/users.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- PURPOSE
--   Reusable, parameterized queries for user registration, profiles,
--   account management, role lookups, account status, and administration.
--
-- EXPECTED TABLES
--   users
--   roles
--   user_roles
--
-- OPTIONAL TABLES
--   user_profiles
--   sessions
--   audit_logs
--
-- SCHEMA ASSUMPTIONS
--   users:
--     id, public_id, name, email, password_hash, phone, account_status,
--     email_verified_at, phone_verified_at, last_login_at, created_at,
--     updated_at, deleted_at
--
--   roles:
--     id, name, display_name, is_active
--
--   user_roles:
--     user_id, role_id
--
-- IMPORTANT
--   - Never store plaintext passwords.
--   - Hash passwords in the application using a suitable password-hashing
--     algorithm such as Argon2id.
--   - Normalize email addresses before lookup and insertion.
--   - Never return password_hash in API responses.
--   - Enforce authorization in the service/controller layer.
--   - Match all assumed columns to your actual database migrations.
-- =============================================================================


-- =============================================================================
-- 1. FIND USER BY INTERNAL ID
--
-- Parameter:
--   1. internal user ID
--
-- Internal service use only.
-- =============================================================================

SELECT
    u.id,
    u.public_id,
    u.name,
    u.email,
    u.phone,
    u.account_status,
    u.email_verified_at,
    u.phone_verified_at,
    u.last_login_at,
    u.created_at,
    u.updated_at
FROM users AS u
WHERE u.id = ?
  AND u.deleted_at IS NULL
LIMIT 1;


-- =============================================================================
-- 2. FIND USER BY PUBLIC ID
--
-- Parameter:
--   1. public UUID
-- =============================================================================

SELECT
    u.id,
    u.public_id,
    u.name,
    u.email,
    u.phone,
    u.account_status,
    u.email_verified_at,
    u.phone_verified_at,
    u.last_login_at,
    u.created_at,
    u.updated_at
FROM users AS u
WHERE u.public_id = ?
  AND u.deleted_at IS NULL
LIMIT 1;


-- =============================================================================
-- 3. FIND USER BY EMAIL FOR AUTHENTICATION
--
-- Parameter:
--   1. normalized email address
--
-- password_hash is included only for authentication-service use.
-- Never serialize this result directly to the client.
-- =============================================================================

SELECT
    u.id,
    u.public_id,
    u.name,
    u.email,
    u.password_hash,
    u.account_status,
    u.email_verified_at,
    u.last_login_at
FROM users AS u
WHERE u.email = ?
  AND u.deleted_at IS NULL
LIMIT 1;


-- =============================================================================
-- 4. CHECK WHETHER EMAIL IS ALREADY REGISTERED
--
-- Parameter:
--   1. normalized email address
--
-- Use a UNIQUE constraint on the normalized email field to prevent concurrent
-- duplicate registrations. This query is only a preliminary check.
-- =============================================================================

SELECT EXISTS (
    SELECT 1
    FROM users AS u
    WHERE u.email = ?
      AND u.deleted_at IS NULL
) AS email_exists;


-- =============================================================================
-- 5. CHECK WHETHER PHONE IS ALREADY REGISTERED
--
-- Parameter:
--   1. normalized phone number
--
-- Use only if phone uniqueness is a business requirement.
-- =============================================================================

SELECT EXISTS (
    SELECT 1
    FROM users AS u
    WHERE u.phone = ?
      AND u.deleted_at IS NULL
) AS phone_exists;


-- =============================================================================
-- 6. CREATE A USER ACCOUNT
--
-- Parameters:
--   1. public UUID
--   2. name
--   3. normalized email
--   4. application-generated password hash
--   5. normalized phone, or NULL
--
-- Set the initial account status to 'pending_verification' if that status
-- exists in your schema. Never accept account_status from public registration
-- request data.
-- =============================================================================

INSERT INTO users (
    public_id,
    name,
    email,
    password_hash,
    phone,
    account_status,
    created_at,
    updated_at
)
VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    'pending_verification',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
);


-- =============================================================================
-- 7. GET USER PROFILE
--
-- Parameter:
--   1. authenticated user ID
--
-- This query returns only the user's own profile.
-- =============================================================================

SELECT
    u.public_id,
    u.name,
    u.email,
    u.phone,
    u.account_status,
    u.email_verified_at,
    u.phone_verified_at,
    u.last_login_at,
    u.created_at,
    u.updated_at
FROM users AS u
WHERE u.id = ?
  AND u.deleted_at IS NULL
LIMIT 1;


-- =============================================================================
-- 8. UPDATE USER PROFILE
--
-- Parameters:
--   1. new name
--   2. new phone number, or NULL
--   3. authenticated user ID
--
-- Email changes should use a separate verification workflow.
-- =============================================================================

UPDATE users
SET
    name = ?,
    phone = ?,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = ?
  AND deleted_at IS NULL
  AND account_status = 'active';


-- =============================================================================
-- 9. CHANGE PASSWORD HASH
--
-- Parameters:
--   1. newly generated password hash
--   2. authenticated user ID
--
-- Verify the existing password in the application before executing this query.
-- Invalidate existing sessions/tokens after a successful password change.
-- =============================================================================

UPDATE users
SET
    password_hash = ?,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = ?
  AND deleted_at IS NULL
  AND account_status = 'active';


-- =============================================================================
-- 10. UPDATE PASSWORD HASH AFTER PASSWORD RESET
--
-- Parameters:
--   1. newly generated password hash
--   2. user ID resolved from a valid, single-use reset token
--
-- The reset token must be verified, expire appropriately, and be consumed
-- atomically in the password-reset service.
-- =============================================================================

UPDATE users
SET
    password_hash = ?,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = ?
  AND deleted_at IS NULL
  AND account_status IN ('active', 'pending_verification');


-- =============================================================================
-- 11. MARK EMAIL AS VERIFIED
--
-- Parameters:
--   1. user ID resolved from a valid email-verification token
--
-- Use only after verifying the token in the application service.
-- =============================================================================

UPDATE users
SET
    email_verified_at = COALESCE(
        email_verified_at,
        CURRENT_TIMESTAMP(3)
    ),
    account_status = CASE
        WHEN account_status = 'pending_verification' THEN 'active'
        ELSE account_status
    END,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = ?
  AND deleted_at IS NULL
  AND account_status IN ('pending_verification', 'active');


-- =============================================================================
-- 12. MARK PHONE AS VERIFIED
--
-- Parameter:
--   1. user ID resolved from a valid phone-verification token
--
-- =============================================================================

UPDATE users
SET
    phone_verified_at = COALESCE(
        phone_verified_at,
        CURRENT_TIMESTAMP(3)
    ),
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = ?
  AND deleted_at IS NULL
  AND account_status = 'active';


-- =============================================================================
-- 13. UPDATE LAST LOGIN TIME
--
-- Parameter:
--   1. authenticated user ID
--
-- Execute after successful authentication, not before password verification.
-- =============================================================================

UPDATE users
SET
    last_login_at = CURRENT_TIMESTAMP(3),
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = ?
  AND deleted_at IS NULL
  AND account_status = 'active';


-- =============================================================================
-- 14. GET USER ROLES
--
-- Parameter:
--   1. user ID
--
-- Returns only active roles.
-- =============================================================================

SELECT
    r.name AS role_name,
    r.display_name
FROM user_roles AS ur
INNER JOIN roles AS r
    ON r.id = ur.role_id
WHERE ur.user_id = ?
  AND r.is_active = TRUE
ORDER BY r.name ASC;


-- =============================================================================
-- 15. CHECK WHETHER USER HAS A ROLE
--
-- Parameters:
--   1. user ID
--   2. role name
--
-- This query is an authorization helper, not a replacement for service-level
-- authorization and role-assignment controls.
-- =============================================================================

SELECT EXISTS (
    SELECT 1
    FROM user_roles AS ur
    INNER JOIN roles AS r
        ON r.id = ur.role_id
    WHERE ur.user_id = ?
      AND r.name = ?
      AND r.is_active = TRUE
) AS has_role;


-- =============================================================================
-- 16. ASSIGN A ROLE TO A USER
--
-- Parameters:
--   1. user ID
--   2. role ID
--
-- Run only from a trusted administrative service. Enforce a UNIQUE(user_id,
-- role_id) constraint. Never permit public registration to assign privileged
-- roles such as admin.
-- =============================================================================

INSERT INTO user_roles (
    user_id,
    role_id
)
SELECT
    u.id,
    r.id
FROM users AS u
INNER JOIN roles AS r
    ON r.id = ?
   AND r.is_active = TRUE
WHERE u.id = ?
  AND u.deleted_at IS NULL
  AND u.account_status = 'active';


-- =============================================================================
-- 17. REMOVE A ROLE FROM A USER
--
-- Parameters:
--   1. user ID
--   2. role ID
--
-- Apply privileged-role safeguards in the administrative service.
-- =============================================================================

DELETE ur
FROM user_roles AS ur
INNER JOIN users AS u
    ON u.id = ur.user_id
WHERE ur.user_id = ?
  AND ur.role_id = ?
  AND u.deleted_at IS NULL;


-- =============================================================================
-- 18. ADMIN USER DIRECTORY
--
-- Parameters:
--   1. optional account status
--   2. account status again
--   3. optional search term
--   4. search term again
--   5. search term again
--   6. page size
--   7. offset
--
-- Restrict to authorized administrators.
-- =============================================================================

SELECT
    u.public_id,
    u.name,
    u.email,
    u.phone,
    u.account_status,
    u.email_verified_at,
    u.phone_verified_at,
    u.last_login_at,
    u.created_at,
    u.updated_at
FROM users AS u
WHERE u.deleted_at IS NULL
  AND (? IS NULL OR u.account_status = ?)
  AND (
      ? IS NULL
      OR u.name LIKE CONCAT('%', ?, '%')
      OR u.email LIKE CONCAT('%', ?, '%')
  )
ORDER BY u.created_at DESC, u.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 19. ADMIN USER DETAILS
--
-- Parameter:
--   1. user public UUID
--
-- Restrict to authorized administrators. This query intentionally excludes
-- password hashes, password-reset tokens, and authentication secrets.
-- =============================================================================

SELECT
    u.public_id,
    u.name,
    u.email,
    u.phone,
    u.account_status,
    u.email_verified_at,
    u.phone_verified_at,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    GROUP_CONCAT(
        DISTINCT r.name
        ORDER BY r.name
        SEPARATOR ','
    ) AS role_names
FROM users AS u
LEFT JOIN user_roles AS ur
    ON ur.user_id = u.id
LEFT JOIN roles AS r
    ON r.id = ur.role_id
   AND r.is_active = TRUE
WHERE u.public_id = ?
  AND u.deleted_at IS NULL
GROUP BY
    u.id,
    u.public_id,
    u.name,
    u.email,
    u.phone,
    u.account_status,
    u.email_verified_at,
    u.phone_verified_at,
    u.last_login_at,
    u.created_at,
    u.updated_at
LIMIT 1;


-- =============================================================================
-- 20. CHANGE ACCOUNT STATUS
--
-- Parameters:
--   1. target status
--   2. user public UUID
--
-- Allowed statuses must match your schema. Validate the requested transition,
-- the acting administrator, and any last-admin protection in the service layer.
-- =============================================================================

UPDATE users
SET
    account_status = ?,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND deleted_at IS NULL
  AND account_status <> ?;


-- =============================================================================
-- 21. SOFT-DELETE A USER
--
-- Parameters:
--   1. user public UUID
--
-- Execute only after authorization and retention-policy checks. Consider
-- anonymization or a dedicated deactivation workflow where legal retention
-- requirements prohibit deleting associated records.
-- =============================================================================

UPDATE users
SET
    deleted_at = CURRENT_TIMESTAMP(3),
    account_status = 'disabled',
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND deleted_at IS NULL;


-- =============================================================================
-- 22. USER ACCOUNT STATISTICS
--
-- Restricted to authorized administrators.
-- =============================================================================

SELECT
    COUNT(*) AS total_users,
    SUM(account_status = 'active') AS active_users,
    SUM(account_status = 'pending_verification') AS pending_verification_users,
    SUM(account_status = 'disabled') AS disabled_users,
    SUM(email_verified_at IS NOT NULL) AS email_verified_users,
    SUM(phone_verified_at IS NOT NULL) AS phone_verified_users
FROM users
WHERE deleted_at IS NULL;


-- =============================================================================
-- 23. USERS CREATED WITHIN A DATE RANGE
--
-- Parameters:
--   1. inclusive start timestamp
--   2. exclusive end timestamp
--
-- =============================================================================

SELECT
    DATE(created_at) AS registration_date,
    COUNT(*) AS registered_users
FROM users
WHERE created_at >= ?
  AND created_at < ?
  AND deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY registration_date DESC;


-- =============================================================================
-- 24. CHECK FOR DUPLICATE EMAILS
--
-- Useful for migration validation or database health checks.
-- Do not expose the results through a public endpoint.
-- =============================================================================

SELECT
    email,
    COUNT(*) AS duplicate_count
FROM users
WHERE deleted_at IS NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, email ASC;


-- =============================================================================
-- 25. CHECK FOR USERS WITHOUT ROLES
--
-- Useful for internal diagnostics. Some systems intentionally allow role-less
-- accounts during registration; interpret results according to your policy.
-- =============================================================================

SELECT
    u.public_id,
    u.email,
    u.account_status,
    u.created_at
FROM users AS u
LEFT JOIN user_roles AS ur
    ON ur.user_id = u.id
WHERE u.deleted_at IS NULL
  AND u.account_status = 'active'
  AND ur.user_id IS NULL
ORDER BY u.created_at DESC;


-- =============================================================================
-- 26. RECOMMENDED INDEXES
--
-- Inspect existing indexes before applying these statements.
-- Do not add a unique email index until existing duplicate data is resolved.
-- Ensure the chosen uniqueness policy accounts for soft-deleted accounts.
-- =============================================================================

-- CREATE UNIQUE INDEX uq_users_public_id
--     ON users (public_id);
--
-- CREATE UNIQUE INDEX uq_users_email
--     ON users (email);
--
-- CREATE INDEX idx_users_status_created
--     ON users (account_status, created_at);
--
-- CREATE INDEX idx_users_last_login
--     ON users (last_login_at);
--
-- CREATE UNIQUE INDEX uq_user_roles_user_role
--     ON user_roles (user_id, role_id);
--
-- CREATE INDEX idx_user_roles_role_user
--     ON user_roles (role_id, user_id);


-- =============================================================================
-- END OF USER MANAGEMENT QUERIES
-- =============================================================================
