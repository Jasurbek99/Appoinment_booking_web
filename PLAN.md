# Appointment Booking System — Implementation Plan

## How to use this plan

This plan takes the repo from its current pre-implementation state to a working v1 satisfying `SPEC.md`. Execute steps **strictly in order** — each step's "definition of done" is a concrete check you can run before moving on. Step 0 is a bootstrap step inserted before SPEC.md Appendix C step 1, because the spec assumes `npm` and the `frontend/`/`backend/` tree already exist; they don't.

**v1 is "done" when:** all 18 SPEC.md §C steps are complete, the prototype's screens render against the real backend, every state-changing endpoint writes a `appointment_history` row in the same transaction, Socket.io events drive list updates without refetching, the carryover rule works on a date rollover, and an integration-test suite against a real MSSQL test database passes green.

**Tech picks committed up front (don't relitigate mid-build):**

- **Language:** plain JavaScript, ESM (`"type": "module"`) on both sides. Closer to the prototype, ships faster, fewer build moving parts. Zod still gives runtime validation; we accept losing `z.infer` static typing.
- **MSSQL:** Docker via `docker-compose.yml` at repo root using `mcr.microsoft.com/mssql/server:2022-latest`. Avoids Windows install rituals; same image works in CI; disposable.
- **Migrations:** small in-house runner (~50 LOC) reading numbered `.sql` files from `backend/migrations/`, tracking applied IDs in a `_migrations` table, one transaction per file. No library.
- **Audit-log integrity:** database `INSTEAD OF UPDATE, DELETE` trigger on `appointment_history` that `THROW`s. Picked over a restricted DB account because the defense lives with the schema and can't be undone by a future GRANT.
- **Testing:** Vitest both sides. Backend tests are integration tests against a separate `appointments_test` MSSQL database — no DB mocks, per the spec's lessons-learned ethos. Frontend tests focus on hooks/components with React Testing Library; no E2E in v1.

## Critical-concerns map

| Concern | Addressed in step(s) |
|---|---|
| Project bootstrap (no `package.json` exists) | Step 0 |
| MSSQL on Windows host | Step 0 (Docker), Step 1 (migrations) |
| Audit-log append-only enforcement | Step 1 (trigger), Step 6 (single-tx writes) |
| Emit Socket.io **after** commit | Step 6 (service pattern), Step 14 (wiring) |
| Carryover as `WHERE` clause, not cron | Step 5 (single read service) |
| Employee API stub-and-swap | Step 0 (env scaffold), Step 11 (service module) |
| Turkmen i18n native-review TODO | Step 15 |
| Testing strategy | Step 0 (Vitest scaffold), tests added per step |

---

## Step 0 — Repo bootstrap

**Goal:** stand up the empty workspaces, MSSQL, env scaffolding, and the test runner so every later step has somewhere to live.

**Files to create:**

- `docker-compose.yml` — single `mssql` service (port 1433, `MSSQL_SA_PASSWORD` from env, healthcheck via `sqlcmd`), named volume `mssql-data`.
- `.env.example` — every var from SPEC.md §13 (`PORT`, `JWT_SECRET`, `DB_*`, `EMPLOYEE_API_URL`, `EMPLOYEE_API_KEY`, `CORS_ORIGIN`, `VITE_API_URL`, `VITE_SOCKET_URL`) plus `MSSQL_SA_PASSWORD` and `DB_NAME_TEST=appointments_test`.
- `.gitignore` — `node_modules`, `.env`, `.env.local`, `dist`, `coverage`, `mssql-data`.
- `README.md` — one-screen quickstart: `docker compose up -d`, `cd backend && npm i && npm run migrate && npm run dev`, `cd frontend && npm i && npm run dev`.
- `backend/package.json` — ESM, scripts: `dev` (node --watch), `migrate`, `migrate:test`, `seed`, `test` (vitest), `lint`. Deps: `express`, `mssql`, `socket.io`, `jsonwebtoken`, `cookie-parser`, `cors`, `bcrypt`, `zod`, `dotenv`. Dev: `vitest`, `supertest`, `eslint`, `prettier`.
- `backend/src/server.js` — placeholder Express app that boots and exits cleanly.
- `backend/src/config.js` — reads env vars once, validated with Zod, exported as a typed-ish object.
- `backend/src/db/pool.js` — `mssql` connection pool singleton, picks DB name from env (so tests can flip to `appointments_test`).
- `backend/src/db/migrate.js` — the runner described above. Reads `backend/migrations/*.sql` sorted by filename, wraps each in a transaction, inserts into `_migrations`.
- `backend/migrations/.gitkeep` — empty for now; Step 1 fills it.
- `backend/tests/setup.js` — Vitest globalSetup that runs `migrate:test` against `appointments_test` then truncates between tests.
- `backend/vitest.config.js` — points to `tests/`, uses `setup.js`, `singleThread: true` (MSSQL connection pool).
- `frontend/package.json` — Vite scaffold, deps: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `socket.io-client`, `react-i18next`, `i18next`, `lucide-react`, `tailwindcss`, `@headlessui/react` (if needed; otherwise skip).
- `frontend/vite.config.js`, `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/App.jsx` — Vite minimal scaffold with Tailwind preflight, dev proxy `/api → VITE_API_URL`.
- `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/src/index.css` — Tailwind with the SPEC.md §9 palette in `theme.extend.colors` if helpful.
- `frontend/vitest.config.js` — jsdom environment, test glob `src/**/*.test.{js,jsx}`.
- `.eslintrc.json` and `.prettierrc` at repo root — minimal, shared.

**Definition of done:**
- `docker compose up -d` starts MSSQL and the healthcheck passes within 60s.
- `cd backend && npm install && npm run migrate` runs the empty runner cleanly (creates `_migrations` table).
- `cd backend && npm run dev` boots Express on port 3000 and `curl localhost:3000/health` returns `{ok:true}`.
- `cd frontend && npm install && npm run dev` serves the Vite app at port 5173.
- `cd backend && npm test` runs an empty Vitest suite green.

**Dependencies:** none.

---

## Step 1 — DB schema + migrations + seed

**Goal:** SPEC.md §4 schema lives on disk as numbered SQL files; first run applies them; system causes and one secretary user are seeded.

**Files to create:**

- `backend/migrations/001_init.sql` — all four tables exactly per SPEC.md §4 (with `NVARCHAR` everywhere, the filtered unique index on `users.username`, the partial index on `users.role`, the three indexes on `appointments`, the two on `appointment_history`).
- `backend/migrations/002_audit_trigger.sql` — the integrity trigger:
  ```sql
  CREATE TRIGGER tr_history_no_modify ON appointment_history
  INSTEAD OF UPDATE, DELETE AS
  BEGIN THROW 51000, 'appointment_history is append-only', 1; END;
  ```
- `backend/migrations/003_seed_causes.sql` — the three system causes from SPEC.md §4.
- `backend/src/db/seed.js` — script that creates **one** secretary user using `BCRYPT_ROUNDS=12` and a password from env (`INITIAL_SECRETARY_PASSWORD`). Idempotent (skips if username exists).

**Implementation details:**

- The migration runner must reject re-runs if the file's content hash differs from what was recorded — protects against silent edits.
- The trigger goes in its own migration so it can be temporarily disabled in a future migration if a schema change requires it (with a comment that says "re-enable in same migration").

**Definition of done:**
- `npm run migrate` against a fresh DB creates all tables, the trigger, and the three causes.
- `INSERT` into `appointment_history` works; `UPDATE` and `DELETE` against it fail with the THROW message. Verify in `sqlcmd`.
- `npm run seed` creates `sec1` user; running it twice does not duplicate.
- `npm run migrate` against an already-migrated DB is a no-op.

**Dependencies:** Step 0.

---

## Step 2 — Auth

**Goal:** login flow, JWT cookie, `requireAuth`/`requireRole` middleware.

**Files to create:**

- `backend/src/services/users.js` — `findByUsername`, `findById` (the latter does **not** filter `deleted_at` so audit names still resolve; the former does).
- `backend/src/services/auth.js` — `verifyPassword(plain, hash)`, `signToken(user)`, `verifyToken(token)`.
- `backend/src/middleware/auth.js` — `requireAuth` (parses cookie, verifies JWT, attaches `req.user = {id, role, displayName}`); `requireRole(...allowed)` factory; `requireStaff` and `requireBoss` convenience exports.
- `backend/src/routes/auth.js` — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Cookie options: `httpOnly: true, sameSite: 'lax', secure: NODE_ENV==='production', maxAge: 24h`.
- `backend/src/server.js` (update) — wire middleware in this order: `cookieParser()` → `cors({credentials: true, origin: env.CORS_ORIGIN})` → `express.json()` → router mounts → error middleware. Auth is **per-route**, not global, because public endpoints exist.
- `backend/tests/integration/auth.test.js` — login success, login bad password (401), missing cookie on `/me` (401), valid cookie on `/me` (200).

**Definition of done:**
- `curl -i -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"sec1","password":"<seeded>"}'` returns 200 and a `Set-Cookie: token=...; HttpOnly` header.
- `curl --cookie "token=<value>" localhost:3000/api/auth/me` returns the user object with no `password_hash`.
- `npm test` passes the four auth cases.

**Dependencies:** Step 1.

---

## Step 3 — Users CRUD

**Goal:** SPEC.md §6 `/api/users` endpoints. Soft-delete only.

**Files to create:**

- `backend/src/services/users.js` (extend) — `listActive()` (filters `deleted_at IS NULL`, groups by role in the route layer), `create({display_name, username, password, role})`, `update(id, patch)` (omit-to-keep on password; cannot change own role — caller checks), `softDelete(id)` (sets `deleted_at = SYSUTCDATETIME()`, blocks self).
- `backend/src/schemas/users.js` — Zod schemas for create / update bodies. Role must be in the SPEC.md §A `ROLES` list.
- `backend/src/routes/users.js` — four routes, all behind `requireStaff`. The two self-protection rules (`cannot change own role`, `cannot delete self`) are enforced in the route, returning 403 with `{error: 'forbidden_self'}`.
- `backend/tests/integration/users.test.js` — list, create, duplicate username (unique-index violation surfaces as 409), update keeps password when omitted, soft-delete sets `deleted_at`, can't-delete-self.

**Definition of done:**
- `POST /api/users` creates a user that can immediately log in.
- `DELETE /api/users/:id` for self returns 403; for another user, sets `deleted_at` (verify in DB).
- After soft-delete, the user is absent from `GET /api/users` but `findById` still resolves them (used later by audit log).

**Dependencies:** Step 2.

---

## Step 4 — Causes CRUD

**Goal:** SPEC.md §6 `/api/causes` endpoints.

**Files to create:**

- `backend/src/services/causes.js` — `list`, `create`, `update`, `delete` (rejects if `is_system = 1` OR if any `appointments.cause_id` references it; raise `ConflictError` for the route to translate to 409).
- `backend/src/schemas/causes.js` — Zod for create/update.
- `backend/src/routes/causes.js` — `GET` is public (`any`), the rest require staff.
- `backend/tests/integration/causes.test.js` — system cause cannot be deleted; cause referenced by an appointment cannot be deleted (set up via direct INSERT in the test).

**Definition of done:**
- `GET /api/causes` returns the three system causes without auth.
- `DELETE /api/causes/work` returns 409.

**Dependencies:** Step 3.

---

## Step 5 — Appointments: read

**Goal:** `GET /api/appointments` with the carryover filter as a `WHERE` clause; one read service used by every later read path.

**Files to create:**

- `backend/src/services/appointments.read.js` — `listAppointments({mode, bossId?, status?, date?, future})` — the **only** function that builds the appointments SELECT, including:
  - Carryover SQL when `mode === 'today'`: `WHERE visit_date = CAST(GETDATE() AS DATE) OR (visit_date < CAST(GETDATE() AS DATE) AND status IN ('approved','invited'))`.
  - When `mode === 'future'`: `WHERE visit_date > CAST(GETDATE() AS DATE)`.
  - When called for a boss, append `AND boss_id = @bossId`.
  - Sorting per SPEC.md §8 (urgent-pending first, then `created_at` ASC).
  - Joins `appointment_history` and `users` to assemble the full object per SPEC.md §6 response shape.
- `backend/src/services/appointments.serializer.js` — `toAppointmentDTO(row, historyRows, employeeLookup?)` and a separate `toPublicAppointmentDTO(...)` used in Step 7. **Two serializers, not one with a flag** — public must never carry `user.id`.
- `backend/src/routes/appointments.js` — `GET /api/appointments` honoring `?date=&boss_id=&status=&future=true`. Boss role is automatically scoped to `req.user.role` (= boss id) regardless of `?boss_id`.
- `backend/tests/integration/appointments.read.test.js` — seed a few rows directly in SQL (yesterday-approved, yesterday-completed, today-pending, tomorrow-approved). Assert today's list contains exactly the carryover and today rows. Assert boss filter scopes correctly.

**Implementation details:**

- The serializer needs employee lookup data. For now, pass an empty function `() => null` — Step 11 wires the real lookup. The DTO falls back to `visitor_first_name`/`visitor_last_name` when no employee resolves.

**Definition of done:**
- Boss request never returns another boss's row, even with a forged `?boss_id`.
- A row dated yesterday with status `approved` appears in `?date=today` (carryover); the same row with status `completed` does not.

**Dependencies:** Step 4.

---

## Step 6 — Appointments: create + state transitions (the load-bearing step)

**Goal:** all writes go through a single transaction helper that returns post-commit data; the route emits Socket.io events **after** the helper resolves.

**Files to create:**

- `backend/src/db/tx.js` — `withTransaction(async (tx) => {...})` helper. Returns whatever the callback returns. Rolls back on throw.
- `backend/src/services/appointments.write.js` — pure service, **knows nothing about Socket.io**. Functions:
  - `create({input, actor, force})` — runs duplicate check (SPEC.md §12 SQL) unless `force=true`; throws `DuplicateError` (carries `existing: {id, status}`) or inserts the appointment + a `create` history row in one transaction; returns the full DTO (re-reads via the read service).
  - `transition({id, action, actor, note?})` — single function for `approve|reject|invite|complete`. Inside one transaction: SELECT current row `WITH (UPDLOCK)`, validate state-machine transition (terminal states → `ConflictError` 409), validate boss ownership when applicable (raise `ForbiddenError` if not own), UPDATE status (and `rejection_reason` for reject), INSERT history row, return the new full DTO.
- `backend/src/schemas/appointments.js` — Zod for create body. `urgent` defaults to `false`. `visit_date >= today` (server clamps anything earlier per SPEC.md §12). `cause_id === 'other'` requires non-empty `customCause`.
- `backend/src/middleware/requireOwnAppointment.js` — factory that loads the appointment by `:id`, attaches it to `req.appointment`, returns 403 if `req.user.role !== row.boss_id`. Routes that allow staff (`complete`) skip this middleware and let the service decide.
- `backend/src/routes/appointments.js` (extend) — `POST /api/appointments` (staff), four `PATCH` routes, `GET /:id/history`. **Pattern in every write route:**
  ```
  const dto = await appointmentsWrite.transition(...);  // commits inside
  emitAppointmentEvent(io, action, dto);                 // emit AFTER
  res.json(dto);
  ```
  `emitAppointmentEvent` is a stub for now (logs to console); Step 14 wires it.
- `backend/src/lib/errors.js` — `ConflictError`, `DuplicateError`, `ForbiddenError`, `NotFoundError`. Error middleware translates each to the right HTTP status + body shape (`{error, ...}`).
- `backend/tests/integration/appointments.write.test.js` — happy-path create; duplicate without `force` returns 409 with `existing`; with `?force=true` succeeds; full state machine (`pending → approved → invited → completed`); terminal states 409; boss can't transition another boss's appointment (403); after each transition, exactly one new `appointment_history` row exists. **One test must verify the audit-log trigger:** attempt a raw `UPDATE appointment_history SET note='x'` and assert it fails.

**Definition of done:**
- All five history actions are written in the same transaction as the appointment update (verify by yanking the DB connection mid-transition in a test — appointment status must not change).
- The audit-log trigger blocks UPDATE/DELETE on `appointment_history` from the application's own connection.
- `emitAppointmentEvent` is called only when the transaction has committed (no emit on rollback).

**Dependencies:** Step 5.

---

## Step 7 — Public worker search

**Goal:** unauthenticated lastname lookup using the public serializer.

**Files to create:**

- `backend/src/routes/public.js` — `GET /api/public/appointments?lastname=`. Validates lastname (1–100 chars). Calls `listAppointments({mode: 'public', lastname})` and maps through `toPublicAppointmentDTO`. Caps at 20 rows. Filters to recent (e.g. last 30 days) by date.
- Extend `appointments.read.js` with a `mode === 'public'` branch (`WHERE visitor_last_name = @lastname AND visit_date >= DATEADD(day, -30, CAST(GETDATE() AS DATE))`).
- `backend/tests/integration/public.test.js` — searching returns matches with no `user.id` in any history entry; non-matching returns `[]`; SQL injection attempt is parameterized away.

**Definition of done:**
- Response payload, when JSON.stringify'd, contains no internal user IDs (assert via regex in test).

**Dependencies:** Step 6.

---

## Step 8 — Frontend skeleton

**Goal:** routing, auth context, role-based redirect, blank pages for each route.

**Files to create:**

- `frontend/src/lib/api.js` — `fetch` wrapper that includes `credentials: 'include'`, parses JSON, throws structured errors mapping the backend's `{error, ...}` shape.
- `frontend/src/lib/queryClient.js` — TanStack Query client (no retries on 401 — bounce to login).
- `frontend/src/contexts/AuthContext.jsx` — calls `/api/auth/me` on mount, exposes `{user, login, logout, loading}`.
- `frontend/src/contexts/I18nProvider.jsx` — wraps `react-i18next`, exposes `lang`, `setLang`. Defaults to `ru`. (Wired with empty JSONs now; Step 15 fills them.)
- `frontend/src/contexts/SocketContext.jsx` — placeholder context exposing `null` socket; Step 14 fills it.
- `frontend/src/contexts/ToastProvider.jsx` — global toast queue; `useToast()` returns `{push, dismiss}`.
- `frontend/src/pages/LoginPage.jsx` — username/password form, calls `login`, redirects on success.
- `frontend/src/pages/StaffDashboard.jsx`, `BossDashboard.jsx`, `WorkerStatusPage.jsx` — empty shells with a `<TopBar>` and "Coming soon" body.
- `frontend/src/components/TopBar.jsx`, `Btn.jsx`, `Badge.jsx`, `Modal.jsx`, `Input.jsx`, `Select.jsx`, `Empty.jsx`, `StatusBadge.jsx` — primitives, copied verbatim from `prototype.jsx` (these are pure visual primitives with no business logic).
- `frontend/src/App.jsx` (update) — `BrowserRouter` with routes from SPEC.md §9. The `/` route redirects: bosses → `/dashboard` rendering `BossDashboard`; staff → `/dashboard` rendering `StaffDashboard`; unauth → `/login` (except `/status` which is public).
- `frontend/src/components/RequireAuth.jsx`, `RoleGate.jsx` — wrappers.

**Definition of done:**
- Logging in as `sec1` redirects to staff dashboard; logging in as a boss user redirects to boss dashboard. Logout clears the cookie and bounces to `/login`.

**Dependencies:** Step 7.

---

## Step 9 — Staff dashboard: Today tab

**Goal:** the Today list rendered from real backend data, with action buttons that hit real endpoints.

**Files to create:**

- `frontend/src/components/AppointmentCard.jsx` — port the prototype's component verbatim, swapping `onAction` to call mutations from a hook.
- `frontend/src/hooks/useAppointments.js` — TanStack queries for `today` / `future`, mutation hooks for each action. On mutation success, invalidate the relevant query.
- `frontend/src/components/RejectModal.jsx` — port from prototype.
- `frontend/src/pages/StaffDashboard.jsx` (extend) — Today tab from `prototype.jsx` `SecretaryView` (the `today` branch).
- A trivial backend seed script `backend/src/dev-seed.js` to insert a handful of mixed-state appointments for manual UI poking. Not run in production.

**Definition of done:**
- Manually clicking "Complete" on an approved appointment in the UI flips its status, the card updates, and a new `appointment_history` row exists in the DB.

**Dependencies:** Step 8.

---

## Step 10 — Boss dashboard: Today tab

**Goal:** two-column layout (Pending | Queue) per the prototype's `BossView` Today branch.

**Files to create:**

- `frontend/src/pages/BossDashboard.jsx` (extend) — port `BossView` Today branch from prototype. Pending and Queue columns derive from the same `useAppointments({mode:'today'})` query, filtered/sorted client-side.
- Reuse the existing `AppointmentCard` and `RejectModal`.

**Implementation detail:** a boss user's `req.user.role` *is* the `boss_id`. The frontend doesn't need to send a boss filter — the backend scopes automatically (Step 5).

**Definition of done:**
- A boss sees only their own appointments. Approving a pending row moves it to the Queue column on the next refetch.

**Dependencies:** Step 9.

---

## Step 11 — NewAppointmentModal + employee directory

**Goal:** the create flow with three tabs (Employee/Guest/Foreign), employee API search, manual fallback when API is down.

**Files to create:**

- `backend/src/services/employees.js` — `search(q)` interface:
  - Returns `{results: [], degraded: false}` always; never throws.
  - In-memory LRU cache keyed by `q`, 5-min TTL.
  - If `EMPLOYEE_API_URL` is unset OR `fetch` rejects OR returns non-2xx, returns `{results: [], degraded: true}`.
  - On success, normalizes to `[{id, firstName, lastName, company}]` (max 20).
- `backend/src/routes/employees.js` — `GET /api/employees/search?q=`, behind `requireAuth` (any role).
- `frontend/src/components/NewAppointmentModal.jsx` — port from prototype. Employee-tab search hits `/api/employees/search`. If `degraded === true` or zero matches and `manualMode` toggled, show the manual-entry fields. A discreet stone-500 banner reads "Каталог недоступен" when degraded.
- The submit handler POSTs to `/api/appointments`. On 409 `{error: 'duplicate'}`, show a confirm dialog ("This visitor already has a request today, status X. Create another?"). On confirm, re-POST with `?force=true`.
- Employee lookup wiring in the read serializer (Step 5): when serializing for staff/boss, if `appointment.employee_id` is set, look it up via the same employee service (cached). The DTO's `employee` field is populated only on hit; otherwise falls back to manual fields.

**Definition of done:**
- With `EMPLOYEE_API_URL` unset, the modal still works via manual entry, with the degraded banner visible.
- Creating two appointments for the same employee/boss/today: first succeeds (201); second returns 409 with `existing.id`; UI confirms; force-resubmit succeeds.

**Dependencies:** Step 10.

---

## Step 12 — Settings: Causes + Users

**Goal:** SPEC.md §9 SettingsPanel, both subsections.

**Files to create:**

- `frontend/src/components/CausesSection.jsx`, `UsersSection.jsx`, `UserModal.jsx` — port from prototype. Wire mutations to `/api/causes` and `/api/users`.
- Confirm dialogs for delete actions.

**Definition of done:**
- Creating a user via Settings, then logging out and back in as that user, succeeds.
- Attempting to delete `cause:work` fails with the 409 error displayed as a toast.

**Dependencies:** Step 11.

---

## Step 13 — Journal tab

**Goal:** read-only audit log view (staff only).

**Files to create:**

- `backend/src/routes/journal.js` — `GET /api/journal?from=&to=&user_id=&action=`, `requireStaff`. SELECT from `appointment_history` JOIN `users` (use `findById`-style lookup so soft-deleted names still resolve) JOIN `appointments`. Default range: last 7 days. Cap rows at 500.
- `frontend/src/components/JournalTable.jsx` — port from prototype. Columns: when, who, what (action), appointment #, link to appointment.
- `frontend/src/pages/StaffDashboard.jsx` (extend) — Journal tab.

**Definition of done:**
- Filtering by user surfaces only that user's actions, including actions taken before they were soft-deleted.

**Dependencies:** Step 12.

---

## Step 14 — WebSocket integration

**Goal:** the five `appointment:*` events drive in-place list updates; bosses get browser notifications for new urgent requests when their tab is inactive.

**Files to create:**

- `backend/src/sockets/index.js` — `setupSockets(server)` returns the `io` instance. Auth via `io.use((socket, next) => {...})` that parses the JWT cookie at handshake (use `cookie` package) and verifies it; rejects on failure. On connection: `socket.join(role)`; if `role` is staff or assistant, also `socket.join('staff')`. For workers, expose a client-side `socket.emit('subscribe:lastname', name)` that joins `public:<lastname>`.
- `backend/src/sockets/emit.js` — `emitAppointmentEvent(io, action, dto)`:
  - `created` → emit to `staff` and to `dto.bossId`.
  - `approved`/`rejected`/`invited` → emit to `staff` and `public:<lastname>`.
  - `completed` → emit to `staff`, `dto.bossId`, and `public:<lastname>`.
  Replaces the stub from Step 6.
- `backend/src/server.js` (extend) — create http server, attach `io`, pass `io` to routes via `app.set('io', io)` or by closure. **The route handler is what calls `emitAppointmentEvent` — never the service.**
- `frontend/src/contexts/SocketContext.jsx` (replace) — establishes a `socket.io-client` connection on auth; exposes `socket` and a `useAppointmentEvents(handlers)` hook.
- `frontend/src/hooks/useAppointments.js` (extend) — register handlers that update the TanStack Query cache in place via `queryClient.setQueryData`. No refetch on event.
- `frontend/src/lib/notifications.js` — wraps the browser `Notification` API. On `appointment:created` with `urgent && bossDashboard && document.hidden`, fire one.
- `backend/tests/integration/sockets.test.js` — using `socket.io-client`, connect as a boss, POST a create as staff, assert the boss's socket receives `appointment:created`.

**Definition of done:**
- With two browser windows (boss + staff), creating a request as staff updates both windows in real time without a page refresh. Approve in the boss window — the staff window updates without refetch.
- Killing the backend mid-transition does **not** emit the event (verify via test that simulates a thrown error after the SELECT but before COMMIT).

**Dependencies:** Step 13.

---

## Step 15 — i18n

**Goal:** `react-i18next` wired with two language JSONs sourced from the prototype's `T` constant.

**Files to create:**

- `frontend/src/i18n/ru.json`, `frontend/src/i18n/tk.json` — copy from `prototype.jsx`'s `T.ru` and `T.tk`. Top of `tk.json` add a `_NOTE` key referenced in README: `"_NOTE": "TODO: Turkmen translations are AI-drafted; native-speaker review required before production."`
- `frontend/src/i18n/index.js` — initializes `i18next` with both bundles, lang from localStorage or `ru` default.
- Replace every hardcoded string in components with `t('key')`.
- `README.md` (extend) — section "Internationalization": "Turkmen translations are AI-drafted; needs native review before prod. See `frontend/src/i18n/tk.json`."

**Definition of done:**
- Top-bar lang toggle switches every visible string. Refresh persists language.

**Dependencies:** Step 14.

---

## Step 16 — Worker public page

**Goal:** the `/status` page (no auth) showing appointments for a lastname; live updates via the `public:<lastname>` socket room.

**Files to create:**

- `frontend/src/pages/WorkerStatusPage.jsx` — port `WorkerView` from prototype. On lastname submit: fetch from `/api/public/appointments?lastname=`; emit `subscribe:lastname` over the (anonymous) socket connection.
- `frontend/src/components/WorkerAppointmentCard.jsx` — read-only variant of `AppointmentCard`.
- Adjust `SocketContext` so the worker page can use it without an authenticated user.

**Definition of done:**
- Searching a lastname shows recent matches. Inviting one of those appointments from the boss UI in another tab updates the worker tab live (with a toast: "Vас зовут к ...").

**Dependencies:** Step 15.

---

## Step 17 — Analytics tab (boss)

**Goal:** the four-stat panel for "today" per SPEC.md §6 `/api/stats/boss`.

**Files to create:**

- `backend/src/routes/stats.js` — `GET /api/stats/boss`, requires boss; returns `{total, approved, rejected, completed, urgent}` for today's appointments scoped to `req.user.role`.
- `frontend/src/components/BossAnalytics.jsx` — port from prototype, fed by a TanStack query against the new endpoint.

**Definition of done:**
- The panel matches a hand-counted set of today's appointments.

**Dependencies:** Step 16.

---

## Step 18 — Polish, error states, loading skeletons

**Goal:** the app feels finished.

**Tasks (no new files unless noted):**

- Loading skeletons on every list (Tailwind `animate-pulse` placeholders).
- Empty states using `<Empty>` everywhere a list is empty.
- 401 handling: any API call returning 401 logs out via the auth context and bounces to `/login`.
- Error toasts on every mutation failure (use the structured backend error to pick a message).
- `frontend/src/lib/format.js` — date/time helpers using `Intl` with the `Asia/Ashgabat` time zone.
- README finalization with run/test/deploy notes.
- A `backend/src/middleware/error.js` that logs unexpected 500s with a stack but returns a sanitized payload.

**Definition of done:**
- A full smoke pass: create as staff → boss approves → boss invites → worker tab shows the invite → staff completes → journal shows all five history entries with correct names and timestamps. No console errors in either tab.

**Dependencies:** Step 17.

---

## Critical Files for Implementation

These five files concentrate the load-bearing decisions; getting them right makes the rest mechanical:

- `backend/src/services/appointments.write.js` — single-transaction state transitions + audit-log writes; the heart of the data integrity story.
- `backend/src/services/appointments.read.js` — single source of the carryover `WHERE` clause used by all read paths.
- `backend/src/sockets/emit.js` — the post-commit emission map; called only by route handlers.
- `backend/migrations/002_audit_trigger.sql` — the schema-level append-only enforcement that makes the system trustworthy.
- `backend/src/services/employees.js` — the swap-ready external API stub that lets v1 ship before the HR API is finalized.
