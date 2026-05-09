# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repo is **pre-implementation**. It contains only two files:

- `SPEC.md` — the source of truth for the application. Read it before any non-trivial work.
- `prototype.jsx` — a single-file React clickable mock with in-memory state. **Visual contract** for every screen; not production code (fake auth, mock employee API, `window.storage` persistence).

There is no `package.json`, no backend, no migrations, no tests yet. The build/test/lint commands for the eventual `frontend/` and `backend/` workspaces are described in `SPEC.md` §13 but the projects don't exist on disk. Don't fabricate commands — bootstrap the project structure first if asked to implement.

## Target architecture (from SPEC.md)

A two-tier app split into `frontend/` (React 18 + Vite + Tailwind, react-i18next, TanStack Query, Socket.io client) and `backend/` (Node.js + Express, Socket.io, MSSQL via the `mssql` driver, JWT in HTTP-only cookies, bcrypt, Zod). One MSSQL database. Run them as two separate npm projects.

### The audit log is the product

The `appointment_history` table is **why this app exists** — it replaces a verbal/paper workflow where approvals weren't recorded. Treat it as append-only at the database level (trigger or restricted DB account that has no UPDATE/DELETE on this table). Every state-changing endpoint must write a history row in the same transaction as the appointment update. If you find yourself updating or deleting from `appointment_history`, stop — you're solving the wrong problem.

### State machine and the carryover rule

Appointments flow `pending → approved → invited → completed` with `rejected` and `completed` as terminal states. Terminal-state transitions return `409 Conflict`. The "Today" view filter is non-obvious: it shows today's appointments **plus** any past-dated `approved`/`invited` rows that never reached `completed`. This carryover is implemented purely as a SQL `WHERE` clause — no cron job — so don't add a "roll forward" job. See SPEC.md §8.

### Realtime is not optional

The original problem was bosses phoning the secretary to invite each visitor. Socket.io rooms (`boss1|2|3`, `staff`, `public:<lastname>`) and the five `appointment:*` events replace that phone call. Wire every state change to emit the corresponding event; the frontend updates lists in place from these events rather than refetching. See SPEC.md §7 for the room/event matrix.

### Roles and authorization

Three categories: `boss` (3 IDs), `staff` (`secretary` + 3 assistants — currently identical permissions, but the role distinction is intentional for future per-boss views), and unauthenticated `worker`. Bosses can only act on their own appointments — server enforces, never trust client. Worker public search must never expose internal user IDs (only `displayName` + `role`). User deletion is **soft delete** (`deleted_at`) so audit log entries keep resolving names after someone leaves.

### Hardcoded constants

The role IDs, boss IDs, system cause IDs (`work`/`personal`/`other`), states, and visitor types in SPEC.md Appendix A are hardcoded by design — do not parameterize them. Boss display names are i18n strings, not DB rows; rename via `src/i18n/{ru,tk}.json`, not the database.

## Working with the prototype

`prototype.jsx` is the visual source of truth. When building a real screen, open it side-by-side and match layout, colors (palette in SPEC.md §9), button placement, modal structure, and the `T` translation keys. Where prototype and SPEC.md disagree, SPEC.md wins **except** for visual/UX details, where the prototype wins.

The Turkmen translations in `prototype.jsx` were AI-drafted and need native-speaker review before production. Don't treat them as authoritative when adding new strings.

## Conventions specific to this codebase

- **Text columns are `NVARCHAR`** everywhere — Cyrillic + Turkmen Latin with diacritics (ä, ý, ň, ş, ž). Don't use `VARCHAR`.
- **Timestamps are UTC** in the DB (`SYSUTCDATETIME()`); frontend formats to Asia/Ashgabat (UTC+5). `visit_date` is a plain `DATE` in local Ashgabat time — not a timestamp.
- **Duplicate appointments** return `409` with `{error: 'duplicate', existing: {...}}`. Frontend confirms, then re-POSTs with `?force=true`. Don't silently allow or silently block.
- **Validation errors** return `400` with `{error: 'validation', details: [...]}` — Zod schemas at the route boundary.
- **Employee directory** is an external HR API behind a 5-min in-memory cache. If it's down, the create-appointment form must still work via the manual-entry fallback — show a discreet warning, not a hard error.

## Build order

SPEC.md §C lists a 18-step suggested build order (DB → auth → users → causes → appointments read → appointments write → public search → frontend skeleton → dashboards → modal → settings → journal → sockets → i18n → worker page → analytics → polish). Each step is independently testable. Follow it unless the user redirects.
