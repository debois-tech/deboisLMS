-- Fee status, payment methods, and atomic payment recording. Run after core_migration.sql.

-- ── 1. Enums ────────────────────────────────────────────────────────────────
do $$ begin
  create type fee_status as enum ('due', 'paid');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('cash', 'upi', 'bank_transfer', 'other');
exception when duplicate_object then null;
end $$;

-- ── 2. Derived status + typed payment method ────────────────────────────────
alter table student_fees
  add column if not exists status fee_status generated always as (
    case when paid_amount >= total_fee then 'paid'::fee_status else 'due'::fee_status end
  ) stored;

alter table fee_payment_logs
  alter column payment_method type payment_method
  using case
    when lower(trim(payment_method)) in ('cash') then 'cash'::payment_method
    when lower(trim(payment_method)) in ('upi') then 'upi'::payment_method
    when lower(trim(payment_method)) in ('bank transfer', 'bank_transfer', 'bank') then 'bank_transfer'::payment_method
    else 'other'::payment_method
  end;

alter table fee_payment_logs
  alter column payment_method set default 'other';

-- ── 3. Payment log and running balance in one transaction ───────────────────
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
  select * into fee_row
  from student_fees
  where id = p_student_fee_id
  for update;

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

  return jsonb_build_object(
    'log', to_jsonb(log_row),
    'fee', to_jsonb(updated_fee)
  );
end;
$$;

revoke all on function public.record_fee_payment(uuid, numeric, date, payment_method, text) from public;
grant execute on function public.record_fee_payment(uuid, numeric, date, payment_method, text) to authenticated;
