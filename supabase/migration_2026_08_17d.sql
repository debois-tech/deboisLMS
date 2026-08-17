-- =============================================================================
-- Migration — 17 Aug 2026 (d)
-- =============================================================================
-- Run after migration_2026_08_17c.sql. Re-runnable.
--
--   1. feedback — bug reports and requests from the portal
--
-- Applied to dev: ____   Applied to production: ____
-- =============================================================================

do $$ begin create type feedback_kind   as enum ('bug', 'request'); exception when duplicate_object then null; end $$;
do $$ begin create type feedback_status as enum ('open', 'resolved'); exception when duplicate_object then null; end $$;

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id) on delete cascade not null,
  kind        feedback_kind not null default 'bug',
  message     text not null check (length(btrim(message)) > 0),
  -- Captured, not typed: the page and browser are what make a bug report usable.
  page        text,
  user_agent  text,
  status      feedback_status not null default 'open',
  created_at  timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists idx_feedback_student on feedback(student_id);
create index if not exists idx_feedback_status  on feedback(status);

alter table feedback enable row level security;

drop policy if exists admin_full_access on feedback;
create policy admin_full_access on feedback
  for all using (is_admin()) with check (is_admin());

drop policy if exists student_read_own on feedback;
create policy student_read_own on feedback
  for select using (student_id = current_student_id());

-- Insert only, and only as themselves. No update policy on purpose: a student
-- must not be able to mark their own report resolved or edit it after the fact.
drop policy if exists student_insert_own on feedback;
create policy student_insert_own on feedback
  for insert with check (student_id = current_student_id());

-- resolved_at follows status rather than being set by hand in two places.
create or replace function stamp_feedback_resolved()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'resolved' and coalesce(old.status, 'open') <> 'resolved' then
    new.resolved_at := now();
  elsif new.status = 'open' then
    new.resolved_at := null;
  end if;
  return new;
end $$;

drop trigger if exists feedback_resolved_stamp on feedback;
create trigger feedback_resolved_stamp
  before insert or update on feedback
  for each row execute function stamp_feedback_resolved();
