-- Archived and test tutors, readable log entries. Safe to re-run.

-- ============================================================
-- 28. ARCHIVED AND TEST TUTORS, READABLE LOG ENTRIES
-- ============================================================
-- Deleting a tutor's login archives the tutor: no login, off every batch, their work stays.
do $$ begin create type tutor_status as enum ('active', 'archived'); exception when duplicate_object then null; end $$;

alter table tutors add column if not exists status tutor_status not null default 'active';
-- A developer's tutors are test from the first insert, hidden from admins like test batches.
alter table tutors add column if not exists is_test boolean not null default false;

drop trigger if exists aa_dev_born_test on tutors;
create trigger aa_dev_born_test before insert on tutors for each row execute function dev_born_test();
drop policy if exists hide_test_from_admin on tutors;
create policy hide_test_from_admin on tutors as restrictive for select using (is_dev() or not is_admin() or not is_test);

-- The developer's guard reads is_test off the row, so it covers tutors with no further code.
create or replace function archive_tutor(p_tutor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare was tutors%rowtype;
begin
  if not is_admin() then raise exception 'Admin only'; end if;

  select * into was from tutors where id = p_tutor_id;
  if not found then raise exception 'Tutor not found'; end if;
  if was.status = 'archived' then raise exception 'Already archived'; end if;

  delete from tutor_batch_mapping where tutor_id = p_tutor_id;
  update tutors set status = 'archived', auth_user_id = null, password_rotated = false where id = p_tutor_id;

  -- A login shared with a student account is theirs too: keep it.
  if was.auth_user_id is not null and not exists (select 1 from students where auth_user_id = was.auth_user_id) then
    delete from auth.users where id = was.auth_user_id;
  end if;
end $$;

revoke all on function archive_tutor(uuid) from public, anon;
grant execute on function archive_tutor(uuid) to authenticated;

-- Log entries carry the account's email and one sentence for the popup. Older entries have neither.
alter table tutor_actions add column if not exists account text;
alter table tutor_actions add column if not exists description text;
alter table admin_actions add column if not exists account text;
alter table admin_actions add column if not exists description text;

-- "who changed attendance of Asha in batch ASTRA for the lecture on 1 Nov 2026: status partial -> absent".
-- Names come from whichever keys the row carries; an edit lists each changed column, old to new.
create or replace function describe_change(p_who text, p_op text, p_label text, p_old jsonb, p_new jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  doc     jsonb := coalesce(p_new, p_old);
  subject text := coalesce(doc ->> 'title', doc ->> 'name', doc ->> 'student_code', doc ->> 'email');
  student text := (select name from students where id = nullif(doc ->> 'student_id', '')::uuid);
  batch   text := (select name from batches where id = nullif(doc ->> 'batch_id', '')::uuid);
  lecture text := coalesce(
    (select to_char(lecture_date, 'DD Mon YYYY') from lectures where id = nullif(doc ->> 'lecture_id', '')::uuid),
    to_char(nullif(doc ->> 'lecture_date', '')::date, 'DD Mon YYYY'));
  changes text;
begin
  if p_op = 'UPDATE' then
    select string_agg(replace(n.key, '_', ' ') || ' ' || coalesce(left(o.value #>> '{}', 40), 'empty') || ' → ' || coalesce(left(n.value #>> '{}', 40), 'empty'), ', ' order by n.key)
    into changes
    from jsonb_each(p_new) n
    left join jsonb_each(p_old) o on o.key = n.key
    where n.value is distinct from o.value
      and n.key not in ('id', 'created_at', 'updated_at', 'marked_at', 'marked_by', 'raw_upload_ids')
      and n.key !~ '_id$';
  end if;

  return left(
    p_who || ' ' || (case p_op when 'INSERT' then 'added' when 'UPDATE' then 'changed' else 'deleted' end) || ' ' || lower(p_label)
      || coalesce(' "' || subject || '"', '')
      || coalesce(' of ' || student, '')
      || coalesce(' in batch ' || batch, '')
      || coalesce(' for the lecture on ' || lecture, '')
      || coalesce(': ' || changes, ''),
    500);
end $$;

-- Only the log triggers call it; it reads names past RLS, so nobody else should.
revoke all on function describe_change(text, text, text, jsonb, jsonb) from public, anon, authenticated;


-- delete_tutor now needs the tutor archived first
create or replace function delete_tutor(p_tutor_id uuid)
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

  select auth_user_id into auth_id from tutors where id = p_tutor_id;
  if not found then
    raise exception 'Tutor not found';
  end if;
  if (select status from tutors where id = p_tutor_id) <> 'archived' then
    raise exception 'Delete the login first';
  end if;

  delete from tutors where id = p_tutor_id;

  -- A login shared with a student account is theirs too: keep it.
  if auth_id is not null and not exists (select 1 from students where auth_user_id = auth_id) then
    delete from auth.users where id = auth_id;
  end if;
end $$;

revoke all on function delete_tutor(uuid) from public;
grant execute on function delete_tutor(uuid) to authenticated;

-- The two log triggers, now writing the account and a description
create or replace function log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  doc       jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  action_op tutor_action_op := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  label     text := case tg_table_name
    when 'students' then 'Student'
    when 'batches' then 'Batch'
    when 'tutors' then 'Tutor'
    when 'batch_student_mapping' then 'Enrolment'
    when 'tutor_batch_mapping' then 'Tutor assignment'
    when 'student_fees' then 'Fee'
    when 'fee_payment_logs' then 'Payment'
    when 'payment_claims' then 'Payment claim'
    when 'app_settings' then 'Setting'
    else initcap(replace(tg_table_name, '_', ' '))
  end;
  about     text := coalesce(
    doc ->> 'title',
    doc ->> 'name',
    doc ->> 'student_code',
    doc ->> 'email',
    -- A deleted lecture has no name; its date is what the log can show.
    case when tg_table_name = 'lectures' then to_char((doc ->> 'lecture_date')::date, 'DD Mon YYYY') end
  );
  who       text := coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''), auth.jwt() ->> 'email', 'Unknown');
  batch     uuid := coalesce(nullif(doc ->> 'batch_id', '')::uuid, case when tg_table_name = 'batches' then (doc ->> 'id')::uuid end);
begin
  if not is_admin() then
    return null;
  end if;

  update admin_actions
  set times = times + 1
  where admin_id = auth.uid() and op = action_op and item = label
    and batch_id is not distinct from batch
    and detail is not distinct from about
    and created_at > now() - interval '1 minute';

  if not found then
    insert into admin_actions (admin_id, admin_name, actor_role, op, item, detail, batch_id, account, description)
    values (
      auth.uid(), who, (case when is_dev() then 'developer' else 'admin' end)::admin_actor_role, action_op, label, about, batch,
      auth.jwt() ->> 'email',
      describe_change(coalesce(auth.jwt() ->> 'email', who), tg_op, label,
        case when tg_op = 'INSERT' then null else to_jsonb(old) end,
        case when tg_op = 'DELETE' then null else to_jsonb(new) end)
    );
  end if;

  return null;
end $$;

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
  about     text := coalesce(
    doc->>'title',
    doc->>'name',
    case when tg_table_name = 'lectures' then to_char((doc->>'lecture_date')::date, 'DD Mon YYYY') end
  );
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
    insert into tutor_actions (tutor_id, tutor_name, op, item, detail, batch_id, account, description)
    values (
      tutor.id, tutor.name, action_op, label, about, batch, tutor.email,
      describe_change(coalesce(tutor.email, tutor.name), tg_op, label,
        case when tg_op = 'INSERT' then null else to_jsonb(old) end,
        case when tg_op = 'DELETE' then null else to_jsonb(new) end)
    );
  end if;

  return null;
end $$;
