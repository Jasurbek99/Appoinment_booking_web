# Appointment Booking

Internal tool for managing visitor appointments with three executives. Replaces a paper/verbal workflow where approvals weren't consistently logged.

- **`SPEC.md`** — source-of-truth specification.
- **`PLAN.md`** — the 18-step build plan executed in this repo.
- **`CLAUDE.md`** — orientation for future Claude Code sessions.
- **`prototype.jsx`** — clickable mock used as the visual contract.

## Quickstart

Prerequisites: Docker Desktop, Node.js 20+, npm.

```bash
# 1. Configure env
cp .env.example .env
#    Edit .env: set MSSQL_SA_PASSWORD, JWT_SECRET (>= 32 chars),
#    DB_PASSWORD to match, and INITIAL_SECRETARY_PASSWORD.

# 2. Start MSSQL
docker compose up -d
docker compose ps                 # wait for "healthy"

# 3. Backend
cd backend
npm install
npm run migrate                   # applies 001_init, 002_audit_trigger, 003_seed_causes
npm run seed                      # creates sec1 (secretary) with INITIAL_SECRETARY_PASSWORD
npm run dev-seed                  # optional: extra demo users (b1/b2/b3, pw "changeme") + sample data
npm run dev                       # REST + websocket on http://localhost:3000

# 4. Frontend (another terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

## Tests

```bash
cd backend && npm test            # requires MSSQL up (uses appointments_test DB)
RUN_DB_TESTS=0 npm test           # skip DB-touching globalSetup (frontend-only iteration)
cd frontend && npm test
```

Backend tests are integration tests against a real MSSQL test database (no DB mocks — see SPEC.md lessons-learned and CLAUDE.md). Frontend tests run under jsdom.

## What's where

```
.
├── backend/
│   ├── migrations/        001_init.sql, 002_audit_trigger.sql, 003_seed_causes.sql
│   └── src/
│       ├── db/            pool, tx, migration runner, seed scripts
│       ├── lib/           errors, roles
│       ├── middleware/    auth (JWT cookie), error translator
│       ├── routes/        auth, users, causes, appointments, public, employees, journal, stats
│       ├── schemas/       Zod schemas
│       ├── services/      users, auth, causes, appointments.read/write/serializer, employees
│       └── sockets/       Socket.io setup + post-commit fan-out
├── frontend/
│   └── src/
│       ├── components/    primitives, TopBar, AppointmentCard, RejectModal, NewAppointmentModal,
│       │                  CausesSection, UsersSection, JournalTable, BossAnalytics, TodayList,
│       │                  FutureList, WorkerAppointmentCard
│       ├── contexts/      AuthContext, I18nProvider (react-i18next), SocketContext, ToastProvider
│       ├── hooks/         useAppointments, useAppointmentEvents, useEmployees, useCauses, useUsers, useJournal
│       ├── i18n/          ru.json, tk.json, index.js
│       ├── lib/           api fetch wrapper, queryClient, format
│       └── pages/         LoginPage, StaffDashboard, BossDashboard, WorkerStatusPage, HomeRedirect
```

## Routes

- `/login` — username/password form
- `/dashboard/staff` — staff (secretary, assistants): Today / Future / Journal / Settings tabs
- `/dashboard/boss` — bosses: Today (Pending | Queue) / Future / Analytics tabs
- `/status` — public lastname search (no auth)

## Internationalization

The app ships with Russian (default) and Turkmen (Latin) bundles.

**The Turkmen translation in `frontend/src/i18n/tk.json` was AI-drafted (lifted from `prototype.jsx`). A native speaker must review it before production deployment.** A `_NOTE` key flags this inside the file.

## Verification done

- Every backend file passes `node --check`.
- Frontend `npm run build` and `vitest` pass.
- Live DB- and websocket-dependent verification (per-step "Definition of done" in `PLAN.md`) is deferred until the developer has Docker running on a machine that doesn't have port 3000 occupied — these checks were not runnable in the build environment.
