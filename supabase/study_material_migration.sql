-- ============================================================================
-- Study material — table, private storage bucket, RLS
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor. It is idempotent: safe to re-run.
--
-- Requires supabase/student_login_migration.sql to have been run first: the
-- policies below use its is_admin() and current_student_id() helpers rather than
-- re-inlining the same JWT and auth.uid() checks, so every table in the project
-- shares one definition of "admin" and "the signed-in student".
--
-- Model: the admin uploads one PDF per material and attaches it to a batch.
-- Students in that batch read it through the `watermark-material` edge function,
-- which stamps their name and phone onto every page before streaming it back.
-- The bucket is private — nothing here is ever publicly readable, and no student
-- is granted a storage policy, so the only path to the bytes is that function.
-- ============================================================================

-- ── Table ───────────────────────────────────────────────────────────────────
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

-- ── View log ────────────────────────────────────────────────────────────────
-- Who opened what, and when. This is what makes a watermarked leak traceable to
-- a person rather than just to a batch, so it is written on every open.
create table if not exists material_views (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references materials(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  viewed_at    timestamptz not null default now()
);

create index if not exists material_views_material_idx on material_views (material_id);
create index if not exists material_views_student_idx on material_views (student_id);

-- ── Storage bucket ──────────────────────────────────────────────────────────
-- `public => false`. The 3rd argument caps uploads at 50 MB; the 4th restricts
-- the bucket to PDFs, so a non-PDF is rejected by storage itself and not only by
-- the upload form.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── RLS: materials ──────────────────────────────────────────────────────────
alter table materials enable row level security;
alter table material_views enable row level security;

drop policy if exists "admin full access to materials" on materials;
create policy "admin full access to materials" on materials
  for all
  using (is_admin())
  with check (is_admin());

-- A student sees the metadata of material for batches they are actively in.
-- Metadata only — the file itself still requires the edge function.
drop policy if exists "students read material for their batches" on materials;
create policy "students read material for their batches" on materials
  for select
  using (
    batch_id in (
      select batch_id from batch_student_mapping
      where student_id = current_student_id() and status = 'active'
    )
  );

-- ── RLS: material_views ─────────────────────────────────────────────────────
drop policy if exists "admin full access to material views" on material_views;
create policy "admin full access to material views" on material_views
  for all
  using (is_admin())
  with check (is_admin());

-- A student may read and append their own view log, nothing else. The insert is
-- written by the edge function under the service role anyway; this policy exists
-- so the portal can show "last opened" without widening anything.
drop policy if exists "students read own material views" on material_views;
create policy "students read own material views" on material_views
  for select
  using (student_id = current_student_id());

-- ── RLS: storage.objects ────────────────────────────────────────────────────
-- Admins get full access to the bucket. Students get NO policy at all, on
-- purpose: with RLS enabled and no matching policy, every student request for
-- the raw object is denied. The edge function reaches the file with the service
-- role key, which bypasses RLS, and returns only a watermarked copy.
drop policy if exists "admin manages material files" on storage.objects;
create policy "admin manages material files" on storage.objects
  for all
  using (bucket_id = 'materials' and is_admin())
  with check (bucket_id = 'materials' and is_admin());
