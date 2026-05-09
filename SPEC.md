# Appointment Booking System — Project Specification

> Internal tool for managing visitor appointments with three executives. Replaces a
> paper/verbal workflow where approvals were not consistently logged, leading to
> missed visitors and disputes about what was actually approved.

This document is the source of truth for building the application. A clickable
React prototype (`prototype.jsx`) is provided as a visual reference — it shows
exactly how every screen should look and behave.

---

## 1. Problem & Solution

**Problem.** Three executives ("Bosses") receive appointment requests from
employees and external visitors. Requests pass through a shared secretary or
each boss's personal assistant. Approvals were given verbally and not recorded
anywhere, so the team frequently lost track of who was approved, who showed up,
and who was waiting. The boss had to call the secretary by phone to invite each
visitor, which added friction and missed invitations.

**Solution.** A web app where every action — creation, approval, rejection,
invitation, completion — is captured with **who, when, and why** in an
append-only audit log. Real-time notifications via WebSocket eliminate the need
for phone coordination between boss and secretary.

---

## 2. Tech Stack

| Layer       | Choice                                  |
|-------------|-----------------------------------------|
| Frontend    | React 18 + Vite + Tailwind CSS          |
| State       | React state (no Redux). Tanstack Query for server state |
| i18n        | `react-i18next` (Russian + Turkmen Latin) |
| Backend     | Node.js + Express                       |
| Real-time   | Socket.io                               |
| Database    | MSSQL Server                            |
| DB driver   | `mssql` (Tedious-based, official Node driver) |
| Auth        | JWT (HTTP-only cookie)                  |
| Passwords   | bcrypt                                  |
| Validation  | Zod                                     |

---

## 3. Roles & Permissions

There are three role categories: **boss**, **staff** (secretary + assistants),
and **worker** (public, no login).

| Role ID       | Category | Sees                          | Can approve | Manages users/causes |
|---------------|----------|-------------------------------|-------------|----------------------|
| `boss1/2/3`   | boss     | own appointments only         | yes (own)   | no                   |
| `secretary`   | staff    | all appointments              | no          | yes                  |
| `assistant1/2/3` | staff | all appointments              | no          | yes                  |
| (worker)      | public   | own appointments by lastname  | no          | no                   |

**Note on assistants.** In the current spec, assistants have identical
permissions to the secretary. The role distinction exists so that future
functionality (e.g. boss-specific scheduling, restricted views) can be added
per-role without restructuring auth.

**Multiple users per role.** Multiple people can share the same role (e.g. two
secretaries, deputy boss). Each user is an independent record.

---

## 4. Database Schema (MSSQL)

All text columns use `NVARCHAR` to support Cyrillic and Turkmen Latin with
diacritics (ä, ý, ň, ş, ž).

```sql
-- Users — one row per real person who logs in
CREATE TABLE users (
  id              NVARCHAR(50)  NOT NULL PRIMARY KEY,    -- e.g. 'u_<uuid>'
  display_name    NVARCHAR(200) NOT NULL,
  username        NVARCHAR(50)  NOT NULL,
  password_hash   NVARCHAR(200) NOT NULL,                -- bcrypt
  role            NVARCHAR(20)  NOT NULL,
  created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at      DATETIME2     NULL,
  CONSTRAINT ck_users_role CHECK (role IN
    ('secretary','assistant1','assistant2','assistant3',
     'boss1','boss2','boss3'))
);
CREATE UNIQUE INDEX ux_users_username
  ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX ix_users_role
  ON users(role) WHERE deleted_at IS NULL;

-- Causes — visit reason categories. Editable in Settings.
CREATE TABLE causes (
  id          NVARCHAR(50)  NOT NULL PRIMARY KEY,
  label_ru    NVARCHAR(200) NOT NULL,
  label_tk    NVARCHAR(200) NOT NULL,
  is_system   BIT           NOT NULL DEFAULT 0,           -- system causes can't be deleted
  created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Appointments — one row per visit request
CREATE TABLE appointments (
  id                  INT           IDENTITY(1,1) PRIMARY KEY,
  visitor_type        NVARCHAR(20)  NOT NULL,             -- 'employee'|'guest'|'foreign'
  employee_id         INT           NULL,                 -- ref to external HR API
  visitor_first_name  NVARCHAR(100) NULL,                 -- used when not an employee
  visitor_last_name   NVARCHAR(100) NULL,                 --   or when employee added manually
  visitor_company     NVARCHAR(200) NULL,
  boss_id             NVARCHAR(20)  NOT NULL,             -- 'boss1'|'boss2'|'boss3'
  cause_id            NVARCHAR(50)  NOT NULL,
  custom_cause        NVARCHAR(500) NULL,                 -- only when cause_id='other'
  urgent              BIT           NOT NULL DEFAULT 0,
  visit_date          DATE          NOT NULL,
  status              NVARCHAR(20)  NOT NULL,
  rejection_reason    NVARCHAR(500) NULL,
  created_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_appt_cause FOREIGN KEY (cause_id) REFERENCES causes(id),
  CONSTRAINT ck_visitor_type CHECK (visitor_type IN ('employee','guest','foreign')),
  CONSTRAINT ck_boss CHECK (boss_id IN ('boss1','boss2','boss3')),
  CONSTRAINT ck_status CHECK (status IN ('pending','approved','rejected','invited','completed'))
);
CREATE INDEX ix_appt_date_status ON appointments(visit_date, status);
CREATE INDEX ix_appt_boss        ON appointments(boss_id, visit_date);
CREATE INDEX ix_appt_lastname    ON appointments(visitor_last_name);

-- Appointment history — audit log, append-only, never updated or deleted
CREATE TABLE appointment_history (
  id              BIGINT        IDENTITY(1,1) PRIMARY KEY,
  appointment_id  INT           NOT NULL,
  action          NVARCHAR(20)  NOT NULL,                 -- 'create'|'approve'|'reject'|'invite'|'complete'
  user_id         NVARCHAR(50)  NOT NULL,
  at              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  note            NVARCHAR(500) NULL,                     -- e.g. rejection reason
  CONSTRAINT fk_hist_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_hist_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT ck_action CHECK (action IN ('create','approve','reject','invite','complete'))
);
CREATE INDEX ix_hist_appt ON appointment_history(appointment_id, at);
CREATE INDEX ix_hist_user ON appointment_history(user_id, at);
```

**The history table is the most important thing in this system.** It is the
audit log that solves the original business problem. It must be append-only —
no UPDATE or DELETE statements should ever touch it. Add a database trigger
or use an account without UPDATE/DELETE rights on this table.

### Seed data

Insert the three system causes on first migration:

```sql
INSERT INTO causes (id, label_ru, label_tk, is_system) VALUES
  ('work',     N'По работе',         N'Iş boýunça',      1),
  ('personal', N'По своим причинам', N'Şahsy sebäpler',  1),
  ('other',    N'Другое',            N'Beýleki',         1);
```

Initial users must be seeded via a setup script (one per role slot). Passwords
are set on first login or by environment variable for the secretary admin.

---

## 5. Authentication

- **Login flow.** `POST /api/auth/login` with `{ username, password }`. Server
  verifies via bcrypt, issues a JWT in an HTTP-only cookie (24h expiry, secure
  in prod, sameSite=lax).
- **JWT payload.** `{ userId, role, displayName, iat, exp }`. Role is included
  to skip a DB lookup on every request, but on sensitive operations the server
  re-fetches the user to confirm the role hasn't changed and the user isn't
  soft-deleted.
- **Public endpoints.** Worker status search does not require auth. All other
  endpoints require a valid JWT.
- **Authorization middleware.** Two helpers:
  - `requireAuth` — JWT must be valid.
  - `requireRole(...allowedRoles)` — checks `role` is in the allowed set.

---

## 6. REST API

All endpoints return JSON. All bodies are validated with Zod schemas. On
validation error return `400` with `{ error: 'validation', details: [...] }`.

### Auth
| Method | Path                  | Auth   | Description                     |
|--------|-----------------------|--------|---------------------------------|
| POST   | `/api/auth/login`     | none   | Login, sets cookie              |
| POST   | `/api/auth/logout`    | any    | Clears cookie                   |
| GET    | `/api/auth/me`        | any    | Returns current user            |

### Users (admin = secretary or assistant)
| Method | Path                | Auth   | Notes                                            |
|--------|---------------------|--------|--------------------------------------------------|
| GET    | `/api/users`        | staff  | List active users grouped by role                |
| POST   | `/api/users`        | staff  | Create user. Body: `{display_name, username, password, role}` |
| PATCH  | `/api/users/:id`    | staff  | Update. `password` optional (omit to keep). Cannot change own role. |
| DELETE | `/api/users/:id`    | staff  | Soft delete. Cannot delete self.                 |

### Causes (admin = staff)
| Method | Path             | Auth   | Notes                                                |
|--------|------------------|--------|------------------------------------------------------|
| GET    | `/api/causes`    | any    | Public — used in form dropdowns                      |
| POST   | `/api/causes`    | staff  | Create. Body: `{label_ru, label_tk}`                 |
| PATCH  | `/api/causes/:id`| staff  | Update labels                                        |
| DELETE | `/api/causes/:id`| staff  | Reject if `is_system=1` or referenced by appointments|

### Appointments
| Method | Path                                    | Auth        | Notes                                    |
|--------|-----------------------------------------|-------------|------------------------------------------|
| GET    | `/api/appointments`                     | staff/boss  | Query: `?date=&boss_id=&status=&future=true`. Bosses see only their own automatically. |
| POST   | `/api/appointments`                     | staff       | Create. Returns full appointment with history. |
| PATCH  | `/api/appointments/:id/approve`         | boss (own)  | Status `pending → approved`              |
| PATCH  | `/api/appointments/:id/reject`          | boss (own)  | Body: `{reason?}`. Status `pending → rejected` |
| PATCH  | `/api/appointments/:id/invite`          | boss (own)  | Status `approved → invited`              |
| PATCH  | `/api/appointments/:id/complete`        | staff or boss | Status `approved|invited → completed`  |
| GET    | `/api/appointments/:id/history`         | staff/boss  | Full history for one appointment         |

### Public (no auth)
| Method | Path                                          | Notes                          |
|--------|-----------------------------------------------|--------------------------------|
| GET    | `/api/public/appointments?lastname=`          | Returns recent appointments matching lastname (max 20). Returns subset of fields — no internal user IDs. |

### Employee directory (proxy)
| Method | Path                                | Notes                                                    |
|--------|-------------------------------------|----------------------------------------------------------|
| GET    | `/api/employees/search?q=`          | Proxies to external HR API. Returns `[{id, firstName, lastName, company}]`. Cache results for 5 minutes. |

### Analytics
| Method | Path                              | Auth    | Notes                                       |
|--------|-----------------------------------|---------|---------------------------------------------|
| GET    | `/api/journal`                    | staff   | Query: `?from=&to=&user_id=&action=`. Audit log entries with joined user/appointment data. |
| GET    | `/api/stats/boss`                 | boss    | Returns `{total, approved, rejected, completed, urgent}` for today (own appointments only). |

### Response shapes

**Appointment object** returned by `GET /api/appointments`:

```json
{
  "id": 42,
  "visitorType": "employee",
  "employee": { "id": 123, "firstName": "Иван", "lastName": "Петров", "company": "ООО «Альянс»" },
  "visitor": null,
  "bossId": "boss1",
  "causeId": "work",
  "customCause": null,
  "urgent": true,
  "date": "2026-05-09",
  "status": "approved",
  "rejectionReason": null,
  "history": [
    { "action": "create",  "user": { "id": "u_sec1", "displayName": "Иванова А.А.", "role": "secretary" }, "at": "2026-05-09T08:30:00Z" },
    { "action": "approve", "user": { "id": "u_b1",   "displayName": "Иванов И.И.",  "role": "boss1" },     "at": "2026-05-09T08:35:00Z" }
  ]
}
```

For `visitor_type='guest'` or `'foreign'`, `employee` is null and `visitor`
holds `{firstName, lastName, company?}`. For employees who couldn't be matched
in the directory and were entered manually, `employee` is null and `visitor` is
populated.

---

## 7. WebSocket Events

Connect on login; the JWT cookie authenticates. Server places each socket into
rooms based on role:

- Room `boss1`, `boss2`, `boss3` — only the matching boss's socket joins.
- Room `staff` — secretary and all assistants.
- Room `public:<lastname>` — workers who searched their lastname (joined on
  client demand for live status updates).

### Server → Client events

| Event                    | Emitted to                       | Payload                          | When                       |
|--------------------------|----------------------------------|----------------------------------|----------------------------|
| `appointment:created`    | `bossN` (target boss) + `staff` | full appointment                 | After successful POST      |
| `appointment:approved`   | `staff` + `public:<lastname>`   | full appointment                 | After approve              |
| `appointment:rejected`   | `staff` + `public:<lastname>`   | full appointment                 | After reject               |
| `appointment:invited`    | `staff` + `public:<lastname>`   | full appointment                 | After invite (urgent toast)|
| `appointment:completed`  | `staff` + `bossN` + `public:..` | `{id, status: 'completed'}`      | After complete             |

The frontend uses these to:
- Update lists in place without refetching.
- Show toast notifications.
- Trigger browser `Notification` API for the boss's "new urgent request" popup
  when the tab is not active.

---

## 8. Appointment State Machine

```
            ┌──────────┐  approve   ┌──────────┐  invite   ┌──────────┐
[create] →  │ pending  │ ─────────→ │ approved │ ────────→ │ invited  │
            └──────────┘            └──────────┘           └──────────┘
                 │                       │                      │
                 │ reject                │ complete             │ complete
                 ↓                       ↓                      ↓
            ┌──────────┐            ┌──────────┐           ┌──────────┐
            │ rejected │            │completed │           │completed │
            └──────────┘            └──────────┘           └──────────┘
```

Terminal states: `rejected`, `completed`. Once in a terminal state, no further
transitions are allowed (server returns `409 Conflict`).

### "Today's list" filter

The Today view (for both staff and boss) shows:

```sql
WHERE
  visit_date = CAST(GETDATE() AS DATE)
  OR (
    visit_date < CAST(GETDATE() AS DATE)
    AND status IN ('approved', 'invited')
  )
```

This implements the **carryover rule**: appointments approved on a previous day
but not completed (e.g. boss left unexpectedly) automatically appear in today's
list with a "carried over" badge in the UI. No cron job needed — the filter
does the work on every read.

### Sorting

Within a list:
1. Urgent appointments first (where `status = 'pending'`).
2. Then by `created_at` ascending (oldest first).

For the "awaiting pickup" queue on boss view: invited first, then approved by
approval time ascending.

---

## 9. Frontend Structure

### Routes

The app uses client-side routing with `react-router-dom`:

| Path             | Component       | Access                    |
|------------------|-----------------|---------------------------|
| `/login`         | `LoginPage`     | unauthenticated only      |
| `/`              | redirects based on role |                  |
| `/dashboard`     | `StaffDashboard`| secretary, assistants     |
| `/dashboard`     | `BossDashboard` | bosses (same path, role-based render) |
| `/status`        | `WorkerStatusPage` | public                |

### Component tree (key components only)

```
App
├── AuthProvider           (JWT, current user, logout)
├── I18nProvider           (lang state, T() helper)
├── SocketProvider         (socket.io connection, event handlers)
├── ToastProvider          (global toast queue)
└── Routes
    ├── LoginPage
    ├── WorkerStatusPage
    │   ├── LastNameSearch
    │   └── AppointmentCard (read-only)
    ├── StaffDashboard
    │   ├── TopBar
    │   ├── Tabs: Today | Future | Journal | Settings
    │   ├── TodayList
    │   │   └── AppointmentCard (with action buttons)
    │   ├── FutureList
    │   ├── JournalTable
    │   ├── SettingsPanel
    │   │   ├── CausesSection (CRUD)
    │   │   └── UsersSection (CRUD)
    │   ├── NewAppointmentModal
    │   │   └── Tabs: Employee | Guest | Foreign
    │   └── RejectModal / UserModal
    └── BossDashboard
        ├── TopBar
        ├── Tabs: Today | Future | Analytics
        ├── PendingColumn  (appointments awaiting decision)
        ├── QueueColumn    (approved + invited)
        ├── FutureList
        └── AnalyticsPanel
```

The visual reference for every screen is `prototype.jsx`. Match it closely.

### Styling

Tailwind utility classes. Color palette:

- Background: `stone-50`, `white`
- Text: `stone-900` (primary), `stone-500` (muted)
- Primary action: `stone-900`
- Success: `emerald-600`
- Danger / urgent: `rose-600`
- Info / invited: `indigo-600`

Cards: `rounded-2xl border border-stone-200 p-4`. No drop shadows except on
modals.

---

## 10. Internationalization

Two languages, switched via top-bar toggle:

- **ru** — Russian (Cyrillic, default)
- **tk** — Turkmen (Latin script)

Strings live in `src/i18n/{ru,tk}.json`. The full key set is reproduced in
`prototype.jsx` under the `T` constant — copy it into proper i18n JSON files.

Server-side, error messages may also be returned in both languages by accepting
an `Accept-Language` header.

The Turkmen translation in `prototype.jsx` was AI-drafted. **A native speaker
must review it before production deployment.**

---

## 11. External Dependencies

### Employee directory API

A separate team maintains an HR API for employee lookup. Specification is not
yet finalized. Build the integration as a thin proxy at
`GET /api/employees/search?q=` with these expected behaviors:

- Searches by first name, last name, or company (case-insensitive).
- Returns up to 20 matches.
- Response shape: `[{id: number, firstName, lastName, company}]`.

Wrap this in a service module so the actual endpoint URL and auth headers can
be configured via environment variables. Cache results per query for 5 minutes
in memory (no Redis needed at this scale).

If the API is unavailable, the create-appointment form must still work via the
"add manually" fallback. Show a discreet warning instead of a hard error.

---

## 12. Business Rules & Edge Cases

### Duplicate detection (soft warning)

When creating a new appointment, before inserting:

```sql
SELECT id FROM appointments
WHERE visit_date = @date
  AND boss_id = @boss_id
  AND status IN ('pending', 'approved', 'invited')
  AND (
    (visitor_type = 'employee' AND employee_id = @employee_id)
    OR (visitor_type IN ('guest','foreign')
        AND visitor_first_name = @first AND visitor_last_name = @last)
  );
```

If a row is returned, return `409 Conflict` with body
`{error: 'duplicate', existing: {id, status}}`. The frontend displays a confirm
dialog: *"This visitor already has a request today (status X). Create another?"*
If the user confirms, the frontend re-POSTs with `?force=true` to bypass the
check.

### Authorization checks

- **Boss approve/reject/invite/complete:** must match the appointment's
  `boss_id`. Return `403` otherwise.
- **Staff complete:** allowed regardless of which boss the appointment belongs to.
- **Worker search:** only returns appointments where the lastname matches.
  Never expose internal `user_id` values, only `displayName` and `role`.

### Validation rules

- `urgent` defaults to `false`.
- `visit_date` must be `>= today()`. Server clamps anything earlier.
- `cause_id = 'other'` requires non-empty `customCause`.
- `visitor_type = 'employee'` requires either `employee_id` (from API) or full
  manual visitor data — at least one path must complete.

### Soft delete for users

`DELETE /api/users/:id` sets `deleted_at` instead of removing the row, so the
audit log keeps working — entries reference `user_id`, and the UI must still be
able to show "Иванова А.А." even after she leaves the company. List endpoints
filter out soft-deleted users; lookup by ID returns them.

### Time zones

Store all timestamps in UTC (`SYSUTCDATETIME()`). Frontend formats to
Asia/Ashgabat (UTC+5) for display. The `visit_date` column is a plain `DATE`
and represents the local Ashgabat date.

---

## 13. Project Setup

### Recommended structure

```
appointment-app/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   ├── lib/         (api client, socket client)
│   │   └── App.jsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── db/          (mssql connection pool, migrations)
│   │   ├── sockets/
│   │   └── server.js
│   ├── migrations/
│   └── package.json
├── prototype.jsx        (visual reference — DO NOT ship)
├── README.md
└── .env.example
```

### Environment variables

```
# Backend
PORT=3000
JWT_SECRET=<long random string>
DB_SERVER=localhost
DB_NAME=appointments
DB_USER=...
DB_PASSWORD=...
EMPLOYEE_API_URL=https://hr.example.com/api/employees
EMPLOYEE_API_KEY=...
CORS_ORIGIN=http://localhost:5173

# Frontend
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

### Running

```bash
# Backend
cd backend && npm install && npm run migrate && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

---

## 14. Future Enhancements (out of scope for v1)

These came up during planning but are not required for the first release. Build
v1 in a way that doesn't preclude them.

1. **Calling board** — fullscreen public display in the lobby showing currently
   invited visitors in large type. Reuses existing `appointment:invited` events;
   one read-only page at `/board`, no auth.
2. **Per-assistant restricted views** — assistants currently see all bosses. A
   future toggle in Settings could limit each assistant to their boss only.
3. **Recurring/standing appointments** — for weekly meetings.
4. **Calendar export** — `.ics` feed of approved appointments per boss.
5. **Mobile push notifications** — currently relies on browser `Notification` API.
6. **Native passport/visa fields** for foreign visitors if compliance requires.

---

## Appendix A: Reference Constants

These IDs are hardcoded in the system. Do not parameterize.

```js
// Bosses
const BOSSES = ['boss1', 'boss2', 'boss3'];

// Roles (DB constraint enforces these)
const ROLES = [
  'secretary',
  'assistant1', 'assistant2', 'assistant3',
  'boss1', 'boss2', 'boss3'
];

// System causes (cannot be deleted)
const SYSTEM_CAUSES = ['work', 'personal', 'other'];

// Appointment states
const STATES = ['pending', 'approved', 'rejected', 'invited', 'completed'];

// Visitor types
const VISITOR_TYPES = ['employee', 'guest', 'foreign'];
```

The boss display names ("Босс 1", "Başlyk 1") are i18n strings, not hardcoded
in the database. To rename a boss for display, edit the i18n files, not the DB.

---

## Appendix B: Prototype Reference

`prototype.jsx` is a single-file React component that demonstrates the entire
UI with mock data and in-browser persistence. It is not production code:

- Authentication is faked via a role/user dropdown in the top bar.
- Notifications are simulated locally instead of arriving via WebSocket.
- All data is held in `window.storage` (browser-side) instead of a real DB.
- Employee search runs against a hardcoded array.

Use it as the visual contract — every screen, layout, button, and color the
final product should match. Translations, role groupings, action button
positions, modal layouts are all reproduced faithfully.

When you finish a screen, open `prototype.jsx` side-by-side and compare. If
something differs, the prototype is the source of truth unless this document
explicitly says otherwise.

---

## Appendix C: Build Order Suggestion

A suggested sequence to keep things stable:

1. **DB schema + migrations.** Bring up MSSQL, create tables, seed system causes
   and one secretary user.
2. **Auth.** `POST /login`, `GET /me`, JWT middleware. Manually test with curl.
3. **Users CRUD.** `/api/users` endpoints. Test with the seeded secretary.
4. **Causes CRUD.** Trivial after users.
5. **Appointments — read.** `GET /api/appointments` with all filters. Seed a
   few rows manually for testing.
6. **Appointments — create + state transitions.** All the PATCH endpoints.
   Verify history is being written.
7. **Public worker search.** Open endpoint.
8. **Frontend skeleton.** Login page, auth context, routing by role.
9. **Staff dashboard — Today tab.** Most complex frontend screen.
10. **Boss dashboard — Today tab.** Pending + queue columns.
11. **NewAppointmentModal.** Three tabs, employee API integration, manual fallback.
12. **Settings — Causes and Users.** CRUD UI.
13. **Journal tab.** Read-only audit log.
14. **WebSocket integration.** Wire up events to live-update lists.
15. **i18n.** Wire `react-i18next`, populate JSON files from `prototype.jsx`'s `T`.
16. **Worker public page.** Last screen, simplest.
17. **Analytics tab.** Stats cards.
18. **Polish, error states, loading skeletons.**

Each step should be testable on its own.
