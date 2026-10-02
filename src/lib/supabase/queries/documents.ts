import { supabase } from '../client';
import { ok } from './result';
import type { Batch, BatchStudentMapping, DocumentKind, Student } from '@/lib/types';
import { fromDateValue } from '@/lib/utils/date';
import { buildDocumentPdf, type DocumentAssets } from '@/lib/utils/documents';
import regularFont from '@/assets/fonts/manrope-400.woff?url';
import mediumFont from '@/assets/fonts/manrope-500.woff?url';
import boldFont from '@/assets/fonts/manrope-700.woff?url';

// The company letterhead both documents are drawn on, hosted where the HTML templates already point.
const LETTERHEAD_URL = 'https://res.cloudinary.com/uxbtmcpx/image/upload/v1790672578/Copy_of_Official_Letterhead.png';

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
const NAMES: Record<DocumentKind, string> = { offer_letter: 'Offer-Letter', cert: 'Internship-Certificate' };

const fetchBytes = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url.split('/').pop()}`);
  return new Uint8Array(await response.arrayBuffer());
};

// Fonts and letterhead are fetched once per session, and again after a failure.
let assets: Promise<DocumentAssets> | undefined;
function loadAssets(): Promise<DocumentAssets> {
  assets ??= Promise.all([fetchBytes(regularFont), fetchBytes(mediumFont), fetchBytes(boldFont), fetchBytes(LETTERHEAD_URL)])
    .then(([regular, medium, bold, letterhead]) => ({ regular, medium, bold, letterhead }))
    .catch((err) => {
      assets = undefined;
      throw err;
    });
  return assets;
}

/**
 * One document, drawn from the student's own data and stored under the enrolment. Always on an admin's click: nothing
 * is generated when a student is enrolled, and each new student needs their own click. Every date comes from
 * the batch: the student's internship start and end date, which default to the batch's start and end date. Every later
 * view, download or email reads the stored copy back.
 */
export async function generateAndStoreDocument(
  kind: DocumentKind,
  mapping: BatchStudentMapping,
  student: Student,
  batch: Batch,
): Promise<Pick<BatchStudentMapping, 'offer_letter_path' | 'cert_path'>> {
  if (!student.internship_role) throw new Error(`Set ${student.name}'s internship role first (Edit student).`);
  const day = (value?: string | null) => (value ? fromDateValue(value.slice(0, 10)) : null);
  const startOn = day(student.internship_start_date) ?? day(batch.start_date) ?? day(mapping.joined_at) ?? new Date();
  const endOn = day(student.internship_end_date) ?? day(batch.ended_at);
  if (kind === 'cert' && !endOn) throw new Error(`${student.name} has no internship end date: end the batch, or set it on Edit student.`);

  const bytes = await buildDocumentPdf(
    kind,
    {
      name: student.name.trim(),
      code: student.student_code ?? '',
      role: student.internship_role,
      startOn,
      endOn: endOn ?? undefined,
    },
    await loadAssets(),
  );
  const file = new File([bytes as BlobPart], `${NAMES[kind]}-${student.student_code ?? student.id}.pdf`, { type: 'application/pdf' });

  const path = `${mapping.id}/${kind}.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`Could not store the ${kind === 'offer_letter' ? 'offer letter' : 'certificate'}: ${error.message}`);

  const patch = { [PATH_COLUMN[kind]]: path };
  ok(await supabase.from('batch_student_mapping').update(patch).eq('id', mapping.id), 'The document was stored but the record could not be updated');
  return patch;
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
