# Student/User Login + Student Portal — Implementation Plan

**Status: built.** Phases 0–4 are done and `npm run build` passes. What's left is the QA pass in
Phase 6 (needs a real student login) and the optional hardening in Phase 5.

## Overview

A second auth role — **student** — alongside the existing admin. Students get read-only login
credentials (created by the admin when adding them) and a portal showing their own record: batch,
fees, attendance, assignments.

Creating a Supabase Auth user requires the **service role key**, which must never ship in the
browser bundle, so credential creation runs in a Supabase **Edge Function** invoked from the admin
dashboard.

Credential scheme: student's `email` (now required on the add-student form) + a format-based
password, `Debois@<last 4 digits of phone>` (random 6-digit suffix if no phone). Deterministic
enough for the admin to read out, but per-student rather than one shared password. The password is
returned once and never stored — a lost password is reset, not recovered.

---

## Phase 0 — Supabase Setup (done)

1. Email/password provider enabled.
2. `supabase/student_login_migration.sql` run in the SQL Editor:
   - `students.auth_user_id` column linking to `auth.users`.
   - Admin user tagged `app_metadata.role = 'admin'`.
   - `is_admin()` / `current_student_id()` helper functions.
   - RLS enabled on all 12 tables: admin full access, student read-own.
   - `security_invoker = on` on `batch_fee_summary` / `batch_attendance_summary` — views run as
     their owner by default, which would have let a student read every batch's totals.
3. `create-student-login` edge function deployed; `SECRET_SERVICE_ROLE_KEY` set via
   `supabase secrets set` (the `SUPABASE_` prefix is reserved, hence the name).
4. Admin logged out/in so the JWT carries the new role tag.

---

## Phase 1 — Types & Query Layer (done)

- `Role = 'admin' | 'student'`; `Student.auth_user_id`; `Profile.student_id`; `StudentCredentials`.
- `queries/students.ts`: `createStudentLogin`, `getStudentByAuthUserId`.
- `queries/attendance.ts`: `getApprovedAttendanceByStudent`.
- `queries/assignments.ts`: `getAssignmentsForStudent`.
- All re-exported from the `@/lib/supabase` barrel.

## Phase 2 — Admin-side Credential Creation (done)

- `NewStudentPage` — email is required; after saving, the login is created automatically and the
  credentials are shown in a copy-able modal. Reusing an existing student who already has a login
  skips creation so their password isn't silently rotated. A failed login creation warns but keeps
  the saved student.
- `StudentDetailPage` — "Portal Login" card with a Create/Reset action
  (`components/students/StudentLoginCard.tsx`), for backfilling older students or rotating a
  password.

## Phase 3 — Auth & Routing (done)

- `AuthContext` reads role from `app_metadata` (never `user_metadata`), resolves `student_id`, and
  exposes `isStudent` alongside `isAdmin`.
- `ProtectedRoute` takes a `role` prop and bounces the wrong role to its own home.
- `/auth/login/user` is a real login page (`UserLoginPage`) sharing `LoginPanel` with the admin
  page; the landing route is picked from the session's role, not from which page was used.

## Phase 4 — Student Portal (done)

- `layouts/PortalLayout.tsx` — top bar (logo, theme toggle, sign out) + horizontal tab nav.
- `components/layout/PortalNav.tsx` — `portalNavItems`, the single source of truth for sections.
- `components/portal/PortalPage.tsx` — `PortalPage` / `PortalStat` / `PortalRow` / `PortalEmpty`
  primitives and `usePortalStudentId()`.
- Pages: `PortalOverviewPage` (profile, current batch, next lecture, attendance rate, fees, batch
  history), `PortalAttendancePage`, `PortalAssignmentsPage`, `PortalFeesPage`.

**Adding a section later:** a route under `/portal` in `App.tsx` + an entry in `portalNavItems` +
a page using `PortalPage`. No auth or data-scoping changes needed — RLS handles access.

## Phase 5 — Hardening (optional, not built)

- Force password change on first login: edge function sets
  `user_metadata: { must_change_password: true }`; `ProtectedRoute` redirects to
  `/portal/change-password` until it's cleared via `supabase.auth.updateUser`.
- Surface Supabase's server-side rate limiting on repeated failed logins in the UI.

## Phase 6 — QA (pending)

- Create a student with an email, hand the credentials to a test login, confirm the portal shows
  only their data.
- Verify RLS isolation: as Student A, confirm Student B's fees/attendance/assignments are
  unreachable even via direct table queries from devtools.
- Verify admin flows still work end to end now that RLS is on every table.
- Verify a student with no email can still be created (login blocked until an email is added).
