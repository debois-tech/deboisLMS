-- Run once in the Supabase SQL editor; re-runnable. Curriculum parents follow their children.

create or replace function set_curriculum_status(p_node uuid, p_status curriculum_status, p_done_on date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare b uuid;
begin
  select batch_id into b from curriculum_nodes where id = p_node;
  if b is null then
    raise exception 'Not found';
  end if;
  if not (is_admin() or exists (
    select 1 from tutor_batch_mapping where tutor_id = current_tutor_id() and batch_id = b
  )) then
    raise exception 'Not your batch';
  end if;
  -- A card with children follows them (refresh_curriculum_parents); only the ones without any are set by hand.
  if exists (select 1 from curriculum_nodes where parent_id = p_node) then
    raise exception 'This follows what is under it';
  end if;
  update curriculum_nodes
  set status = p_status,
      done_on = case when p_status = 'done' then coalesce(p_done_on, current_date) else null end
  where id = p_node;
end $$;

revoke all on function set_curriculum_status(uuid, curriculum_status, date) from public;
grant execute on function set_curriculum_status(uuid, curriculum_status, date) to authenticated;

-- 27. CURRICULUM PARENTS FOLLOW THEIR CHILDREN
-- A topic with subtopics, or a module with topics, is finished once every child is done or skipped and at least one is done;
-- skipped when all are skipped; otherwise open. Its date is its last done child's. Cards with no children are set by hand.
create or replace function refresh_curriculum_parents(p_batch uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare lvl text;
begin
  -- Subtopics settle their topics first, then topics settle their modules
  foreach lvl in array array['subtopic', 'topic'] loop
    update curriculum_nodes p
    set status = d.status, done_on = d.done_on
    from (
      select c.parent_id,
        (case when bool_or(c.status = 'todo') then 'todo'
              when bool_or(c.status = 'done') then 'done'
              else 'skipped' end)::curriculum_status as status,
        case when not bool_or(c.status = 'todo') and bool_or(c.status = 'done')
             then max(c.done_on) filter (where c.status = 'done') end as done_on
      from curriculum_nodes c
      where c.batch_id = p_batch and c.kind::text = lvl
      group by c.parent_id
    ) d
    where p.id = d.parent_id and (p.status, p.done_on) is distinct from (d.status, d.done_on);
  end loop;
end $$;

revoke all on function refresh_curriculum_parents(uuid) from public, anon, authenticated;

create or replace function curriculum_parents_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform refresh_curriculum_parents(coalesce(new.batch_id, old.batch_id));
  return null;
end $$;

drop trigger if exists curriculum_parents_refresh on curriculum_nodes;
create trigger curriculum_parents_refresh
  after insert or update of status, parent_id or delete on curriculum_nodes
  for each row when (pg_trigger_depth() = 0)
  execute function curriculum_parents_trigger();

-- Settle every existing batch once
select refresh_curriculum_parents(id) from batches;
