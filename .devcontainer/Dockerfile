
# =============================================================================
# MEDORBITS | DEVELOPMENT CONTAINER
#
# File: .devcontainer/Dockerfile
# Purpose: Reproducible Node.js and Python development environment
#
# Security:
#   - Non-root development user by default
#   - No embedded credentials or production secrets
#   - Minimal OS packages and cleaned package-manager caches
#   - Project dependencies installed by Dev Container lifecycle commands
#   - No application deployment or database migrations
# =============================================================================

FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

LABEL org.opencontainers.image.title="MedOrbits Development Container" \
      org.opencontainers.image.description="Node.js and Python development environment for MedOrbits" \
      org.opencontainers.image.vendor="MedOrbits"

ENV NODE_ENV=development \
    HOST=0.0.0.0 \
    PORT=3000 \
    API_PREFIX=/api/v1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NPM_CONFIG_AUDIT=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /workspaces

USER root

# Install only essential OS utilities.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openssh-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /workspaces \
    && chown node:node /workspaces

# Run development processes as the standard non-root user.
USER node

WORKDIR /workspaces

# Fail the image build if required tools are unavailable.
RUN node --version \
    && npm --version \
    && git --version

EXPOSE 3000

# Dev Containers manages the lifecycle.
CMD ["sleep", "infinity"]
