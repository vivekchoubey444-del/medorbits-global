
#!/usr/bin/env bash
# =============================================================================
# MedOrbits -- Service Availability Waiter
# File: /scripts/wait-for-service.sh
# Version: 2.0.0
#
# Purpose:
#   Wait until a TCP service becomes reachable.
#
# Usage:
#   ./scripts/wait-for-service.sh
#   ./scripts/wait-for-service.sh postgres 5432
#   ./scripts/wait-for-service.sh redis 6379 60
#   ./scripts/wait-for-service.sh database 5432 60 3
#
# Arguments:
#   1. HOST                Default: postgres
#   2. PORT                Default: 5432
#   3. MAX_ATTEMPTS        Default: 30
#   4. CONNECTION_TIMEOUT Default: 2 seconds
#
# Exit codes:
#   0 = Service available
#   1 = Service unavailable
#   2 = Invalid configuration or missing utility
#
# Security:
#   - Does not expose credentials.
#   - Does not execute SQL commands.
#   - Does not modify database state.
#   - Checks TCP connectivity only.
#
# Requirements:
#   Bash 4+
#   timeout utility
# =============================================================================

set -Eeuo pipefail

# =============================================================================
# 01. CONFIGURATION
# =============================================================================

HOST="${1:-postgres}"
PORT="${2:-5432}"
MAX_ATTEMPTS="${3:-30}"
CONNECTION_TIMEOUT="${4:-2}"

# =============================================================================
# 02. VALIDATION
# =============================================================================

fail() {
    printf 'ERROR: %s\n' "$1" >&2
    exit "${2:-2}"
}

[[ -n "$HOST" ]] || fail "HOST cannot be empty."

[[ "$HOST" =~ ^[a-zA-Z0-9._:-]+$ ]] ||
    fail "HOST contains unsupported characters."

[[ "$PORT" =~ ^[0-9]+$ ]] ||
    fail "PORT must be a positive integer."

(( PORT >= 1 && PORT <= 65535 )) ||
    fail "PORT must be between 1 and 65535."

[[ "$MAX_ATTEMPTS" =~ ^[0-9]+$ ]] ||
    fail "MAX_ATTEMPTS must be a positive integer."

(( MAX_ATTEMPTS >= 1 && MAX_ATTEMPTS <= 10000 )) ||
    fail "MAX_ATTEMPTS must be between 1 and 10000."

[[ "$CONNECTION_TIMEOUT" =~ ^[0-9]+$ ]] ||
    fail "CONNECTION_TIMEOUT must be a positive integer."

(( CONNECTION_TIMEOUT >= 1 && CONNECTION_TIMEOUT <= 60 )) ||
    fail "CONNECTION_TIMEOUT must be between 1 and 60 seconds."

# =============================================================================
# 03. DEPENDENCY CHECK
# =============================================================================

command -v timeout >/dev/null 2>&1 ||
    fail "The timeout utility is required." 2

# =============================================================================
# 04. CONNECTION CHECK
# =============================================================================

check_connection() {
    timeout "${CONNECTION_TIMEOUT}s" \
        bash -c 'exec 3<>"/dev/tcp/$1/$2"' _ "$HOST" "$PORT" \
        2>/dev/null
}

# =============================================================================
# 05. WAIT LOOP
# =============================================================================

printf 'Waiting for service %s:%s\n' "$HOST" "$PORT"
printf 'Maximum attempts: %s\n' "$MAX_ATTEMPTS"
printf 'Connection timeout: %ss\n' "$CONNECTION_TIMEOUT"

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do

    if check_connection; then
        printf 'SUCCESS: %s:%s is accepting TCP connections.\n' \
            "$HOST" "$PORT"
        exit 0
    fi

    printf 'Attempt %s/%s failed. Retrying...\n' \
        "$attempt" "$MAX_ATTEMPTS"

    if (( attempt < MAX_ATTEMPTS )); then
        sleep 2
    fi

done

# =============================================================================
# 06. FAILURE
# =============================================================================

printf 'ERROR: Service %s:%s did not become available.\n' \
    "$HOST" "$PORT" >&2

exit 1
