-- =============================================================================
-- Migration — 11 Aug 2026
-- =============================================================================
-- Everything this round needs, in one file, in dependency order. Run it whole in
-- the Supabase SQL editor. It is re-runnable: every statement is guarded, and
-- nothing here rewrites data that has already been issued.
--
--   1. Student codes      — one permanent ID per student, DBT-INT-2026-001
--   2. Material files     — any file type, plus files attached to an assignment
--   3. Attendance         — 120-minute default session length
--
-- Run after core_migration.sql and study_material_migration.sql.
--
-- NOT DONE BY THIS FILE — the material reader will 500 on the new columns until
-- the edge function is redeployed:
--
--   npx supabase functions deploy watermark-material --project-ref rganjiaxsdrrhoobpnfw
-- =============================================================================


-- =============================================================================
-- 1. STUDENT CODES
-- =============================================================================
-- One permanent ID per student, independent of every batch.
--
-- Postgres issues the code, not the app: students are created from the form, from
-- two CSV importers that insert every row at once, and by hand in SQL. Anything
-- app-side that reads the highest number and adds one hands out duplicates under
-- that burst; nextval() cannot.

-- ── 1a. The prefix ──────────────────────────────────────────────────────────
-- Split in two because only the year ever moves. Changing either affects students
-- created after the change: an issued code never moves.
-- Seeded once, never replaced: re-running this file after the year has been
-- rolled must not drag it back to 2026 and re-issue codes that already exist.
-- Use set_student_code_year() below to change it.
do $$
begin
  if to_regprocedure('student_code_year()') is null then
    execute 'create function student_code_year() returns text language sql stable as $f$ select ''2026''::text $f$';
  end if;
end $$;

create or replace function student_code_prefix() returns text
  language sql stable
  as $$ select 'DBT-INT-' || student_code_year() || '-' $$;

-- Rolling the year, when the 2027 intake starts:
--
--   select set_student_code_year(2027);
--
-- Both halves in one call, because doing one without the other is the bug: a new
-- year without the restart keeps counting from 057, and a restart without a new
-- year re-issues codes that already exist. The guard below refuses the second
-- case outright, and the whole thing is one transaction — a refusal leaves the
-- year unchanged too.
create or replace function set_student_code_year(new_year int) returns text
  language plpgsql
  as $$
begin
  execute format(
    'create or replace function student_code_year() returns text language sql stable as $f$ select %L::text $f$',
    new_year::text
  );

  if exists (select 1 from students where student_code like student_code_prefix() || '%') then
    raise exception 'Codes already issued under %, refusing to restart the counter',
      student_code_prefix();
  end if;

  alter sequence student_code_seq restart 1;
  return student_code_prefix();
end $$;

-- ── 1b. The running number ──────────────────────────────────────────────────
create sequence if not exists student_code_seq as bigint start 1;

-- The other half of the format: DBT-INT-2026-001. lpad pads but never truncates,
-- so the 1000th student widens to -1000 rather than losing a digit.
create or replace function next_student_code() returns text
  language sql volatile
  as $$ select student_code_prefix() || lpad(nextval('student_code_seq')::text, 3, '0') $$;

-- ── 1c. The column ──────────────────────────────────────────────────────────
alter table students add column if not exists student_code text;
alter table students alter column student_code set default next_student_code();

comment on column students.student_code is
  'Permanent institution-wide student ID. Assigned once on insert and never '
  'rewritten — batches, drops and re-enrolments do not touch it.';

-- Backfilled oldest-first, one row at a time: UPDATE ... FROM promises nothing
-- about the order rows are processed in, and these numbers should follow signup.
do $$
declare target record;
begin
  for target in select id from students where student_code is null order by created_at, id loop
    update students set student_code = next_student_code() where id = target.id;
  end loop;
end $$;

alter table students alter column student_code set not null;

-- One student one code, and no second student can ever take it.
create unique index if not exists students_student_code_key on students (student_code);


-- =============================================================================
-- 2. MATERIAL FILES
-- =============================================================================
-- Any file type, and files attached to an assignment.
--
-- Two changes. First, the bucket stops being PDF-only, and the row records what
-- it is holding so the reader knows whether to page it, print it, or hand it
-- over. Second, a material can hang off an assignment instead of standing on its
-- own — an assignment's own handouts are files exactly like study material is,
-- so they are the same table rather than a parallel one.

-- ── 2a. What the file is ────────────────────────────────────────────────────
-- Existing rows are all PDFs: the bucket allowed nothing else until now.
alter table materials add column if not exists mime_type text not null default 'application/pdf';

comment on column materials.mime_type is
  'Decides how the file is delivered: PDFs and images are watermarked and paged, '
  'markdown and text are shown as-is, everything else is downloaded.';

-- ── 2b. Assignment handouts ─────────────────────────────────────────────────
-- The batch_id is set as well, so the existing student read policy already
-- covers these rows. Study-material listings filter on `assignment_id is null`
-- to keep an assignment's handouts out of the material library.
alter table materials add column if not exists assignment_id uuid
  references assignments(id) on delete cascade;

comment on column materials.assignment_id is
  'Set when the file is an assignment handout rather than study material. '
  'batch_id is still set, so access follows the same enrolment rule.';

create index if not exists materials_assignment_id_idx on materials (assignment_id);

-- ── 2c. Bucket ──────────────────────────────────────────────────────────────
-- .docx is absent on purpose: it is converted to a PDF in the browser before
-- upload, so it never reaches storage as Word. 50 MB per file stands — it is
-- what the watermark function can hold in memory alongside its output.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials', 'materials', false, 52428800,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'text/markdown', 'text/x-markdown', 'text/plain', 'text/csv',
    'application/json', 'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- =============================================================================
-- 3. ATTENDANCE
-- =============================================================================
-- Manual marking needs almost nothing here, because the schema already allowed
-- for it: `attendance` carries an `attendance_source` of manual | automated and
-- already defaults to 'manual', `total_attended_minutes` is nullable, and the
-- `unique (student_id, lecture_id)` constraint lets a hand-marked row and a
-- CSV-processed one upsert over each other on the same key.

-- ── 3a. Session length ──────────────────────────────────────────────────────
-- 120 minutes, not 90. It is the denominator every attendance percentage is
-- measured against, so a lecture created without one should carry the real
-- figure rather than a shorter guess that marks full attendance as partial.
alter table lectures alter column scheduled_duration_minutes set default 120;

comment on column lectures.scheduled_duration_minutes is
  'Scheduled session length. Attendance bands are a percentage of this: '
  '>=90% present, >=65% partial, below that absent.';

-- Existing lectures are left alone on purpose. Changing the denominator under a
-- past session would silently restate attendance that has already been approved.
