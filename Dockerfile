# ============================================================
# MEDORBITS -- DOCKER COMPOSE
# Production-oriented deployment configuration
#
# Usage:
#   docker compose config
#   docker compose build
#   docker compose up -d
#   docker compose ps
#   docker compose logs --tail=100 app
#   docker compose down
#
# Safety:
#   - No automatic image publishing.
#   - No automatic database migrations.
#   - No automatic deletion of persistent volumes.
#   - Secrets should be supplied through environment variables
#     or your deployment platform's secret manager.
# ============================================================
name: medorbits
services:
  app:
    container_name: medorbits-app
    build:
      context: .
      dockerfile: Dockerfile
    image: medorbits:local
    init: true
    restart: unless-stopped
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: "3000"
      API_PREFIX: /api/v1
      # Application database configuration.
      # Set DATABASE_URL for PostgreSQL deployments.
      # For MySQL deployments, configure DB_* variables only
      # if the application actually uses a MySQL driver.
      DATABASE_URL: "${DATABASE_URL:-}"
      # Optional configuration values.
      DATABASE_SSL: "${DATABASE_SSL:-false}"
      LOG_LEVEL: "${LOG_LEVEL:-info}"
      # Configure this in your deployment environment.
      # Do not place real secrets in this file.
      SESSION_SECRET: "${SESSION_SECRET:?Set SESSION_SECRET in your environment}"
    ports:
      # Bind to localhost by default.
      # Change APP_BIND_ADDRESS only when external exposure
      # is intentionally required.
      - "${APP_BIND_ADDRESS:-127.0.0.1}:${APP_PORT:-3000}:3000"
    volumes:
      - app_private:/app/storage/private
      - app_temporary:/app/storage/temporary
      - app_logs:/app/storage/logs
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
    networks:
      - medorbits_internal
volumes:
  app_private:
    name: medorbits_private_data
  app_temporary:
    name: medorbits_temporary_data
  app_logs:
    name: medorbits_application_logs
networks:
  medorbits_internal:
    name: medorbits_internal
    driver: bridge