-- =============================================================================
-- Migration — 12 Aug 2026 (b)
-- =============================================================================
-- The low-severity pass. Run after migration_2026_08_12.sql.
--
--   1. Bucket        — WebP dropped, because nothing downstream can stamp it
--   2. Search path   — pinned on the six functions that were missing it
--
-- Non-destructive: no table is dropped, no row is rewritten. Safe to run on a
-- database that already has batches and programmes in it.
--
-- A separate file rather than an edit to migration_2026_08_12.sql because that
-- one drops and recreates batch_programs, so re-running it would wipe the
-- programmes and blank every batch's programme column.
-- =============================================================================


-- =============================================================================
-- 1. BUCKET — WebP out
-- =============================================================================
-- pdf-lib embeds PNG and JPEG only, so watermark-material cannot stamp a WebP.
-- It used to fall through to the "hand it over untouched" branch, which meant a
-- WebP was served with no watermark at all — a hole in the one control that makes
-- a leak traceable.
--
-- The uploader already converts WebP to PNG in the browser, so nothing legitimate
-- reaches storage as WebP. Removing it from the allowlist closes the path an
-- upload that skipped the form would have taken.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/png', 'image/jpeg',
  'text/markdown', 'text/x-markdown', 'text/plain', 'text/csv',
  'application/json', 'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
]
where id = 'materials';

-- Anything already stored as WebP predates this and can no longer be stamped.
-- Nothing is deleted automatically; this just names them.
do $$
declare stragglers int;
begin
  select count(*) into stragglers from materials where mime_type = 'image/webp';
  if stragglers > 0 then
    raise notice 'WebP materials still stored: % — re-upload them as PNG to get a watermark.', stragglers;
  end if;
end $$;


-- =============================================================================
-- 2. SEARCH PATH
-- =============================================================================
-- Without `set search_path`, these resolve unqualified names through whatever
-- search_path the caller happens to have. All are SECURITY INVOKER so this is not
-- directly exploitable today, but is_admin() is the function every RLS policy in
-- the database depends on, and Supabase's linter flags all six. Pinning it costs
-- nothing and removes the whole class.
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

create or replace function student_code_prefix() returns text
  language sql stable
  set search_path = public
  as $$ select 'DBT-INT-' || student_code_year() || '-' $$;

create or replace function next_student_code() returns text
  language sql volatile
  set search_path = public
  as $$ select student_code_prefix() || lpad(nextval('student_code_seq')::text, 3, '0') $$;

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

-- The year function is rebuilt by set_student_code_year(), so both it and its
-- builder need the setting — otherwise rolling the year silently drops it again.
do $$
declare current_year text;
begin
  execute 'select student_code_year()' into current_year;
  execute format(
    'create or replace function student_code_year() returns text language sql stable set search_path = public as $f$ select %L::text $f$',
    current_year
  );
end $$;

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


-- =============================================================================
-- 3. FEE PRIVACY — students see what they owe, not what they were charged
-- =============================================================================
-- The portal already withheld the total on screen, but it read student_fees with
-- `select *`, so total_fee and paid_amount travelled to the browser regardless.
-- Hiding a column in the UI is not hiding it.
--
-- Column-level grants cannot solve this: admins and students are both the
-- `authenticated` role, so revoking a column from one revokes it from both. A
-- view can. This one runs with owner rights (no security_invoker), so it reaches
-- past RLS, and it carries its own `where` on current_student_id() to stay scoped
-- to the caller.
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

-- With the view in place the base table is closed to students entirely. Admins
-- are unaffected: admin_full_access is a separate policy on the table itself.
drop policy if exists student_read_own on student_fees;

comment on view student_fee_dues is
  'Portal-facing fee row: the outstanding balance only. total_fee and paid_amount '
  'never leave the database for a student. Admin reads student_fees directly.';

-- Payment history stays readable: it is the student's own record of what they
-- handed over, and it carries no total.


-- =============================================================================
-- 4. PASSWORD RESET
-- =============================================================================
-- Reset was a no-op and looked like a bug. The password is derived from the phone
-- number, so "reset" recomputed the identical string and nothing changed.
--
-- A real reset now issues a random password. Once that happens the dashboard can
-- no longer recompute it, so this flag records which students are past the
-- derived rule — without it the card would keep displaying the old derived
-- password, which is worse than showing nothing.
alter table students add column if not exists password_rotated boolean not null default false;

comment on column students.password_rotated is
  'True once the portal password has been reset to a random one. The derived '
  'Debois@<last4> rule no longer applies to this student and the password is '
  'shown once, at reset.';


-- =============================================================================
-- 5. REGISTRATION FEE
-- =============================================================================
-- Every student pays 1000 on joining a batch. Booked as a payment against the
-- fee, not subtracted from the total, so the log and the balance agree.
-- Fires on insert only: re-adding a dropped student reuses its fee row.
create or replace function log_registration_fee()
returns trigger
language plpgsql
set search_path = public
as $$
declare amount constant numeric := 1000;
begin
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
