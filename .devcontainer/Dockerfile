
# ==============================================================================
# MedOrbits / GHAR -- Development Container
# File: /.devcontainer/Dockerfile
# ==============================================================================

FROM node:22-bookworm

LABEL org.opencontainers.image.title="MedOrbits GHAR Development"
LABEL org.opencontainers.image.description="Full-stack development environment"

USER root

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    python3-dev \
    git \
    curl \
    wget \
    ca-certificates \
    build-essential \
    pkg-config \
    bash \
    jq \
    unzip \
    zip \
    postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

RUN mkdir -p /workspace/.devcontainer \
    && chown -R node:node /workspace

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

USER node

CMD ["sleep", "infinity"]
