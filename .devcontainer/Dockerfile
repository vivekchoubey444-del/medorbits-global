
# =============================================================================
# MEDORBITS | DEVELOPMENT CONTAINER
#
# File: .devcontainer/Dockerfile
# Purpose: Secure, reproducible Node.js development environment
#
# Security:
#   - Non-root execution by default
#   - No embedded credentials or production secrets
#   - Minimal OS packages
#   - Dependency installation controlled by devcontainer lifecycle
#   - No application deployment or database migration
# =============================================================================

FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

LABEL org.opencontainers.image.title="MedOrbits Development Container"
LABEL org.opencontainers.image.description="Development environment for the MedOrbits platform"
LABEL org.opencontainers.image.vendor="MedOrbits"

ENV NODE_ENV=development \
    HOST=0.0.0.0 \
    PORT=3000 \
    API_PREFIX=/api/v1 \
    NPM_CONFIG_AUDIT=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /workspaces

# Install only essential development utilities.
USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openssh-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Prepare workspace permissions for the standard development user.
RUN mkdir -p /workspaces \
    && chown node:node /workspaces

# Do not copy source files or install project dependencies during image build.
# The Dev Containers runtime mounts the repository into the workspace.
USER node

WORKDIR /workspaces

# Verify essential tooling.
RUN node --version \
    && npm --version \
    && git --version

EXPOSE 3000

# The Dev Containers runtime manages the container lifecycle.
CMD ["sleep", "infinity"]
