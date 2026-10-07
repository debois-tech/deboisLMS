import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import { ok, rows } from './result';

export type FailureKind = 'cleanup' | 'document_email' | 'csv_import' | 'login_create';

export interface ActionFailure {
  id: string;
  kind: FailureKind;
  detail: string;
  created_at: string;
}

export interface ExpiringStudent {
  student_id: string;
  student_name: string;
  student_code: string;
  batch_name: string | null;
  ended_on: string | null;
  delete_on: string;
  owed: number;
  docs_made: number;
  docs_shared: number;
}

export const NOTICES_CHANGED = 'notices-changed';

export async function getExpiringStudents(): Promise<ExpiringStudent[]> {
  return rows<ExpiringStudent>(await supabase.rpc('expiring_students'), 'Could not load expiring accounts');
}

export async function getFailures(): Promise<ActionFailure[]> {
  return rows<ActionFailure>(
    await supabase.from('action_failures').select('*').order('created_at', { ascending: false }).limit(50),
    'Could not load failed actions',
  );
}

// Best effort: a failure to record a failure must never hide the original error
export async function logFailures(kind: FailureKind, details: string[]): Promise<void> {
  if (details.length === 0) return;
  const { error } = await supabase.from('action_failures').insert(details.map((detail) => ({ kind, detail })));
  if (error) console.error('[logFailures]', error);
  else window.dispatchEvent(new Event(NOTICES_CHANGED));
}

export async function clearFailures(): Promise<void> {
  ok(await supabase.from('action_failures').delete().not('id', 'is', null), 'Could not clear the failed actions');
  window.dispatchEvent(new Event(NOTICES_CHANGED));
}

// Batches with a curriculum submission waiting; a tutor sees only their own through RLS
export async function getPendingCurriculum(): Promise<{ batch_id: string; name: string }[]> {
  type Request = { batch_id: string; batch: { name: string } | null };
  const requests = rows<Request>(
    (await supabase.from('curriculum_requests').select('batch_id, batch:batches(name)').eq('status', 'pending')) as unknown as { data: Request[] | null; error: PostgrestError | null },
    'Could not load curriculum submissions',
  );
  return [...new Map(requests.map((r) => [r.batch_id, { batch_id: r.batch_id, name: r.batch?.name ?? 'Batch' }])).values()];
}
