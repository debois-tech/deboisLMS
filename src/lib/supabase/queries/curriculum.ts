import { supabase } from '../client';
import { maybeRow, ok, rows } from './result';
import { NOTICES_CHANGED } from './notices';
import type { BatchBadge, CurriculumDraftNode, CurriculumNode, CurriculumRequest, CurriculumStatus } from '@/lib/types';

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
  window.dispatchEvent(new Event(NOTICES_CHANGED));
}

// Topics done over topics, per batch (just one when given). A batch without topics is absent.
// Paged, because the API hands back at most 1000 rows a call.
export async function getCurriculumProgress(batchId?: string): Promise<Map<string, { done: number; total: number }>> {
  const PAGE = 1000;
  const progress = new Map<string, { done: number; total: number }>();
  for (let from = 0; ; from += PAGE) {
    const base = supabase.from('curriculum_nodes').select('batch_id, status').eq('kind', 'topic');
    const page = rows<{ batch_id: string; status: CurriculumStatus }>(
      await (batchId ? base.eq('batch_id', batchId) : base).order('id').range(from, from + PAGE - 1),
      'Could not load curriculum progress',
    );
    for (const { batch_id, status } of page) {
      const entry = progress.get(batch_id) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (status === 'done') entry.done += 1;
      progress.set(batch_id, entry);
    }
    if (page.length < PAGE) return progress;
  }
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

// Each card's attached badges, for one batch
export async function getNodeBadges(batchId: string): Promise<Map<string, BatchBadge[]>> {
  const list = rows<{ node_id: string; badge: BatchBadge }>(
    await supabase.from('curriculum_node_badges').select('node_id, badge:batch_badges!inner(*)').eq('badge.batch_id', batchId).returns<{ node_id: string; badge: BatchBadge }[]>(),
    'Could not load the badges',
  );
  const byNode = new Map<string, BatchBadge[]>();
  for (const { node_id, badge } of list) byNode.set(node_id, [...(byNode.get(node_id) ?? []), badge]);
  return byNode;
}

// Replaces the card's badges with these; only the card's own batch's badges are accepted
export async function setNodeBadges(nodeId: string, badgeIds: string[]): Promise<void> {
  ok(await supabase.rpc('set_node_badges', { p_node: nodeId, p_badges: badgeIds }), 'Could not save the badges');
  window.dispatchEvent(new Event(NOTICES_CHANGED));
}

export interface BadgeTask {
  batch_id: string;
  batch_name: string;
  badge_id: string;
  badge_name: string;
  node_title: string;
}

// The signed-in tutor's badges waiting to be awarded: the card is done and nobody holds the badge yet
export async function getBadgeTasks(): Promise<BadgeTask[]> {
  return rows<BadgeTask>(await supabase.rpc('badges_to_award'), 'Could not load the badges to award');
}
