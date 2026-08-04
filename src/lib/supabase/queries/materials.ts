import { supabase } from '../client';
import type { Material, MaterialView } from '@/lib/types';

const BUCKET = 'materials';

export async function getMaterialsByBatch(batchId: string): Promise<Material[]> {
  const { data } = await supabase
    .from('materials')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Material[];
}

/**
 * Every material the student can open, newest first. RLS does the filtering —
 * the policy only returns rows for batches the student is actively mapped to —
 * so this deliberately does not repeat that logic in the client.
 */
export async function getMaterialsForStudent(): Promise<Material[]> {
  const { data } = await supabase
    .from('materials')
    .select('*, batch:batches(*)')
    .order('created_at', { ascending: false });
  return (data ?? []) as Material[];
}

export async function getMaterialById(id: string): Promise<Material | undefined> {
  const { data } = await supabase
    .from('materials')
    .select('*, batch:batches(*)')
    .eq('id', id)
    .single();
  return data as Material | undefined;
}

/**
 * Uploads the file first and only then writes the row, so a failed upload can
 * never leave a material listed with nothing behind it. If the row insert fails
 * the orphaned object is removed rather than left paying for storage.
 */
export async function uploadMaterial(input: {
  batchId: string;
  title: string;
  description?: string;
  file: File;
  uploadedBy?: string;
}): Promise<Material> {
  if (input.file.type !== 'application/pdf') {
    throw new Error('Only PDF files can be uploaded.');
  }

  const storagePath = `${input.batchId}/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, { contentType: 'application/pdf', upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('materials')
    .insert({
      batch_id: input.batchId,
      title: input.title,
      description: input.description || null,
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

/** Removes the row and the file together; the row goes last so nothing is listed without a file. */
export async function deleteMaterial(material: Material): Promise<void> {
  await supabase.storage.from(BUCKET).remove([material.storage_path]);
  const { error } = await supabase.from('materials').delete().eq('id', material.id);
  if (error) throw new Error(error.message);
}

/** Admin-only: who has opened this material, newest first. */
export async function getMaterialViews(materialId: string): Promise<MaterialView[]> {
  const { data } = await supabase
    .from('material_views')
    .select('*, student:students(*)')
    .eq('material_id', materialId)
    .order('viewed_at', { ascending: false });
  return (data ?? []) as MaterialView[];
}

/**
 * Fetches the student's own watermarked copy as a blob URL. The raw file is
 * never exposed: the edge function is the only reader of the bucket, and what
 * comes back has the student's name and phone stamped on every page.
 *
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
