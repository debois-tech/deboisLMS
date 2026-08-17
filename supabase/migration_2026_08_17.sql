-- =============================================================================
-- Migration — 17 Aug 2026
-- =============================================================================
-- Run after migration_2026_08_16.sql. Re-runnable.
--
--   1. `terminated` enrolment status
--   2. batches.ended_at, and end_batch()
--   3. auth_user_id survives its auth user being deleted
--   4. terminate_enrolment() — cuts the fee, logs the settlement, kills the login
--   5. revoke_expired_student_logins() — 30 days after a batch ends
--   6. record_fee_payment() refuses more than is owed
--
-- Applied to dev: ____   Applied to production: ____
-- =============================================================================


-- 1. TERMINATED
-- 'dropped' now means finished-and-past-the-grace-window; 'terminated' means left
-- mid-batch. Both keep every row the student owns; only the login goes.
-- Top level, not a DO block: an exception handler makes this a subtransaction,
-- which ADD VALUE is not allowed inside. IF NOT EXISTS already makes it re-runnable.
alter type mapping_status add value if not exists 'terminated';


-- 2. WHEN A BATCH ENDED
-- status alone cannot date the 30-day window.
alter table batches add column if not exists ended_at date;

comment on column batches.ended_at is
  'Set by end_batch(). Starts the 30 day countdown on every login in the batch.';

create or replace function end_batch(p_batch_id uuid)
returns batches
language plpgsql
security definer
set search_path = public
as $$
declare updated batches;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  update batches
  set status = 'completed', ended_at = coalesce(ended_at, current_date)
  where id = p_batch_id
  returning * into updated;

  if not found then
    raise exception 'Batch not found';
  end if;

  return updated;
end $$;

revoke all on function end_batch(uuid) from public;
grant execute on function end_batch(uuid) to authenticated;


-- 3. A DELETED AUTH USER MUST NOT BLOCK
-- The column pointed at auth.users with no ON DELETE, so deleting the login was
-- rejected by the constraint. Null it instead — the student row is untouched and
-- the app offers "Create login" again.
do $$ begin
  alter table students drop constraint if exists students_auth_user_id_fkey;
  alter table students add constraint students_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users(id) on delete set null;
end $$;


-- 4. TERMINATING AN ENROLMENT
-- One transaction: cut the fee to what they actually owe, record the settlement,
-- mark the enrolment, delete the login.
--
-- Instalments are half of what is left after the discount and the registration
-- fee. A batch charging 15000 at 20% off is 12000, less 1000, so 5500 each; every
-- amount is read per student. One becomes payable 20 days after the batch starts
-- and the second at 40. Leaving before day 20 owes nothing beyond registration.
create or replace function terminate_enrolment(p_mapping_id uuid, p_left_on date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m            batch_student_mapping%rowtype;
  batch_start  date;
  fee_row      student_fees%rowtype;
  instalment   numeric;
  due_count    int := 0;
  owed         numeric;
  settlement   numeric := 0;
  auth_id      uuid;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  select * into m from batch_student_mapping where id = p_mapping_id;
  if not found then
    raise exception 'Enrolment not found';
  end if;

  select start_date into batch_start from batches where id = m.batch_id;
  select * into fee_row from student_fees
  where student_id = m.student_id and batch_id = m.batch_id
  for update;

  if found and fee_row.total_fee > 0 then
    instalment := round(greatest(fee_row.total_fee - 1000, 0) / 2.0);

    -- Due on the day itself, so `>=`, not `>`.
    if batch_start is not null then
      if p_left_on >= batch_start + 20 then due_count := 1; end if;
      if p_left_on >= batch_start + 40 then due_count := 2; end if;
    end if;

    -- Registration stays owed whatever happens; instalments only once reached.
    owed := least(fee_row.total_fee, least(1000, fee_row.total_fee) + instalment * due_count);
    settlement := greatest(owed - fee_row.paid_amount, 0);

    if settlement > 0 then
      insert into fee_payment_logs (
        student_fee_id, student_id, batch_id, amount, payment_date, payment_method, notes
      ) values (
        fee_row.id, m.student_id, m.batch_id, settlement, p_left_on, 'upi', 'Termination settlement'
      );
    end if;

    -- Cut the total to what was owed, and count the settlement as received, so
    -- the student closes at zero rather than carrying a balance nobody will chase.
    update student_fees
    set total_fee = owed,
        paid_amount = least(fee_row.paid_amount + settlement, owed),
        updated_at = now()
    where id = fee_row.id;
  end if;

  update batch_student_mapping set status = 'terminated' where id = p_mapping_id;

  -- Access ends now. Data stays.
  select auth_user_id into auth_id from students where id = m.student_id;
  if auth_id is not null then
    delete from auth.users where id = auth_id;
    update students set password_rotated = false where id = m.student_id;
  end if;

  return jsonb_build_object(
    'instalments_due', due_count,
    'settlement', settlement,
    'login_revoked', auth_id is not null
  );
end $$;

revoke all on function terminate_enrolment(uuid, date) from public;
grant execute on function terminate_enrolment(uuid, date) to authenticated;


-- 5. THE 30 DAY WINDOW
-- A finished batch keeps its logins for 30 days, then they go. The enrolment
-- becomes 'dropped' at the same time — finished, not thrown out.
create or replace function revoke_expired_student_logins()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  expired record;
  removed int := 0;
begin
  -- cron runs this with no JWT, so "no caller" is allowed. A signed-in caller
  -- must be an admin: without this a student could invoke it themselves.
  if auth.uid() is not null and not is_admin() then
    raise exception 'Admin only';
  end if;

  for expired in
    select distinct s.id as student_id, s.auth_user_id
    from batch_student_mapping m
    join batches b on b.id = m.batch_id
    join students s on s.id = m.student_id
    where b.ended_at is not null
      and b.ended_at + 30 <= current_date
      and s.auth_user_id is not null
      -- Still enrolled somewhere that has not ended keeps its login.
      and not exists (
        select 1 from batch_student_mapping m2
        join batches b2 on b2.id = m2.batch_id
        where m2.student_id = s.id
          and m2.status = 'active'
          and (b2.ended_at is null or b2.ended_at + 30 > current_date)
      )
  loop
    delete from auth.users where id = expired.auth_user_id;
    update students set password_rotated = false where id = expired.student_id;
    removed := removed + 1;
  end loop;

  update batch_student_mapping m
  set status = 'dropped'
  from batches b
  where b.id = m.batch_id
    and b.ended_at is not null
    and b.ended_at + 30 <= current_date
    and m.status = 'active';

  return removed;
end $$;

revoke all on function revoke_expired_student_logins() from public;
grant execute on function revoke_expired_student_logins() to authenticated;

-- Nightly at 02:00. pg_cron runs SQL directly, so no key or edge function is
-- involved. Safe to re-run: unschedule first.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('revoke-expired-student-logins');
exception when others then null; end $$;

do $$ begin
  perform cron.schedule(
    'revoke-expired-student-logins', '0 2 * * *',
    $cron$select public.revoke_expired_student_logins()$cron$
  );
exception when others then
  raise notice 'pg_cron not available — call revoke_expired_student_logins() on a schedule of your own.';
end $$;


-- 6. NO PAYMENT LARGER THAN THE BALANCE
-- The form blocks it too, but the form is not the guard that matters.
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
  remaining numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select * into fee_row from student_fees where id = p_student_fee_id for update;

  if not found then
    raise exception 'Could not find the fee record';
  end if;

  remaining := fee_row.total_fee - fee_row.paid_amount;
  if remaining <= 0 then
    raise exception 'This fee is already paid in full';
  end if;
  if p_amount > remaining then
    raise exception 'Payment exceeds the % still owed', remaining;
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
