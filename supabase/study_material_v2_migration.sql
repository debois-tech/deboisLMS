-- ============================================================================
-- Study material v2 — batch codes, tutor attribution, all-student material
-- ----------------------------------------------------------------------------
-- Run in the Supabase SQL editor, after study_material_migration.sql.
-- Idempotent: safe to re-run.
--
-- What changes:
--   1. batches.batch_code    — the filename prefix, e.g. DBT-TEPC-2026-D
--   2. materials.tutor_id    — whose name is watermarked onto the pages
--   3. materials.batch_id    — now nullable; NULL means "every student"
--   4. bucket size limit     — 50 MB -> 300 MB (read the caveat below)
-- ============================================================================

-- ── 1. Batch code ───────────────────────────────────────────────────────────
-- Free text on purpose. The shape (DBT-TEP<C|M>-<year>-D) is a naming
-- convention, not a constraint — it will change, and a CHECK would then need a
-- migration to fix data that is only ever read by humans.
alter table batches add column if not exists batch_code text;

comment on column batches.batch_code is
  'Filename prefix for this batch''s study material, e.g. DBT-TEPC-2026-D. '
  'Material titles are this plus an admin-entered suffix: DBT-TEPC-2026-D01.';

-- ── 2. Tutor attribution ────────────────────────────────────────────────────
-- The watermark names the tutor and the company rather than the reading student.
-- on delete set null: removing a tutor must not delete the material.
alter table materials add column if not exists tutor_id uuid references tutors(id) on delete set null;

create index if not exists materials_tutor_id_idx on materials (tutor_id);

-- ── 2b. Folder grouping ─────────────────────────────────────────────────────
-- A folder upload stays one row per PDF — the portal, the reader and the delete
-- path all assume one material is one file, and a real folder table would mean a
-- join on every read for no gain. This column is just the folder's name, so the
-- files can be grouped under it when listed. NULL for a single-file upload.
alter table materials add column if not exists folder text;

create index if not exists materials_folder_idx on materials (batch_id, folder);

-- ── 3. Material for every student ───────────────────────────────────────────
-- NULL batch_id = not tied to a batch = visible to every active student.
alter table materials alter column batch_id drop not null;

-- The storage path for batch-less material is `all/<uuid>.pdf`.

-- ── 4. Bucket size limit ────────────────────────────────────────────────────
-- Held at 50 MB, matching what the watermarker can actually process.
--
-- The bucket briefly allowed 300 MB. That was worse than useless: a 120 MB PDF
-- uploaded happily and then failed for every student, because the edge function
-- loads the whole document into memory and serialises a second copy inside a
-- ~256 MB budget. One number the whole system agrees on beats a storage ceiling
-- that the reader cannot honour.
--
-- 50 MB is per file. Nothing caps how many files a batch has; total storage is
-- bounded only by the Supabase plan.
update storage.buckets
set file_size_limit = 52428800
where id = 'materials';

-- ── 5. RLS: students also see batch-less material ───────────────────────────
drop policy if exists "students read material for their batches" on materials;
create policy "students read material for their batches" on materials
  for select
  using (
    batch_id is null
    or batch_id in (
      select batch_id from batch_student_mapping
      where student_id = current_student_id() and status = 'active'
    )
  );
