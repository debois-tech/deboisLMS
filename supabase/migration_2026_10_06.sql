-- 20. DELETING A STUDENT GIVES THEIR REF BACK
-- The ref counter (student_code_seq) never rewinds on its own, so a deleted student's number was lost until
-- resync_student_code_seq() was run by hand. delete_student() now runs it itself: the next student takes the
-- highest remaining ref + 1. Deleting the newest student frees their ref; deleting one in the middle leaves
-- the gap, because the highest ref still stands.
create or replace function delete_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare auth_id uuid;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  select auth_user_id into auth_id from students where id = p_student_id;
  if not found then
    raise exception 'Student not found';
  end if;

  if auth_id is not null then
    delete from auth.users where id = auth_id;
  end if;

  delete from students where id = p_student_id;

  -- Hand the freed ref back: without this the next student skips it and the dashboard shows a hole.
  perform resync_student_code_seq();
end $$;

revoke all on function delete_student(uuid) from public;
grant execute on function delete_student(uuid) to authenticated;


-- 21. TEST BATCHES
-- A batch can be converted, once and for good, to a test batch: kept out of every total, and its students draw
-- refs from their own series (DBT-TEST-2026-001) so the live counter never moves for them.
alter table batches  add column if not exists is_test boolean not null default false;
alter table students add column if not exists is_test boolean not null default false;

create sequence if not exists student_test_code_seq as bigint start 1;

create or replace function next_test_student_code() returns text
  language sql volatile
  set search_path = public
  as $$ select 'DBT-TEST-' || student_code_year() || '-' || lpad(nextval('student_test_code_seq')::text, 3, '0') $$;

-- A student is test or live, never both: the first batch decides which ref series they draw from, every
-- later one has to match. The live ref taken when the student row was created goes back to the counter.
create or replace function enforce_batch_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_test   boolean;
  student_test boolean;
begin
  select is_test into batch_test from batches where id = new.batch_id;
  select is_test into student_test from students where id = new.student_id;

  if batch_test is not distinct from student_test then
    return new;
  end if;

  if exists (select 1 from batch_student_mapping where student_id = new.student_id) then
    raise exception 'A student cannot be in both a test batch and a live batch';
  end if;

  update students
  set is_test = batch_test,
      student_code = case when batch_test then next_test_student_code() else next_student_code() end
  where id = new.student_id;

  if batch_test then
    perform resync_student_code_seq();
  end if;
  return new;
end $$;

drop trigger if exists bsm_kind_guard on batch_student_mapping;
create trigger bsm_kind_guard
  before insert on batch_student_mapping
  for each row execute function enforce_batch_kind();

-- The two global finance views gain is_test (appended last) so the dashboard can leave test batches out.
create or replace view batch_fee_summary as
select
  b.id as batch_id,
  b.name as batch_name,
  count(distinct bsm.student_id) filter (where bsm.status <> 'terminated') as total_students,
  coalesce(sum(sf.total_fee) filter (where bsm.status <> 'terminated'), 0) as total_fees,
  coalesce(sum(sf.paid_amount), 0) as total_collected,
  coalesce(sum(greatest(sf.total_fee - sf.paid_amount, 0)) filter (where bsm.status <> 'terminated'), 0) as total_outstanding,
  b.is_test
from batches b
left join batch_student_mapping bsm on bsm.batch_id = b.id
left join student_fees sf on sf.batch_id = b.id and sf.student_id = bsm.student_id
group by b.id, b.name;

create or replace view earning_breakdown as
select
  b.id   as batch_id,
  b.name as batch_name,
  count(bsm.id) filter (where bsm.status <> 'terminated') as active_students,
  count(bsm.id) filter (where bsm.status =  'terminated') as terminated_students,
  coalesce(sum(sf.paid_amount), 0) as collected,
  coalesce(sum(sf.paid_amount) filter (where bsm.status <> 'terminated'), 0) as collected_active,
  coalesce(sum(sf.paid_amount) filter (where bsm.status =  'terminated'), 0) as collected_terminated,
  coalesce(sum(greatest(sf.total_fee - sf.paid_amount, 0))
    filter (where bsm.status <> 'terminated'), 0) as pending,
  coalesce(sum(greatest(coalesce(sf.expected_on_exit, 0) - sf.paid_amount, 0))
    filter (where bsm.status = 'terminated'), 0) as void_amount,
  coalesce(sum(greatest(sf.total_fee - coalesce(sf.expected_on_exit, 0), 0))
    filter (where bsm.status = 'terminated'), 0) as never_due,
  coalesce(sum(greatest(sf.paid_amount - coalesce(sf.paid_at_exit, sf.paid_amount), 0))
    filter (where bsm.status = 'terminated'), 0) as recovered,
  b.is_test
from batches b
left join batch_student_mapping bsm on bsm.batch_id = b.id
left join student_fees sf on sf.batch_id = b.id and sf.student_id = bsm.student_id
group by b.id, b.name;

-- One way: the batch and everyone in it leave the live numbers for good. Their refs are re-issued from the test
-- series and the live counter is resynced, so refs at the top of the stack come back and refs in the middle leave a gap.
create or replace function convert_batch_to_test(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  shared text;
  moved  int;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  if not exists (select 1 from batches where id = p_batch_id) then
    raise exception 'Batch not found';
  end if;
  if exists (select 1 from batches where id = p_batch_id and is_test) then
    raise exception 'Already a test batch';
  end if;

  -- A student in a live batch as well would be both kinds.
  select string_agg(s.name, ', ') into shared
  from batch_student_mapping m
  join students s on s.id = m.student_id
  where m.batch_id = p_batch_id
    and exists (select 1 from batch_student_mapping o where o.student_id = m.student_id and o.batch_id <> p_batch_id);
  if shared is not null then
    raise exception 'Also in other batches: %', shared;
  end if;

  update batches set is_test = true where id = p_batch_id;

  with moved_rows as (
    update students
    set is_test = true, student_code = next_test_student_code()
    where id in (select student_id from batch_student_mapping where batch_id = p_batch_id)
    returning 1
  )
  select count(*) into moved from moved_rows;

  perform resync_student_code_seq();
  return jsonb_build_object('converted', moved);
end $$;

revoke all on function convert_batch_to_test(uuid) from public;
grant execute on function convert_batch_to_test(uuid) to authenticated;
