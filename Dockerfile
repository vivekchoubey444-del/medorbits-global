# =============================================================================
# MEDORBITS | DOCKER COMPOSE
# Production-Oriented Deployment Configuration
#
# File: compose.yaml
# Project: MedOrbits
# Configuration Version: Compose Specification
#
# Usage:
#   docker compose config
#   docker compose build
#   docker compose up -d
#   docker compose ps
#   docker compose logs --tail=100 app
#   docker compose down
#
# Security and Safety:
#   - No automatic image publishing.
#   - No automatic database migrations.
#   - No automatic deletion of persistent volumes.
#   - Secrets must be supplied through environment variables or a
#     deployment platform's secret manager.
#   - Application ports bind to localhost by default.
#   - The application container runs with a read-only root filesystem.
#   - Linux capabilities are dropped and privilege escalation is disabled.
# =============================================================================

name: medorbits

services:

  # ---------------------------------------------------------------------------
  # Application Service
  # ---------------------------------------------------------------------------
  app:
    container_name: medorbits-app

    build:
      context: .
      dockerfile: Dockerfile

    image: medorbits:local
    init: true
    restart: unless-stopped

    # -------------------------------------------------------------------------
    # Runtime Environment
    # -------------------------------------------------------------------------
    environment:
      NODE_ENV: production
      HOST: "0.0.0.0"
      PORT: "3000"
      API_PREFIX: /api/v1

      # Database Configuration
      # PostgreSQL deployments may use DATABASE_URL.
      # MySQL deployments require a compatible application driver and
      # the corresponding DB_* configuration, if supported by the app.
      DATABASE_URL: "${DATABASE_URL:-}"
      DATABASE_SSL: "${DATABASE_SSL:-false}"

      # Logging
      LOG_LEVEL: "${LOG_LEVEL:-info}"

      # Required Application Secret
      # Supply a strong, unique value through the deployment environment.
      # Never commit the actual secret to version control.
      SESSION_SECRET: "${SESSION_SECRET:?Set SESSION_SECRET in your environment}"

    # -------------------------------------------------------------------------
    # Network Exposure
    # -------------------------------------------------------------------------
    ports:
      - "${APP_BIND_ADDRESS:-127.0.0.1}:${APP_PORT:-3000}:3000"

    networks:
      - medorbits_internal

    # -------------------------------------------------------------------------
    # Persistent Application Storage
    # -------------------------------------------------------------------------
    volumes:
      - app_private:/app/storage/private
      - app_temporary:/app/storage/temporary
      - app_logs:/app/storage/logs

    # -------------------------------------------------------------------------
    # Container Hardening
    # -------------------------------------------------------------------------
    read_only: true

    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64m

    security_opt:
      - no-new-privileges:true

    cap_drop:
      - ALL

    pids_limit: 200
    mem_limit: 512m
    cpus: 1.0

    stop_grace_period: 30s

    # -------------------------------------------------------------------------
    # Health Monitoring
    # -------------------------------------------------------------------------
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - >-
          fetch('http://127.0.0.1:3000/health',
          {signal: AbortSignal.timeout(4000)})
          .then(r => process.exit(r.ok ? 0 : 1))
          .catch(() => process.exit(1))

      interval: 30s
      timeout: 5s
      start_period: 30s
      retries: 3


# =============================================================================
# Persistent Volumes
# =============================================================================
# Named volumes persist independently of the application container.
# `docker compose down` does not remove them by default.
# Avoid `docker compose down -v` unless deletion is explicitly intended.
# =============================================================================

volumes:

  app_private:
    name: medorbits_private_data

  app_temporary:
    name: medorbits_temporary_data

  app_logs:
    name: medorbits_application_logs


# =============================================================================
# Internal Network
# =============================================================================
# Application network for internal service communication.
# Add database services here only when required by the actual architecture.
# =============================================================================

networks:

  medorbits_internal:
    name: medorbits_internal
    driver: bridge