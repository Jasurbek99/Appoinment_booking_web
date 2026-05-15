# syntax=docker/dockerfile:1.7

# ---- deps stage: install production dependencies only ----
FROM node:20-alpine AS deps
WORKDIR /app

# bcrypt builds native code — needs python+build-base on alpine. Removed
# afterwards to keep the runtime image lean.
RUN apk add --no-cache --virtual .build-deps python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && apk del .build-deps

# ---- runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the unprivileged node user that the base image already provides.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations

USER node
EXPOSE 3000

# Container-native healthcheck so the orchestrator can decide when this is ready.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
