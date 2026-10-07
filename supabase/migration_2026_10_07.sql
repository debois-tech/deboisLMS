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
  -- A transfer that carries payments brings its own registration fee
  if current_setting('app.skip_registration', true) = 'on' then
    return new;
  end if;

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

  -- Their documents go with them
  insert into document_cleanup (path)
  select p from unnest(array[m.offer_letter_path, m.cert_path]) as p where p is not null
  on conflict do nothing;

  update batch_student_mapping
  set status = 'terminated', left_on = p_left_on,
      offer_letter_path = null, cert_path = null, offer_letter_shared = false, cert_shared = false
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

-- 23. LIFECYCLE: 90 days, Archived, documents, finished batches closed
-- The enrolment status "dropped" is now "archived": set by the 90-day clean-up. Idempotent.
do $$ begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'mapping_status' and e.enumlabel = 'dropped') then
    alter type mapping_status rename value 'dropped' to 'archived';
  end if;
end $$;

alter table students add column if not exists no_batch_since date;

update students s
set no_batch_since = (now() at time zone 'Asia/Kolkata')::date
where s.no_batch_since is null
  and s.auth_user_id is not null
  and not exists (select 1 from batch_student_mapping m where m.student_id = s.id);

-- Remembers when a student lost their last batch, for the 90-day clean-up
create or replace function track_no_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update students set no_batch_since = null where id = new.student_id and no_batch_since is not null;
  elsif not exists (select 1 from batch_student_mapping where student_id = old.student_id) then
    update students set no_batch_since = (now() at time zone 'Asia/Kolkata')::date where id = old.student_id;
  end if;
  return null;
end $$;

drop trigger if exists bsm_track_no_batch on batch_student_mapping;
create trigger bsm_track_no_batch
  after insert or delete on batch_student_mapping
  for each row execute function track_no_batch();

-- Files cannot be removed from SQL, so their paths wait here until an admin opens the dashboard
create table if not exists document_cleanup (
  path text primary key
);

alter table document_cleanup enable row level security;
drop policy if exists admin_full_access on document_cleanup;
create policy admin_full_access on document_cleanup
  for all using (is_admin()) with check (is_admin());

drop function if exists revoke_expired_student_logins();

-- 24. NOTICES: failed actions and expiring accounts
-- Things that went wrong in the background or in bulk, shown in the admin notices until cleared
do $ begin create type failure_kind as enum ('cleanup', 'document_email', 'csv_import', 'login_create'); exception when duplicate_object then null; end $;

create table if not exists action_failures (
  id         uuid primary key default gen_random_uuid(),
  kind       failure_kind not null,
  detail     text not null,
  created_at timestamptz not null default now()
);

alter table action_failures enable row level security;
drop policy if exists admin_full_access on action_failures;
create policy admin_full_access on action_failures
  for all using (is_admin()) with check (is_admin());

-- Students whose login and documents go within p_days, with what the admin may want to settle first
create or replace function expiring_students(p_days int default 14)
returns table (
  student_id uuid, student_name text, student_code text, batch_name text,
  ended_on date, delete_on date, owed numeric, docs_made int, docs_shared int
)
language plpgsql
stable
security definer
set search_path = public
as $
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  return query
  select s.id, s.name, s.student_code, b.name,
         b.ended_at, coalesce(b.ended_at, s.no_batch_since) + 90,
         greatest(coalesce(sf.total_fee, 0) - coalesce(sf.paid_amount, 0), 0),
         (m.offer_letter_path is not null)::int + (m.cert_path is not null)::int,
         m.offer_letter_shared::int + m.cert_shared::int
  from students s
  left join lateral (
    select m2.* from batch_student_mapping m2
    join batches b2 on b2.id = m2.batch_id
    where m2.student_id = s.id
    order by b2.ended_at desc nulls last
    limit 1
  ) m on true
  left join batches b on b.id = m.batch_id
  left join student_fees sf on sf.student_id = s.id and sf.batch_id = m.batch_id
  where s.auth_user_id is not null
    and not s.is_test
    and not exists (
      select 1 from batch_student_mapping m3
      join batches b3 on b3.id = m3.batch_id
      where m3.student_id = s.id and m3.status = 'active' and b3.ended_at is null
    )
    and coalesce(b.ended_at, s.no_batch_since) is not null
    and coalesce(b.ended_at, s.no_batch_since) + 90 <= current_date + p_days
  order by 6;
end $;

revoke all on function expiring_students(int) from public;
grant execute on function expiring_students(int) to authenticated;

-- 90 days after a batch ends, with nothing running, the login and documents go; every other record stays
create or replace function expire_students()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  expired record;
  removed int := 0;
begin
  -- cron runs this with no JWT; a signed-in caller must be an admin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Admin only';
  end if;

  for expired in
    select s.id as student_id, s.auth_user_id
    from students s
    where s.auth_user_id is not null
      and not s.is_test
      and (
        -- has had a batch, and none is running or inside its 90 days
        (
          exists (select 1 from batch_student_mapping m where m.student_id = s.id)
          and not exists (
            select 1 from batch_student_mapping m2
            join batches b2 on b2.id = m2.batch_id
            where m2.student_id = s.id
              and m2.status = 'active'
              and (b2.ended_at is null or b2.ended_at + 90 > current_date)
          )
        )
        -- or has had no batch for 90 days
        or (
          not exists (select 1 from batch_student_mapping m3 where m3.student_id = s.id)
          and s.no_batch_since is not null
          and s.no_batch_since + 90 <= current_date
        )
      )
  loop
    -- One student failing must not stop the rest; it is reported in the admin notices
    begin
      insert into document_cleanup (path)
      select p from batch_student_mapping m, unnest(array[m.offer_letter_path, m.cert_path]) as p
      where m.student_id = expired.student_id and p is not null
      on conflict do nothing;

      update batch_student_mapping
      set status = case when status = 'active' then 'archived'::mapping_status else status end,
          offer_letter_path = null, cert_path = null, offer_letter_shared = false, cert_shared = false
      where student_id = expired.student_id;

      -- Unlinked first, so this works whatever the foreign key does on delete
      update students set auth_user_id = null, password_rotated = false, no_batch_since = null where id = expired.student_id;
      delete from auth.users where id = expired.auth_user_id;
      removed := removed + 1;
    exception when others then
      insert into action_failures (kind, detail)
      values ('cleanup', 'Clean-up failed for ' || (select name from students where id = expired.student_id) || ': ' || sqlerrm);
    end;
  end loop;

  return removed;
end $$;

revoke all on function expire_students() from public;
grant execute on function expire_students() to authenticated;

-- Daily at 02:00 India time. Needs pg_cron; if it is not enabled, run expire_students() by hand
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-students', '30 20 * * *', 'select public.expire_students()');
exception when others then
  raise notice 'pg_cron not available (%), schedule expire_students() by hand', sqlerrm;
end $$;

-- A finished batch is read-only for students: no submissions
drop policy if exists student_insert_own on assignment_completions;
create policy student_insert_own on assignment_completions
  for insert with check (
    student_id = current_student_id()
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      join batches b on b.id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and b.ended_at is null
    )
  );

drop policy if exists student_update_own on assignment_completions;
create policy student_update_own on assignment_completions
  for update using (
    student_id = current_student_id()
    and submitted = false
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      join batches b on b.id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and b.ended_at is null
    )
  )
  with check (
    student_id = current_student_id()
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      join batches b on b.id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and b.ended_at is null
    )
  );

-- 25. TUTOR LOG
-- Everything a tutor does, for the admin Tutor Log. Written by triggers, so no screen can skip it.
do $$ begin create type tutor_action_op as enum ('created', 'updated', 'deleted'); exception when duplicate_object then null; end $$;

create table if not exists tutor_actions (
  id         uuid primary key default gen_random_uuid(),
  tutor_id   uuid references tutors(id) on delete set null,
  tutor_name text not null,
  op         tutor_action_op not null,
  item       text not null,
  detail     text,
  batch_id   uuid,
  times      int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_tutor_actions_created on tutor_actions(created_at desc);

alter table tutor_actions enable row level security;
drop policy if exists admin_full_access on tutor_actions;
create policy admin_full_access on tutor_actions
  for all using (is_admin()) with check (is_admin());

create or replace function log_tutor_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tutor     tutors%rowtype;
  doc       jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  action_op tutor_action_op := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  label     text := case tg_table_name
    when 'lectures' then 'Lecture'
    when 'attendance' then 'Attendance'
    when 'uploads' then 'Attendance upload'
    when 'assignments' then 'Assignment'
    when 'assignment_completions' then 'Assignment mark'
    when 'materials' then 'Study material'
    when 'batch_badges' then 'Badge'
    when 'student_badges' then 'Badge given'
    when 'quizzes' then 'Quiz'
    when 'curriculum_nodes' then 'Curriculum'
    else 'Curriculum submission'
  end;
  about     text := coalesce(doc->>'title', doc->>'name');
  batch     uuid;
begin
  if not is_tutor() then
    return null;
  end if;

  select * into tutor from tutors where auth_user_id = auth.uid();
  if not found then
    return null;
  end if;

  batch := coalesce(
    nullif(doc->>'batch_id', '')::uuid,
    (select a.batch_id from assignments a where a.id = nullif(doc->>'assignment_id', '')::uuid),
    (select bb.batch_id from batch_badges bb where bb.id = nullif(doc->>'badge_id', '')::uuid)
  );

  -- A burst of the same action (marking a whole class) folds into one row
  update tutor_actions
  set times = times + 1
  where tutor_id = tutor.id and op = action_op and item = label
    and batch_id is not distinct from batch
    and detail is not distinct from about
    and created_at > now() - interval '1 minute';

  if not found then
    insert into tutor_actions (tutor_id, tutor_name, op, item, detail, batch_id)
    values (tutor.id, tutor.name, action_op, label, about, batch);
  end if;

  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'lectures', 'attendance', 'uploads', 'assignments', 'assignment_completions', 'materials',
    'batch_badges', 'student_badges', 'quizzes', 'curriculum_nodes', 'curriculum_requests'
  ] loop
    execute format('drop trigger if exists log_tutor_action on %I', t);
    execute format('create trigger log_tutor_action after insert or update or delete on %I for each row execute function log_tutor_action()', t);
  end loop;
end $$;

-- 26. TRANSFER: Transferred status, read-only for the student, one student at a time
-- The new value is only compared as text below, because a value added in this script cannot be used as an enum yet
alter type mapping_status add value if not exists 'transferred';

drop function if exists transfer_students(uuid[], uuid);

create or replace view batch_fee_summary as
select
  b.id as batch_id,
  b.name as batch_name,
  count(distinct bsm.student_id) filter (where bsm.status::text not in ('terminated', 'transferred')) as total_students,
  coalesce(sum(sf.total_fee) filter (where bsm.status::text not in ('terminated', 'transferred')), 0) as total_fees,
  coalesce(sum(sf.paid_amount), 0) as total_collected,
  coalesce(sum(greatest(sf.total_fee - sf.paid_amount, 0)) filter (where bsm.status::text not in ('terminated', 'transferred')), 0) as total_outstanding,
  b.is_test
from batches b
left join batch_student_mapping bsm on bsm.batch_id = b.id
left join student_fees sf on sf.batch_id = b.id and sf.student_id = bsm.student_id
group by b.id, b.name;

create or replace view earning_breakdown as
select
  b.id   as batch_id,
  b.name as batch_name,
  count(bsm.id) filter (where bsm.status::text not in ('terminated', 'transferred')) as active_students,
  count(bsm.id) filter (where bsm.status =  'terminated') as terminated_students,

  -- Everything banked, whoever paid it.
  coalesce(sum(sf.paid_amount), 0) as collected,
  coalesce(sum(sf.paid_amount) filter (where bsm.status::text not in ('terminated', 'transferred')), 0) as collected_active,
  coalesce(sum(sf.paid_amount) filter (where bsm.status =  'terminated'), 0) as collected_terminated,

  -- Still expected from students who have not left.
  coalesce(sum(greatest(sf.total_fee - sf.paid_amount, 0))
    filter (where bsm.status::text not in ('terminated', 'transferred')), 0) as pending,

  -- Owed on the day they left and never paid. Recorded, never expected.
  coalesce(sum(greatest(coalesce(sf.expected_on_exit, 0) - sf.paid_amount, 0))
    filter (where bsm.status = 'terminated'), 0) as void_amount,

  -- The rest of their course fee, which never became due at all.
  coalesce(sum(greatest(sf.total_fee - coalesce(sf.expected_on_exit, 0), 0))
    filter (where bsm.status = 'terminated'), 0) as never_due,

  -- Void that came in after they left. Never more than the void itself.
  coalesce(sum(greatest(sf.paid_amount - coalesce(sf.paid_at_exit, sf.paid_amount), 0))
    filter (where bsm.status = 'terminated'), 0) as recovered,
  b.is_test
from batches b
left join batch_student_mapping bsm on bsm.batch_id = b.id
left join student_fees sf on sf.batch_id = b.id and sf.student_id = bsm.student_id
group by b.id, b.name;

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
    -- Moved fee: any payment besides the registration fee counts as the 1st instalment.
    when sf.transferred then
      case when exists (
        select 1 from fee_payment_logs l
        where l.student_fee_id = sf.id and l.notes is distinct from 'Registration fee'
      ) then 1 else 0 end
    when sf.paid_amount >= least(1000, sf.total_fee)
                         + round(greatest(sf.total_fee - 1000, 0) / 2.0) then 1
    else 0
  end as paid_through
from student_fees sf
where sf.student_id = current_student_id()
  and exists (
    select 1 from batch_student_mapping m
    where m.student_id = sf.student_id and m.batch_id = sf.batch_id and m.status::text <> 'transferred'
  );

drop policy if exists student_read_own on batch_student_mapping;
create policy student_read_own on batch_student_mapping
  for select using (student_id = current_student_id() and status::text <> 'transferred');


drop policy if exists student_read_own on batches;
create policy student_read_own on batches
  for select using (
    id in (select batch_id from batch_student_mapping where student_id = current_student_id() and status::text <> 'transferred')
  );


drop policy if exists student_read_own on lectures;
create policy student_read_own on lectures
  for select using (
    batch_id in (select batch_id from batch_student_mapping where student_id = current_student_id() and status::text <> 'transferred')
  );


drop policy if exists student_read_own on assignments;
create policy student_read_own on assignments
  for select using (
    batch_id in (select batch_id from batch_student_mapping where student_id = current_student_id() and status::text <> 'transferred')
  );


drop policy if exists student_read_own on curriculum_nodes;
create policy student_read_own on curriculum_nodes
  for select using (
    batch_id in (select batch_id from batch_student_mapping where student_id = (select current_student_id()) and status::text <> 'transferred')
  );


drop policy if exists student_read_own on batch_badges;
create policy student_read_own on batch_badges
  for select using (
    batch_id in (select batch_id from batch_student_mapping where student_id = (select current_student_id()) and status::text <> 'transferred')
  );


drop policy if exists student_read_own on fee_payment_logs;
create policy student_read_own on fee_payment_logs
  for select using (
    student_id = current_student_id()
    and batch_id in (select batch_id from batch_student_mapping where student_id = current_student_id() and status::text <> 'transferred')
  );


-- Moves one student to another running batch. The old enrolment stays as Transferred with its data, read-only;
-- its documents are dropped. With p_carry the payments are copied to the new batch and stop counting in the old one.
create or replace function transfer_student(
  p_mapping_id uuid, p_to_batch uuid, p_fee numeric, p_carry boolean, p_joined_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m       batch_student_mapping%rowtype;
  source  batches%rowtype;
  target  batches%rowtype;
  old_fee student_fees%rowtype;
  new_fee student_fees%rowtype;
  who     text;
  pending int;
  new_map uuid;
  carried numeric := 0;
  today   date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  select * into m from batch_student_mapping where id = p_mapping_id for update;
  if not found then
    raise exception 'Enrolment not found';
  end if;
  select name into who from students where id = m.student_id;

  if m.status <> 'active' then
    raise exception '% is not active in this batch', who;
  end if;

  select * into source from batches where id = m.batch_id;
  if source.ended_at is not null then
    raise exception '% is in a finished batch: add them to the new batch instead of transferring', who;
  end if;

  select * into target from batches where id = p_to_batch;
  if not found then
    raise exception 'Target batch not found';
  end if;
  if target.ended_at is not null or target.status = 'completed' then
    raise exception 'The target batch has ended';
  end if;
  if exists (select 1 from batch_student_mapping where batch_id = p_to_batch and student_id = m.student_id) then
    raise exception '% is already in the target batch', who;
  end if;

  select count(*) into pending from payment_claims
  where student_id = m.student_id and batch_id = m.batch_id and status = 'pending';
  if pending > 0 then
    raise exception 'Clear % payment claims for % first', pending, who;
  end if;

  if p_fee is null or p_fee < 0 then
    raise exception 'Fee must be 0 or more';
  end if;
  if target.base_fee is not null and p_fee > target.base_fee then
    raise exception 'Fee is above the base fee of %', target.base_fee;
  end if;

  select * into old_fee from student_fees where student_id = m.student_id and batch_id = m.batch_id for update;
  if p_carry then
    if not found then
      raise exception '% has no fee to carry over', who;
    end if;
    if p_fee < old_fee.paid_amount then
      raise exception 'Fee is below the % already paid by %', old_fee.paid_amount, who;
    end if;
  end if;

  -- The join date rule runs unless a date was given
  insert into batch_student_mapping (batch_id, student_id, joined_at)
  values (p_to_batch, m.student_id, p_joined_on)
  returning id into new_map;

  if p_carry then
    -- The carried payments already include the registration fee
    perform set_config('app.skip_registration', 'on', true);
    insert into student_fees (student_id, batch_id, total_fee, paid_amount, transferred, discount_type, discount_value)
    values (m.student_id, p_to_batch, p_fee, 0, true, 'amount', greatest(coalesce(target.base_fee, p_fee) - p_fee, 0))
    returning * into new_fee;
    perform set_config('app.skip_registration', 'off', true);

    insert into fee_payment_logs (student_fee_id, student_id, batch_id, amount, payment_date, payment_method, notes)
    select new_fee.id, l.student_id, p_to_batch, l.amount, l.payment_date, l.payment_method,
           concat_ws(' · ', l.notes, 'Transferred from ' || source.name || ', counted for this batch')
    from fee_payment_logs l
    where l.student_fee_id = old_fee.id;

    carried := old_fee.paid_amount;
    update student_fees set paid_amount = carried where id = new_fee.id;

    update fee_payment_logs
    set notes = concat_ws(' · ', notes, 'Transferred to ' || target.name || ', not counted here')
    where student_fee_id = old_fee.id;

    -- Nothing left to count or collect in the old batch
    update student_fees
    set paid_at_exit = old_fee.paid_amount, expected_on_exit = 0, paid_amount = 0, updated_at = now()
    where id = old_fee.id;
  else
    -- The registration fee trigger books the Rs 1,000 on the new fee
    insert into student_fees (student_id, batch_id, total_fee, paid_amount, discount_type, discount_value)
    values (m.student_id, p_to_batch, p_fee, 0, 'amount', greatest(coalesce(target.base_fee, p_fee) - p_fee, 0));

    -- The old fee stays as it is, frozen at what was paid: no more payments
    update student_fees
    set paid_at_exit = paid_amount, expected_on_exit = paid_amount, updated_at = now()
    where student_id = m.student_id and batch_id = m.batch_id;
  end if;

  insert into document_cleanup (path)
  select p from unnest(array[m.offer_letter_path, m.cert_path]) as p where p is not null
  on conflict do nothing;

  update batch_student_mapping
  set status = 'transferred', left_on = today,
      offer_letter_path = null, cert_path = null, offer_letter_shared = false, cert_shared = false
  where id = p_mapping_id;

  return jsonb_build_object('mapping_id', new_map, 'carried', carried);
end $$;

revoke all on function transfer_student(uuid, uuid, numeric, boolean, date) from public;
grant execute on function transfer_student(uuid, uuid, numeric, boolean, date) to authenticated;

-- 27. PORTAL: a quiz result says which batch it belongs to, so the portal can follow the chosen batch
drop function if exists quiz_my_history();

create or replace function quiz_my_history()
returns table (quiz_id uuid, batch_id uuid, title text, ended_at timestamptz, rank bigint, participants bigint, points bigint, correct bigint, questions bigint)
language sql
stable
security definer
set search_path = public
as $$
  select z.id, z.batch_id, z.title, z.ended_at, s.rank,
         (select count(*) from quiz_participants x where x.quiz_id = z.id),
         s.points, s.correct,
         (select count(*) from quiz_questions q where q.quiz_id = z.id and q.opened_at is not null)
  from quizzes z
  join quiz_participants p on p.quiz_id = z.id and p.student_id = current_student_id()
  cross join lateral quiz_scores(z.id) s
  where z.status = 'ended' and s.student_id = p.student_id
  order by z.ended_at desc;
$$;

revoke all on function quiz_my_history() from public;
grant execute on function quiz_my_history() to authenticated;

-- 28. REPO LINK PER BATCH
alter table student_repos add column if not exists batch_id uuid references batches(id) on delete cascade;

-- A link saved before this belongs to the student's newest batch; one with no batch has nothing to attach to
update student_repos r
set batch_id = (select m.batch_id from batch_student_mapping m where m.student_id = r.student_id order by m.joined_at desc limit 1)
where r.batch_id is null;
delete from student_repos where batch_id is null;

alter table student_repos drop constraint if exists student_repos_pkey;
alter table student_repos add primary key (student_id, batch_id);

drop policy if exists student_insert_own on student_repos;
create policy student_insert_own on student_repos
  for insert with check (
    student_id = current_student_id()
    and batch_id in (select batch_id from batch_student_mapping where student_id = current_student_id())
  );

drop policy if exists student_update_own on student_repos;
create policy student_update_own on student_repos
  for update using (student_id = current_student_id())
  with check (
    student_id = current_student_id()
    and batch_id in (select batch_id from batch_student_mapping where student_id = current_student_id())
  );

-- 29. LATE JOINERS: count the lectures and assignments from before they joined, or not
alter table batch_student_mapping add column if not exists count_earlier_work boolean not null default true;

drop function if exists transfer_student(uuid, uuid, numeric, boolean, date);

-- Moves one student to another running batch. The old enrolment stays as Transferred with its data, read-only;
-- its documents are dropped. With p_carry the payments are copied to the new batch and stop counting in the old one.
create or replace function transfer_student(
  p_mapping_id uuid, p_to_batch uuid, p_fee numeric, p_carry boolean, p_joined_on date default null, p_count_earlier boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m       batch_student_mapping%rowtype;
  source  batches%rowtype;
  target  batches%rowtype;
  old_fee student_fees%rowtype;
  new_fee student_fees%rowtype;
  who     text;
  pending int;
  new_map uuid;
  carried numeric := 0;
  today   date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  select * into m from batch_student_mapping where id = p_mapping_id for update;
  if not found then
    raise exception 'Enrolment not found';
  end if;
  select name into who from students where id = m.student_id;

  if m.status <> 'active' then
    raise exception '% is not active in this batch', who;
  end if;

  select * into source from batches where id = m.batch_id;
  if source.ended_at is not null then
    raise exception '% is in a finished batch: add them to the new batch instead of transferring', who;
  end if;

  select * into target from batches where id = p_to_batch;
  if not found then
    raise exception 'Target batch not found';
  end if;
  if target.ended_at is not null or target.status = 'completed' then
    raise exception 'The target batch has ended';
  end if;
  if exists (select 1 from batch_student_mapping where batch_id = p_to_batch and student_id = m.student_id) then
    raise exception '% is already in the target batch', who;
  end if;

  select count(*) into pending from payment_claims
  where student_id = m.student_id and batch_id = m.batch_id and status = 'pending';
  if pending > 0 then
    raise exception 'Clear % payment claims for % first', pending, who;
  end if;

  if p_fee is null or p_fee < 0 then
    raise exception 'Fee must be 0 or more';
  end if;
  if target.base_fee is not null and p_fee > target.base_fee then
    raise exception 'Fee is above the base fee of %', target.base_fee;
  end if;

  select * into old_fee from student_fees where student_id = m.student_id and batch_id = m.batch_id for update;
  if p_carry then
    if not found then
      raise exception '% has no fee to carry over', who;
    end if;
    if p_fee < old_fee.paid_amount then
      raise exception 'Fee is below the % already paid by %', old_fee.paid_amount, who;
    end if;
  end if;

  -- The join date rule runs unless a date was given
  insert into batch_student_mapping (batch_id, student_id, joined_at, count_earlier_work)
  values (p_to_batch, m.student_id, p_joined_on, p_count_earlier)
  returning id into new_map;

  if p_carry then
    -- The carried payments already include the registration fee
    perform set_config('app.skip_registration', 'on', true);
    insert into student_fees (student_id, batch_id, total_fee, paid_amount, transferred, discount_type, discount_value)
    values (m.student_id, p_to_batch, p_fee, 0, true, 'amount', greatest(coalesce(target.base_fee, p_fee) - p_fee, 0))
    returning * into new_fee;
    perform set_config('app.skip_registration', 'off', true);

    insert into fee_payment_logs (student_fee_id, student_id, batch_id, amount, payment_date, payment_method, notes)
    select new_fee.id, l.student_id, p_to_batch, l.amount, l.payment_date, l.payment_method,
           concat_ws(' · ', l.notes, 'Transferred from ' || source.name || ', counted for this batch')
    from fee_payment_logs l
    where l.student_fee_id = old_fee.id;

    carried := old_fee.paid_amount;
    update student_fees set paid_amount = carried where id = new_fee.id;

    update fee_payment_logs
    set notes = concat_ws(' · ', notes, 'Transferred to ' || target.name || ', not counted here')
    where student_fee_id = old_fee.id;

    -- Nothing left to count or collect in the old batch
    update student_fees
    set paid_at_exit = old_fee.paid_amount, expected_on_exit = 0, paid_amount = 0, updated_at = now()
    where id = old_fee.id;
  else
    -- The registration fee trigger books the Rs 1,000 on the new fee
    insert into student_fees (student_id, batch_id, total_fee, paid_amount, discount_type, discount_value)
    values (m.student_id, p_to_batch, p_fee, 0, 'amount', greatest(coalesce(target.base_fee, p_fee) - p_fee, 0));

    -- The old fee stays as it is, frozen at what was paid: no more payments
    update student_fees
    set paid_at_exit = paid_amount, expected_on_exit = paid_amount, updated_at = now()
    where student_id = m.student_id and batch_id = m.batch_id;
  end if;

  insert into document_cleanup (path)
  select p from unnest(array[m.offer_letter_path, m.cert_path]) as p where p is not null
  on conflict do nothing;

  update batch_student_mapping
  set status = 'transferred', left_on = today,
      offer_letter_path = null, cert_path = null, offer_letter_shared = false, cert_shared = false
  where id = p_mapping_id;

  return jsonb_build_object('mapping_id', new_map, 'carried', carried);
end $$;

revoke all on function transfer_student(uuid, uuid, numeric, boolean, date, boolean) from public;
grant execute on function transfer_student(uuid, uuid, numeric, boolean, date, boolean) to authenticated;

-- 30. HARDENING: these run with no login on purpose (cron, the SQL editor), so the public API must not reach them
-- Supabase grants new functions to anon by name, which revoking from public does not undo
revoke all on function set_student_code_year(int), roll_student_code_year() from public, anon;
revoke all on function expire_students() from public, anon;
revoke all on function resync_student_code_seq() from public, anon;
