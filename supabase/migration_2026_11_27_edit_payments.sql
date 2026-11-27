-- Edit any payment (amount too), delete any payment (registration included), shorter overpay message.

-- Registration auto-booking stays gone, whatever this database has seen before.
drop trigger if exists student_fees_registration_fee on student_fees;
drop function if exists log_registration_fee();
alter table student_fees alter column registration_included set default false;

create or replace function edit_fee_payment(
  p_log_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method payment_method,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  log_row    fee_payment_logs%rowtype;
  fee_row    student_fees%rowtype;
  old_amount numeric;
  ceiling    numeric;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be above zero';
  end if;

  select * into log_row from fee_payment_logs where id = p_log_id;
  if not found then
    raise exception 'Payment not found';
  end if;
  old_amount := log_row.amount;

  -- Locked before the maths, so a concurrent payment cannot read a stale total.
  select * into fee_row from student_fees where id = log_row.student_fee_id for update;
  if not found then
    raise exception 'Could not find the fee record';
  end if;

  -- A fee moved to another batch holds no paid total, so its old rows are counted over there.
  if fee_row.paid_amount < old_amount then
    raise exception 'Counted in another batch';
  end if;

  ceiling := case when fee_row.status = 'terminated' then fee_row.expected_on_exit else fee_row.total_fee end;
  if fee_row.paid_amount - old_amount + p_amount > ceiling then
    raise exception 'Above what is owed. At most % allowed', greatest(ceiling - fee_row.paid_amount + old_amount, 0);
  end if;

  update fee_payment_logs
  set amount = p_amount, payment_date = p_payment_date, payment_method = p_payment_method, notes = p_notes
  where id = p_log_id
  returning * into log_row;

  -- paid_amount is the one stored total; status, dues, summaries and exit void all read from it.
  update student_fees
  set paid_amount = paid_amount - old_amount + p_amount
  where id = fee_row.id
  returning * into fee_row;

  return jsonb_build_object('log', to_jsonb(log_row), 'fee', to_jsonb(fee_row));
end $$;

revoke all on function edit_fee_payment(uuid, numeric, date, payment_method, text) from public;
grant execute on function edit_fee_payment(uuid, numeric, date, payment_method, text) to authenticated;

create or replace function delete_fee_payment(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  log_row fee_payment_logs%rowtype;
  fee_row student_fees%rowtype;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  select * into log_row from fee_payment_logs where id = p_log_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  -- Locked before the delete, so a concurrent payment cannot read a stale total.
  select * into fee_row from student_fees where id = log_row.student_fee_id for update;
  if not found then
    raise exception 'Could not find the fee record';
  end if;

  delete from fee_payment_logs where id = p_log_id;

  update student_fees
  set paid_amount = greatest(coalesce(fee_row.paid_amount, 0) - log_row.amount, 0),
      -- A deleted registration row takes the Rs 1,000 rule with it: two plain halves from here.
      registration_included = registration_included and log_row.notes is distinct from 'Registration fee',
      updated_at = now()
  where id = fee_row.id
  returning * into fee_row;

  return to_jsonb(fee_row);
end $$;

revoke all on function delete_fee_payment(uuid) from public;
grant execute on function delete_fee_payment(uuid) to authenticated;

-- Same function as before, with a short message when a payment goes past what is owed. Stays SECURITY INVOKER.
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
  fee_row     student_fees%rowtype;
  log_row     fee_payment_logs%rowtype;
  updated_fee student_fees%rowtype;
  ceiling     numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be above zero';
  end if;

  -- Lock the fee row. Concurrent payments serialize on this student/batch.
  select * into fee_row from student_fees where id = p_student_fee_id for update;

  if not found then
    raise exception 'Could not find the fee record';
  end if;

  ceiling := case when fee_row.status = 'terminated' then fee_row.expected_on_exit else fee_row.total_fee end;
  if fee_row.paid_amount + p_amount > ceiling then
    raise exception 'Above what is owed. At most % allowed',
      greatest(ceiling - fee_row.paid_amount, 0);
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
