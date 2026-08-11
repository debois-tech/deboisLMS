-- Study material: table, view log, private storage bucket, RLS.
-- Run after core_migration.sql — the policies use its is_admin() / current_student_id().
--
-- The bucket is private and no student gets a storage policy: the only path to
-- the bytes is the `watermark-material` edge function, which stamps the company
-- name onto every page with the service role key.

-- ── 1. Tables ───────────────────────────────────────────────────────────────
create table if not exists materials (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references batches(id) on delete cascade,
  title         text not null,
  description   text,
  -- Path inside the `materials` bucket: <batch_id>/<uuid>.pdf
  storage_path  text not null unique,
  size_bytes    bigint,
  page_count    int,
  -- auth.users id of the admin who uploaded it.
  uploaded_by   uuid,
  created_at    timestamptz not null default now()
);

create index if not exists materials_batch_id_idx on materials (batch_id);
create index if not exists materials_created_at_idx on materials (created_at desc);

-- Who opened what, and when — makes a watermarked leak traceable to a person.
create table if not exists material_views (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references materials(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  viewed_at    timestamptz not null default now()
);

create index if not exists material_views_material_idx on material_views (material_id);
create index if not exists material_views_student_idx on material_views (student_id);

-- ── 2. Extra columns ────────────────────────────────────────────────────────
-- Free text on purpose: the shape (DBT-TEP<C|M>-<year>-D) is a convention, not a constraint.
alter table batches add column if not exists batch_code text;

comment on column batches.batch_code is
  'Filename prefix for this batch''s study material, e.g. DBT-TEPC-2026-D. '
  'Material titles are this plus an admin-entered suffix: DBT-TEPC-2026-D01.';

-- Who the material came from, for the listings. Not part of the watermark.
alter table materials add column if not exists tutor_id uuid references tutors(id) on delete set null;

create index if not exists materials_tutor_id_idx on materials (tutor_id);

-- A folder upload stays one row per PDF; this is just the name they group under.
alter table materials add column if not exists folder text;

create index if not exists materials_folder_idx on materials (batch_id, folder);

-- NULL batch_id = not tied to a batch = visible to every active student.
-- Its storage path is `all/<uuid>.pdf`.
alter table materials alter column batch_id drop not null;

-- ── 3. Storage bucket ───────────────────────────────────────────────────────
-- Private, PDF-only, 50 MB per file — the ceiling the watermarker can actually
-- process, since it holds the whole document plus a copy in a ~256 MB budget.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set file_size_limit = 52428800
where id = 'materials';

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
alter table materials enable row level security;
alter table material_views enable row level security;

drop policy if exists "admin full access to materials" on materials;
create policy "admin full access to materials" on materials
  for all
  using (is_admin())
  with check (is_admin());

-- Metadata only — the file itself still requires the edge function.
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

drop policy if exists "admin full access to material views" on material_views;
create policy "admin full access to material views" on material_views
  for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "students read own material views" on material_views;
create policy "students read own material views" on material_views
  for select
  using (student_id = current_student_id());

-- Students get NO storage policy on purpose: with RLS on and no match, every
-- direct request for the raw object is denied.
drop policy if exists "admin manages material files" on storage.objects;
create policy "admin manages material files" on storage.objects
  for all
  using (bucket_id = 'materials' and is_admin())
  with check (bucket_id = 'materials' and is_admin());
