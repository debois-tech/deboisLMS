-- Assignment submissions: one repo per student, portal channel, deadlines.
-- Run after core_migration.sql. Idempotent.

-- ── 1. One GitHub repo per student ──────────────────────────────────────────
-- Stored against the student, not the submission: editing the link from any
-- assignment's dialog re-points every past and future submission. Intentional.
create table if not exists student_repos (
  student_id uuid primary key references students(id) on delete cascade,
  repo_url   text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_repos_touch_updated_at on student_repos;
create trigger student_repos_touch_updated_at
  before update on student_repos
  for each row execute function touch_updated_at();

-- ── 2. Portal as a submission channel ───────────────────────────────────────
-- Postgres forbids using a new enum value in the transaction that adds it. If
-- your SQL editor wraps this file in one, run this statement on its own first.
alter type submission_channel add value if not exists 'portal';

-- ── 3. Deadline ─────────────────────────────────────────────────────────────
-- timestamptz, not date: a deadline is one absolute instant, and "is it past?"
-- must mean the same thing to the server and to a browser in another timezone.
-- Null = no deadline. Existing rows get null, so nothing becomes missed.
alter table assignments add column if not exists due_at timestamptz;

comment on column assignments.due_at is
  'Deadline as an absolute instant. Null = no deadline. Students cannot submit after it.';

-- ── 4. RLS — student_repos ──────────────────────────────────────────────────
alter table student_repos enable row level security;

drop policy if exists admin_full_access on student_repos;
create policy admin_full_access on student_repos
  for all using (is_admin()) with check (is_admin());

drop policy if exists student_read_own on student_repos;
create policy student_read_own on student_repos
  for select using (student_id = current_student_id());

drop policy if exists student_insert_own on student_repos;
create policy student_insert_own on student_repos
  for insert with check (student_id = current_student_id());

drop policy if exists student_update_own on student_repos;
create policy student_update_own on student_repos
  for update using (student_id = current_student_id())
  with check (student_id = current_student_id());

-- ── 5. RLS — students submit their own work, before the deadline ────────────
-- Both policies carry the same three conditions, so the deadline cannot be
-- sidestepped by updating a completion row instead of inserting one. The client
-- check is UX; this is the one that holds against a changed clock or a direct
-- API call. admin_full_access is untouched, so an admin can still tick work off late.
drop policy if exists student_insert_own on assignment_completions;
create policy student_insert_own on assignment_completions
  for insert with check (
    student_id = current_student_id()
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and (a.due_at is null or now() <= a.due_at)
    )
  );

drop policy if exists student_update_own on assignment_completions;
create policy student_update_own on assignment_completions
  for update using (
    student_id = current_student_id()
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and (a.due_at is null or now() <= a.due_at)
    )
  )
  with check (
    student_id = current_student_id()
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      where m.student_id = current_student_id()
        and m.status = 'active'
        and (a.due_at is null or now() <= a.due_at)
    )
  );
