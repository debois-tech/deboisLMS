// Run: node src/lib/utils/curriculum.check.ts
import { averageProgress, childMap, countBelow, diffSummary, filterTree, layoutTree, nextPosition, nextStatus, progressOf, removeSubtree } from './curriculum.ts';

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
must(at.get('m')!.y < at.get('t1')!.y && at.get('t1')!.y < at.get('t2')!.y, 'topics stack downward under their module');
must(at.get('s1')!.x > at.get('t1')!.x + 300 && at.get('s2')!.x === at.get('s1')!.x, 'subtopics stand in a column to the right of their topic');
must(at.get('s1')!.y < at.get('s2')!.y, 'and stack downward');
const view = new Map(layoutTree(childMap(tree), false).map((s) => [s.id, s]));
must(Math.abs((view.get('s1')!.y + view.get('s2')!.y + 84) / 2 - (view.get('t1')!.y + 42)) < 1, 'the column is centred on its topic');
must(view.get('t2')!.y >= view.get('s2')!.y + 84, 'a topic with subtopics makes its row taller, so the next topic stays clear of them');
must(at.get('t2')!.y >= at.get('ghost:t1')!.y + 42, 'and while editing, clear of the + as well');
must(at.get('m')!.x < at.get('t1')!.x, 'topics are indented from their module');
must(at.get('ghost:root')!.x > at.get('s1')!.x && at.get('ghost:root')!.y === at.get('m')!.y + 21, 'next-module + sits after the widest column');
must(at.get('ghost:t1')!.x === at.get('s1')!.x && at.get('ghost:t1')!.y > at.get('s2')!.y, 'the subtopic + closes its column');

// Columns are as wide as they need to be: a second module sits nearer when the first has no subtopics.
const two = (withSubs: boolean) => {
  const nodes = [
    { id: 'a', parent_id: null, kind: 'module' as const, title: 'A', position: 0 },
    { id: 'at', parent_id: 'a', kind: 'topic' as const, title: 'T', position: 0 },
    ...(withSubs ? [{ id: 'as', parent_id: 'at', kind: 'subtopic' as const, title: 'S', position: 0 }] : []),
    { id: 'b', parent_id: null, kind: 'module' as const, title: 'B', position: 1 },
  ];
  return new Map(layoutTree(childMap(nodes), false).map((s) => [s.id, s])).get('b')!.x;
};
must(two(true) > two(false), 'a module with subtopics gets a wider column');

must(nextStatus('todo') === 'done' && nextStatus('done') === 'skipped' && nextStatus('skipped') === 'todo', 'cycle');
must(progressOf([{ status: 'done' }, { status: 'skipped' }, { status: 'todo' }]).done === 1, 'only done counts');
must(removeSubtree(tree, 't1').length === 2, 'subtree removed with its children');
must(nextPosition(tree, 'm') === 2 && nextPosition(tree, 's1') === 0 && nextPosition(tree, null) === 1, 'new sibling goes last');

const after = [...removeSubtree(tree, 't2'), { id: 'x', parent_id: 'm', kind: 'topic' as const, title: 'New', position: 2 }];
const diff = diffSummary(tree, after);
must(diff.added.length === 1 && diff.removed.length === 1 && diff.renamed.length === 0, 'diff counts');


// Folding: a folded module keeps its own slot and drops everything below; a folded topic drops only its subtopics.
const foldedModule = layoutTree(childMap(tree), false, new Set(['m']));
must(foldedModule.map((s) => s.id).sort().join() === 'm,root', 'folded module hides its whole branch');
const foldedTopic = layoutTree(childMap(tree), false, new Set(['t1'])).map((s) => s.id);
must(foldedTopic.includes('t1') && foldedTopic.includes('t2') && !foldedTopic.includes('s1'), 'folded topic hides only its subtopics');
must(!layoutTree(childMap(tree), true, new Set(['m'])).some((s) => s.id === 'ghost:m'), 'no add button inside a folded branch');
must(countBelow(childMap(tree), 'm') === 4 && countBelow(childMap(tree), 't1') === 2, 'descendants counted at every depth');

// Filtering: matches keep their ancestors, a parent is judged by its own box, skipped is not done.
const marked = tree.map((n) => ({ ...n, status: n.id === 's1' ? ('done' as const) : n.id === 't2' ? ('skipped' as const) : ('todo' as const) }));
must(filterTree(marked, 'all') === marked, 'all is untouched');
must(filterTree(marked, 'done').map((n) => n.id).join() === 'm,t1,s1', 'done: the match plus its parents, nothing else');
must(filterTree(marked, 'todo').map((n) => n.id).join() === 'm,t1,t2,s2', 'not done: todo and skipped, with parents');
must(filterTree(tree.map((n) => ({ ...n, status: 'todo' as const })), 'done').length === 0, 'nothing done: nothing shown');
// Dashboard average: per batch, then averaged; empty curricula do not count.
const prog = new Map([['a', { done: 1, total: 4 }], ['b', { done: 3, total: 3 }], ['c', { done: 0, total: 0 }]]);
must(averageProgress(prog, ['a', 'b'])!.percent === 63 && averageProgress(prog, ['a', 'b'])!.batches === 2, 'batches weigh the same, 25% and 100% average to 63%');
must(averageProgress(prog, ['c', 'zzz']) === null, 'no curriculum anywhere: no average');
console.log('curriculum ok');
