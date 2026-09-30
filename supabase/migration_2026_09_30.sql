-- 19. INTERNSHIP ROLE AND DATES
-- Stamped on the offer letter ("the position of ...", the joining date) and on the certificate (the role, the
-- internship's start and end date). One set per student, edited on the student form.
-- Role: defaults from the programme of the batch they join. A new programme needs a new value first:
--   alter type internship_role add value '...';
-- Start date: today for a new student. End date: filled by end_batch() with the batch's end date when the batch is
-- ended (only where still empty, so a date typed by hand is kept). Both stay editable.
do $$ begin
  create type internship_role as enum ('devops_engineering_intern', 'ai_ml_engineering_intern', 'cloud_engineering_intern');
exception when duplicate_object then null; end $$;

alter table students add column if not exists internship_role       internship_role;
alter table students add column if not exists internship_start_date date;
alter table students add column if not exists internship_end_date   date;
-- Set after the column exists so students already in the table stay empty until the backfill, not "today".
alter table students alter column internship_start_date set default current_date;

do $$ begin
  alter table students add constraint students_internship_dates_ordered
    check (internship_end_date is null or internship_start_date is null or internship_end_date >= internship_start_date);
exception when duplicate_object then null; end $$;

-- Same as before, plus: students active in the batch get its end date as their internship end date if they have none.
create or replace function end_batch(p_batch_id uuid)
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

  update batches
  set status = 'completed', ended_at = coalesce(ended_at, current_date)
  where id = p_batch_id
  returning * into updated;

  if not found then
    raise exception 'Batch not found';
  end if;

  update students
  set internship_end_date = updated.ended_at
  where internship_end_date is null
    and (internship_start_date is null or internship_start_date <= updated.ended_at)
    and id in (select student_id from batch_student_mapping where batch_id = p_batch_id and status = 'active');

  return updated;
end $$;
