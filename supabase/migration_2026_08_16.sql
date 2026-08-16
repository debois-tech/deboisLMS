-- =============================================================================
-- Migration — 16 Aug 2026
-- =============================================================================
-- Run after migration_2026_08_12c.sql. Non-destructive, re-runnable.
--
--   1. A batch carries its own full fee (`batches.base_fee`)
--   2. The automatic registration payment is not logged when nothing is owed
--
-- Why: a batch charges 15000, but individual students are given discounts and
-- some are given 100%. The import CSV now carries a Discount % per student
-- instead of an amount, and the app derives the fee from base_fee. A student on
-- 100% ends up owing 0 — and the old trigger still booked a 1000 registration
-- payment against that 0, leaving a log that claims they overpaid.
--
-- Applied to dev: ____   Applied to production: ____
-- =============================================================================


-- 1. BATCH BASE FEE
-- Nullable on purpose: batches created before today have no answer and must not
-- be given a wrong one. The New Batch form requires it from here on, and the
-- importer refuses a batch that still has none rather than importing zeroes.
alter table batches add column if not exists base_fee numeric;

do $$ begin
  alter table batches add constraint batches_base_fee_non_negative
    check (base_fee is null or base_fee >= 0);
exception when duplicate_object then null; end $$;

comment on column batches.base_fee is
  'The batch''s full fee before any discount. Student imports read a Discount % '
  'per row and write base_fee * (1 - discount/100) into student_fees.total_fee. '
  'The discount itself is not stored — only the amount it produced.';

-- Batches still missing one, for whoever runs this. Not an error: the app blocks
-- the import that would need it, and every other screen works without it.
do $$
declare missing int;
begin
  select count(*) into missing from batches where base_fee is null;
  if missing > 0 then
    raise notice
      'Set a base fee on % batch(es) before importing into them — run: select id, name from batches where base_fee is null;',
      missing;
  end if;
end $$;


-- 2. REGISTRATION FEE, ONLY WHERE THERE IS A FEE
-- Replaces the version in schema.sql §5. Two guards, both new:
--   * total_fee of 0 (a 100% discount) logs nothing at all — there is no
--     registration payment to record against a student who was charged nothing.
--   * a fee below 1000 logs only what was charged, so the log can never claim a
--     student paid more than they owe.
create or replace function log_registration_fee()
returns trigger
language plpgsql
set search_path = public
as $$
declare amount numeric;
begin
  if new.total_fee is null or new.total_fee <= 0 then
    return new;
  end if;

  amount := least(1000, new.total_fee);

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

-- The trigger itself is unchanged; recreated so this file stands alone.
drop trigger if exists student_fees_registration_fee on student_fees;
create trigger student_fees_registration_fee
  after insert on student_fees
  for each row execute function log_registration_fee();
