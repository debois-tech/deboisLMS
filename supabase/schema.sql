-- ============================================================
-- DeboisTech ERP — Supabase Schema
-- ============================================================
-- Run this in Supabase SQL Editor (or via migration).
-- Assumes a single admin user is created manually in Supabase
-- Auth (Settings → Authentication → Users → Add User).
-- That user's id (from auth.users) is the admin reference for
-- any future admin-only RLS policy, though v1 has no student-
-- facing login so RLS can stay open or trivially restrict to
-- that single uid.
-- ============================================================

-- -----------------------------------------------------------
-- 1. CUSTOM TYPES (optional, for cleaner columns)
-- -----------------------------------------------------------
create type batch_status as enum ('upcoming', 'ongoing', 'completed');
create type session_type as enum ('online', 'offline');
create type attendance_status as enum ('present', 'partial', 'absent');
create type attendance_source as enum ('manual', 'automated');
create type mapping_status as enum ('active', 'dropped');
create type submission_channel as enum ('whatsapp', 'other', 'portal');
create type fee_status as enum ('due', 'paid');
create type payment_method as enum ('cash', 'upi', 'bank_transfer', 'other');

-- -----------------------------------------------------------
-- 2. TUTORS
-- -----------------------------------------------------------
create table tutors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  phone      text,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------
-- 3. BATCHES
-- -----------------------------------------------------------
create table batches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  track      text,
  status     batch_status default 'upcoming',
  start_date date,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------
-- 4. STUDENTS
-- -----------------------------------------------------------
create table students (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text,
  email        text,
  github_url   text,
  linkedin_url text,
  created_at   timestamptz default now()
);

-- -----------------------------------------------------------
-- 5. STUDENT <-> BATCH MAPPING (many-to-many)
-- -----------------------------------------------------------
create table batch_student_mapping (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid references batches(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  joined_at  date default current_date,
  status     mapping_status default 'active',
  unique (batch_id, student_id)
);

create index idx_bsm_batch   on batch_student_mapping(batch_id);
create index idx_bsm_student on batch_student_mapping(student_id);

-- -----------------------------------------------------------
-- 6. TUTOR <-> BATCH MAPPING (many-to-many)
-- -----------------------------------------------------------
create table tutor_batch_mapping (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid references tutors(id) on delete cascade not null,
  batch_id    uuid references batches(id) on delete cascade not null,
  assigned_at date default current_date,
  unique (tutor_id, batch_id)
);

create index idx_tbm_tutor on tutor_batch_mapping(tutor_id);
create index idx_tbm_batch on tutor_batch_mapping(batch_id);

-- -----------------------------------------------------------
-- 7. LECTURES (one row per session)
-- -----------------------------------------------------------
create table lectures (
  id                        uuid primary key default gen_random_uuid(),
  batch_id                  uuid references batches(id) on delete cascade not null,
  lecture_date              date not null,
  session_type              session_type default 'online',
  meeting_code              text,
  scheduled_duration_minutes int,
  created_at                timestamptz default now()
);

create index idx_lectures_batch on lectures(batch_id);

-- -----------------------------------------------------------
-- 8. RAW MEET CSV UPLOADS (one row per CSV row)
-- -----------------------------------------------------------
create table uploads (
  id                   uuid primary key default gen_random_uuid(),
  lecture_id           uuid references lectures(id) on delete set null,
  sno                  int,
  participant_name_raw text not null,
  -- naive wall-clock times (Meet CSV exports "9:30:00 AM"); the calendar date
  -- always comes from the lecture, so no time zone is stored.
  attendance_started   timestamp,
  joined_at            timestamp,
  attendance_stopped   timestamp,
  attended_duration_raw text,
  attended_minutes     numeric,
  meeting_code         text,
  matched_student_id   uuid references students(id) on delete set null,
  processed            boolean default false,
  uploaded_at          timestamptz default now()
);

create index idx_uploads_lecture  on uploads(lecture_id);
create index idx_uploads_meeting  on uploads(meeting_code);
create index idx_uploads_processed on uploads(processed);

-- -----------------------------------------------------------
-- 9. ATTENDANCE (final, per-student-per-lecture record)
-- -----------------------------------------------------------
create table attendance (
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

create index idx_attendance_batch   on attendance(batch_id);
create index idx_attendance_lecture on attendance(lecture_id);
create index idx_attendance_student on attendance(student_id);

-- -----------------------------------------------------------
-- 10. FEES (per student, per batch)
-- -----------------------------------------------------------
create table student_fees (
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

create index idx_fees_student on student_fees(student_id);
create index idx_fees_batch   on student_fees(batch_id);

-- Individual payment history. student_fees.paid_amount remains the current total.
create table fee_payment_logs (
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

create index idx_fee_logs_fee on fee_payment_logs(student_fee_id);
create index idx_fee_logs_batch on fee_payment_logs(batch_id);

-- -----------------------------------------------------------
-- 11. ASSIGNMENTS (the assignment definition, per batch)
-- -----------------------------------------------------------
create table assignments (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid references batches(id) on delete cascade not null,
  title         text not null,
  description   text,
  assigned_date date default current_date,
  created_at    timestamptz default now()
);

create index idx_assignments_batch on assignments(batch_id);

-- -----------------------------------------------------------
-- 12. ASSIGNMENT COMPLETION (per student, per assignment)
-- -----------------------------------------------------------
create table assignment_completions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade not null,
  student_id    uuid references students(id) on delete cascade not null,
  submitted     boolean default false,
  submitted_via submission_channel default 'whatsapp',
  submitted_at  timestamptz,
  marked_by     uuid references tutors(id) on delete set null,
  unique (assignment_id, student_id)
);

create index idx_ac_assignment on assignment_completions(assignment_id);
create index idx_ac_student    on assignment_completions(student_id);

-- -----------------------------------------------------------
-- 12b. STUDENT REPO (one GitHub repo per student, all homework)
-- -----------------------------------------------------------
-- Stored per student rather than per submission: editing the link from any
-- assignment's submit dialog re-points every past and future submission.
create table student_repos (
  student_id uuid primary key references students(id) on delete cascade,
  repo_url   text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- -----------------------------------------------------------
-- 12c. STUDY MATERIAL (PDF per batch, watermarked per student)
-- -----------------------------------------------------------
-- The file itself lives in the private `materials` storage bucket; only the
-- edge function (service role) can reach it, and it stamps the reading
-- student's name and phone onto every page before returning it.
-- Bucket, RLS and view-log policies: supabase/study_material_migration.sql
create table materials (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references batches(id) on delete cascade,
  title        text not null,
  description  text,
  storage_path text not null unique,   -- <batch_id>/<uuid>.pdf inside the bucket
  size_bytes   bigint,
  page_count   int,
  uploaded_by  uuid,
  created_at   timestamptz default now()
);

create index idx_materials_batch on materials(batch_id);

-- Who opened what. A watermarked leak identifies the student; this says when.
create table material_views (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  viewed_at   timestamptz default now()
);

create index idx_material_views_material on material_views(material_id);
create index idx_material_views_student  on material_views(student_id);

-- -----------------------------------------------------------
-- 13. COMPUTED VIEWS (convenience)
-- -----------------------------------------------------------

-- Batch-level fee summary
create view batch_fee_summary as
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

-- Batch-level attendance summary
create view batch_attendance_summary as
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
