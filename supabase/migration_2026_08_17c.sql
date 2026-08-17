-- =============================================================================
-- Migration — 17 Aug 2026 (c)
-- =============================================================================
-- Run after migration_2026_08_17b.sql. Re-runnable.
--
--   1. resync_student_code_seq() — point the counter at the students who remain
--
-- Applied to dev: ____   Applied to production: ____
-- =============================================================================


-- Deleting a student does not give their code back: student_code_seq has already
-- moved on, so the next intake starts at a number nobody used. Wiping the table
-- and restarting the sequence was the old fix and is no longer available — there
-- is live data that must not be touched.
--
-- This walks the other way. It reads the highest code still held by a real
-- student under the current year prefix and parks the sequence there, so the
-- next student issued takes the very next number. Existing codes are read, never
-- rewritten.
--
-- Safe by construction: the sequence can only ever land on a number that is
-- already taken, so the next one it hands out is free. It cannot produce a
-- duplicate, and it will not move the counter below a code still in use.
create or replace function resync_student_code_seq()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix  text := student_code_prefix();
  highest bigint;
begin
  -- The SQL editor carries no JWT, so "no caller" is allowed — that is where this
  -- gets run. A signed-in caller must be an admin.
  if auth.uid() is not null and not is_admin() then
    raise exception 'Admin only';
  end if;

  -- Digits after the prefix. Other years carry a different prefix and a
  -- different string, so they can never collide with this one.
  select max(nullif(regexp_replace(substring(student_code from length(prefix) + 1), '\D', '', 'g'), '')::bigint)
  into highest
  from students
  where student_code like prefix || '%';

  if highest is null then
    -- Nobody left under this prefix: the next call starts at 1.
    perform setval('student_code_seq', 1, false);
  else
    perform setval('student_code_seq', highest);
  end if;

  -- The code the next student will get. Worked out, not consumed.
  return prefix || lpad((coalesce(highest, 0) + 1)::text, 3, '0');
end $$;

revoke all on function resync_student_code_seq() from public;
grant execute on function resync_student_code_seq() to authenticated;
