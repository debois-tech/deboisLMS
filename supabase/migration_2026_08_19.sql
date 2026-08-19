-- =============================================================================
-- Migration — 19 Aug 2026
-- =============================================================================
-- Run after migration_2026_08_17d.sql. Re-runnable.
--
--   1. Instalments move to 15 and 30 days
--   2. Termination keeps the contracted fee and stops inventing a payment
--   3. A terminated student's balance leaves pending dues and becomes "void"
--   4. Deleting a payment log reverts the balance
--
-- Applied to dev: ____   Applied to production: ____
-- =============================================================================


-- 1. WHAT TERMINATION LEAVES BEHIND
-- The exit date was accepted and thrown away, and `expected_on_exit` did not
-- exist at all. Both are needed now: the fee rule changes over time, so what a
-- student owed is frozen at the moment they left rather than recomputed later
-- under whatever rule happens to be in force.
alter table batch_student_mapping add column if not exists left_on date;
alter table student_fees          add column if not exists expected_on_exit numeric;
alter table student_fees          add column if not exists paid_at_exit numeric;

comment on column batch_student_mapping.left_on is
  'Date the student left. Null while the enrolment has not been terminated.';
comment on column student_fees.expected_on_exit is
  'What the fee rule said was owed on the day of termination, frozen. Null while active. '
  'Unpaid remainder is void: real, recorded, and never counted as a due we expect to collect. '
  'Doubles as the ceiling on any later payment — instalments they never reached are gone.';
comment on column student_fees.paid_at_exit is
  'What they had paid on the day they left, frozen. Anything above it since is recovered void.';


-- 2. TERMINATION
-- Three things change. The instalment dates move to 15 and 30 days. `total_fee`
-- is left alone, so the contracted amount survives — the old version overwrote
-- it and the original figure was gone for good. And the settlement is no longer
-- inserted as a payment: the previous version wrote a `fee_payment_logs` row for
-- money nobody had handed over, so leaving mid-course quietly booked itself as
-- income. Fees collected now only ever holds money that actually arrived.
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

  select start_date into batch_start from batches where id = m.batch_id;
  select * into fee_row from student_fees
  where student_id = m.student_id and batch_id = m.batch_id
  for update;

  if found and fee_row.total_fee > 0 then
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


-- 3. THE TWO HEADLINE FIGURES
-- The old view joined `status = 'active'` alone, so terminating a student erased
-- them from both figures at once — including the registration fee they really
-- did pay. Collected now counts everyone, because the money arrived whatever
-- happened afterwards; outstanding counts everyone still on the hook. A student
-- who left is on nobody's hook, which is the whole point of void.
create or replace view batch_fee_summary as
select
  b.id as batch_id,
  b.name as batch_name,
  count(distinct bsm.student_id) filter (where bsm.status <> 'terminated') as total_students,
  coalesce(sum(sf.total_fee) filter (where bsm.status <> 'terminated'), 0) as total_fees,
  coalesce(sum(sf.paid_amount), 0) as total_collected,
  coalesce(sum(greatest(sf.total_fee - sf.paid_amount, 0)) filter (where bsm.status <> 'terminated'), 0) as total_outstanding
from batches b
left join batch_student_mapping bsm on bsm.batch_id = b.id
left join student_fees sf on sf.batch_id = b.id and sf.student_id = bsm.student_id
group by b.id, b.name;

alter view batch_fee_summary set (security_invoker = on);


-- 4. THE BREAKDOWN
-- Every figure derives from four stored numbers, so nothing here can drift out
-- of step with the payment logs. Void shrinks on its own as money comes in,
-- because it is `expected - paid` rather than a total frozen at termination.
create or replace view earning_breakdown as
select
  b.id   as batch_id,
  b.name as batch_name,
  count(bsm.id) filter (where bsm.status <> 'terminated') as active_students,
  count(bsm.id) filter (where bsm.status =  'terminated') as terminated_students,

  -- Everything banked, whoever paid it.
  coalesce(sum(sf.paid_amount), 0) as collected,
  coalesce(sum(sf.paid_amount) filter (where bsm.status <> 'terminated'), 0) as collected_active,
  coalesce(sum(sf.paid_amount) filter (where bsm.status =  'terminated'), 0) as collected_terminated,

  -- Still expected from students who have not left.
  coalesce(sum(greatest(sf.total_fee - sf.paid_amount, 0))
    filter (where bsm.status <> 'terminated'), 0) as pending,

  -- Owed on the day they left and never paid. Recorded, never expected.
  coalesce(sum(greatest(coalesce(sf.expected_on_exit, 0) - sf.paid_amount, 0))
    filter (where bsm.status = 'terminated'), 0) as void_amount,

  -- The rest of their course fee, which never became due at all.
  coalesce(sum(greatest(sf.total_fee - coalesce(sf.expected_on_exit, 0), 0))
    filter (where bsm.status = 'terminated'), 0) as never_due,

  -- Void that came in after they left. Never more than the void itself.
  coalesce(sum(greatest(sf.paid_amount - coalesce(sf.paid_at_exit, sf.paid_amount), 0))
    filter (where bsm.status = 'terminated'), 0) as recovered
from batches b
left join batch_student_mapping bsm on bsm.batch_id = b.id
left join student_fees sf on sf.batch_id = b.id and sf.student_id = bsm.student_id
group by b.id, b.name;

alter view earning_breakdown set (security_invoker = on);

comment on view earning_breakdown is
  'Per-batch earnings. pending is what active students still owe; void_amount is what '
  'terminated students owed at exit and never paid. The two never mix.';


-- 5. WHICH INSTALMENT THE STUDENT IS ON
-- The portal decided this by counting payment logs, so three part-payments read
-- as "both instalments settled" and the reminder disappeared with money still
-- owed. It has to be decided by amount, but a student is never shown total_fee
-- or paid_amount — hence a milestone count derived in here, where those columns
-- are already in scope. 0 = registration only, 1 = first instalment covered,
-- 2 = the schedule is complete and anything left is late.
create or replace view student_fee_dues as
select
  sf.id,
  sf.student_id,
  sf.batch_id,
  greatest(sf.total_fee - sf.paid_amount, 0) as amount_due,
  sf.status,
  sf.updated_at,
  case
    when sf.total_fee <= 0 then 2
    when sf.paid_amount >= sf.total_fee then 2
    when sf.paid_amount >= least(1000, sf.total_fee)
                         + round(greatest(sf.total_fee - 1000, 0) / 2.0) then 1
    else 0
  end as paid_through
from student_fees sf
where sf.student_id = current_student_id();

grant select on student_fee_dues to authenticated;


-- 6. NOBODY PAYS PAST WHAT THEY OWE
-- A comment in the payment modal claimed this function already refused an
-- overpayment. It never did, and the only guard was a `max` on a number input.
-- Splitting one instalment 6k/4k instead of 5k/5k is fine and always was — the
-- ceiling is the balance, not the instalment. What the ceiling is made of
-- changes once a student leaves: `expected_on_exit`, because the instalments
-- they never reached no longer exist to be paid.
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
    raise exception 'Payment amount must be greater than zero';
  end if;

  -- Lock the fee row. Concurrent payments serialize on this student/batch.
  select * into fee_row from student_fees where id = p_student_fee_id for update;

  if not found then
    raise exception 'Could not find the fee record';
  end if;

  ceiling := coalesce(fee_row.expected_on_exit, fee_row.total_fee);
  if fee_row.paid_amount + p_amount > ceiling then
    raise exception 'That is more than is owed. At most % can be logged.',
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


-- 7. UNDOING A PAYMENT
-- Logged the wrong amount, or logged it against the wrong student. Both figures
-- that a payment moves — pending for an active student, void for a terminated
-- one — are derived from `paid_amount`, so putting that back is the whole of the
-- repair; the balance returns to whichever column it came out of on its own.
--
-- The registration fee is not deletable. It is written by a trigger on the fee
-- row, so deleting it would leave a payment nothing can recreate.
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

  if log_row.notes = 'Registration fee' then
    raise exception 'The registration fee cannot be deleted';
  end if;

  -- Locked before the delete, so a concurrent payment cannot read a stale total.
  select * into fee_row from student_fees where id = log_row.student_fee_id for update;
  if not found then
    raise exception 'Could not find the fee record';
  end if;

  delete from fee_payment_logs where id = p_log_id;

  update student_fees
  set paid_amount = greatest(coalesce(fee_row.paid_amount, 0) - log_row.amount, 0),
      updated_at = now()
  where id = fee_row.id
  returning * into fee_row;

  return to_jsonb(fee_row);
end $$;

revoke all on function delete_fee_payment(uuid) from public;
grant execute on function delete_fee_payment(uuid) to authenticated;
