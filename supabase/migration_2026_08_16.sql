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


-- 2. REGISTRATION FEE, ONLY WHERE THERE IS A FEE, DATED FROM THE BATCH
-- Replaces the version in schema.sql §5. Three guards:
--   * total_fee of 0 (a 100% discount) logs nothing at all — there is no
--     registration payment to record against a student who was charged nothing.
--   * a fee below 1000 logs only what was charged, so the log can never claim a
--     student paid more than they owe.
--   * the payment is dated from the batch's start date rather than the day the
--     row happened to be inserted. A batch is always created before its students,
--     so that date exists, and it is the date the intake actually began — an
--     import run three weeks late should not read as three weeks of late fees.
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

  -- A batch with no start date falls back to today rather than inserting null,
  -- which the column forbids.
  select b.start_date into paid_on from batches b where b.id = new.batch_id;
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

-- The trigger itself is unchanged; recreated so this file stands alone.
drop trigger if exists student_fees_registration_fee on student_fees;
create trigger student_fees_registration_fee
  after insert on student_fees
  for each row execute function log_registration_fee();


-- 3. ENROLMENT DATED FROM THE BATCH TOO
-- `joined_at` recorded the day the row was inserted, which is when an admin got
-- round to the paperwork rather than when the student joined. The batch's start
-- date is the intake date for everyone on it.
--
-- The default is dropped rather than changed: a column default cannot see another
-- table, and while it stays as current_date a BEFORE trigger cannot tell an
-- omitted value from one deliberately set to today.
alter table batch_student_mapping alter column joined_at drop default;

create or replace function set_join_date_from_batch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- An explicit date is a fact someone entered. Only fill the blank.
  if new.joined_at is not null then
    return new;
  end if;

  select b.start_date into new.joined_at from batches b where b.id = new.batch_id;
  new.joined_at := coalesce(new.joined_at, current_date);

  return new;
end;
$$;

drop trigger if exists bsm_join_date_from_batch on batch_student_mapping;
create trigger bsm_join_date_from_batch
  before insert on batch_student_mapping
  for each row execute function set_join_date_from_batch();
