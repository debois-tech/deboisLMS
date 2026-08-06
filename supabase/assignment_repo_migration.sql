-- ============================================================
-- Portal assignment submissions — schema + RLS migration
-- Run once in Supabase SQL Editor. Idempotent (safe to re-run).
--
-- Adds the one-repo-per-student model behind the student portal's
-- assignment submit flow, and grants students the write access they
-- need for it (until now every student policy was read-only).
-- ============================================================

-- -----------------------------------------------------------
-- 1. ONE GITHUB REPO PER STUDENT
-- -----------------------------------------------------------
-- Students keep all their homework in a single repo, so the link is stored
-- once against the student rather than snapshotted per submission. Editing
-- it from any assignment's submit dialog therefore re-points every past and
-- future submission at the new URL — that is intentional, not a bug.
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

-- -----------------------------------------------------------
-- 2. PORTAL AS A SUBMISSION CHANNEL
-- -----------------------------------------------------------
-- Distinguishes a student's own portal submission from an admin ticking the
-- box on their behalf. Postgres forbids using a new enum value in the same
-- transaction that adds it — if your SQL editor wraps the whole file in one
-- transaction and rejects this, run this single statement on its own first.
alter type submission_channel add value if not exists 'portal';

-- -----------------------------------------------------------
-- 3. RLS — STUDENT_REPOS
-- -----------------------------------------------------------
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

-- -----------------------------------------------------------
-- 4. RLS — STUDENTS MAY SUBMIT THEIR OWN ASSIGNMENTS
-- -----------------------------------------------------------
-- student_login_migration.sql gave students select-only access here. The
-- portal submit button needs insert + update, still scoped to their own row
-- and to assignments belonging to a batch they are actively enrolled in.
drop policy if exists student_insert_own on assignment_completions;
create policy student_insert_own on assignment_completions
  for insert with check (
    student_id = current_student_id()
    and assignment_id in (
      select a.id
      from assignments a
      join batch_student_mapping m on m.batch_id = a.batch_id
      where m.student_id = current_student_id() and m.status = 'active'
    )
  );

drop policy if exists student_update_own on assignment_completions;
create policy student_update_own on assignment_completions
  for update using (student_id = current_student_id())
  with check (student_id = current_student_id());
