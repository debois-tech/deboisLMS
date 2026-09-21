// Run: node src/lib/utils/curriculum.check.ts
import { childMap, diffSummary, layoutTree, nextPosition, nextStatus, progressOf, removeSubtree } from './curriculum.ts';

const must = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};

const tree = [
  { id: 'm', parent_id: null, kind: 'module' as const, title: 'Linux', position: 0 },
  { id: 't1', parent_id: 'm', kind: 'topic' as const, title: 'Commands', position: 0 },
  { id: 't2', parent_id: 'm', kind: 'topic' as const, title: 'Users', position: 1 },
  { id: 's1', parent_id: 't1', kind: 'subtopic' as const, title: 'chmod', position: 0 },
  { id: 's2', parent_id: 't1', kind: 'subtopic' as const, title: 'sudo', position: 1 },
];

for (const editable of [false, true]) {
  const slots = layoutTree(childMap(tree), editable);
  const seen = new Set(slots.map((s) => `${s.x}:${s.y}`));
  must(seen.size === slots.length, `slots overlap (editable=${editable})`);
  must(slots.some((s) => s.ghost) === editable, 'ghosts only while editing');
}

const at = new Map(layoutTree(childMap(tree), true).map((s) => [s.id, s]));
must(at.get('m')!.y < at.get('t1')!.y && at.get('t1')!.y < at.get('s1')!.y && at.get('s1')!.y < at.get('s2')!.y, 'stacked downward');
must(at.get('m')!.x < at.get('t1')!.x && at.get('t1')!.x < at.get('s1')!.x, 'each level indented');
must(at.get('ghost:root')!.x > at.get('m')!.x && at.get('ghost:root')!.y === at.get('m')!.y + 21, 'next-module + sits beside the last module');

must(nextStatus('todo') === 'done' && nextStatus('done') === 'skipped' && nextStatus('skipped') === 'todo', 'cycle');
must(progressOf([{ status: 'done' }, { status: 'skipped' }, { status: 'todo' }]).done === 1, 'only done counts');
must(removeSubtree(tree, 't1').length === 2, 'subtree removed with its children');
must(nextPosition(tree, 'm') === 2 && nextPosition(tree, 's1') === 0 && nextPosition(tree, null) === 1, 'new sibling goes last');

const after = [...removeSubtree(tree, 't2'), { id: 'x', parent_id: 'm', kind: 'topic' as const, title: 'New', position: 2 }];
const diff = diffSummary(tree, after);
must(diff.added.length === 1 && diff.removed.length === 1 && diff.renamed.length === 0, 'diff counts');

console.log('curriculum ok');
