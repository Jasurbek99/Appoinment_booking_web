#!/usr/bin/env bash
# Deploy the appointment-booking stack on the production host.
#
# First time:
#   - clone the repo somewhere (e.g. /opt/appointments)
#   - cp .env.example .env.production && edit it
#   - bash scripts/deploy.sh
#
# Subsequent deploys (after pushing to main):
#   - bash scripts/deploy.sh
#
# This script is idempotent: running it twice in a row is safe and the
# second run is a no-op unless main moved or images changed.

set -euo pipefail

# Always run from repo root, regardless of where the user invoked us from.
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="docker-compose.prod.yml"
COMPOSE="docker compose --env-file $ENV_FILE -f $COMPOSE_FILE"

log()  { printf "\033[1;34m[deploy]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[deploy]\033[0m %s\n" "$*" >&2; }
die()  { printf "\033[1;31m[deploy]\033[0m %s\n" "$*" >&2; exit 1; }

# ---- prerequisites ----------------------------------------------------------

log "checking prerequisites"
command -v docker >/dev/null 2>&1 || die "docker not installed"
docker compose version >/dev/null 2>&1 || die "docker compose v2 not installed (need 'docker compose', not 'docker-compose')"
command -v git >/dev/null 2>&1 || die "git not installed"

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found in $REPO_ROOT. Copy .env.example to $ENV_FILE and fill it in."

# Refuse to deploy if the env file still has placeholder secrets.
if grep -qE '^JWT_SECRET=replace-with-' "$ENV_FILE"; then
  die "$ENV_FILE still has the placeholder JWT_SECRET. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\""
fi
if grep -qE '^NODE_ENV=development' "$ENV_FILE"; then
  warn "$ENV_FILE has NODE_ENV=development — switching to production is strongly recommended."
fi

# ---- pull latest ------------------------------------------------------------

if [[ "${SKIP_PULL:-0}" != "1" ]]; then
  log "git fetch + reset to origin/$(git rev-parse --abbrev-ref HEAD)"
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git fetch --quiet origin "$BRANCH"
  BEFORE="$(git rev-parse HEAD)"
  git reset --hard "origin/$BRANCH" >/dev/null
  AFTER="$(git rev-parse HEAD)"
  if [[ "$BEFORE" == "$AFTER" ]]; then
    log "already at $AFTER"
  else
    log "moved $BEFORE → $AFTER"
  fi
else
  log "SKIP_PULL=1 — using working tree as-is"
fi

# ---- build + bring up -------------------------------------------------------

log "building images"
$COMPOSE build

log "starting stack (detached)"
$COMPOSE up -d --remove-orphans

# Wait for the backend to be able to reach its database before running
# migrations. /api/health pings the DB, so this covers both the bundled-db
# profile (waits for the mssql container to start) and the external-db
# case (waits for connectivity to the prod DB IP).
log "waiting for backend to reach its database"
DB_READY=0
for i in $(seq 1 60); do
  # Use the backend container's own healthcheck status — it polls /api/health
  # on localhost:3000 every 10s and flips to "healthy" once the DB ping passes.
  status="$(docker inspect -f '{{.State.Health.Status}}' appointments-backend 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    log "backend healthy after ~${i}0s"
    DB_READY=1
    break
  fi
  sleep 10
done

if [[ "$DB_READY" != "1" ]]; then
  $COMPOSE logs --tail=80 backend >&2
  die "backend did not reach its database within 10 minutes — check DB_SERVER, DB_USER, DB_PASSWORD and firewall rules"
fi

# ---- migrations -------------------------------------------------------------

log "running migrations"
$COMPOSE exec -T backend node src/db/migrate.js

# ---- health check -----------------------------------------------------------

FRONTEND_PORT="$(grep -E '^FRONTEND_PORT=' "$ENV_FILE" | cut -d= -f2 || true)"
FRONTEND_PORT="${FRONTEND_PORT:-8088}"

log "probing /api/health on port $FRONTEND_PORT"
for i in $(seq 1 12); do
  if curl -fsS --max-time 5 "http://localhost:$FRONTEND_PORT/api/health" >/dev/null 2>&1; then
    body="$(curl -fsS "http://localhost:$FRONTEND_PORT/api/health")"
    log "health: $body"
    log "deploy complete"
    exit 0
  fi
  sleep 5
done

$COMPOSE logs --tail=50 backend >&2
die "/api/health did not respond OK within 60s — see backend logs above"
