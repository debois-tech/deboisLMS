import { supabase } from '../client';
import { maybeRow, ok, rows } from './result';
import type { CurriculumDraftNode, CurriculumNode, CurriculumRequest, CurriculumStatus } from '@/lib/types';

export async function getCurriculumNodes(batchId: string): Promise<CurriculumNode[]> {
  return rows<CurriculumNode>(
    await supabase
      .from('curriculum_nodes')
      .select('id, batch_id, parent_id, kind, title, position, status, done_on')
      .eq('batch_id', batchId)
      .order('position'),
    'Could not load the curriculum',
  );
}

/** The newest submission, whatever its outcome: pending locks the tutor, denied earns a banner. */
export async function getLatestCurriculumRequest(batchId: string): Promise<CurriculumRequest | undefined> {
  return maybeRow<CurriculumRequest>(
    await supabase
      .from('curriculum_requests')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'Could not load the curriculum submission',
  );
}

/** Admin: the draft goes live at once. */
export async function saveCurriculum(batchId: string, nodes: CurriculumDraftNode[]): Promise<void> {
  ok(await supabase.rpc('save_curriculum', { p_batch: batchId, p_nodes: nodes }), 'Could not save the curriculum');
}

/** Tutor: the draft waits for an admin. */
export async function proposeCurriculum(batchId: string, nodes: CurriculumDraftNode[]): Promise<void> {
  ok(await supabase.rpc('propose_curriculum', { p_batch: batchId, p_nodes: nodes }), 'Could not submit the curriculum');
}

export async function reviewCurriculum(requestId: string, approve: boolean): Promise<void> {
  ok(await supabase.rpc('review_curriculum', { p_request: requestId, p_approve: approve }), 'Could not record the decision');
}

/** Sending 'done' again with a new date moves the day it was taught. */
export async function setCurriculumStatus(nodeId: string, status: CurriculumStatus, doneOn?: string): Promise<void> {
  ok(
    await supabase.rpc('set_curriculum_status', { p_node: nodeId, p_status: status, p_done_on: doneOn ?? null }),
    'Could not update the topic',
  );
}

export interface CurriculumOverview {
  /** Per batch: done modules over all modules. Absent = no curriculum yet. */
  progress: Map<string, { done: number; total: number }>;
  /** Batches with a tutor submission waiting for an admin. */
  pending: Set<string>;
}

/** The list page's one round trip: module progress and waiting submissions for every visible batch. */
export async function getCurriculumOverview(): Promise<CurriculumOverview> {
  const [modules, pending] = await Promise.all([
    supabase.from('curriculum_nodes').select('batch_id, status').eq('kind', 'module'),
    supabase.from('curriculum_requests').select('batch_id').eq('status', 'pending'),
  ]);

  const progress = new Map<string, { done: number; total: number }>();
  for (const { batch_id, status } of rows<{ batch_id: string; status: CurriculumStatus }>(modules, 'Could not load curriculum progress')) {
    const entry = progress.get(batch_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (status === 'done') entry.done += 1;
    progress.set(batch_id, entry);
  }

  return {
    progress,
    pending: new Set(rows<{ batch_id: string }>(pending, 'Could not load curriculum submissions').map((row) => row.batch_id)),
  };
}
