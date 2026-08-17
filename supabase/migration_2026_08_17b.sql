-- =============================================================================
-- Migration — 17 Aug 2026 (b)
-- =============================================================================
-- Run after migration_2026_08_17.sql. Re-runnable.
--
--   1. Terminating one enrolment no longer kills a login the student still needs
--
-- Applied to dev: ____   Applied to production: ____
-- =============================================================================


-- The first version deleted the auth user whenever any enrolment was terminated.
-- A student on two batches, terminated from one, lost access to the other as
-- well. The login now goes only when nothing active is left — the same rule
-- revoke_expired_student_logins() already applies.
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
  still_active boolean;
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

    -- Cut the total to what was owed and count the settlement as received, so the
    -- student closes at zero rather than carrying a balance nobody will chase.
    update student_fees
    set total_fee = owed,
        paid_amount = least(fee_row.paid_amount + settlement, owed),
        updated_at = now()
    where id = fee_row.id;
  end if;

  update batch_student_mapping set status = 'terminated' where id = p_mapping_id;

  -- Checked after the update, so this enrolment is already out of the running.
  select exists (
    select 1 from batch_student_mapping m2
    join batches b2 on b2.id = m2.batch_id
    where m2.student_id = m.student_id
      and m2.status = 'active'
      and b2.ended_at is null
  ) into still_active;

  select auth_user_id into auth_id from students where id = m.student_id;

  if auth_id is not null and not still_active then
    delete from auth.users where id = auth_id;
    update students set password_rotated = false where id = m.student_id;
  end if;

  return jsonb_build_object(
    'instalments_due', due_count,
    'settlement', settlement,
    'login_revoked', auth_id is not null and not still_active
  );
end $$;

revoke all on function terminate_enrolment(uuid, date) from public;
grant execute on function terminate_enrolment(uuid, date) to authenticated;
