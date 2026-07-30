-- Run once for an existing database that already has student_fees and fee_payment_logs.
do $$ begin
  create type fee_status as enum ('due', 'paid');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('cash', 'upi', 'bank_transfer', 'other');
exception when duplicate_object then null;
end $$;

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
