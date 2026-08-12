-- =============================================================================
-- Migration — 12 Aug 2026
-- =============================================================================
-- The delta from the 11 Aug database to the current schema.sql. Run this ONLY on
-- a project that already has the old tables; a fresh project runs schema.sql
-- alone and needs nothing from here.
--
--   1. Programmes      — PHR / AML / MCL, replacing free-text `track`
--   2. Student profile — the fields the new import CSV carries
--   3. Submissions     — GitHub only, and columns the student cannot forge
--   4. Repo links      — canonical GitHub URLs, enforced by the database
--
-- Destructive in one place: it drops `track` and the 'whatsapp'/'other'
-- submission channels. Both are agreed — the project is not deployed and there
-- are no production rows to preserve.
-- =============================================================================


-- =============================================================================
-- 1. PROGRAMMES
-- =============================================================================
-- `track` was free text with four hardcoded options duplicated across two React
-- files. Nothing validated it, so a typo made a batch unfindable and the CSV
-- import had nothing trustworthy to match on.
--
-- The replacement is a lookup table, NOT a Postgres enum. A real enum is fixed at
-- migration time: adding a value is DDL (`alter type`), which the browser client
-- has no rights to run and which cannot be done inside the transaction that then
-- uses the new value. Since the batch form has to mint an abbreviation on the
-- spot, the valid set has to be rows an admin can insert. The CHECK below keeps
-- the codes enum-shaped, and the foreign key gives the same guarantee an enum
-- would: a batch cannot name a programme that does not exist.

-- Dropped rather than migrated: the type only ever existed between this file's
-- first run and now, and the database is empty.
alter table batches drop column if exists program;
drop table if exists batch_programs;
drop type if exists batch_program;

create table batch_programs (
  -- Enum-shaped by constraint: 2–6 capitals, e.g. PHR, AML, MCL.
  code       text primary key check (code ~ '^[A-Z]{2,6}$'),
  name       text not null check (length(btrim(name)) > 0),
  sort_order int  not null default 0
);

insert into batch_programs (code, name, sort_order) values
  ('PHR', 'DevOps Prahar',           1),
  ('AML', 'AI/ML Engineering',       2),
  ('MCL', 'Multi-Cloud Engineering', 3)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

-- No cascade delete: a programme still carrying batches must not vanish under
-- them. Postgres refuses the delete instead.
alter table batches add column program text references batch_programs(code);

alter table batches drop column if exists track;

create index if not exists idx_batches_program on batches(program);

-- Recreating the table dropped its policies with it. Without RLS the anon key
-- could write these rows, so this is not optional.
alter table batch_programs enable row level security;

drop policy if exists admin_full_access on batch_programs;
create policy admin_full_access on batch_programs
  for all using (is_admin()) with check (is_admin());

-- Reference data, no secrets: three columns of programme names.
drop policy if exists read_programs on batch_programs;
create policy read_programs on batch_programs for select to authenticated using (true);


-- =============================================================================
-- 2. STUDENT PROFILE
-- =============================================================================
-- The intake sheet carries a full profile now, not just a name and a number.
alter table students add column if not exists date_of_birth   date;
alter table students add column if not exists gender          text;
alter table students add column if not exists college         text;
alter table students add column if not exists course          text;
alter table students add column if not exists branch          text;
-- Free text, not an int: "3rd", "Final year" and "2" all turn up in the sheets.
alter table students add column if not exists current_year    text;
alter table students add column if not exists graduation_year int;

comment on column students.phone is
  'WhatsApp number. Also the source of the portal password suffix.';


-- =============================================================================
-- 3. SUBMISSIONS
-- =============================================================================
-- ── 3a. GitHub only ─────────────────────────────────────────────────────────
-- Work is handed in as a repo and nothing else. 'portal' is the student doing it
-- themselves; 'github' is an admin recording one. Postgres cannot remove a value
-- from an enum, so the type is rebuilt and swapped.
do $$
begin
  if exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'submission_channel' and e.enumlabel = 'whatsapp'
  ) then
    alter table assignment_completions alter column submitted_via drop default;

    create type submission_channel_new as enum ('github', 'portal');

    alter table assignment_completions
      alter column submitted_via type submission_channel_new
      using case submitted_via::text
              when 'portal' then 'portal'
              else 'github'
            end::submission_channel_new;

    drop type submission_channel;
    alter type submission_channel_new rename to submission_channel;

    alter table assignment_completions alter column submitted_via set default 'portal';
  end if;
end $$;

-- ── 3b. Columns the student cannot forge ────────────────────────────────────
-- RLS decides which row a student may write. It says nothing about the values,
-- so a direct API call could set submitted_at to any timestamp, claim a channel,
-- or name a tutor in marked_by. This owns the columns; RLS owns the row.
create or replace function guard_assignment_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if is_admin() then return new; end if;

  -- Students hand work in. Taking it back is an admin action.
  if new.submitted is not true then
    raise exception 'Only a coordinator can un-submit work';
  end if;
  if tg_op = 'UPDATE' and old.submitted then
    raise exception 'This assignment has already been handed in';
  end if;

  -- Server owns all three, whatever the client sent.
  new.submitted_via := 'portal';
  new.submitted_at  := now();
  new.marked_by     := null;
  return new;
end;
$$;

drop trigger if exists assignment_completions_guard on assignment_completions;
create trigger assignment_completions_guard
  before insert or update on assignment_completions
  for each row execute function guard_assignment_completion();

-- `submitted = false` in USING freezes a row the moment it is handed in, so a
-- student can move work from unsubmitted to submitted exactly once and can never
-- touch a row a coordinator has already marked.
drop policy if exists student_update_own on assignment_completions;
create policy student_update_own on assignment_completions
  for update using (
    student_id = current_student_id()
    and submitted = false
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


-- =============================================================================
-- 4. REPO LINKS
-- =============================================================================
-- Canonical form only — https://github.com/<owner>/<repo>, which is what
-- validateRepoUrl() in src/components/portal/AssignmentModal.tsx sends. No
-- scheme-less input, no query string, no other host, and a length ceiling so the
-- column cannot be used as free storage.
update student_repos
set repo_url = 'https://github.com/' || split_part(regexp_replace(repo_url, '^https?://(www\.)?github\.com/', ''), '/', 1)
               || '/' || regexp_replace(split_part(regexp_replace(repo_url, '^https?://(www\.)?github\.com/', ''), '/', 2), '\.git$', '')
where repo_url !~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'
  and repo_url ~ 'github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+';

-- Anything still unparseable was never a repo link; drop it rather than block
-- the constraint. The student is asked for it again on their next hand-in.
delete from student_repos
where repo_url !~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$';

alter table student_repos drop constraint if exists student_repos_repo_url_github;
alter table student_repos add constraint student_repos_repo_url_github
  check (
    repo_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'
    and length(repo_url) <= 200
  );


-- =============================================================================
-- 5. MATERIALS — close the "for everyone" hole
-- =============================================================================
-- The old policy allowed `batch_id is null or <enrolled>`. The first branch
-- checked nothing, so a student dropped from every batch kept reading shared
-- material. Every student now belongs to a batch, so the branch can go.
drop policy if exists "students read material for their batches" on materials;
drop policy if exists student_read_own on materials;
create policy student_read_own on materials
  for select using (
    batch_id in (
      select batch_id from batch_student_mapping
      where student_id = current_student_id() and status = 'active'
    )
  );
