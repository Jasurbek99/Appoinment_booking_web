# Appointment Booking

Internal tool for managing visitor appointments with three executives. See `SPEC.md` for the full specification and `PLAN.md` for the implementation plan. `prototype.jsx` is the visual contract for every screen. `CLAUDE.md` orients future Claude Code sessions.

## Quickstart

Prerequisites: Docker Desktop, Node.js 20+, npm.

```bash
# 1. Configure environment
cp .env.example .env            # then edit .env

# 2. Start MSSQL
docker compose up -d
docker compose ps               # wait for "healthy"

# 3. Backend
cd backend
npm install
npm run migrate                 # creates schema, trigger, system causes
npm run seed                    # creates the initial secretary user (sec1)
npm run dev                     # http://localhost:3000

# 4. Frontend (in another terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

## Tests

```bash
cd backend && npm run migrate:test && npm test
cd frontend && npm test
```

Backend tests run against a separate `appointments_test` database (configured via `DB_NAME_TEST`). They are integration tests against real MSSQL, not mocks.

## Layout

```
.
├── SPEC.md            source of truth
├── PLAN.md            18-step build plan
├── CLAUDE.md          guidance for Claude Code sessions
├── prototype.jsx      visual contract — do not ship
├── docker-compose.yml MSSQL service
├── backend/           Express + Socket.io + mssql
└── frontend/          React + Vite + Tailwind
```

## Internationalization

The app ships with Russian (default) and Turkmen (Latin). The Turkmen strings in `prototype.jsx` were AI-drafted. **A native speaker must review `frontend/src/i18n/tk.json` before production.**
