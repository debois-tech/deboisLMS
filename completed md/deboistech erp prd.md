# PRD: DeboisTech Training Program — Dashboard ERP

**Status:** Draft v0.3 (attendance thresholds, approval flow, fee scope, and multi-session handling confirmed)
**Owner:** DeboisTech
**Doc type:** Product Requirements Document

---

## 1. Overview

A single-admin dashboard ERP for managing DeboisTech's training batches (DevOps ongoing, AI/ML starting soon). There is **no student login** — the admin manually enters and reviews all data, and the dashboard surfaces it: fees, attendance, batch/lecture progress, and assignment-submission records.

**Stack:** Website (admin dashboard only) + Supabase (Postgres + Storage). Single admin auth account.

---

## 2. Goals

- One admin dashboard to replace scattered spreadsheets/WhatsApp tracking for fees, attendance, and assignment completion.
- Support multiple concurrent batches, each with its own students and tutor(s).
- A working attendance pipeline: manual entry now, with a defined path to semi-automate it via a raw-CSV → AI-matching → final-table flow.
- Everything else (badges, certificates, offer/LOR docs, forms) either stays a stub for later or is explicitly dropped.

## 3. Non-Goals (v1)

- No student-facing login or portal.
- No payment gateway — fees are recorded manually.
- No file storage/grading workflow for assignments — just a submitted/not-submitted record.
- No Google Form module, no badge logic, no certificate generation. (Offer/LOR storage remains a stub, same as prior draft.)

---

## 4. Users

**Admin (single login):** the only authenticated user. Full CRUD on all data below, views the dashboard.

**Tutors and Students are data, not logins** — they're records the admin manages, not accounts that sign in.

---

## 5. Modules

### 5.1 Batches
Dashboard's organizing unit. Admin creates a batch (e.g. "DevOps Batch 3", "AI/ML Batch 1"), and the dashboard shows per-batch summaries: student count, lectures held to date, average attendance, fee collection status.

### 5.2 Personal Details (Students & Tutors)
- Students: basic profile fields (name, phone, email, GitHub, LinkedIn), entered by admin.
- Tutors: name/contact, assigned to one or more batches.
- A student can belong to more than one batch over time (e.g. finishes DevOps, joins AI/ML) — modeled as a mapping table, not a field on the student record.
- A tutor can be assigned to more than one batch — also a mapping table.

### 5.3 Finance
- Per student, per batch: total fee, amount paid, amount remaining (computed).
- Admin updates `paid_amount` manually as payments come in.
- Dashboard shows collection status per batch (e.g. total collected vs total due) and can flag students with outstanding balance.
- Confirmed: fee is scoped **per student per batch** — a student in two batches has two separate fee records.

### 5.4 Attendance
Three-stage pipeline, as you outlined:

1. **Roster** — `students` + `batch_student_mapping` (who's in which batch — already covered above).
2. **`upload`** — raw Google Meet CSV, ingested as-is: every row from the export, unmatched, un-deduplicated.
3. **`attendance`** — the final, per-student-per-lecture record that the dashboard actually reads from.

**The merge step (script, not this PRD's concern to implement, but the schema needs to support it):**
- Script pulls unprocessed `upload` rows for a given lecture (matched via `meeting_code` + date).
- For each raw row, it fuzzy-matches `participant_name_raw` against the batch roster (via Gemini), to handle typos/nicknames/"Name (2)"-style duplicate-device labels.
- Rows that match the same student are grouped and their durations summed — this is how both cases you flagged (rejoin after disconnect, and joining from two devices) collapse into a single final record per student per lecture.
- One row per student per lecture is written into `attendance`, with status derived from attended duration vs. the lecture's scheduled length:
  - **≥90%** of `scheduled_duration_minutes` → **present**
  - **65–90%** → **partial**
  - **<65%** → **absent**
- A back-reference (`raw_upload_ids`) records which raw rows fed into each final row, for audit — since the AI matching won't be 100% reliable.
- **Approval workflow (confirmed):** once a lecture's raw rows are parsed and merged into `attendance`, the row lands with `approved = false`. It only counts as confirmed attendance on the dashboard once the admin manually hits an approve/tick button per row (or in bulk per lecture) on the frontend, which flips `approved = true`.

**Multiple sessions per batch per day:** not the normal case, but the schema already supports it without any special-casing — `lectures` is one row per session (not one row per date), so two sessions on the same day are just two `lectures` rows with the same `lecture_date` but different `meeting_code`. CSV-to-lecture matching should key off `meeting_code` (unique per Meet session) rather than date alone, which handles this automatically if/when it comes up. Nothing extra needed in the base implementation.

**Still open:** should raw `upload` rows be deleted once merged into `attendance` (matches "removed from Upload table" as you described it), or kept with `processed = true` as an audit trail in case a match needs re-checking later? Schema as written supports either — deleting is just a cleanup step in the script after a successful merge; keeping them costs nothing but a bit of table size. Lean towards keeping + `processed = true` unless storage/clutter is a real concern, but this is your call.

### 5.5 Assignments
- Admin creates an assignment record per batch (title, assigned date).
- Admin marks, per student, whether it was submitted (and via what channel — WhatsApp today, "other" as a catch-all) — this is a completion log, not a file store.

### 5.6 Badges / Certificates / Offer / LOR
Unchanged from the prior draft — stubs for now:
- **Badges** — deferred, no schema yet.
- **Certificates** — deferred, no schema yet.
- **Offer/LOR** — confirmed staying unbuilt for now, same as Badges/Certificates. No schema below.

### 5.7 Dropped
Gform-redirect module and anything else not listed above — not being built.

---

## 6. Supabase Schema

All tables use `uuid` primary keys (`default gen_random_uuid()`) and `timestamptz` for timestamps unless noted. RLS can stay simple (single admin role) since there's no student-facing access to lock down.

```sql
-- Tutors
create table tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  created_at timestamptz default now()
);

-- Batches
create table batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  track text,                          -- e.g. 'DevOps', 'AI/ML'
  status text check (status in ('upcoming','ongoing','completed')) default 'upcoming',
  start_date date,
  created_at timestamptz default now()
);

-- Students
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  github_url text,
  linkedin_url text,
  created_at timestamptz default now()
);

-- Student <-> Batch mapping (many-to-many)
create table batch_student_mapping (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id) not null,
  student_id uuid references students(id) not null,
  joined_at date default now(),
  status text check (status in ('active','dropped')) default 'active',
  unique (batch_id, student_id)
);

-- Tutor <-> Batch mapping (many-to-many)
create table tutor_batch_mapping (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references tutors(id) not null,
  batch_id uuid references batches(id) not null,
  assigned_at date default now(),
  unique (tutor_id, batch_id)
);

-- Lectures (one row per session; needed to scope attendance/uploads correctly)
create table lectures (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id) not null,
  lecture_date date not null,
  session_type text check (session_type in ('online','offline')) default 'online',
  meeting_code text,                   -- matches the Meet CSV "Meeting code" column; unique per session,
                                        -- so multiple sessions on the same lecture_date work with no extra changes
  scheduled_duration_minutes int,       -- planned length, used to compute attendance % (≥90% present, 65-90% partial, <65% absent)
  created_at timestamptz default now()
);

-- Raw Meet CSV import (unprocessed, one row per CSV row)
create table upload (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid references lectures(id),   -- linked once matched to a session (by meeting_code/date)
  sno int,
  participant_name_raw text not null,        -- exactly as in the CSV, unmatched
  attendance_started timestamptz,
  joined_at timestamptz,                     -- CSV's "Joined at (beta)" column
  attendance_stopped timestamptz,
  attended_duration_raw text,                -- CSV gives e.g. "12 min 15s"; keep raw, parse in script
  attended_minutes numeric,                  -- parsed numeric duration, filled by the script
  meeting_code text,
  matched_student_id uuid references students(id),  -- filled in by the AI matching step
  processed boolean default false,
  uploaded_at timestamptz default now()
);

-- Final, merged attendance (one row per student per lecture)
create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) not null,
  batch_id uuid references batches(id) not null,
  lecture_id uuid references lectures(id) not null,
  status text check (status in ('present','partial','absent')) default 'absent',
  total_attended_minutes numeric,        -- summed across all matched raw rows (handles rejoin/multi-device)
  raw_upload_ids uuid[],                 -- upload.id rows merged into this record, for audit
  source text check (source in ('manual','automated')) default 'manual',
  approved boolean default false,       -- flips to true only via manual approve/tick action on the frontend
  approved_at timestamptz,
  created_at timestamptz default now(),
  unique (student_id, lecture_id)
);

-- Fees (per student, per batch)
create table student_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) not null,
  batch_id uuid references batches(id) not null,
  total_fee numeric not null,
  paid_amount numeric not null default 0,
  updated_at timestamptz default now(),
  unique (student_id, batch_id)
  -- remaining = total_fee - paid_amount, compute in query or as a generated column
);

-- Assignments (the assignment itself, per batch)
create table assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id) not null,
  title text not null,
  description text,
  assigned_date date default now(),
  created_at timestamptz default now()
);

-- Assignment completion record (per student, per assignment)
create table assignment_completed (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) not null,
  student_id uuid references students(id) not null,
  submitted boolean default false,
  submitted_via text check (submitted_via in ('whatsapp','other')) default 'whatsapp',
  submitted_at timestamptz,
  marked_by uuid references tutors(id),
  unique (assignment_id, student_id)
);
```

**Tables added beyond your original list, and why:**
- `lectures` — attendance is really per-lecture, not just per-date; without this table there's nowhere to hang `scheduled_duration_minutes` (needed to compute present/partial/absent) or to disambiguate two sessions on the same day.
- `assignments` — separates "the assignment that was given" from "who submitted it." Without it, `assignment_completed` alone has nowhere to store the title/description/date of the assignment itself, and every student's row would duplicate that info.

---

## 7. Open Questions

Resolved: attendance thresholds, fee scope, approval workflow, multi-session handling, and Offer/LOR status are all settled (see sections above). One item remains:

1. **Raw `upload` row lifecycle:** delete rows from `upload` once successfully merged into `attendance`, or keep them (with `processed = true`) as an audit trail? Either works with the schema as written — this is just a script-behavior decision, not a structural one.

---

## 8. Next Steps

Once the above are confirmed, this schema is ready to stand up in Supabase directly — happy to turn section 6 into a runnable migration file, or start scaffolding the admin dashboard UI (batch list → batch detail → attendance/fees/assignments tabs) next.
