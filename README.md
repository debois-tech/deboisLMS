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
| `supabase/core_migration.sql` | Links students to auth users, defines the `is_admin()` / `current_student_id()` helpers, enables RLS everywhere |
| `supabase/fees_migration.sql` | Fee status, payment methods, and `record_fee_payment()` — payment log and running balance in one transaction |
| `supabase/study_material_migration.sql` | Study material table, private storage bucket, batch codes, tutor attribution, RLS |
| `supabase/assignments_migration.sql` | Per-student GitHub repo, deadlines (`assignments.due_at`), and the policies that stop a student submitting after one |

Edit the admin email in `core_migration.sql` before running it — that block is what tags
your account as an admin.

### Edge functions

Anything needing a secret runs server-side. Deploy each with
`supabase functions deploy <name> --project-ref <ref>`:

| Function | Purpose | Secret |
|---|---|---|
| `create-student-login` | Creates/resets a student's portal login | `SECRET_SERVICE_ROLE_KEY` |
| `watermark-material` | Serves a material: watermarks PDFs and images, passes other files through | `SECRET_SERVICE_ROLE_KEY` |
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

**Study material** accepts any file, and what happens to it depends on what it is. PDFs and images
are watermarked and paged in the in-app reader, never downloadable — an image is wrapped into a
one-page PDF first, so it takes the same path. Word files are converted to PDF in the browser before
upload, which keeps the text but not the layout. Markdown and plain text are shown as written.
Everything else — sheets, decks, archives — is downloaded, because no browser renders them.

Every file lives in a private bucket that students have no storage policy for; the only path to the
bytes is the `watermark-material` function. Screenshots cannot be prevented in a browser — the
watermark says where a leaked copy came from and the view log, written for every kind including
downloads, says who opened it. Assignment handouts are the same table with an `assignment_id`, so
they inherit the reader, the log and the enrolment rule.

**Portal logins** use a password derived from the student's phone (`Debois@<last4>`). Supabase Auth
stores only a hash and this app stores no plaintext copy; the dashboard shows the current password
by recomputing it from the same rule.

## Docs

- `completed md/deboistech erp prd.md` — product scope and DB schema, the source of truth
- `completed md/plan_steps.md` — the LMS → ERP migration plan this repo followed
- `THEME.md` — design tokens and the visual system
- `src/components/portal/README.md` — the portal widget kit and its rules
