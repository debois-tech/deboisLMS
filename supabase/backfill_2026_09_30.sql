-- One-off backfill for students that existed before the internship role and dates were added.
-- Run it once, after migration_2026_09_30.sql. Every statement only touches a student whose value is still empty,
-- so it is safe to re-run and never overwrites anything typed by hand.

-- 1. Role: by batch id, from the student's most recent enrolment. One line per batch:
--   when '<batch id>' then 'devops_engineering_intern' | 'ai_ml_engineering_intern' | 'cloud_engineering_intern'
-- A student whose latest batch is not listed is left empty. (Batch ids: select id, name, batch_code from batches;)
update students s
set internship_role = (case latest.batch_id
  when '00000000-0000-0000-0000-000000000000' then 'devops_engineering_intern'
  -- when '<batch id>' then 'ai_ml_engineering_intern'
  -- when '<batch id>' then 'cloud_engineering_intern'
end)::internship_role
from (
  select distinct on (m.student_id) m.student_id, m.batch_id
  from batch_student_mapping m
  join batches b on b.id = m.batch_id
  order by m.student_id, coalesce(m.joined_at, b.start_date) desc nulls last, m.id
) latest
where s.id = latest.student_id
  and s.internship_role is null;
