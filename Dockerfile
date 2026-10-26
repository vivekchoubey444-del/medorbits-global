# ============================================================
# MEDORBITS -- HARDENED PRODUCTION DOCKERFILE
# Multi-stage build | Non-root user | Production dependencies
# ============================================================
# ------------------------------------------------------------
# Stage 1: Install production dependencies
# ------------------------------------------------------------
FROM node:25-alpine AS dependencies
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force
# ------------------------------------------------------------
# Stage 2: Production runtime
# ------------------------------------------------------------
FROM node:25-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    API_PREFIX=/api/v1
# Install only runtime dependencies.
COPY --from=dependencies --chown=node:node \
    /app/node_modules ./node_modules
# Copy the application.
# Ensure .dockerignore excludes secrets, local dependencies,
# Git metadata, logs, coverage, and development artifacts.
COPY --chown=node:node . .
# Create private runtime directories.
RUN mkdir -p \
      /app/storage/private \
      /app/storage/temporary \
      /app/storage/logs \
    && chown -R node:node /app/storage \
    && chmod -R u=rwX,go= /app/storage \
    && chmod -R go-w /app
# Run as the unprivileged Node.js user.
USER node
# Application HTTP port.
EXPOSE 3000
# Liveness check.
# Requires GET /health to return HTTP 2xx.
HEALTHCHECK --interval=30s \
    --timeout=5s \
    --start-period=30s \
    --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(4000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
# Start the application.
CMD ["node", "server.js"]