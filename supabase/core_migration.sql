-- Auth, RLS and legacy column fixes. Run after schema.sql. Idempotent.

-- ── 1. Link students to auth users ──────────────────────────────────────────
alter table students
  add column if not exists auth_user_id uuid references auth.users(id) unique;

-- ── 2. Tag the admin user ───────────────────────────────────────────────────
-- Policies below trust app_metadata.role. EDIT the email before running.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'adminuser@deboistech.in';

-- ── 3. Helper functions ─────────────────────────────────────────────────────
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

-- ── 4. Enable RLS everywhere ────────────────────────────────────────────────
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

-- ── 5. Admin — full access on every table ───────────────────────────────────
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

-- ── 6. Student — read-only, scoped to their own data ────────────────────────
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

-- No student policy on tutors / tutor_batch_mapping / uploads: RLS default-denies.

-- ── 7. Views must respect the caller's RLS ──────────────────────────────────
-- Views run with the owner's rights by default, which would bypass the policies above.
alter view batch_fee_summary        set (security_invoker = on);
alter view batch_attendance_summary set (security_invoker = on);

-- ── 8. Legacy fix: naive timestamps on uploads ──────────────────────────────
-- Meet CSV times carry no zone, so a timestamptz column silently applies the
-- session's. Only needed on databases created before schema.sql switched these
-- to `timestamp`; uploads is cleared after every process run, so the cast is safe.
alter table uploads
  alter column attendance_started type timestamp using attendance_started::timestamp,
  alter column joined_at           type timestamp using joined_at::timestamp,
  alter column attendance_stopped  type timestamp using attendance_stopped::timestamp;
