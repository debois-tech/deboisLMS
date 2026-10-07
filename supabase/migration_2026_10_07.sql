-- 22. DATES: a student starts on the batch start date if they join in its first week, else the day they join
-- Instalments, the registration fee date and the documents all count from that day. Student-level internship dates are no longer written.
-- Deploy: paste this whole file into the Supabase SQL editor and run it. Safe to re-run.

-- Joining in the batch's first week counts from its start date, later from the day they join (India time).
create or replace function set_join_date_from_batch()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  batch_start date;
  today       date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if new.joined_at is not null then
    return new;
  end if;

  select b.start_date into batch_start from batches b where b.id = new.batch_id;
  new.joined_at := case when batch_start is not null and today < batch_start + 7 then batch_start else today end;

  return new;
end;
$$;

-- Dated the day the student started
create or replace function log_registration_fee()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  amount numeric;
  paid_on date;
begin
  if new.total_fee is null or new.total_fee <= 0 then
    return new;
  end if;

  amount := least(1000, new.total_fee);

  select m.joined_at into paid_on from batch_student_mapping m where m.batch_id = new.batch_id and m.student_id = new.student_id;
  paid_on := coalesce(paid_on, current_date);

  insert into fee_payment_logs (
    student_fee_id, student_id, batch_id, amount, payment_date, payment_method, notes
  ) values (
    new.id, new.student_id, new.batch_id, amount, paid_on, 'upi', 'Registration fee'
  );

  update student_fees
  set paid_amount = paid_amount + amount, updated_at = now()
  where id = new.id;

  return new;
end;
$$;

-- No longer writes a student-level end date
create or replace function end_batch(p_batch_id uuid, p_ended_on date default current_date)
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
  if exists (select 1 from batches where id = p_batch_id and start_date > p_ended_on) then
    raise exception 'A batch cannot end before it starts';
  end if;

  update batches
  set status = 'completed', ended_at = p_ended_on
  where id = p_batch_id
  returning * into updated;

  if not found then
    raise exception 'Batch not found';
  end if;

  return updated;
end $$;

revoke all on function end_batch(uuid, date) from public;
grant execute on function end_batch(uuid, date) to authenticated;

-- Instalments count from the day the student started
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
  expected     numeric := 0;
  void_amount  numeric := 0;
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

  batch_start := m.joined_at;
  select * into fee_row from student_fees
  where student_id = m.student_id and batch_id = m.batch_id
  for update;

  -- Also for a zero fee (expected 0), so every leaver's fee row reads 'terminated'.
  if found then
    instalment := round(greatest(fee_row.total_fee - 1000, 0) / 2.0);

    -- Due on the day itself, so `>=`, not `>`.
    if batch_start is not null then
      if p_left_on >= batch_start + 15 then due_count := 1; end if;
      if p_left_on >= batch_start + 30 then due_count := 2; end if;
    end if;

    -- Registration is collected at sign-up and always owed; instalments only
    -- once their date has been reached.
    expected := least(fee_row.total_fee, least(1000, fee_row.total_fee) + instalment * due_count);
    void_amount := greatest(expected - fee_row.paid_amount, 0);

    update student_fees
    set expected_on_exit = expected,
        paid_at_exit = fee_row.paid_amount,
        updated_at = now()
    where id = fee_row.id;
  end if;

  update batch_student_mapping
  set status = 'terminated', left_on = p_left_on
  where id = p_mapping_id;

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
    'expected_on_exit', expected,
    'void_amount', void_amount,
    'login_revoked', auth_id is not null and not still_active
  );
end $$;

revoke all on function terminate_enrolment(uuid, date) from public;
grant execute on function terminate_enrolment(uuid, date) to authenticated;
