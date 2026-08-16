-- DeboisTech ERP — schema
-- The whole database in one file: run it on a fresh project and nothing else.
-- Assumes an admin user already exists in Supabase Auth — edit the email in §9.
-- Re-runnable: every statement is guarded and nothing rewrites issued data.


-- 1. TYPES
do $$ begin create type batch_status       as enum ('upcoming', 'ongoing', 'completed');      exception when duplicate_object then null; end $$;
do $$ begin create type session_type       as enum ('online', 'offline');                     exception when duplicate_object then null; end $$;
do $$ begin create type attendance_status  as enum ('present', 'partial', 'absent');          exception when duplicate_object then null; end $$;
do $$ begin create type attendance_source  as enum ('manual', 'automated');                   exception when duplicate_object then null; end $$;
do $$ begin create type mapping_status     as enum ('active', 'dropped');                     exception when duplicate_object then null; end $$;
do $$ begin create type fee_status         as enum ('due', 'paid');                           exception when duplicate_object then null; end $$;
do $$ begin create type payment_method     as enum ('cash', 'upi', 'bank_transfer', 'other'); exception when duplicate_object then null; end $$;

-- Work is handed in as a GitHub repo and nothing else. 'portal' is the student
-- doing it themselves; 'github' is an admin recording one. WhatsApp is gone.
do $$ begin create type submission_channel as enum ('github', 'portal');                      exception when duplicate_object then null; end $$;

-- Programmes are NOT an enum — see the batch_programs table below for why.


-- 2. STUDENT CODES
-- One permanent ID per student, independent of every batch. Postgres issues it,
-- not the app: students are created from a form, from two CSV importers that
-- insert every row at once, and by hand in SQL. Anything app-side that reads the
-- highest number and adds one hands out duplicates under that burst; nextval()
-- cannot.

-- Seeded once, never replaced: re-running this file after the year has been
-- rolled must not drag it back to 2026 and re-issue codes that already exist.
do $$
begin
  if to_regprocedure('student_code_year()') is null then
    execute 'create function student_code_year() returns text language sql stable set search_path = public as $f$ select ''2026''::text $f$';
  end if;
end $$;

create or replace function student_code_prefix() returns text
  language sql stable
  set search_path = public
  as $$ select 'DBT-INT-' || student_code_year() || '-' $$;

-- Rolling the year, when the 2027 intake starts:
--
--   select set_student_code_year(2027);
--
-- Both halves in one call, because doing one without the other is the bug: a new
-- year without the restart keeps counting from 057, and a restart without a new
-- year re-issues codes that already exist. The guard below refuses the second
-- case outright, and the whole thing is one transaction.
create or replace function set_student_code_year(new_year int) returns text
  language plpgsql
  set search_path = public
  as $$
begin
  execute format(
    'create or replace function student_code_year() returns text language sql stable set search_path = public as $f$ select %L::text $f$',
    new_year::text
  );

  if exists (select 1 from students where student_code like student_code_prefix() || '%') then
    raise exception 'Codes already issued under %, refusing to restart the counter',
      student_code_prefix();
  end if;

  alter sequence student_code_seq restart 1;
  return student_code_prefix();
end $$;

create sequence if not exists student_code_seq as bigint start 1;

-- DBT-INT-2026-001. lpad pads but never truncates, so the 1000th student widens
-- to -1000 rather than losing a digit.
create or replace function next_student_code() returns text
  language sql volatile
  set search_path = public
  as $$ select student_code_prefix() || lpad(nextval('student_code_seq')::text, 3, '0') $$;


-- 3. CORE TABLES
create table if not exists tutors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  phone      text,
  created_at timestamptz default now()
);

-- Abbreviation to display name. A table rather than a hardcoded list in the app,
-- so the import validator and the batch form read the same rows.
--
-- Deliberately not a Postgres enum. An enum is fixed at migration time: adding a
-- value is DDL, which the browser client cannot run and which cannot be done in
-- the same transaction that then uses the value. The batch form mints a new
-- abbreviation on the spot, so the valid set has to be rows. The CHECK keeps the
-- codes enum-shaped and the foreign key on batches.program gives the same
-- guarantee an enum would.
create table if not exists batch_programs (
  -- Enum-shaped by constraint: 2–6 capitals, e.g. PHR, AML, MCL.
  code       text primary key check (code ~ '^[A-Z]{2,6}$'),
  name       text not null check (length(btrim(name)) > 0),
  sort_order int  not null default 0
);

insert into batch_programs (code, name, sort_order) values
  ('PHR', 'DevOps Prahar',           1),
  ('AML', 'AI/ML Engineering',       2),
  ('MCL', 'Multi-Cloud Engineering', 3)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

create table if not exists batches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- Which programme this batch runs. Replaces the old free-text `track`, which
  -- allowed any spelling and could not be validated. No cascade delete: a
  -- programme still carrying batches must not vanish under them.
  -- Not null: a batch with no programme is invisible to the CSV importer.
  program    text not null references batch_programs(code),
  status     batch_status default 'upcoming',
  start_date date,
  -- Filename prefix for this batch's study material, e.g. DBT-TEPC-2026-D.
  -- Material titles are this plus an admin-entered suffix: DBT-TEPC-2026-D01.
  batch_code text,
  -- The batch's full fee before any discount. Student imports carry a Discount %
  -- per row and write base_fee * (1 - discount/100) into student_fees.total_fee;
  -- the discount itself is never stored, only the amount it produced. Nullable
  -- for batches created before the column existed — the form requires it now and
  -- the importer refuses a batch without one rather than importing zeroes.
  base_fee   numeric check (base_fee is null or base_fee >= 0),
  created_at timestamptz default now()
);

create index if not exists idx_batches_program on batches(program);

create table if not exists students (
  id              uuid primary key default gen_random_uuid(),
  student_code    text unique not null default next_student_code(),
  name            text not null,
  -- WhatsApp number. Also the source of the portal password suffix.
  phone           text,
  email           text,
  date_of_birth   date,
  gender          text,
  college         text,
  course          text,
  branch          text,
  -- Free text, not an int: "3rd", "Final year" and "2" all turn up in the sheets.
  current_year    text,
  graduation_year int,
  github_url      text,
  linkedin_url    text,
  -- True once the portal password has been reset to a random one: the derived
  -- Debois@<last4> rule no longer applies and the password is shown only at reset.
  password_rotated boolean not null default false,
  -- Set once a portal login exists for this student.
  auth_user_id    uuid references auth.users(id) unique,
  created_at      timestamptz default now()
);

comment on column students.student_code is
  'Permanent institution-wide student ID. Assigned once on insert and never '
  'rewritten — batches, drops and re-enrolments do not touch it.';

create table if not exists batch_student_mapping (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid references batches(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  joined_at  date default current_date,
  status     mapping_status default 'active',
  unique (batch_id, student_id)
);

create index if not exists idx_bsm_batch   on batch_student_mapping(batch_id);
create index if not exists idx_bsm_student on batch_student_mapping(student_id);

create table if not exists tutor_batch_mapping (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid references tutors(id) on delete cascade not null,
  batch_id    uuid references batches(id) on delete cascade not null,
  assigned_at date default current_date,
  unique (tutor_id, batch_id)
);

create index if not exists idx_tbm_tutor on tutor_batch_mapping(tutor_id);
create index if not exists idx_tbm_batch on tutor_batch_mapping(batch_id);


-- 4. ATTENDANCE
create table if not exists lectures (
  id                         uuid primary key default gen_random_uuid(),
  batch_id                   uuid references batches(id) on delete cascade not null,
  lecture_date               date not null,
  session_type               session_type default 'online',
  meeting_code               text,
  scheduled_duration_minutes int default 120,
  created_at                 timestamptz default now()
);

comment on column lectures.scheduled_duration_minutes is
  'Scheduled session length. Attendance bands are a percentage of this: '
  '>=90% present, >=65% partial, below that absent.';

create index if not exists idx_lectures_batch on lectures(batch_id);

-- Raw Meet CSV uploads, one row per CSV row. Cleared after every process run.
create table if not exists uploads (
  id                    uuid primary key default gen_random_uuid(),
  lecture_id            uuid references lectures(id) on delete set null,
  sno                   int,
  participant_name_raw  text not null,
  -- Naive wall-clock times: the Meet CSV exports "9:30:00 AM" with no zone, and
  -- the calendar date always comes from the lecture. A timestamptz column would
  -- silently apply the session's zone.
  attendance_started    timestamp,
  joined_at             timestamp,
  attendance_stopped    timestamp,
  attended_duration_raw text,
  attended_minutes      numeric,
  meeting_code          text,
  matched_student_id    uuid references students(id) on delete set null,
  processed             boolean default false,
  uploaded_at           timestamptz default now()
);

create index if not exists idx_uploads_lecture   on uploads(lecture_id);
create index if not exists idx_uploads_meeting   on uploads(meeting_code);
create index if not exists idx_uploads_processed on uploads(processed);

create table if not exists attendance (
  id                     uuid primary key default gen_random_uuid(),
  student_id             uuid references students(id) on delete cascade not null,
  batch_id               uuid references batches(id) on delete cascade not null,
  lecture_id             uuid references lectures(id) on delete cascade not null,
  status                 attendance_status default 'absent',
  total_attended_minutes numeric,
  raw_upload_ids         uuid[],
  source                 attendance_source default 'manual',
  approved               boolean default false,
  approved_at            timestamptz,
  created_at             timestamptz default now(),
  unique (student_id, lecture_id)
);

create index if not exists idx_attendance_batch   on attendance(batch_id);
create index if not exists idx_attendance_lecture on attendance(lecture_id);
create index if not exists idx_attendance_student on attendance(student_id);


-- 5. FEES
create table if not exists student_fees (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id) on delete cascade not null,
  batch_id    uuid references batches(id) on delete cascade not null,
  total_fee   numeric not null,
  paid_amount numeric not null default 0,
  status      fee_status generated always as (
    case when paid_amount >= total_fee then 'paid'::fee_status else 'due'::fee_status end
  ) stored,
  updated_at  timestamptz default now(),
  unique (student_id, batch_id)
);

create index if not exists idx_fees_student on student_fees(student_id);
create index if not exists idx_fees_batch   on student_fees(batch_id);

-- Individual payment history. student_fees.paid_amount stays the running total.
create table if not exists fee_payment_logs (
  id             uuid primary key default gen_random_uuid(),
  student_fee_id uuid references student_fees(id) on delete cascade not null,
  student_id     uuid references students(id) on delete cascade not null,
  batch_id       uuid references batches(id) on delete cascade not null,
  amount         numeric not null check (amount > 0),
  payment_date   date not null default current_date,
  payment_method payment_method default 'other',
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists idx_fee_logs_fee   on fee_payment_logs(student_fee_id);
create index if not exists idx_fee_logs_batch on fee_payment_logs(batch_id);

-- Payment log and running balance in one transaction.
--
-- SECURITY INVOKER on purpose. It is granted to `authenticated`, which includes
-- students, and it is safe only because RLS still applies to the INSERT and the
-- UPDATE inside it — a student's call fails on the policies. Do not add
-- SECURITY DEFINER.
create or replace function public.record_fee_payment(
  p_student_fee_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method payment_method default 'other',
  p_notes text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  fee_row student_fees%rowtype;
  log_row fee_payment_logs%rowtype;
  updated_fee student_fees%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  -- Lock the fee row. Concurrent payments serialize on this student/batch.
  select * into fee_row from student_fees where id = p_student_fee_id for update;

  if not found then
    raise exception 'Could not find the fee record';
  end if;

  insert into fee_payment_logs (
    student_fee_id, student_id, batch_id, amount,
    payment_date, payment_method, notes
  ) values (
    fee_row.id, fee_row.student_id, fee_row.batch_id, p_amount,
    p_payment_date, p_payment_method, p_notes
  )
  returning * into log_row;

  update student_fees
  set paid_amount = fee_row.paid_amount + p_amount,
      updated_at = now()
  where id = fee_row.id
  returning * into updated_fee;

  return jsonb_build_object('log', to_jsonb(log_row), 'fee', to_jsonb(updated_fee));
end;
$$;

revoke all on function public.record_fee_payment(uuid, numeric, date, payment_method, text) from public;
grant execute on function public.record_fee_payment(uuid, numeric, date, payment_method, text) to authenticated;


-- Every student pays 1000 on joining a batch. Booked as a payment against the fee,
-- not subtracted from the total, so the log and the balance agree.
-- Fires on insert only: re-adding a dropped student reuses its fee row.
--
-- Nothing is logged for a student charged nothing — a 100% discount produces a
-- total_fee of 0, and a registration payment against 0 is not a fact. A fee
-- under 1000 logs only what was charged, so the log never exceeds the total.
create or replace function log_registration_fee()
returns trigger
language plpgsql
set search_path = public
as $$
declare amount numeric;
begin
  if new.total_fee is null or new.total_fee <= 0 then
    return new;
  end if;

  amount := least(1000, new.total_fee);

  insert into fee_payment_logs (
    student_fee_id, student_id, batch_id, amount, payment_date, payment_method, notes
  ) values (
    new.id, new.student_id, new.batch_id, amount, current_date, 'upi', 'Registration fee'
  );

  update student_fees
  set paid_amount = paid_amount + amount, updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists student_fees_registration_fee on student_fees;
create trigger student_fees_registration_fee
  after insert on student_fees
  for each row execute function log_registration_fee();


-- 6. ASSIGNMENTS
-- assigned_date is when the work was handed out; due_at is the deadline.
create table if not exists assignments (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid references batches(id) on delete cascade not null,
  title         text not null,
  description   text,
  assigned_date date default current_date,
  due_at        timestamptz,
  created_at    timestamptz default now()
);

comment on column assignments.due_at is
  'Deadline as an absolute instant. Null = no deadline. Students cannot submit after it.';

create index if not exists idx_assignments_batch on assignments(batch_id);

create table if not exists assignment_completions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade not null,
  student_id    uuid references students(id) on delete cascade not null,
  submitted     boolean default false,
  submitted_via submission_channel default 'portal',
  submitted_at  timestamptz,
  marked_by     uuid references tutors(id) on delete set null,
  unique (assignment_id, student_id)
);

create index if not exists idx_ac_assignment on assignment_completions(assignment_id);
create index if not exists idx_ac_student    on assignment_completions(student_id);

-- One repo per student, not one per submission: editing the link from any
-- assignment's dialog re-points every past and future submission. Intentional.
-- The row belongs to the student, but the columns do not. RLS decides which row
-- a student may write; this decides what the values may be, so a hand-written
-- API call carrying submitted_at, submitted_via or marked_by achieves nothing.
create or replace function guard_assignment_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if is_admin() then return new; end if;

  -- Students hand work in. Taking it back is an admin action.
  if new.submitted is not true then
    raise exception 'Only a coordinator can un-submit work';
  end if;
  if tg_op = 'UPDATE' and old.submitted then
    raise exception 'This assignment has already been handed in';
  end if;

  -- Server owns all three, whatever the client sent.
  new.submitted_via := 'portal';
  new.submitted_at  := now();
  new.marked_by     := null;
  return new;
end;
$$;

drop trigger if exists assignment_completions_guard on assignment_completions;
create trigger assignment_completions_guard
  before insert or update on assignment_completions
  for each row execute function guard_assignment_completion();

create table if not exists student_repos (
  student_id uuid primary key references students(id) on delete cascade,
  repo_url   text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- The submit dialog already refuses a non-GitHub link, but that check lives in
-- the browser and the browser is not a lock: a student can PATCH this table
-- through the REST API directly. The value is rendered as a clickable link in
-- the admin's submission table, so it is constrained where it is written.
alter table student_repos drop constraint if exists student_repos_repo_url_github;
alter table student_repos add constraint student_repos_repo_url_github
  check (
    repo_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'
    and length(repo_url) <= 200
  );

create or replace function touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_repos_touch_updated_at on student_repos;
create trigger student_repos_touch_updated_at
  before update on student_repos
  for each row execute function touch_updated_at();


-- 7. STUDY MATERIAL
-- The file itself lives in the private `materials` bucket; only the edge
-- function (service role) can reach it, and it stamps every page before
-- returning it.
create table if not exists materials (
  id            uuid primary key default gen_random_uuid(),
  -- NULL means the material is for every student, not one batch.
  batch_id      uuid references batches(id) on delete cascade,
  -- Set when the file is an assignment handout rather than study material.
  -- batch_id is still set, so access follows the same enrolment rule.
  assignment_id uuid references assignments(id) on delete cascade,
  -- Who the material came from, for the listings. Not part of the watermark.
  tutor_id      uuid references tutors(id) on delete set null,
  title         text not null,
  description   text,
  -- Folder name when this came from a folder upload; NULL for a single file.
  -- One row per file either way — this only groups them in listings.
  folder        text,
  storage_path  text not null unique,   -- <batch_id|all>/<uuid>.<ext>
  mime_type     text not null default 'application/pdf',
  size_bytes    bigint,
  page_count    int,
  uploaded_by   uuid,
  created_at    timestamptz default now()
);

comment on column materials.mime_type is
  'Decides how the file is delivered: PDFs and images are watermarked and paged, '
  'markdown and text are shown as-is, everything else is downloaded.';

create index if not exists idx_materials_batch      on materials(batch_id);
create index if not exists materials_assignment_id_idx on materials(assignment_id);
create index if not exists materials_tutor_id_idx   on materials(tutor_id);
create index if not exists materials_folder_idx     on materials(batch_id, folder);
create index if not exists materials_created_at_idx on materials(created_at desc);

-- Who opened what. A watermarked leak identifies the student; this says when.
create table if not exists material_views (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  viewed_at   timestamptz not null default now()
);

create index if not exists idx_material_views_material on material_views(material_id);
create index if not exists idx_material_views_student  on material_views(student_id);

-- .docx is absent on purpose: it is converted to a PDF in the browser before
-- upload, so it never reaches storage as Word. 50 MB per file is what the
-- watermark function can hold in memory alongside its output.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials', 'materials', false, 52428800,
  array[
    'application/pdf',
    'image/png', 'image/jpeg',
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


-- 8. VIEWS
create or replace view batch_fee_summary as
select
  b.id as batch_id,
  b.name as batch_name,
  count(distinct bsm.student_id) as total_students,
  coalesce(sum(sf.total_fee), 0) as total_fees,
  coalesce(sum(sf.paid_amount), 0) as total_collected,
  coalesce(sum(sf.total_fee - sf.paid_amount), 0) as total_outstanding
from batches b
left join batch_student_mapping bsm on bsm.batch_id = b.id and bsm.status = 'active'
left join student_fees sf on sf.batch_id = b.id and sf.student_id = bsm.student_id
group by b.id, b.name;

create or replace view batch_attendance_summary as
select
  b.id as batch_id,
  b.name as batch_name,
  count(distinct l.id) as total_lectures,
  count(distinct a.id) filter (where a.status = 'present' and a.approved) as present_count,
  count(distinct a.id) filter (where a.status = 'partial' and a.approved) as partial_count,
  count(distinct a.id) filter (where a.status = 'absent' and a.approved) as absent_count,
  count(distinct a.id) filter (where a.approved = false) as pending_approval
from batches b
left join lectures l on l.batch_id = b.id
left join attendance a on a.lecture_id = l.id
group by b.id, b.name;

-- Views run with the owner's rights by default, which would bypass every policy
-- below. This makes them run as the caller instead.
alter view batch_fee_summary        set (security_invoker = on);
alter view batch_attendance_summary set (security_invoker = on);

-- This one is the exception, and deliberately keeps owner rights: it exists to
-- show a student their balance WITHOUT showing them total_fee or paid_amount.
-- Column-level grants cannot express that, because admins and students are both
-- the `authenticated` role. Reaching past RLS is the point, so it carries its own
-- `where` on current_student_id() instead.
create or replace view student_fee_dues as
select
  sf.id,
  sf.student_id,
  sf.batch_id,
  greatest(sf.total_fee - sf.paid_amount, 0) as amount_due,
  sf.status,
  sf.updated_at
from student_fees sf
where sf.student_id = current_student_id();

grant select on student_fee_dues to authenticated;

comment on view student_fee_dues is
  'Portal-facing fee row: the outstanding balance only. total_fee and paid_amount '
  'never leave the database for a student. Admin reads student_fees directly.';


-- 9. AUTH HELPERS
-- Policies trust app_metadata.role, which only the service role can write.
-- EDIT the email before running on a new project.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'adminuser@deboistech.in';

create or replace function is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function current_student_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from students where auth_user_id = auth.uid();
$$;


-- 10. ROW LEVEL SECURITY
alter table tutors                 enable row level security;
alter table batches                enable row level security;
alter table students               enable row level security;
alter table batch_student_mapping  enable row level security;
alter table tutor_batch_mapping    enable row level security;
alter table lectures               enable row level security;
alter table uploads                enable row level security;
alter table attendance             enable row level security;
alter table student_fees           enable row level security;
alter table fee_payment_logs       enable row level security;
alter table assignments            enable row level security;
alter table assignment_completions enable row level security;
alter table student_repos          enable row level security;
alter table materials              enable row level security;
alter table material_views         enable row level security;
alter table batch_programs         enable row level security;

-- Reference data, no secrets: every signed-in user reads the three rows, only an
-- admin changes them.
drop policy if exists read_programs on batch_programs;
create policy read_programs on batch_programs for select to authenticated using (true);

-- ── Admin — full access everywhere ──────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'tutors', 'batches', 'students', 'batch_student_mapping', 'tutor_batch_mapping',
    'lectures', 'uploads', 'attendance', 'student_fees', 'fee_payment_logs',
    'assignments', 'assignment_completions', 'student_repos', 'materials', 'material_views',
    'batch_programs'
  ] loop
    execute format('drop policy if exists admin_full_access on %I', t);
    execute format(
      'create policy admin_full_access on %I for all using (is_admin()) with check (is_admin())', t
    );
  end loop;
end $$;

-- ── Student — read-only, scoped to their own data ───────────────────────────
drop policy if exists student_read_own on students;
create policy student_read_own on students
  for select using (auth_user_id = auth.uid());

drop policy if exists student_read_own on batch_student_mapping;
create policy student_read_own on batch_student_mapping
  for select using (student_id = current_student_id());

drop policy if exists student_read_own on batches;
create policy student_read_own on batches
  for select using (
    id in (select batch_id from batch_student_mapping where student_id = current_student_id())
  );

drop policy if exists student_read_own on lectures;
create policy student_read_own on lectures
  for select using (
    batch_id in (select batch_id from batch_student_mapping where student_id = current_student_id())
  );

-- Approved rows only: unapproved attendance is pending review, not fact.
drop policy if exists student_read_own on attendance;
create policy student_read_own on attendance
  for select using (student_id = current_student_id() and approved = true);

-- No student policy on student_fees: the portal reads student_fee_dues instead,
-- which exposes the balance without total_fee or paid_amount. See section 8.

drop policy if exists student_read_own on fee_payment_logs;
create policy student_read_own on fee_payment_logs
  for select using (student_id = current_student_id());

drop policy if exists student_read_own on assignments;
create policy student_read_own on assignments
  for select using (
    batch_id in (select batch_id from batch_student_mapping where student_id = current_student_id())
  );

drop policy if exists student_read_own on assignment_completions;
create policy student_read_own on assignment_completions
  for select using (student_id = current_student_id());

drop policy if exists student_read_own on student_repos;
create policy student_read_own on student_repos
  for select using (student_id = current_student_id());

drop policy if exists student_read_own on material_views;
create policy student_read_own on material_views
  for select using (student_id = current_student_id());

-- Metadata only — the bytes still require the edge function.
-- The `batch_id is null` branch is deliberately absent: a material for everyone
-- is still only for enrolled students, and every student now has a batch.
drop policy if exists student_read_own on materials;
create policy student_read_own on materials
  for select using (
    batch_id in (
      select batch_id from batch_student_mapping
      where student_id = current_student_id() and status = 'active'
    )
  );

-- ── Student — the two tables they may write ─────────────────────────────────
drop policy if exists student_insert_own on student_repos;
create policy student_insert_own on student_repos
  for insert with check (student_id = current_student_id());

drop policy if exists student_update_own on student_repos;
create policy student_update_own on student_repos
  for update using (student_id = current_student_id())
  with check (student_id = current_student_id());

-- Both policies carry the same conditions, so the deadline cannot be sidestepped
-- by updating a completion row instead of inserting one. The client check is UX;
-- this is the one that holds against a changed clock or a direct API call.
-- admin_full_access is untouched, so an admin can still tick work off late.
drop policy if exists student_insert_own on assignment_completions;
create policy student_insert_own on assignment_completions
  for insert with check (
    student_id = current_student_id()
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and (a.due_at is null or now() <= a.due_at)
    )
  );

-- `submitted = false` in USING freezes a row the moment it is handed in, so a
-- student can move work from unsubmitted to submitted exactly once and can never
-- touch a row a coordinator has already marked.
drop policy if exists student_update_own on assignment_completions;
create policy student_update_own on assignment_completions
  for update using (
    student_id = current_student_id()
    and submitted = false
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and (a.due_at is null or now() <= a.due_at)
    )
  )
  with check (
    student_id = current_student_id()
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and (a.due_at is null or now() <= a.due_at)
    )
  );

-- No student policy on tutors / tutor_batch_mapping / uploads: RLS default-denies.

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Students get NO storage policy on purpose: with RLS on and no match, every
-- direct request for the raw object is denied. The watermark edge function is
-- the only route to the bytes.
drop policy if exists "admin manages material files" on storage.objects;
create policy "admin manages material files" on storage.objects
  for all
  using (bucket_id = 'materials' and is_admin())
  with check (bucket_id = 'materials' and is_admin());
