# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status: mid-pivot

This repo started as a student-facing LMS (classes/materials/tests) and is being converted into
**DeboisTech ERP** — a single-admin dashboard for managing training batches (fees, attendance,
assignments). There is **no student or tutor login**; students/tutors are records the one admin
manages, not accounts. `README.md` still describes the old LMS concept and is stale — trust
`deboistech erp prd.md` (the PRD, source of truth for product scope and DB schema) and
`plan_steps.md` (the migration plan from LMS → ERP) over the README.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build      # tsc -b && vite build (type-checks before bundling)
npm run preview    # preview production build
npm run lint        # currently broken — eslint is not in package.json devDependencies and no eslint config file exists in the repo
```

No test runner is configured. There is no CLAUDE.md convention for single-test execution because
there are no tests in the repo currently.

### Environment variables (`.env`, gitignored)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=       # optional — enables AI fuzzy name matching in the attendance pipeline
```

The Supabase client (`src/lib/supabase/client.ts`) falls back to placeholder values and logs a
warning if these are unset, rather than throwing.

## Architecture

### Data layer: schema-first

`supabase/schema.sql` is the single source of truth for the database (tables, enums, RLS). Update
it first when changing data shape, then mirror the change into `src/lib/types/index.ts` and the
relevant `src/lib/supabase/queries/*.ts` file. `src/lib/types/index.ts` types map 1:1 onto schema
tables/enums (e.g. `BatchStatus`, `AttendanceStatus`, `FeeStatus` mirror Postgres `enum` types).

All Supabase reads/writes go through `src/lib/supabase/queries/<domain>.ts` (one file per entity:
`batches`, `students`, `tutors`, `lectures`, `attendance`, `fees`, `assignments`, `dashboard`) and
are re-exported from the barrel file `src/lib/supabase/index.ts`. Pages/components should import
from that barrel (`@/lib/supabase`) rather than reaching into individual query files or importing
`supabase` client directly, except for auth calls.

### Attendance pipeline (`src/lib/attendance/`)

Three-stage flow, per the PRD (`deboistech erp prd.md` §5.4):

1. **`upload`** — raw Google Meet CSV rows, ingested as-is (`src/lib/utils/csvParser.ts` parses the
   file; `insertUploadRows` in `queries/attendance.ts` writes rows).
2. **Processing** (`src/lib/attendance/process.ts` → `processAttendance(lectureId)`) — the pipeline
   entry point, run per lecture:
   - `merge.ts` — collapses reconnect/multi-device rows per participant into one merged session
     (`mergeSessions`), summing attended minutes without double-counting overlapping intervals.
   - `match.ts` — resolves each merged participant to a roster student, deterministic matching
     first, falling back to `gemini.ts` (`matchNameWithGemini`) only when needed. Tutor names are
     detected and excluded from student attendance rather than flagged unmatched.
   - `db.ts` — loads upload rows/roster/tutors (`loadUploadRows`, `loadProcessingContext`) and
     writes results (`insertAttendance`, `clearUploads`).
   - `computeStatus(minutes, scheduledMinutes)` in `process.ts` derives present (≥90%) / partial
     (65–90%) / absent (<65%) from attended vs. scheduled lecture duration — thresholds are fixed
     in the PRD, don't change without checking it first.
3. **`attendance`** — one final row per student per lecture, inserted with `approved: false`. It
   only counts toward dashboards/reports once an admin flips `approved` via
   `approveAttendance`/`bulkApproveAttendance` — this manual approval gate is intentional (the AI
   matching step is not treated as fully trustworthy), don't bypass it by auto-approving on insert.

`processAttendance` clears the `upload` table only *after* a successful `insertAttendance` — the
ordering matters for idempotency/re-run safety if the pipeline is extended; don't reorder those
steps.

`gemini.ts` calls the Gemini API directly from the browser using `VITE_GEMINI_API_KEY`. It caches
failure state (`geminiUnavailableReason` / cooldown) so a bad/missing key or rate limit doesn't
retry on every unmatched name in a batch — auth errors (400/401/403) disable AI matching for the
rest of the session; rate limits/5xx only start a cooldown. Preserve this distinction if touching
error handling there.

### Routing & layout

`src/App.tsx` defines all routes; everything except `/auth/login` is nested under
`ProtectedRoute` (redirects to login if unauthenticated) → `DashboardLayout` (persistent
`Navbar` + `Sidebar` shell). Route params follow `<entity>/:id` (e.g. `batches/:batchId`);
detail pages fetch by id in a `useEffect`/loader rather than through a route loader.

`AuthContext` (`src/lib/context/AuthContext.tsx`) wraps Supabase Auth session state; the only
role is `admin` (`Role = 'admin'` in types) — no per-page role branching is needed since there's
exactly one authenticated role.

### Styling

Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no separate `tailwind.config.js` — v4 is
CSS-driven; tokens live in `src/globals.css`). `THEME.md` documents the design system extracted
from the marketing site (`deboistech.in`) — colors, radii, typography — reused here for visual
consistency; consult it before introducing new color/spacing values. Path alias `@/*` → `src/*`
(configured in both `vite.config.ts` and `tsconfig.json`).
