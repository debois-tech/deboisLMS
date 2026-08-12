# Security

Pre-deployment audit, 12 Aug 2026. Update the status line as each item is closed.
An item is **Done** only when the fix is in the code *and* deployed — a written
solution with nothing shipped stays **Open**.

**Threat model.** Admins are trusted: full access on the admin side is by design and
is not a finding. Students are the untrusted party. Two rules drive everything below:

1. A student must never reach data that isn't theirs.
2. A student must never edit data an admin entered for them.

**Database files.** There are two, and only two. `supabase/schema.sql` builds the
whole database from nothing and is the only file a fresh project needs.
`supabase/migration_2026_08_12.sql` is the delta for the existing dev database and
can be deleted once that database has been rebuilt. The six older migration files
were folded into the baseline and removed.

The migration is edited in place rather than chained, and is safe to re-run: it drops
and recreates `batch_programs` and drops the old `batch_program` enum before rebuilding
them. That is only true while the database is empty — once real batches exist, a
further change needs its own file.

**Status: paused after the high-severity work.** Items 1–5 are closed or consciously
deferred. Items 6–11 are the remaining low-severity pass and have not been started.

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Portal passwords derived from phone number | Critical | Accepted risk |
| 2 | Students can overwrite admin submission records | Critical | **Done** |
| 3 | Students with no batch keep access to shared material | High | **Done** |
| 4 | No browser security headers | High | **Open** — deliberately last, see below |
| 5 | Repo link not validated server-side | Medium | **Done** |
| 6 | WebP files skip the watermark | Low | Open |
| 7 | SQL functions missing `search_path` | Low | Open |
| 8 | Server errors returned verbatim to clients | Low | Open |
| 9 | Edge functions accept requests from any origin | Low | Open |
| 10 | Dependency advisories (react-router, nanoid) | Low | Open |
| 11 | `supabase/.temp/` committed to git | Low | Open |

---

## 1. Portal passwords derived from phone number — Accepted risk

`generatePassword` in `supabase/functions/create-student-login/index.ts` and
`derivePortalPassword` in `src/lib/utils/portalPassword.ts` both produce
`Debois@<last 4 phone digits>`. The keyspace is 10,000, the prefix is a constant, and
classmates already know each other's phone numbers — so any student can log in as any
other. There is no password-change screen in the app, so the password is permanent.

Accepted by the product owner on 12 Aug 2026. Recorded here so the decision is
visible, not because it is disputed.

If it is ever revisited, the shape of the fix is: random password on creation, a
"Reset password" action on the student detail page that shows the new one once, and a
change-password screen in the portal. The admin dashboard would stop being able to
display an existing password, because it would no longer be derivable.

---

## 2. Students can overwrite admin submission records — Done

`assignment_completions` is written by both sides — an admin ticking work off and a
student handing it in go through the same `markSubmission`. The RLS policies said
which **row** a student could write but nothing about the **values**, so a direct API
call could flip `submitted` back to false on a row the admin had set, backdate
`submitted_at` past a deadline, or name any tutor in `marked_by`.

Fixed with a trigger plus a tightened policy, both in `schema.sql`:

- `guard_assignment_completion()` runs `before insert or update`. An admin passes
  through untouched. For anyone else it forces `submitted_via = 'portal'`,
  `submitted_at = now()` and `marked_by = null`, so whatever the client sent is
  discarded, and it raises if `submitted` is anything but true — un-submitting is an
  admin action.
- The trigger also refuses an update where the row was already submitted, and
  `student_update_own` now carries `and submitted = false` in its `USING` clause. A
  student can move work from unsubmitted to submitted exactly once and can never
  touch it again.
- `submitAssignmentFromPortal` no longer sends the three server-owned columns.

RLS gates the row, the trigger owns the columns. Between them the client payload
stops mattering.

The deadline logic was already correct and is unchanged: the same conditions appear
on INSERT and UPDATE, so it cannot be dodged by updating instead of inserting.

**Also done in the same pass:** `submission_channel` dropped `whatsapp` and `other`.
Work is a GitHub repo now — `portal` means the student handed it in, `github` means an
admin recorded it.

---

## 3. Students with no batch keep access to shared material — Done

The student read policy on `materials` was
`batch_id is null or batch_id in (...enrolled batches...)`. The second branch checked
active enrolment; the first checked nothing, so material marked "for every student"
was readable by any account with a student record — including a student dropped from
every batch. `watermark-material` only re-checks enrolment when `material.batch_id` is
set, so the file itself was reachable too, not just the listing.

Fixed from both ends. Every student now belongs to a batch at creation time, so the
`batch_id is null` case no longer describes anyone, and the branch was deleted from
the policy.

- `src/pages/students/NewStudentPage.tsx` — batch and total fee are required, and the
  student is enrolled in the same submit. With no batches in the system the form is
  replaced by a prompt to create one first.
- `src/components/students/StudentImportModal.tsx` — requires a programme (students
  page) or inherits the batch's own (batch page) before it will import.
- `importStudentsIntoBatch` in `queries/students.ts` is the single import routine both
  pages call, so a sheet imported from either place lands identically.

Enforced in the UI rather than the database, deliberately: a student row must exist
before the enrolment row can reference it, so "never unenrolled" cannot be a column
constraint — it would need a deferred constraint or a trigger pair that blocks the
legitimate two-step insert. The only actor on this path is a trusted admin. Revisit if
student creation is ever exposed to anyone else.

Account deletion for out-of-batch students is planned separately and remains worth
doing — it closes the same gap from the other end.

**Check before go-live**, since the UI change does not clean up existing rows:

```sql
select s.id, s.name, s.email from students s
where not exists (select 1 from batch_student_mapping m
                  where m.student_id = s.id and m.status = 'active');
```

---

## 4. No browser security headers — Open, and last on purpose

Agreed to do this at the very end of deployment. Written out here in full so it can be
done from this file without re-deriving it.

### What the problem actually is

A website can load another website inside an invisible frame on its own page. Nothing
stops this by default. The attack, called **clickjacking**, works like this:

1. An admin is logged into the dashboard in their browser.
2. They open some unrelated page — a link from a message, a search result, anything.
3. That page has loaded your dashboard in a frame, sized and positioned so that a real
   button sits exactly under a fake one, then made invisible with CSS.
4. The admin clicks what looks like "Play" or "Continue". The click lands on the real
   button underneath, in their own logged-in session.

The admin does nothing wrong and sees nothing unusual. Their browser has their session
cookie, so the action succeeds.

### Why "private site" does not remove it

Two things worth separating, because they are often assumed to be the same:

- **These headers have nothing to do with Google or search visibility.** Nothing here
  affects whether the site is indexed, and adding them will not hide it or expose it.
  Search indexing is controlled by `robots.txt` and `noindex`, which are unrelated.
- **Unlisted is not the same as unreachable.** The attack needs the *victim's browser*
  to reach the site, not the attacker's. The attacker never has to log in, know the
  URL structure, or see any data — they only need one logged-in admin to visit a page
  they control. A URL shared in a chat, a browser extension, or a bookmark sync is
  enough for the address to be known.

That said, the exposure is genuinely small while the audience is a handful of trusted
staff, which is why last-in-deployment is a reasonable call. It is one config block
with no code change and no failure mode, so there is no reason to skip it entirely.

### How to do it

Replace `vercel.json` with this. The existing `rewrites` block is unchanged — the
`headers` block is added alongside it.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'none'" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" }
      ]
    }
  ]
}
```

What each line does:

| Header | Effect |
|--------|--------|
| `X-Frame-Options: DENY` | No site may load this one in a frame. Blocks the attack above in older browsers. |
| `frame-ancestors 'none'` | The same rule for current browsers, which prefer this one. |
| `Referrer-Policy` | Stops dashboard URLs (which contain batch and student IDs) leaking to sites an admin clicks through to. |
| `X-Content-Type-Options: nosniff` | Stops the browser second-guessing a file's type, which is how an uploaded file can be coaxed into running as script. |
| `Strict-Transport-Security` | The browser refuses plain HTTP for this domain afterwards. **Set this one last** — it is remembered for two years and cannot be undone quickly if the domain ever needs to serve plain HTTP. |

**How to verify** after deploying: open the site, press F12, go to the Network tab,
reload, click the first request, and read Response Headers. All five should be listed.

### The part not included above

A full `Content-Security-Policy` that also restricts where scripts may load from is
the bigger win and the fiddlier one. It needs `script-src`, `connect-src`,
`style-src` and `font-src` entries covering the Supabase project URL and the Google
Fonts hosts that `index.html` uses, and getting it wrong shows up as a blank page
rather than an error message. Ship the five headers above first, then do the full
policy as its own change tested on a preview deploy.

---

## 5. Repo link not validated server-side — Done

`validateRepoUrl` in the portal enforced a github.com host, but only in the browser.
The `student_repos` policies checked ownership and nothing about the value, so a
student posting straight to the REST API could store any string — and that string is
rendered as a clickable link in the admin's submission table. React 19 blocks
`javascript:` URLs, so this was never code execution; it was an admin one click from
an attacker-chosen page. The column also had no length limit.

Fixed on both sides:

- `src/components/portal/AssignmentModal.tsx` — `validateRepoUrl` now returns a
  canonical `https://github.com/<owner>/<repo>`, dropping the scheme-less form, `www.`,
  `.git`, query strings and trailing paths. The canonical value is what gets saved.
- `schema.sql` — a `CHECK` constraint on `student_repos.repo_url` accepting only that
  exact shape, max 200 characters.

The migration file normalises existing rows into the canonical form first and deletes
anything that was never a repo link, so the constraint applies cleanly.

---

## Non-security changes that touched the security surface

Shipped in the same pass. Recorded here because each one moves a boundary, not because
either is a finding.

- **Programmes replaced free-text `track`.** New `batch_programs` table holding the
  abbreviation, name and sort order; `batches.program` is a foreign key to it. RLS is
  enabled: admin-only writes, readable by any signed-in user. It is a table rather than
  a Postgres enum because the New Batch form mints abbreviations at runtime and DDL
  cannot run from the browser client; a `CHECK` on the code and the foreign key on
  `batches.program` together give what the enum gave. **If this table is ever dropped
  and recreated again, re-apply its two policies** — dropping a table drops its policies
  silently, and without them the anon key can write these rows.
- **Students gained seven profile columns** (date of birth, gender, college, course,
  branch, current year, graduation year). All additive, all covered by the existing
  `students` policies — a student still reads only their own row, and only an admin
  writes. No new read path.
- **`submission_channel` narrowed to `('github','portal')`.** Fewer values a student
  could claim, and the trigger in item 2 pins it to `portal` for them regardless.
- **One shared import routine** (`importStudentsIntoBatch`) now backs both import
  screens, so there is one code path to audit rather than two that can drift.

---

## Low priority

Not started. Batch these into one follow-up pass. None block the deploy.

### 6. WebP files skip the watermark

`IMAGE_TYPES` in `supabase/functions/watermark-material/index.ts` is PNG and JPEG only,
but the bucket's allowed types include `image/webp`. A WebP falls through to the
passthrough branch and is served unstamped. The upload form converts WebP to PNG
(`materials.ts`), so this only bites on an upload that bypasses the form — admin-only,
hence low. Fix: add `image/webp` to `IMAGE_TYPES` and embed via conversion, or drop it
from the bucket's allowed types.

### 7. SQL functions missing `search_path`

`is_admin()`, `current_student_id()`, `next_student_code()`, `touch_updated_at()`,
`student_code_prefix()` and `set_student_code_year()` are missing
`set search_path = public`. `record_fee_payment` and the new
`guard_assignment_completion` both have it. All are SECURITY INVOKER so exploitation is
not straightforward, but `is_admin()` is the function every policy depends on, and
Supabase's linter flags them all. One line each, in `schema.sql`.

### 8. Server errors returned verbatim to clients

All three edge functions end in `catch (err) => json({ error: err.message }, 500)`,
forwarding raw Postgres and Deno messages to the caller. `match-name` also relays 200
characters of Google's error body. Log the detail, return a generic message.

### 9. Edge functions accept requests from any origin

`Access-Control-Allow-Origin: '*'` in all three. They authenticate by bearer token and
not by cookie, so this is not CSRF, but there is no reason not to pin it to the
deployed origin.

### 10. Dependency advisories

`npm audit` reports 3 high, 0 critical. `react-router-dom@7.18.1` — the advisory covers
RSC mode, which this app does not use. `nanoid` — reached through `vite → postcss`,
build-time only, never shipped. **Neither is exploitable here**, but both will appear in
any scan, so update them to keep the report clean.

### 11. `supabase/.temp/` committed to git

CLI scratch state. Checked for credentials: `pooler-url` has **no** password and the
project ref is already public in `VITE_SUPABASE_URL`, so nothing sensitive leaked. Add
to `.gitignore` and `git rm -r --cached` it.

---

## Verified sound

Checked and found correct — recorded so a later change does not quietly undo them.

- **Secrets are server-side only.** The service-role and Gemini keys appear nowhere in
  `src/`; `.env` is untracked and holds only the public URL and anon key.
- **Role comes from `app_metadata`**, not `user_metadata` (`AuthContext.tsx`). The
  latter is user-editable — reading the role from it is the classic escalation bug.
- **Student reads are properly scoped.** Fees, attendance, tutors, uploads, lectures,
  batches and other students' records are all either own-row-only or default-denied.
- **Students can write to exactly two tables** — `student_repos` and
  `assignment_completions`, both own-row-only, both now column-guarded — and can delete
  from none.
- **Deadlines are enforced in the database**, so they hold against a direct API call.
- **Material storage is private** with no student storage policy; the watermarking
  edge function is the only route to the bytes.
- **CSV exports are escaped against formula injection** (`csvExport.ts`).
- **No `dangerouslySetInnerHTML`, `innerHTML` or `eval`** anywhere in `src/`.
- **`record_fee_payment` is SECURITY INVOKER**, so RLS still applies inside it and a
  student's call fails. It is granted to `authenticated`, which includes students — it
  is safe *only* because it is not SECURITY DEFINER. Do not "fix" that.
- **`batch_programs` is readable by any signed-in user by design, and admin-writable
  only.** Reference data — abbreviations and names — with nothing student-specific in
  it. See the section above for why it is a table rather than an enum.

---

## Picking this back up

1. **Test first.** The programme system, both import paths and the submission trigger
   are all new and none have been exercised against real data. The smoke test worth
   running: create a batch under a programme, import a CSV from the students page,
   import the same shape from that batch's Students tab, and confirm both produce
   identical student rows.
2. **Then items 6–11**, in one pass. Items 7 and 11 are one-line changes; 8 and 9 are
   small edits to the three edge functions; 10 is a dependency bump.
3. **Item 4 last**, at deployment, per the decision recorded in its own section.
4. **Item 1 stays accepted** unless the password design is revisited.
