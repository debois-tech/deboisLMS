import { supabase } from '../client';
import { maybeRow, ok, rows } from './result';
import { DOCX_TYPE, docxToPdf, extensionOf, fileMimeType, prepareImageForUpload } from '@/lib/utils/files';
import type { Material, MaterialView } from '@/lib/types';

const BUCKET = 'materials';

export { MATERIAL_MAX_BYTES } from '@/lib/utils/files';

/** `null` batchId = material for every student, stored under `all/`. */
function storagePathFor(batchId: string | null, extension: string): string {
  return `${batchId ?? 'all'}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
}

const SELECT = '*, batch:batches(*), tutor:tutors(*)';

export async function getMaterialsByBatch(batchId: string): Promise<Material[]> {
  return rows<Material>(
    await supabase
      .from('materials')
      .select(SELECT)
      .eq('batch_id', batchId)
      .is('assignment_id', null)
      .order('created_at', { ascending: false }),
    'Could not load study material',
  );
}

/** Material not tied to any batch — visible to every student. */
export async function getMaterialsForEveryone(): Promise<Material[]> {
  return rows<Material>(
    await supabase
      .from('materials')
      .select(SELECT)
      .is('batch_id', null)
      .is('assignment_id', null)
      .order('created_at', { ascending: false }),
    'Could not load study material',
  );
}

/** Every material the student can open, newest first. RLS does the filtering. */
export async function getMaterialsForStudent(): Promise<Material[]> {
  return rows<Material>(
    await supabase
      .from('materials')
      .select(SELECT)
      .is('assignment_id', null)
      .order('created_at', { ascending: false }),
    'Could not load your study material',
  );
}

/** An assignment's handouts. Same table, same access rule as the batch's material. */
export async function getMaterialsByAssignment(assignmentId: string): Promise<Material[]> {
  return rows<Material>(
    await supabase
      .from('materials')
      .select(SELECT)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false }),
    'Could not load the assignment files',
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
  /** Set to attach the file to an assignment instead of the material library. */
  assignmentId?: string | null;
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
  // Converted here rather than on the way out: as a PDF or a PNG the file
  // inherits the watermark and the paged reader instead of needing its own path.
  const incoming = fileMimeType(input.file);
  const file =
    incoming === DOCX_TYPE ? await docxToPdf(input.file)
    : await prepareImageForUpload(input.file);

  const mimeType = fileMimeType(file);
  const storagePath = storagePathFor(input.batchId, extensionOf(file.name));

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: mimeType, upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('materials')
    .insert({
      batch_id: input.batchId,
      assignment_id: input.assignmentId ?? null,
      tutor_id: input.tutorId || null,
      title: input.title,
      description: input.description || null,
      folder: input.folder || null,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: file.size,
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

/** Uploads a folder's worth of files, one material per file. One file's failure never stops the rest. */
export async function uploadMaterials(
  files: File[],
  base: Omit<UploadMaterialInput, 'file' | 'title'> & { title: (file: File, index: number) => string },
  onProgress?: (done: number, total: number) => void,
): Promise<BulkUploadResult> {
  const result: BulkUploadResult = { uploaded: [], failed: [] };

  // Sequential on purpose: parallel uploads of large files saturate the connection.
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

export interface OpenedMaterial {
  /** Blob URL. The caller owns it and must `URL.revokeObjectURL` it. */
  url: string;
  /** What came back, which is not always what was uploaded: an image arrives as a PDF. */
  type: string;
  /** Present only for text, already decoded — the reader needs the string, not the blob. */
  text?: string;
}

/**
 * Opens a material through the edge function, the only path to the bytes. What
 * comes back depends on the file: a PDF or an image is a watermarked PDF, text
 * is itself, and anything else is the stored file for the browser to save.
 */
export async function openMaterial(materialId: string): Promise<OpenedMaterial> {
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
    // The function answers with JSON on failure and the file on success.
    const message = await response.json().catch(() => null);
    throw new Error(message?.error ?? 'Could not open this material.');
  }

  const blob = await response.blob();
  const type = response.headers.get('Content-Type') ?? blob.type;
  return {
    url: URL.createObjectURL(blob),
    type,
    text: type.startsWith('text/') ? await blob.text() : undefined,
  };
}

/** Saves a material to the visitor's device. Only for files no reader can show. */
export async function downloadMaterial(material: Material): Promise<void> {
  const opened = await openMaterial(material.id);
  try {
    const link = document.createElement('a');
    link.href = opened.url;
    link.download = `${material.title}.${extensionOf(material.storage_path) || 'file'}`;
    link.click();
  } finally {
    URL.revokeObjectURL(opened.url);
  }
}
