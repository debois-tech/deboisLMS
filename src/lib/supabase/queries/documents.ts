import { supabase } from '../client';
import { ok } from './result';
import type { Batch, BatchStudentMapping, DocumentKind, Student } from '@/lib/types';
import { generateDocumentPdf } from '@/lib/utils/documents';

const BUCKET = 'documents';

const SHARE_COLUMN: Record<DocumentKind, 'offer_letter_shared' | 'cert_shared'> = {
  offer_letter: 'offer_letter_shared',
  cert: 'cert_shared',
};
const SHARED_AT_COLUMN: Record<DocumentKind, 'offer_letter_shared_at' | 'cert_shared_at'> = {
  offer_letter: 'offer_letter_shared_at',
  cert: 'cert_shared_at',
};
const PATH_COLUMN: Record<DocumentKind, 'offer_letter_path' | 'cert_path'> = {
  offer_letter: 'offer_letter_path',
  cert: 'cert_path',
};
const KINDS: DocumentKind[] = ['offer_letter', 'cert'];

/**
 * Generated once — right when the mapping row is created (see addStudentToBatch) — and stored, so
 * every later view, download or email just reads this same copy back.
 */
export async function generateAndStoreDocuments(
  mapping: BatchStudentMapping,
  student: Student,
  batch: Batch,
): Promise<Pick<BatchStudentMapping, 'offer_letter_path' | 'cert_path'>> {
  const patch: Partial<Record<'offer_letter_path' | 'cert_path', string>> = {};

  for (const kind of KINDS) {
    const file = await generateDocumentPdf(kind, student, batch);
    const path = `${mapping.id}/${kind}.pdf`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true });
    if (error) throw new Error(`Could not store the ${kind === 'offer_letter' ? 'offer letter' : 'certificate'}: ${error.message}`);
    patch[PATH_COLUMN[kind]] = path;
  }

  ok(
    await supabase.from('batch_student_mapping').update(patch).eq('id', mapping.id),
    'The documents were stored but the record could not be updated',
  );

  return patch as Pick<BatchStudentMapping, 'offer_letter_path' | 'cert_path'>;
}

type SharePatch = Pick<BatchStudentMapping, 'offer_letter_shared' | 'cert_shared' | 'offer_letter_shared_at' | 'cert_shared_at'>;

export async function setDocumentShared(mappingId: string, kind: DocumentKind, shared: boolean): Promise<SharePatch> {
  const patch: Record<string, boolean | string> = { [SHARE_COLUMN[kind]]: shared };
  // Only set on the way to true — un-sharing keeps the last share date rather than clearing it.
  if (shared) patch[SHARED_AT_COLUMN[kind]] = new Date().toISOString();

  ok(
    await supabase.from('batch_student_mapping').update(patch).eq('id', mappingId),
    'Could not update the release',
  );

  return patch as unknown as SharePatch;
}

/** RLS enforces the shared flag on the bucket too — this is not the only gate, just the UI's. */
export async function downloadStoredDocument(path: string, filename: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error('The file is missing from storage.');
  const url = URL.createObjectURL(data);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The edge function re-reads the stored file and the shared flag itself — nothing to pass but ids. */
export async function sendDocumentEmail(studentId: string, batchId: string, kind: DocumentKind): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-document', {
    body: { student_id: studentId, batch_id: batchId, doc_type: kind },
  });

  if (error) {
    const response = (error as { context?: Response }).context;
    const detail = response && typeof response.json === 'function'
      ? await response.json().then((body: { error?: string } | null) => body?.error).catch(() => undefined)
      : undefined;
    throw new Error(detail ?? error.message ?? 'Could not send the email');
  }
  if (data?.error) throw new Error(data.error);
}
