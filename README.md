# DeboisTech ERP

Admin dashboard for running training batches — students, tutors, attendance, fees, assignments and
study material — plus a read-only student portal.

Built with Vite 6 + React 19 + TypeScript, Tailwind CSS 4, and Supabase (Postgres, Auth, Storage,
Edge Functions).

## Who logs in

- **Admins** run everything from the dashboard at `/`.
- **Students** get a read-only portal at `/portal`. Their logins are **created by an admin**, not by
  self-signup — there is no public registration and no class-join code.
- **Tutors have no login.** They are records the admin manages.

Roles come from `app_metadata.role` on the auth user, and access is enforced by row-level security
in Postgres rather than by the client.

## Setup

```bash
npm install
cp .env.example .env    # fill in your Supabase URL and anon key
npm run dev
```

### Database

Run these in the Supabase SQL editor, in order. All are idempotent.

| File | What it does |
|---|---|
| `supabase/schema.sql` | Tables, enums and views — the source of truth for data shape |
| `supabase/student_login_migration.sql` | Links students to auth users, defines the `is_admin()` / `current_student_id()` helpers, enables RLS everywhere |
| `supabase/fee_migration.sql` | Fee payment logs |
| `supabase/attendance_timestamp_migration.sql` | Attendance timestamp columns |
| `supabase/assignment_repo_migration.sql` | Per-student GitHub repo + student-writable policies |
| `supabase/study_material_migration.sql` | Study material table, private storage bucket, RLS |

Edit the admin email in `student_login_migration.sql` before running it — that block is what tags
your account as an admin.

### Edge functions

Anything needing a secret runs server-side. Deploy each with
`supabase functions deploy <name> --project-ref <ref>`:

| Function | Purpose | Secret |
|---|---|---|
| `create-student-login` | Creates/resets a student's portal login | `SECRET_SERVICE_ROLE_KEY` |
| `watermark-material` | Stamps a student's name and phone onto every page of a PDF | `SECRET_SERVICE_ROLE_KEY` |
| `match-name` | Gemini fuzzy name matching for attendance | `GEMINI_API_KEY` |

```bash
supabase secrets set SECRET_SERVICE_ROLE_KEY=... --project-ref <ref>
supabase secrets set GEMINI_API_KEY=...          --project-ref <ref>   # optional
```

Without `GEMINI_API_KEY`, attendance still works — it falls back to deterministic name matching and
flags the rest for manual review.

## Commands

```bash
npm run dev       # dev server
npm run build     # tsc -b && vite build (type-checks before bundling)
npm run preview   # preview the production build
npm run lint      # eslint
```

There is no test runner configured yet.

## How the main pieces work

**Attendance** is a three-stage pipeline: a Google Meet CSV is ingested as-is, then processed per
lecture (reconnect rows merged, names matched to the roster, minutes compared against the scheduled
duration), then written as one row per student per lecture with `approved: false`. Nothing counts
towards a dashboard or a student's portal until an admin approves it — the AI matching step is not
treated as trustworthy on its own.

**Study material** is view-only. The PDF lives in a private bucket that students have no storage
policy for; the only path to it is the `watermark-material` function, which stamps the reading
student's name and phone onto every page. Screenshots cannot be prevented in a browser — the
watermark and the view log make a leak *traceable*, which is the actual goal.

**Portal logins** use a password derived from the student's phone (`Debois@<last4>`). Supabase Auth
stores only a hash and this app stores no plaintext copy; the dashboard shows the current password
by recomputing it from the same rule.

## Docs

- `deboistech erp prd.md` — product scope and DB schema, the source of truth
- `CLAUDE.md` — architecture and conventions
- `THEME.md` — design tokens and the visual system
- `AUDIT.md` — known issues and their status
- `src/components/portal/README.md` — the portal widget kit and its rules
