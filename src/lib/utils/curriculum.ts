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

/** Pixels. A card is CARD_W x CARD_H; a ghost (the "+") is GHOST square. */
const CARD_W = 300;
const CARD_H = 84;
const GHOST = 42;
const COL = 400;
const INDENT = 24;
const ROW = 108;
const GHOST_ROW = 72;
const MODULE_Y = 132;

/**
 * Batch card on top, modules in a row under it. Each module owns a column: its topics stack below it,
 * a topic's subtopics below that, each level indented. While editing, a "+" ends every stack and
 * one sits after the last module.
 */
export function layoutTree(byParent: Map<string | null, (Linked & { kind: CurriculumKind })[]>, editable: boolean): Slot[] {
  const slots: Slot[] = [];
  const modules = byParent.get(null) ?? [];

  modules.forEach((module, index) => {
    const x = index * COL;
    slots.push({ id: module.id, x, y: MODULE_Y });
    let y = MODULE_Y + ROW;

    const stack = (parentId: string, kind: CurriculumKind, level: number) => {
      for (const node of byParent.get(parentId) ?? []) {
        slots.push({ id: node.id, x: x + INDENT * level, y });
        y += ROW;
        const below = CHILD_KIND[node.kind];
        if (below) stack(node.id, below, level + 1);
      }
      if (editable) {
        slots.push({ id: `ghost:${parentId}`, x: x + INDENT * level, y, ghost: { parentId, kind } });
        y += GHOST_ROW;
      }
    };
    stack(module.id, 'topic', 1);
  });

  const columns = modules.length + (editable ? 1 : 0);
  if (editable) {
    slots.push({
      id: 'ghost:root',
      x: modules.length * COL + (CARD_W - GHOST) / 2,
      y: MODULE_Y + (CARD_H - GHOST) / 2,
      ghost: { parentId: null, kind: 'module' },
    });
  }
  slots.push({ id: 'root', x: (Math.max(columns, 1) - 1) * COL / 2, y: 0 });
  return slots;
}
