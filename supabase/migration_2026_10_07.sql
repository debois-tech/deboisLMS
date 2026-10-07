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
