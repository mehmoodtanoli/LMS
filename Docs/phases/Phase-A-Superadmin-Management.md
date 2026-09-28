# Phase A — Super Admin Laboratory & User Management

## 1. Phase Overview

Phase A adds the Super Admin operational layer on top of the Phase 3 backend and Phase 4 frontend MVP, so the LMS can be run without VS Code, SQL, Prisma Studio, PowerShell, or manual database edits.

Scope:

* Super Admin dashboard (summary counts)
* Laboratory management (list, view, create, edit, activate/deactivate)
* User management (list, view, create, edit, activate/deactivate), primarily for creating LAB_ADMIN accounts
* Server-side SUPERADMIN authorization on every admin endpoint
* LAB_ADMIN isolation preserved (no changes to existing laboratory-scoped behavior)

No existing architecture, working systems, or routes were redesigned or removed.

---

## 2. Database Changes

Added `isActive` (`Boolean`, default `true`) to `Laboratory` and `User` in `schema.prisma`. Both default to `true`, so all existing records remain active with no data loss.

Migration: `Server/prisma/migrations/20260922082700_add_active_status/migration.sql`

```sql
ALTER TABLE "laboratories" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
```

This migration was hand-written against the schema and has not been run against a live database from this environment (see Section 6, Known Limitations). Run `npx prisma migrate dev` locally to apply and verify it; Prisma will either apply this file as-is or confirm it matches the schema diff.

No hard deletes were introduced anywhere. Laboratories and users are deactivated, never removed, so patients, orders, results, reports, and payments are never orphaned.

## 3. Backend Changes

New files:

* `Server/src/services/laboratory.service.js`, `controllers/laboratory.controller.js`, `routes/laboratory.route.js`
* `Server/src/services/user.service.js`, `controllers/user.controller.js`, `routes/user.route.js`
* `Server/src/controllers/dashboard.controller.js`, `routes/dashboard.route.js`

Modified files:

* `Server/src/middlewares/auth.middleware.js` — added `requireRole(...roles)`, a reusable role guard used by every admin route; also rejects requests from deactivated users
* `Server/src/services/auth.service.js` — login now rejects deactivated users
* `Server/src/app.js` — mounted the three new routers

New endpoints (all require `authMiddleware` + `requireRole("SUPERADMIN")`):

```
GET    /api/admin/dashboard
GET    /api/admin/laboratories
POST   /api/admin/laboratories
GET    /api/admin/laboratories/:id
PATCH  /api/admin/laboratories/:id
PATCH  /api/admin/laboratories/:id/status
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/:id
PATCH  /api/admin/users/:id
PATCH  /api/admin/users/:id/status
```

All follow the existing `ApiError` / `ApiResponse` / `asyncHandler` conventions. Validation covers missing fields, invalid email, duplicate email, invalid laboratory ID, LAB_ADMIN without a laboratory, invalid role, and invalid status, matching the pattern already used in `patient.service.js`. Passwords go through the existing `hashPassword`/`bcryptjs` utility; password hashes are never returned in any response.

## 4. Authorization / Security

* Every admin endpoint is protected server-side by `requireRole("SUPERADMIN")` — the frontend hiding the nav links is a convenience, not the enforcement point.
* LAB_ADMIN behavior and scoping (`getScopedWhere` in the existing patient/test/order/result/report/payment services) were not touched.
* Deactivating a user immediately blocks both new logins and any request made with an existing token for that user, since `authMiddleware` re-checks `isActive` on every request.
* LAB_ADMIN cannot reach `/api/admin/*` (blocked by `requireRole`) or the `/admin/*` frontend routes (blocked by `RequireRole` in the router).

## 5. Frontend Changes

New files: `Client/src/pages/Laboratories.jsx`, `Client/src/pages/Users.jsx`

Modified files:

* `Client/src/api/resources.js` — added `laboratoriesApi`, `adminUsersApi`, `adminDashboardApi`
* `Client/src/layout/AppShell.jsx` — Admin nav section (Laboratories, Users), shown only to SUPERADMIN
* `Client/src/components/ProtectedRoute.jsx` — added `RequireRole`
* `Client/src/App.jsx` — wired `/admin/laboratories` and `/admin/users` routes (list, new, detail, edit) behind `RequireRole role="SUPERADMIN"`
* `Client/src/styles.css` — two badge color rules for active/inactive status

No existing pages were changed beyond these additions. The existing per-laboratory Dashboard, Patients, Orders, Results, Reports, and Payments pages are unchanged.

## 6. Testing Performed

* `node --check` on every new/modified backend file — all pass
* `npm install` in `Server/` — succeeds
* `npm install` and `npx vite build` in `Client/` — succeeds, all 88 modules transform cleanly, production bundle builds

**Not tested from this environment, and not claimed as tested:**

* No live database — `npx prisma generate` failed here because this sandbox's network policy blocks Prisma's engine-binary host. The migration was written by hand against the schema rather than generated and applied.
* No end-to-end request testing (login, laboratory CRUD, user CRUD, status toggles, LAB_ADMIN isolation) has been performed against a running server.

Run the Definition of Done checklist locally against a real database before treating Phase A as verified.

## 7. Known Limitations

* This work was produced in a sandbox with no push access to `github.com/mehmoodtanoli/LMS` and no live Postgres instance, so it is committed locally only and has not been run end-to-end. Apply the diff, run `npx prisma migrate dev`, and smoke-test locally.
* Laboratory records only carry `name` per the existing schema — no address/location field exists, so the laboratory list does not show one (schema was intentionally not expanded beyond `isActive`).
* User edit allows an optional password reset field; this was not explicitly in the Phase A spec but reuses the existing hashing path and was judged in scope for "edit appropriate fields."
