-- Student and lecture updates. Run after the existing migrations.

do $$ begin
  create type discount_type as enum ('percentage', 'amount');
exception when duplicate_object then null;
end $$;

-- Existing records must be completed before this migration is applied.
alter table students alter column phone set not null;
alter table students add constraint students_phone_not_blank check (btrim(phone) <> '');

alter table student_fees add column if not exists discount_type discount_type not null default 'percentage';
alter table student_fees add column if not exists discount_value numeric not null default 0;
alter table student_fees add constraint student_fees_discount_value_nonnegative check (discount_value >= 0);

alter table lectures add column if not exists note text;
alter table lectures add column if not exists start_at timestamptz;
alter table lectures add column if not exists end_at timestamptz;
alter table lectures add constraint lectures_end_after_start check (end_at is null or start_at is null or end_at > start_at);

comment on column lectures.session_type is 'Lecture mode: online or offline.';
comment on column lectures.start_at is 'Manually selected local meeting start, stored as a timestamp.';
comment on column lectures.end_at is 'Computed from start_at plus scheduled_duration_minutes.';
