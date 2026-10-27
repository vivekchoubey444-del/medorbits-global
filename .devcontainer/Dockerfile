
# =============================================================================
# MEDORBITS | DEVELOPMENT CONTAINER
#
# File: .devcontainer/Dockerfile
# Purpose: Secure, reproducible Node.js development environment
#
# Security:
#   - Non-root execution
#   - No embedded credentials or production secrets
#   - Minimal OS packages
#   - Dependency installation controlled by the devcontainer lifecycle
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

# Install only the minimal utilities required by the development environment.
# Keep package installation reproducible where possible and remove apt metadata.
USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openssh-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Ensure the standard development user owns the workspace root.
RUN mkdir -p /workspaces \
    && chown node:node /workspaces

# Do not copy application source or install project dependencies at image build
# time. The devcontainer mounts the repository as the workspace.
USER node

WORKDIR /workspaces

# Confirm essential tooling is available without installing project packages.
RUN node --version \
    && npm --version \
    && git --version

EXPOSE 3000

# The Dev Containers runtime manages the development container lifecycle.
CMD ["sleep", "infinity"]
