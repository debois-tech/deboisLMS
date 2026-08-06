import { supabase } from '../client';
import { maybeRow, ok, rows } from './result';
import type { Material, MaterialView } from '@/lib/types';

const BUCKET = 'materials';

/** Per-file upload limit, matching the bucket and the watermark function. */
export const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;

/** `null` batchId = material for every student, stored under `all/`. */
function storagePathFor(batchId: string | null): string {
  return `${batchId ?? 'all'}/${crypto.randomUUID()}.pdf`;
}

export async function getMaterialsByBatch(batchId: string): Promise<Material[]> {
  return rows<Material>(
    await supabase
      .from('materials')
      .select('*, batch:batches(*), tutor:tutors(*)')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false }),
    'Could not load study material',
  );
}

/** Material not tied to any batch — visible to every student. */
export async function getMaterialsForEveryone(): Promise<Material[]> {
  return rows<Material>(
    await supabase
      .from('materials')
      .select('*, batch:batches(*), tutor:tutors(*)')
      .is('batch_id', null)
      .order('created_at', { ascending: false }),
    'Could not load study material',
  );
}

/** Every material the student can open, newest first. RLS does the filtering. */
export async function getMaterialsForStudent(): Promise<Material[]> {
  return rows<Material>(
    await supabase
      .from('materials')
      .select('*, batch:batches(*), tutor:tutors(*)')
      .order('created_at', { ascending: false }),
    'Could not load your study material',
  );
}

export async function getMaterialById(id: string): Promise<Material | undefined> {
  return maybeRow<Material>(
    await supabase.from('materials').select('*, batch:batches(*), tutor:tutors(*)').eq('id', id).single(),
    'Could not load this material',
  );
}

export interface UploadMaterialInput {
  /** null = for every student. */
  batchId: string | null;
  title: string;
  description?: string;
  tutorId?: string | null;
  /** Folder name when this is part of a folder upload; listings group by it. */
  folder?: string | null;
  file: File;
  uploadedBy?: string;
}

/** Uploads the file first and only then writes the row; a failed insert removes the orphaned object. */
export async function uploadMaterial(input: UploadMaterialInput): Promise<Material> {
  if (input.file.type !== 'application/pdf') {
    throw new Error(`${input.file.name} is not a PDF.`);
  }

  const storagePath = storagePathFor(input.batchId);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, { contentType: 'application/pdf', upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('materials')
    .insert({
      batch_id: input.batchId,
      tutor_id: input.tutorId || null,
      title: input.title,
      description: input.description || null,
      folder: input.folder || null,
      storage_path: storagePath,
      size_bytes: input.file.size,
      uploaded_by: input.uploadedBy ?? null,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  return data as Material;
}

export interface BulkUploadResult {
  uploaded: Material[];
  failed: { name: string; reason: string }[];
}

/** Uploads a folder's worth of PDFs, one material per file. One file's failure never stops the rest. */
export async function uploadMaterials(
  files: File[],
  base: Omit<UploadMaterialInput, 'file' | 'title'> & { title: (file: File, index: number) => string },
  onProgress?: (done: number, total: number) => void,
): Promise<BulkUploadResult> {
  const result: BulkUploadResult = { uploaded: [], failed: [] };

  // Sequential on purpose: parallel uploads of large PDFs saturate the connection.
  for (const [index, file] of files.entries()) {
    try {
      result.uploaded.push(
        await uploadMaterial({ ...base, file, title: base.title(file, index) }),
      );
    } catch (err) {
      result.failed.push({
        name: file.name,
        reason: err instanceof Error ? err.message : 'Upload failed',
      });
    }
    onProgress?.(index + 1, files.length);
  }

  return result;
}

/** Removes the row first, then the file — a failed object delete leaves only a storage orphan. */
export async function deleteMaterial(material: Material): Promise<void> {
  ok(await supabase.from('materials').delete().eq('id', material.id), 'Could not delete the material');

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([material.storage_path]);
  if (storageError) {
    throw new Error(
      `The material was removed, but its file is still in storage (${storageError.message}).`,
    );
  }
}

/** Admin-only: who has opened this material, newest first. */
export async function getMaterialViews(materialId: string): Promise<MaterialView[]> {
  return rows<MaterialView>(
    await supabase
      .from('material_views')
      .select('*, student:students(*)')
      .eq('material_id', materialId)
      .order('viewed_at', { ascending: false }),
    'Could not load the view log',
  );
}

/**
 * Fetches the watermarked copy as a blob URL; the raw file is never exposed.
 * The caller owns the returned URL and must `URL.revokeObjectURL` it.
 */
export async function getWatermarkedMaterialUrl(materialId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You are signed out. Sign in again to open this.');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/watermark-material`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ material_id: materialId }),
    },
  );

  if (!response.ok) {
    // The function answers with JSON on failure and a PDF on success.
    const message = await response.json().catch(() => null);
    throw new Error(message?.error ?? 'Could not open this material.');
  }

  return URL.createObjectURL(await response.blob());
}
