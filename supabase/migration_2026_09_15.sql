-- Submission status becomes fully student-driven; admins get a separate
-- manual "mark" column instead of being able to toggle submitted.
-- marked_by dropped (never populated, no tutor-auth mapping exists to fill
-- it). 'github' submission channel retired — portal is the only value
-- written now (the enum keeps the label; Postgres can't drop enum values).
alter table assignment_completions add column if not exists mark boolean default false not null;

create or replace function guard_assignment_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if is_admin() then
    -- Admin can only set the manual mark — submission status is student-driven.
    if tg_op = 'UPDATE' then
      new.submitted     := old.submitted;
      new.submitted_via := old.submitted_via;
      new.submitted_at  := old.submitted_at;
    else
      new.submitted     := false;
      new.submitted_via := null;
      new.submitted_at  := null;
    end if;
    return new;
  end if;

  -- Students hand work in, and can't take it back or redo it.
  if new.submitted is not true then
    raise exception 'Submission status is set by the student';
  end if;
  if tg_op = 'UPDATE' and old.submitted then
    raise exception 'This assignment has already been handed in';
  end if;

  -- Server owns both, whatever the client sent.
  new.submitted_via := 'portal';
  new.submitted_at  := now();
  return new;
end;
$$;

alter table assignment_completions drop column if exists marked_by;
