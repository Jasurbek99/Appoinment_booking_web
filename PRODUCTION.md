# Production deployment

Docker-based deployment for the appointment-booking app. The stack is three
containers on one host: MSSQL, the Node backend, and an nginx container that
serves the SPA and reverse-proxies `/api` and `/socket.io` to the backend.

## What's in scope here

This document covers what was hardened for production:

- Security middleware (helmet, rate limiting, body limit, trust proxy, cookie flags, CORS lockdown).
- Build and env config (`.env.example`, prod JWT secret check, dev-seed guard).
- Observability (pino structured logs, request logging, `/health` with DB ping, graceful shutdown).
- Reverse proxy and TLS readiness (nginx config in the frontend container).
- CI (lint + test + build for both packages).

## Deferred — not in place yet

- **Append-only enforcement on `appointment_history`.** Per `CLAUDE.md`, this
  table is the product. Right now only application code prevents mutation;
  there is no DB-level trigger or restricted DB account enforcing that. Add
  a trigger or run the backend under a DB user with no `UPDATE`/`DELETE` on
  this table before you go live.
- **Backups.** No backup automation here. Schedule SQL Server backups
  (full + log) to off-host storage and test the restore.
- **Error tracking** (Sentry, etc.) and an external log sink. The app emits
  JSON to stdout — point your container runtime at whatever log aggregator
  you use.
- **Integration test coverage for the new prod surface.** Rate limiting,
  `/api/health` DB-ping, and graceful shutdown are exercised only by manual
  probe. Add tests when you wire an MSSQL service container into CI (see
  `RUN_DB_TESTS` in `backend/vitest.config.js`).
- **TLS termination.** This stack listens on plain HTTP on `FRONTEND_PORT`.
  Put a host nginx, Traefik, or Caddy in front and let it manage Let's
  Encrypt. The frontend container is HTTP-only on purpose so the TLS layer
  is swappable.

## Deploy script

The `scripts/deploy.sh` script handles both the first-time bootstrap and
every subsequent deploy. It's idempotent — re-running it with no changes
is a no-op. Under the hood it:

1. Verifies prerequisites (docker, docker compose v2, git, `.env.production`).
2. Refuses to run if `JWT_SECRET` still has the placeholder value.
3. `git fetch && git reset --hard origin/<current-branch>` (skip with `SKIP_PULL=1`).
4. `docker compose build` + `up -d --remove-orphans`.
5. Waits for the MSSQL healthcheck to pass.
6. Runs `node src/db/migrate.js` inside the backend container.
7. Polls `/api/health` until it returns OK, then exits 0.

Run it from the repo root on the host:

```bash
bash scripts/deploy.sh
```

If anything fails the script exits non-zero with the relevant container
logs already printed.

## First-time setup

1. **Copy and fill the env file.** All required values are checked at startup
   and the backend refuses to boot if anything is missing.

   ```bash
   cp .env.example .env.production
   ```

   Then edit `.env.production`:

   - `NODE_ENV=production`
   - `JWT_SECRET` — must be a real 32+ char random string. Generate:
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
     (The backend refuses placeholder strings like `replace-with-...` in production.)
   - `MSSQL_SA_PASSWORD`, `DB_PASSWORD` — strong, satisfy SQL Server's policy.
   - `EMPLOYEE_DB_*` — your HR directory database creds.
   - `CORS_ORIGIN=` — leave empty for the default single-origin layout. Only
     set this if you serve the frontend from a different hostname than the API.
   - `TRUST_PROXY=1` — the backend sits behind the frontend's nginx.
   - `VITE_API_URL=` and `VITE_SOCKET_URL=` — leave empty for same-origin.

2. **Run the deploy script** — it builds, starts, migrates, and health-checks
   in one shot:

   ```bash
   bash scripts/deploy.sh
   ```

   The first run reads `INITIAL_SECRETARY_PASSWORD` from `.env.production`
   and seeds the secretary account. Log in via the frontend, change the
   password through the UI, then **delete the `INITIAL_SECRETARY_PASSWORD`
   line from `.env.production`** so it isn't sitting in the env file.

3. **Verify health** (the script already does this, but for ad-hoc checks):

   ```bash
   curl -fsS http://localhost:${FRONTEND_PORT:-8088}/api/health
   # → {"ok":true,"env":"production","db":"up"}
   ```

   The frontend container also exposes a static `/healthz` for nginx liveness.

## Subsequent deploys

After merging changes to main, on the host:

```bash
cd /path/to/appointment_booking
bash scripts/deploy.sh
```

That's the whole loop. The script git-pulls, rebuilds only what changed,
restarts containers, runs new migrations, and exits 0 once `/api/health`
reports healthy. If it exits non-zero, the relevant container logs are
already on stderr — paste them when asking for help.

To deploy a specific commit/branch (e.g. a hotfix branch) without pulling
from origin, `git checkout` it first then run `SKIP_PULL=1 bash scripts/deploy.sh`.

## Database: bundled vs external

The stack runs in one of two database modes, chosen by `COMPOSE_PROFILES`
in `.env.production`:

| Mode | `COMPOSE_PROFILES` | `DB_SERVER` | What runs |
|---|---|---|---|
| Bundled (default for greenfield) | `bundled-db` | `mssql` | mssql + backend + frontend |
| External (existing prod DB) | _(empty)_ | prod DB IP/hostname | backend + frontend only |

In **external** mode the bundled mssql service is skipped entirely — the
backend connects directly to your production database server. Things to
check before switching:

- The deploy host can reach the prod DB IP on port 1433 (`nc -zv <ip> 1433`).
- The DB account in `DB_USER`/`DB_PASSWORD` exists on the prod server and
  has `CREATE DATABASE` rights on first migrate (or the `appointments`
  database already exists and the account has `db_owner` on it).
- The `EMPLOYEE_DB_*` account exists on the HR database, read-only.
- The prod DB's firewall accepts connections from the deploy host's IP.

Switching modes after the fact is non-trivial — you'd need to export and
re-import data. Pick one mode at the start and stick with it.

## Port layout

Only one host port is bound:

| Container | Container port | Host port | Purpose |
|---|---|---|---|
| frontend (nginx) | 80 | `FRONTEND_PORT` (default 8088) | SPA + reverse proxy to backend |
| backend (node)   | 3000 | — (internal only) | API + sockets |
| mssql            | 1433 | — (internal only) | Database |

Pick `FRONTEND_PORT` from a free port on the host (`sudo ss -tuln`). Common
choices:

- **8088** (default) — leaves 80/443 free for a host TLS terminator.
- **80** — only when no other web server runs on the host and you'll add
  TLS later (or terminate it elsewhere).

## TLS

Run a host-level reverse proxy that terminates TLS and forwards plain HTTP
to the frontend container on `${FRONTEND_PORT}`. Example with host nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 600s;
    }
}
```

With TLS in place, the backend's `secure: config.isProduction` cookie flag
takes effect and the JWT cookie will only travel over HTTPS. If you proxy
through more layers, set `TRUST_PROXY` to the number of hops.

## Operations

- **Logs:** `docker compose -f docker-compose.prod.yml logs -f backend`
  (JSON one-per-line, parseable by every log tool).
- **Restart backend:** `docker compose -f docker-compose.prod.yml restart backend`.
  Graceful shutdown closes socket.io, drains in-flight HTTP, and closes the
  DB pool, with a 10s hard exit if anything hangs.
- **Rate limits:** general API is 300 req/min/IP, login is 30/15min/IP plus
  10/15min/username. Adjust in `backend/src/middleware/rateLimit.js`.
- **Updating the SPA without restarting the backend:** rebuild and replace
  just the frontend service:
  `docker compose -f docker-compose.prod.yml up -d --build frontend`.

## Production checklist before going live

- [ ] `JWT_SECRET` is a freshly generated random string, not from `.env.example`.
- [ ] `INITIAL_SECRETARY_PASSWORD` was set on first migrate, then immediately
      changed via the UI and removed from the env file.
- [ ] TLS is terminating in front of the frontend container; HTTP→HTTPS redirect set.
- [ ] `appointment_history` append-only enforcement is in place at the DB level.
- [ ] MSSQL backups are scheduled and one restore drill has been completed.
- [ ] The host nginx (or whatever terminates TLS) sets `X-Forwarded-Proto`
      and `TRUST_PROXY` matches the hop count.
- [ ] Container logs are flowing to your log aggregator.
- [ ] A non-root host user owns the deploy directory and `.env.production`
      has `chmod 600`.
