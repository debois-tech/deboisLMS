-- ============================================================
-- Student/User login — schema + RLS migration
-- Run once in Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================

-- -----------------------------------------------------------
-- 1. LINK STUDENTS TO AUTH USERS
-- -----------------------------------------------------------
alter table students
  add column if not exists auth_user_id uuid references auth.users(id) unique;

-- -----------------------------------------------------------
-- 2. TAG THE EXISTING ADMIN USER
-- -----------------------------------------------------------
-- RLS policies below trust app_metadata.role to tell admin apart from student.
-- EDIT the email below to your actual admin login email, then run this block.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'adminuser@deboistech.in';

-- -----------------------------------------------------------
-- 3. HELPER FUNCTIONS (used by policies below)
-- -----------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function current_student_id()
returns uuid
language sql
stable
as $$
  select id from students where auth_user_id = auth.uid();
$$;

-- -----------------------------------------------------------
-- 4. ENABLE RLS ON EVERY TABLE
-- -----------------------------------------------------------
alter table tutors                  enable row level security;
alter table batches                 enable row level security;
alter table students                enable row level security;
alter table batch_student_mapping   enable row level security;
alter table tutor_batch_mapping     enable row level security;
alter table lectures                enable row level security;
alter table uploads                 enable row level security;
alter table attendance              enable row level security;
alter table student_fees            enable row level security;
alter table fee_payment_logs        enable row level security;
alter table assignments             enable row level security;
alter table assignment_completions  enable row level security;

-- -----------------------------------------------------------
-- 5. ADMIN — full access on every table (matches current app behavior)
-- -----------------------------------------------------------
drop policy if exists admin_full_access on tutors;
create policy admin_full_access on tutors for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on batches;
create policy admin_full_access on batches for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on students;
create policy admin_full_access on students for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on batch_student_mapping;
create policy admin_full_access on batch_student_mapping for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on tutor_batch_mapping;
create policy admin_full_access on tutor_batch_mapping for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on lectures;
create policy admin_full_access on lectures for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on uploads;
create policy admin_full_access on uploads for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on attendance;
create policy admin_full_access on attendance for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on student_fees;
create policy admin_full_access on student_fees for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on fee_payment_logs;
create policy admin_full_access on fee_payment_logs for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on assignments;
create policy admin_full_access on assignments for all using (is_admin()) with check (is_admin());

drop policy if exists admin_full_access on assignment_completions;
create policy admin_full_access on assignment_completions for all using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------
-- 6. STUDENT — read-only, scoped to their own data
-- -----------------------------------------------------------
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

-- Students only ever see approved attendance — matches the admin approval gate
-- (unapproved rows are pending review and shouldn't be visible as fact yet).
drop policy if exists student_read_own on attendance;
create policy student_read_own on attendance
  for select using (student_id = current_student_id() and approved = true);

drop policy if exists student_read_own on student_fees;
create policy student_read_own on student_fees
  for select using (student_id = current_student_id());

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

-- No student policy on tutors / tutor_batch_mapping / uploads: students never
-- need these, so RLS default-denies them there once enabled above.

-- -----------------------------------------------------------
-- 7. VIEWS MUST RESPECT THE CALLER'S RLS
-- -----------------------------------------------------------
-- Postgres views run with the view owner's rights by default, which bypasses the
-- policies above — without this a student could read every batch's totals straight
-- from the summary views. security_invoker makes them evaluate as the caller.
alter view batch_fee_summary        set (security_invoker = on);
alter view batch_attendance_summary set (security_invoker = on);
