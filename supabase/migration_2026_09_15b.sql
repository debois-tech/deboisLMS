-- Drop the dead 'github' submission channel. Postgres has no ALTER TYPE ...
-- DROP VALUE, so the enum is recreated with just 'portal'. Any old rows
-- still tagged 'github' (from before admin writes were locked out) are
-- relabeled first — the channel is metadata only, nothing reads it.
-- The guard trigger blocks updates to an already-submitted row outside a
-- real admin request (no JWT here, so is_admin() reads false) — disable it
-- for this one relabel.
alter table assignment_completions disable trigger assignment_completions_guard;
update assignment_completions set submitted_via = 'portal' where submitted_via = 'github';
alter table assignment_completions enable trigger assignment_completions_guard;

alter table assignment_completions alter column submitted_via drop default;

alter type submission_channel rename to submission_channel_old;
create type submission_channel as enum ('portal');

alter table assignment_completions
  alter column submitted_via type submission_channel using submitted_via::text::submission_channel;

alter table assignment_completions alter column submitted_via set default 'portal';

drop type submission_channel_old;
