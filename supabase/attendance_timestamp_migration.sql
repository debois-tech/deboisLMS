-- Run once against an existing database whose `uploads` table still has
-- timestamptz columns (created before schema.sql switched attendance_started/
-- joined_at/attendance_stopped to naive `timestamp`).
--
-- Meet CSV times have no time zone (e.g. "9:30:00 AM"); the parser combines
-- them with the lecture's date and writes a naive `YYYY-MM-DDTHH:MM:SS`
-- string. Inserting that into a timestamptz column silently applies the
-- session time zone, which is the mismatch causing the error. `uploads` is
-- cleared after every successful process run, so a direct cast (no data
-- worth preserving) is safe.

alter table uploads
  alter column attendance_started type timestamp using attendance_started::timestamp,
  alter column joined_at           type timestamp using joined_at::timestamp,
  alter column attendance_stopped  type timestamp using attendance_stopped::timestamp;
