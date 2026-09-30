import type { CurriculumDraftNode, CurriculumKind, CurriculumNode, CurriculumStatus } from '@/lib/types';

export const CHILD_KIND: Record<CurriculumKind, CurriculumKind | null> = {
  module: 'topic',
  topic: 'subtopic',
  subtopic: null,
};

type Linked = { id: string; parent_id: string | null; position?: number };

/** Children per parent (`null` = the modules), in position order; ties keep array order. */
export function childMap<T extends Linked>(nodes: T[]): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>();
  for (const node of nodes) {
    const list = map.get(node.parent_id) ?? [];
    list.push(node);
    map.set(node.parent_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return map;
}

/** Empty, then done, then skipped, then back to empty. */
export function nextStatus(status: CurriculumStatus): CurriculumStatus {
  return status === 'todo' ? 'done' : status === 'done' ? 'skipped' : 'todo';
}

export type CurriculumFilter = 'all' | 'done' | 'todo';

// Matches keep their ancestors for context; a parent is judged by its own box, and skipped counts as not done.
export function filterTree<T extends Linked & { status: CurriculumStatus }>(nodes: T[], filter: CurriculumFilter): T[] {
  if (filter === 'all') return nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const keep = new Set<string>();
  for (const node of nodes) {
    if ((node.status === 'done') !== (filter === 'done')) continue;
    for (let at: T | undefined = node; at && !keep.has(at.id); at = at.parent_id ? byId.get(at.parent_id) : undefined) keep.add(at.id);
  }
  return nodes.filter((node) => keep.has(node.id));
}

// Everything under a node, however deep: what a folded card hides.
export function countBelow(byParent: Map<string | null, Linked[]>, id: string): number {
  return (byParent.get(id) ?? []).reduce((sum, kid) => sum + 1 + countBelow(byParent, kid.id), 0);
}

// Each batch counts once, whatever its size; batches with no curriculum yet are left out.
export function averageProgress(
  progress: Map<string, { done: number; total: number }>,
  batchIds: string[],
): { percent: number; batches: number } | null {
  const shares = batchIds.flatMap((id) => {
    const entry = progress.get(id);
    return entry && entry.total > 0 ? [entry.done / entry.total] : [];
  });
  return shares.length ? { percent: Math.round((100 * shares.reduce((sum, share) => sum + share, 0)) / shares.length), batches: shares.length } : null;
}

/** Only done counts: a skipped child keeps the bar below full. */
export function progressOf(kids: { status: CurriculumStatus }[]): { done: number; total: number } {
  return { done: kids.filter((kid) => kid.status === 'done').length, total: kids.length };
}

export function doneByDate(nodes: CurriculumNode[]): Map<string, CurriculumNode[]> {
  const map = new Map<string, CurriculumNode[]>();
  for (const node of nodes) {
    if (node.status !== 'done' || !node.done_on) continue;
    map.set(node.done_on, [...(map.get(node.done_on) ?? []), node]);
  }
  return map;
}

export function toDraft(nodes: CurriculumNode[]): CurriculumDraftNode[] {
  return nodes.map(({ id, parent_id, kind, title, position }) => ({ id, parent_id, kind, title, position }));
}

/** A new sibling lands last; gaps left by deletes are harmless, only the order is read. */
export function nextPosition(draft: CurriculumDraftNode[], parentId: string | null): number {
  return Math.max(-1, ...draft.filter((node) => node.parent_id === parentId).map((node) => node.position)) + 1;
}

export function removeSubtree<T extends Linked>(nodes: T[], id: string): T[] {
  const gone = new Set([id]);
  // One pass per level is enough: depth is three.
  for (let pass = 0; pass < 3; pass += 1) {
    for (const node of nodes) if (node.parent_id && gone.has(node.parent_id)) gone.add(node.id);
  }
  return nodes.filter((node) => !gone.has(node.id));
}

export function diffSummary(before: CurriculumDraftNode[], after: CurriculumDraftNode[]) {
  const was = new Map(before.map((node) => [node.id, node]));
  const now = new Map(after.map((node) => [node.id, node]));
  return {
    added: after.filter((node) => !was.has(node.id)),
    removed: before.filter((node) => !now.has(node.id)),
    renamed: after.filter((node) => was.has(node.id) && was.get(node.id)!.title !== node.title),
  };
}

export interface Slot {
  /** `ghost:<parent id or root>` for an add button. */
  id: string;
  /** Pixels from the top-left of the canvas. */
  x: number;
  y: number;
  ghost?: { parentId: string | null; kind: CurriculumKind };
}

/** Pixels. A card is CARD_W x CARD_H (a subtopic SUB_W wide); a ghost (the "+") is GHOST square. */
const CARD_W = 300;
const SUB_W = 260;
const CARD_H = 84;
const GHOST = 42;
// Topics sit this far in from their module's edge, leaving room for the stem down the side.
const INDENT = 48;
// Between a topic and the column of its subtopics.
const SUB_GAP = 88;
const MODULE_GAP = 96;
// One topic with nothing beside it: the card plus the air under it.
const ROW = 108;
const SUB_ROW = 96;
const GHOST_GAP = 12;
const MODULE_Y = 132;

/**
 * Batch card on top, modules in a row under it. A module's topics stack below it; a topic's subtopics stand in a
 * column to its right, centred on it, like the branches of an org chart. So a topic's row grows with its subtopics
 * and a module's column is only as wide as it needs to be. While editing, a "+" ends every column and one sits after
 * the last module. A folded node keeps its own slot and gives up everything below it.
 */
export function layoutTree(
  byParent: Map<string | null, (Linked & { kind: CurriculumKind })[]>,
  editable: boolean,
  folded: ReadonlySet<string> = new Set(),
): Slot[] {
  const slots: Slot[] = [];
  const modules = byParent.get(null) ?? [];
  const centres: number[] = [];
  let x = 0;

  for (const module of modules) {
    slots.push({ id: module.id, x, y: MODULE_Y });
    centres.push(x + CARD_W / 2);
    let width = CARD_W;
    let y = MODULE_Y + CARD_H + 24;

    if (!folded.has(module.id)) {
      const topics = byParent.get(module.id) ?? [];
      const subsOf = (topic: Linked) => (folded.has(topic.id) ? [] : byParent.get(topic.id) ?? []);
      // Subtopics show unless their topic is folded; while editing, a topic with none still shows its "+".
      const wantsSubs = (topic: Linked) => !folded.has(topic.id) && (editable || subsOf(topic).length > 0);
      const subX = x + INDENT + CARD_W + SUB_GAP;
      if (topics.some(wantsSubs)) width = INDENT + CARD_W + SUB_GAP + SUB_W;
      else if (topics.length > 0 || editable) width = INDENT + CARD_W;

      for (const topic of topics) {
        const subs = subsOf(topic);
        const withGhost = wantsSubs(topic) && editable;
        const block = subs.length > 0
          ? (subs.length - 1) * SUB_ROW + CARD_H + (withGhost ? GHOST_GAP + GHOST : 0)
          : withGhost ? GHOST : 0;
        const rowHeight = Math.max(ROW, block + 24);
        // A tall row centres its topic; the column of subtopics is centred on the same line.
        const top = y + (rowHeight - ROW) / 2;
        slots.push({ id: topic.id, x: x + INDENT, y: top });
        const blockTop = top + CARD_H / 2 - block / 2;
        subs.forEach((sub, index) => slots.push({ id: sub.id, x: subX, y: blockTop + index * SUB_ROW }));
        if (withGhost) {
          slots.push({
            id: `ghost:${topic.id}`,
            x: subX,
            y: subs.length > 0 ? blockTop + block - GHOST : blockTop,
            ghost: { parentId: topic.id, kind: 'subtopic' },
          });
        }
        y += rowHeight;
      }
      if (editable) slots.push({ id: `ghost:${module.id}`, x: x + INDENT, y, ghost: { parentId: module.id, kind: 'topic' } });
    }
    x += width + MODULE_GAP;
  }

  if (editable) {
    slots.push({
      id: 'ghost:root',
      x: x + (CARD_W - GHOST) / 2,
      y: MODULE_Y + (CARD_H - GHOST) / 2,
      ghost: { parentId: null, kind: 'module' },
    });
    centres.push(x + CARD_W / 2);
  }
  const first = centres[0] ?? CARD_W / 2;
  const last = centres[centres.length - 1] ?? first;
  slots.push({ id: 'root', x: (first + last) / 2 - CARD_W / 2, y: 0 });
  return slots;
}
