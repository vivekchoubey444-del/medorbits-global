# =============================================================================
# MEDORBITS | DEVELOPMENT CONTAINER
#
# File: .devcontainer/Dockerfile
# Purpose: Secure, reproducible Node.js and Python development environment
#
# Security:
#   - Non-root development user by default
#   - No embedded credentials or production secrets
#   - Minimal OS packages and cleaned package-manager caches
#   - Project dependencies installed by Dev Container lifecycle commands
#   - No application deployment or database migrations
# =============================================================================

FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

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

# Install minimal OS-level development utilities.
USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openssh-client \
        python3 \
        python3-venv \
        python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /workspaces \
    && chown node:node /workspaces

# Retain the standard non-root development user.
USER node

WORKDIR /workspaces

# Verify the required runtime tools during image build.
RUN node --version \
    && npm --version \
    && git --version \
    && python3 --version \
    && python3 -m venv --help >/dev/null

EXPOSE 3000

# Dev Containers controls the container lifecycle.
CMD ["sleep", "infinity"]