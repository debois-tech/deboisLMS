import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  getSmoothStepPath,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useOnViewportChange,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  BookOpen, CalendarDays, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, FileText, Layers, LibraryBig, Maximize2, Minimize2, Minus,
  Pencil, Plus, Scan, Trash2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { clsx } from 'clsx';
import { QuizSegment } from '@/components/exams/QuizParts';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { CurriculumCalendar } from '@/components/curriculum/CurriculumCalendar';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import {
  getCurriculumNodes,
  getLatestCurriculumRequest,
  proposeCurriculum,
  reviewCurriculum,
  saveCurriculum,
  setCurriculumStatus,
} from '@/lib/supabase';
import type { CurriculumKind, CurriculumNode, CurriculumRequest, CurriculumStatus } from '@/lib/types';
import {
  childMap,
  countBelow,
  diffSummary,
  filterTree,
  layoutTree,
  nextPosition,
  nextStatus,
  progressOf,
  removeSubtree,
  toDraft,
  type CurriculumFilter,
  type Slot,
} from '@/lib/utils/curriculum';
import { formatDateValue, toDateValue } from '@/lib/utils/date';
import { errorMessage } from '@/lib/utils/errors';

type View = 'view' | 'edit' | 'review';

interface CardData extends Record<string, unknown> {
  node: CurriculumNode;
  done: number;
  total: number;
  view: View;
  canTick: boolean;
  isNew: boolean;
  autoFocus: boolean;
  // Cards with something under them get a fold handle; `hidden` is how many a folded one is holding back.
  foldable: boolean;
  folded: boolean;
  hidden: number;
  // Folding into its parent: drawn at the parent and faded out. Coming out of it: an offset back to the parent to start from.
  gone: boolean;
  enter: { dx: number; dy: number } | null;
  onFold: (id: string) => void;
  onCycle: (node: CurriculumNode) => void;
  onDate: (node: CurriculumNode, date: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (node: CurriculumNode) => void;
}
/** `beside`: the next-module "+", which hangs off the batch card; every other "+" ends a stack. */
interface GhostData extends Record<string, unknown> { hint: string; beside: boolean; gone: boolean; enter: { dx: number; dy: number } | null; onAdd: () => void }
interface RootData extends Record<string, unknown> { name: string; done: number; total: number }

type CardNode = Node<CardData, 'card'>;
type GhostNode = Node<GhostData, 'ghost'>;
type RootNode = Node<RootData, 'root'>;

const KIND_ICON = { module: Layers, topic: BookOpen, subtopic: FileText } as const;

function TriBox({ status, disabled, label, onClick }: { status: CurriculumStatus; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={status === 'done' ? true : status === 'skipped' ? 'mixed' : false}
      aria-label={label}
      title={disabled ? undefined : 'Click: done, again: skipped, again: clear'}
      disabled={disabled}
      onClick={onClick}
      className={clsx('cv-box nodrag', `is-${status}`)}
    >
      {status === 'done' && <Check size={14} strokeWidth={3} />}
      {status === 'skipped' && <Minus size={14} strokeWidth={3} />}
    </button>
  );
}

function RootCard({ data }: NodeProps<RootNode>) {
  return (
    <div className="cv-card cv-root">
      <Handle type="source" position={Position.Bottom} className="cv-handle" isConnectable={false} />
      <div className="cv-row">
        <LibraryBig size={18} className="cv-root-icon" aria-hidden="true" />
        <span className="cv-title">{data.name}</span>
      </div>
      <ProgressBar count done={data.done} total={data.total} label={`${data.name} overall progress`} />
    </div>
  );
}

function CurriculumCard({ data }: NodeProps<CardNode>) {
  const { node, done, total, view, canTick, isNew, autoFocus, foldable, folded, hidden, gone, enter } = data;
  const Icon = KIND_ICON[node.kind];
  const editing = view === 'edit';

  return (
    <div
      className={clsx('cv-card', `is-${node.status}`, node.kind === 'subtopic' && 'is-sub', isNew && 'is-new', gone && 'is-gone', enter && 'is-entering')}
      style={enter ? ({ '--dx': `${enter.dx}px`, '--dy': `${enter.dy}px` } as React.CSSProperties) : undefined}
    >
      <Handle type="target" position={node.kind === 'module' ? Position.Top : Position.Left} className="cv-handle" isConnectable={false} />
      {/* A module's topics hang from a stem down its side; a topic's subtopics fan out to its right. */}
      {node.kind === 'topic' ? (
        <Handle type="source" position={Position.Right} className="cv-handle" isConnectable={false} />
      ) : (
        <Handle type="source" position={Position.Bottom} className="cv-handle is-trunk" isConnectable={false} />
      )}
      <div className="cv-row">
        <TriBox
          status={node.status}
          disabled={!canTick || editing}
          label={`Mark ${node.title || node.kind} done`}
          onClick={() => data.onCycle(node)}
        />
        {editing ? (
          <input
            className="cv-input nodrag nopan nowheel"
            value={node.title}
            placeholder={`Name this ${node.kind}`}
            aria-label={`${node.kind} name`}
            maxLength={120}
            autoFocus={autoFocus}
            onChange={(event) => data.onRename(node.id, event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          />
        ) : (
          <span className={clsx('cv-title', node.status === 'skipped' && 'is-skipped')} title={node.title}>{node.title}</span>
        )}
        {editing ? (
          <button type="button" className="cv-icon-btn nodrag" aria-label={`Remove ${node.title || node.kind}`} onClick={() => data.onRemove(node)}>
            <Trash2 size={15} />
          </button>
        ) : (
          <Icon size={15} className="cv-kind-icon" aria-hidden="true" />
        )}
      </div>
      <div className="cv-row cv-row-foot">
        {total > 0 ? (
          <ProgressBar count done={done} total={total} label={`${node.title} progress`} />
        ) : node.status === 'done' && node.done_on ? (
          canTick && !editing ? (
            <DatePicker value={node.done_on} clearable={false} max={toDateValue(new Date())} ariaLabel={`Date ${node.title} was taught`} className="cv-date nodrag" onChange={(date) => date && data.onDate(node, date)} />
          ) : (
            <span className="cv-muted">Done {formatDateValue(node.done_on)}</span>
          )
        ) : (
          <span className="cv-muted">{node.status === 'skipped' ? 'Skipped' : 'Not started'}</span>
        )}
        {isNew && <span className="cv-new">New</span>}
      </div>
      {foldable && (
        <button
          type="button"
          className={clsx('cv-fold nodrag', node.kind === 'topic' && 'is-side', folded && 'is-folded')}
          aria-expanded={!folded}
          aria-label={folded ? `Show ${hidden} ${hidden === 1 ? 'item' : 'items'} under ${node.title || node.kind}` : `Hide what is under ${node.title || node.kind}`}
          onClick={() => data.onFold(node.id)}
        >
          <ChevronDown size={13} strokeWidth={2.5} aria-hidden="true" />
          {folded && <span>{hidden}</span>}
        </button>
      )}
    </div>
  );
}

function GhostAdd({ data }: NodeProps<GhostNode>) {
  return (
    <button
      type="button"
      className={clsx('cv-ghost nodrag', data.gone && 'is-gone', data.enter && 'is-entering')}
      style={data.enter ? ({ '--dx': `${data.enter.dx}px`, '--dy': `${data.enter.dy}px` } as React.CSSProperties) : undefined}
      data-hint={data.hint} aria-label={data.hint} onClick={data.onAdd}>
      <Handle type="target" position={data.beside ? Position.Top : Position.Left} className="cv-handle" isConnectable={false} />
      <Plus size={18} />
    </button>
  );
}

const nodeTypes = { root: RootCard, card: CurriculumCard, ghost: GhostAdd };

// Every connector is square with rounded corners: siblings share one stem or spine, and each branch sweeps off it
// through an arc of its own size (fixed per branch, so it never shifts), which keeps the tree one drawing but not a
// ruled one.
function BranchEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style }: EdgeProps) {
  const seed = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 7);
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 20 + (seed % 17) });
  return <BaseEdge path={path} style={style} />;
}

const edgeTypes = { branch: BranchEdge };

type Role = 'admin' | 'tutor' | 'student';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.6;
const FIT = { padding: 0.25, maxZoom: 1 };

// Code-driven camera moves take their time; a reader who asked for less motion gets the same moves at once.
const ms = (n: number) => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : n);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

// The camera. Wheel zoom is eased and anchored on the cursor, a drag glides on after release, and the
// buttons animate. `fitTick` re-frames the whole tree after a change that reshapes it.
function CanvasCamera({ fitTick, boxRef }: { fitTick: number; boxRef: React.RefObject<HTMLDivElement | null> }) {
  const { getViewport, setViewport, zoomIn, zoomOut, fitView } = useReactFlow();
  const aim = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const lastWheel = useRef(0);
  // True while a move was started by code, so it never earns a glide of its own.
  const scripted = useRef(false);
  const trail = useRef<{ t: number; x: number; y: number; zoom: number }[]>([]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('.nowheel, .cv-calendar-slot, .cv-toolbar')) return;
      event.preventDefault();
      const now = performance.now();
      // Rapid ticks build on where the last one is heading, not on where the camera happens to be mid-glide.
      const from = aim.current && now - lastWheel.current < 300 ? aim.current : getViewport();
      lastWheel.current = now;
      const delta = event.deltaY * (event.deltaMode === 1 ? 33 : 1);
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from.zoom * Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0018))));
      const rect = box.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const k = zoom / from.zoom;
      aim.current = { x: px - (px - from.x) * k, y: py - (py - from.y) * k, zoom };
      scripted.current = true;
      void setViewport(aim.current, { duration: ms(140), ease: (t) => t });
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [boxRef, getViewport, setViewport]);

  useOnViewportChange({
    onStart: () => { trail.current = []; },
    onChange: (view) => {
      const t = performance.now();
      trail.current.push({ t, ...view });
      while (trail.current.length > 1 && t - trail.current[0].t > 100) trail.current.shift();
    },
    onEnd: (view) => {
      const [first] = trail.current;
      const last = trail.current[trail.current.length - 1];
      trail.current = [];
      if (scripted.current) {
        scripted.current = false;
        return;
      }
      // Released while still moving, and it was a pan rather than a zoom.
      if (!first || !last || last.t === first.t || performance.now() - last.t > 60 || Math.abs(last.zoom - first.zoom) > 0.001) return;
      const vx = (last.x - first.x) / (last.t - first.t);
      const vy = (last.y - first.y) / (last.t - first.t);
      const speed = Math.hypot(vx, vy);
      if (speed < 0.3) return;
      const reach = Math.min(speed, 3) * 260;
      scripted.current = true;
      void setViewport({ x: view.x + (vx / speed) * reach, y: view.y + (vy / speed) * reach, zoom: view.zoom }, { duration: ms(600), ease: easeOut });
    },
  });

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // After the cards have started to move, so the frame is the new shape and not the old one.
    const id = window.setTimeout(() => void fitView({ ...FIT, duration: ms(500), ease: easeOut }), 90);
    return () => window.clearTimeout(id);
  }, [fitTick, fitView]);

  return (
    <Panel position="bottom-left" className="cv-controls">
      <button type="button" className="cv-tool is-small" aria-label="Zoom in" onClick={() => void zoomIn({ duration: ms(220) })}><ZoomIn size={16} /></button>
      <button type="button" className="cv-tool is-small" aria-label="Zoom out" onClick={() => void zoomOut({ duration: ms(220) })}><ZoomOut size={16} /></button>
      <button type="button" className="cv-tool is-small" aria-label="Fit to screen" onClick={() => void fitView({ ...FIT, duration: ms(500), ease: easeOut })}><Scan size={16} /></button>
    </Panel>
  );
}

function summarize(diff: ReturnType<typeof diffSummary>): string {
  return [
    diff.added.length && `${diff.added.length} added`,
    diff.removed.length && `${diff.removed.length} removed`,
    diff.renamed.length && `${diff.renamed.length} renamed`,
  ].filter(Boolean).join(', ');
}

// Which cards a reader folded, kept per batch in this browser.
function readFolded(batchId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(`cv-folded:${batchId}`) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

type Travelling = Slot & { gone?: boolean; from?: { dx: number; dy: number } };

// The slots as drawn. A card that goes folds back into its parent (drawn at the parent, faded out, so the node's own
// transition carries it there), one that appears is animated out of its parent (a keyframe from an offset), and everything
// else glides to its new place on its own. `anchorOf` names a card's parent.
function useTravel(target: Slot[], anchorOf: (id: string) => string | null): { slots: Travelling[]; moving: boolean } {
  const [drawn, setDrawn] = useState<Travelling[]>(target);
  const before = useRef(target);
  const anchor = useRef(anchorOf);
  useEffect(() => {
    anchor.current = anchorOf;
  });

  useEffect(() => {
    const was = new Map(before.current.map((slot) => [slot.id, slot]));
    const now = new Map(target.map((slot) => [slot.id, slot]));
    before.current = target;
    // Nearest ancestor that is still on the canvas: what a card travels to or from.
    const home = (id: string) => {
      let at = anchor.current(id);
      while (at && !now.has(at)) at = anchor.current(at);
      return at ? now.get(at) : undefined;
    };

    const leaving: Travelling[] = [];
    for (const slot of was.values()) {
      const to = now.has(slot.id) || was.size <= 1 ? undefined : home(slot.id);
      if (to) leaving.push({ ...slot, x: to.x, y: to.y, gone: true });
    }
    const entering = new Map<string, Travelling>();
    for (const slot of target) {
      const from = was.has(slot.id) || was.size <= 1 ? undefined : home(slot.id);
      if (from) entering.set(slot.id, { ...slot, from: { dx: from.x - slot.x, dy: from.y - slot.y } });
    }

    if (leaving.length === 0 && entering.size === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrawn(target);
      return;
    }
    setDrawn([...leaving, ...target.map((slot) => entering.get(slot.id) ?? slot)]);
    // The leavers are dropped once they have landed.
    const done = window.setTimeout(() => setDrawn(target), 460);
    return () => window.clearTimeout(done);
  }, [target]);

  // Only the batch card so far: the first fill is not a journey.
  const slots: Travelling[] = drawn.length <= 1 ? target : drawn;
  return { slots, moving: slots.some((slot) => slot.gone || slot.from) };
}

interface CurriculumCanvasProps {
  batchId: string;
  batchName: string;
  role: Role;
  /** CSS height of the canvas; it never sizes itself. */
  height?: string;
}

/** The batch's curriculum as a floating tree. Admin edits go live; a tutor's edits wait for an admin. */
export function CurriculumCanvas({ batchId, batchName, role, height = 'calc(100vh - 10rem)' }: CurriculumCanvasProps) {
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [live, setLive] = useState<CurriculumNode[]>([]);
  const [request, setRequest] = useState<CurriculumRequest | undefined>();
  const [view, setView] = useState<View>('view');
  const [draft, setDraft] = useState<CurriculumNode[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<CurriculumFilter>('all');
  const [folded, setFolded] = useState<Set<string>>(() => readFolded(batchId));
  // While cards travel to new places their connectors would jump ahead of them, so they step aside.
  const [settled, setSettled] = useState(0);
  const [settledSeen, setSettledSeen] = useState(0);
  const [fitTick, setFitTick] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Clicking anywhere off the calendar (or its button) closes it.
  useEffect(() => {
    if (!calendarOpen) return;
    const away = (event: PointerEvent) => {
      if (!calendarRef.current?.contains(event.target as Element)) setCalendarOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [calendarOpen]);

  // Editing always takes the whole screen (nothing else is reachable until Save or Discard); anyone may ask for it.
  const fullscreen = view === 'edit' || expanded;
  useEffect(() => {
    if (!fullscreen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || view === 'edit') return;
      if ((event.target as Element).closest('input, textarea') || document.querySelector('[role="dialog"]')) return;
      setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, view]);

  // Each layout change bumps `settled`; the connectors come back once it has stopped changing for a beat.
  const settling = settled !== settledSeen;
  useEffect(() => {
    if (!settling) return;
    const id = window.setTimeout(() => setSettledSeen(settled), 420);
    return () => window.clearTimeout(id);
  }, [settling, settled]);

  const settle = useCallback(() => setSettled((n) => n + 1), []);

  const canEdit = role !== 'student';
  const pending = request?.status === 'pending' ? request : undefined;

  const refresh = useCallback(async () => {
    const [nodes, latest] = await Promise.all([
      getCurriculumNodes(batchId),
      canEdit ? getLatestCurriculumRequest(batchId) : Promise.resolve(undefined),
    ]);
    setLive(nodes);
    setRequest(latest);
  }, [batchId, canEdit]);

  const { loading, error, retry } = useInitialLoad(refresh, role === 'student');

  const shown = useMemo<CurriculumNode[]>(() => {
    if (view === 'edit') return draft;
    if (view === 'review' && pending) {
      const was = new Map(live.map((node) => [node.id, node]));
      return pending.nodes.map((node) => ({
        ...node,
        batch_id: batchId,
        status: was.get(node.id)?.status ?? 'todo',
        done_on: was.get(node.id)?.done_on ?? null,
      }));
    }
    return live;
  }, [view, draft, pending, live, batchId]);

  const act = async (work: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      showToast(errorMessage(err, failure), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Optimistic: the box flips at once and snaps back if the database refuses.
  const mark = useCallback(async (node: CurriculumNode, status: CurriculumStatus, doneOn: string | null) => {
    const patch = (next: Pick<CurriculumNode, 'status' | 'done_on'>) =>
      setLive((prev) => prev.map((item) => (item.id === node.id ? { ...item, ...next } : item)));

    patch({ status, done_on: doneOn });
    try {
      await setCurriculumStatus(node.id, status, doneOn ?? undefined);
    } catch (err) {
      patch({ status: node.status, done_on: node.done_on });
      showToast(errorMessage(err, 'Could not update the topic'), 'error');
    }
  }, [showToast]);

  const cycle = useCallback((node: CurriculumNode) => {
    const status = nextStatus(node.status);
    return mark(node, status, status === 'done' ? toDateValue(new Date()) : null);
  }, [mark]);

  const keepFolded = useCallback((next: Set<string>) => {
    setFolded(next);
    settle();
    try {
      localStorage.setItem(`cv-folded:${batchId}`, JSON.stringify([...next]));
    } catch {
      // Private mode: the folds last until the page reloads.
    }
  }, [batchId, settle]);

  const toggleFold = useCallback((id: string) => {
    const next = new Set(folded);
    if (!next.delete(id)) next.add(id);
    keepFolded(next);
  }, [folded, keepFolded]);

  const foldEverything = (fold: boolean) => {
    keepFolded(new Set(fold ? [...childMap(shown).keys()].filter((id): id is string => id !== null) : []));
    setFitTick((n) => n + 1);
  };

  const pickFilter = (next: CurriculumFilter) => {
    setFilter(next);
    settle();
    setFitTick((n) => n + 1);
  };

  const addNode = useCallback((parentId: string | null, kind: CurriculumKind) => {
    const id = crypto.randomUUID();
    setDraft((prev) => [
      ...prev,
      { id, batch_id: batchId, parent_id: parentId, kind, title: '', position: nextPosition(prev, parentId), status: 'todo', done_on: null },
    ]);
    setFocusId(id);
  }, [batchId]);

  const rename = useCallback((id: string, title: string) => {
    setDraft((prev) => prev.map((node) => (node.id === id ? { ...node, title } : node)));
  }, []);

  const remove = useCallback(async (node: CurriculumNode) => {
    const inside = draft.length - removeSubtree(draft, node.id).length - 1;
    if (inside > 0) {
      const accepted = await confirm({
        title: `Remove "${node.title || node.kind}"?`,
        message: `Its ${inside} ${inside === 1 ? 'item' : 'items'} inside go too. Nothing changes until you save.`,
        confirmLabel: 'Remove',
        danger: true,
        quick: true,
      });
      if (!accepted) return;
    }
    setDraft((prev) => removeSubtree(prev, node.id));
  }, [draft, confirm]);

  const startEdit = () => {
    setDraft(live.map((node) => ({ ...node })));
    setView('edit');
  };

  const discard = async () => {
    const changed = diffSummary(toDraft(live), toDraft(draft));
    if (summarize(changed)) {
      const accepted = await confirm({ title: 'Discard your changes?', message: summarize(changed) + '.', confirmLabel: 'Discard', danger: true, quick: true });
      if (!accepted) return;
    }
    setView('view');
  };

  const save = async () => {
    if (draft.some((node) => !node.title.trim())) {
      showToast('Give every card a name, or remove it.', 'error');
      return;
    }
    const next = toDraft(draft).map((node) => ({ ...node, title: node.title.trim() }));
    const summary = summarize(diffSummary(toDraft(live), next));
    if (!summary) {
      showToast('No changes to save.', 'info');
      setView('view');
      return;
    }

    const isAdmin = role === 'admin';
    const accepted = await confirm({
      title: isAdmin ? 'Publish these changes?' : 'Send these changes for approval?',
      message: isAdmin
        ? `${summary}. Students see this at once.${pending ? ' It replaces the submission waiting for approval.' : ''} Removed items lose their progress.`
        : `${summary}. Students keep seeing the current version until an admin approves.`,
      confirmLabel: isAdmin ? 'Publish' : 'Send for approval',
    });
    if (!accepted) return;

    await act(async () => {
      await (isAdmin ? saveCurriculum(batchId, next) : proposeCurriculum(batchId, next));
      await refresh();
      setView('view');
      showToast(isAdmin ? 'Curriculum published.' : 'Sent to an admin for approval.', 'success');
    }, 'Could not save the curriculum');
  };

  const decide = async (approve: boolean) => {
    if (!pending) return;
    const accepted = await confirm({
      title: approve ? 'Approve and publish?' : 'Deny this submission?',
      message: approve ? 'Students see the proposed curriculum at once.' : 'The tutor can edit and send it again.',
      confirmLabel: approve ? 'Approve' : 'Deny',
      danger: !approve,
    });
    if (!accepted) return;

    await act(async () => {
      await reviewCurriculum(pending.id, approve);
      await refresh();
      setView('view');
      showToast(approve ? 'Curriculum approved.' : 'Submission denied.', 'success');
    }, 'Could not record the decision');
  };

  const reviewDiff = useMemo(
    () => (pending ? diffSummary(toDraft(live), pending.nodes) : null),
    [pending, live],
  );

  const layout = useMemo(() => {
    // Layout follows what is visible; the bars always count the whole tree.
    const visible = view === 'view' ? filterTree(shown, filter) : shown;
    const byParent = childMap(visible);
    return {
      slots: layoutTree(byParent, view === 'edit', folded),
      byParent,
      full: childMap(shown),
      byId: new Map(shown.map((node) => [node.id, node])),
      nothingShown: view === 'view' && filter !== 'all' && visible.length === 0,
    };
  }, [shown, view, filter, folded]);

  const { slots, moving } = useTravel(layout.slots, (id) =>
    id === 'root' ? null : id === 'ghost:root' ? 'root' : id.startsWith('ghost:') ? id.slice(6) : layout.byId.get(id)?.parent_id ?? 'root',
  );
  const { nothingShown } = layout;

  const { flowNodes, flowEdges } = useMemo(() => {
    const { byParent, full, byId } = layout;
    const newIds = view === 'review' ? new Set(reviewDiff?.added.map((node) => node.id)) : new Set<string>();
    const overall = progressOf(full.get(null) ?? []);

    const flowNodes: (RootNode | CardNode | GhostNode)[] = [];
    const flowEdges: Edge[] = [];

    for (const slot of slots) {
      const position = { x: slot.x, y: slot.y };
      const gone = Boolean(slot.gone);
      if (slot.id === 'root') {
        flowNodes.push({ id: 'root', type: 'root', position, data: { name: batchName, ...overall }, draggable: false, selectable: false, focusable: false });
      } else if (slot.ghost) {
        const { parentId, kind } = slot.ghost;
        const parent = parentId ? byId.get(parentId) : undefined;
        const siblings = byParent.get(parentId)?.length ?? 0;
        const hint = parent
          ? `Add a ${kind} to "${parent.title || parent.kind}"`
          : siblings > 0 ? 'Add the next module' : 'Add a module';
        flowNodes.push({
          id: slot.id,
          type: 'ghost',
          position,
          data: { hint, beside: kind === 'module', gone, enter: slot.from ?? null, onAdd: () => addNode(parentId, kind) },
          draggable: false, selectable: false, focusable: false,
        });
        if (!gone) {
          flowEdges.push({ id: `e-${slot.id}`, source: parentId ?? 'root', target: slot.id, type: 'branch', style: { strokeDasharray: '4 4' }, className: 'cv-edge is-ghost' });
        }
      } else {
        const node = byId.get(slot.id);
        // Gone from the tree itself (removed while editing): nothing left to fold into its parent.
        if (!node) continue;
        flowNodes.push({
          id: node.id,
          type: 'card',
          position,
          data: {
            node,
            ...progressOf(full.get(node.id) ?? []),
            foldable: (byParent.get(node.id)?.length ?? 0) > 0,
            folded: folded.has(node.id),
            hidden: countBelow(byParent, node.id),
            gone,
            enter: slot.from ?? null,
            onFold: toggleFold,
            view,
            canTick: canEdit && view === 'view',
            isNew: newIds.has(node.id),
            autoFocus: node.id === focusId,
            onCycle: (target) => void cycle(target),
            onDate: (target, date) => void mark(target, 'done', date),
            onRename: rename,
            onRemove: (target) => void remove(target),
          },
          draggable: false, selectable: false, focusable: false,
        });
        if (!gone) {
          flowEdges.push({ id: `e-${node.id}`, source: node.parent_id ?? 'root', target: node.id, type: 'branch', className: clsx('cv-edge', node.status === 'done' && 'is-done') });
        }
      }
    }
    return { flowNodes, flowEdges };
  }, [layout, slots, view, folded, batchName, canEdit, focusId, reviewDiff, addNode, cycle, mark, rename, remove, toggleFold]);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  if (!canEdit && live.length === 0) {
    return (
      <EmptyState
        icon={<LibraryBig size={22} />}
        title="The curriculum isn't published yet"
        description="Your instructors will publish the course outline here."
      />
    );
  }

  const canvas = (
    <div ref={boxRef} className={clsx('cv-canvas', fullscreen && 'is-full', (settling || moving) && 'is-settling')} style={fullscreen ? undefined : { height, minHeight: 520 }}>
      <ReactFlow
        key={batchId}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        zoomOnDoubleClick={false}
        attributionPosition="bottom-center"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--cv-dot)" />
        <CanvasCamera fitTick={fitTick} boxRef={boxRef} />

        <Panel position="top-left" className="cv-toolbar">
            {canEdit && view === 'view' && (
              <Button variant="secondary" className="action-button-compact" onClick={startEdit} disabled={Boolean(pending) && role === 'tutor'}>
                <Pencil size={14} /> Edit curriculum
              </Button>
            )}
            {view === 'edit' && (
              <>
                <Button variant="ghost" className="action-button-compact" onClick={() => void discard()} disabled={busy}>Discard</Button>
                <Button className="action-button-compact" onClick={() => void save()} loading={busy}>
                  {role === 'admin' ? 'Save changes' : 'Send for approval'}
                </Button>
              </>
            )}
            {view === 'review' && (
              <>
                <Button variant="ghost" className="action-button-compact" onClick={() => setView('view')} disabled={busy}>Back</Button>
                <Button variant="danger" className="action-button-compact" onClick={() => void decide(false)} disabled={busy}>Deny</Button>
                <Button className="action-button-compact" onClick={() => void decide(true)} loading={busy}>Approve</Button>
              </>
            )}
            {view === 'view' && (
              <QuizSegment
                label="Show"
                value={filter}
                onChange={pickFilter}
                options={[{ value: 'all', label: 'All' }, { value: 'done', label: 'Completed' }, { value: 'todo', label: 'Incomplete' }]}
              />
            )}
            <button type="button" className="cv-tool" aria-label="Fold everything" title="Fold everything" onClick={() => foldEverything(true)}><ChevronsDownUp size={17} /></button>
            <button type="button" className="cv-tool" aria-label="Unfold everything" title="Unfold everything" onClick={() => foldEverything(false)}><ChevronsUpDown size={17} /></button>
        </Panel>

        {view !== 'edit' && (
          <Panel position="top-right" className="cv-fullscreen-slot">
            <button
              type="button"
              className="cv-tool"
              aria-pressed={expanded}
              aria-label={expanded ? 'Exit full screen' : 'Full screen'}
              title={expanded ? 'Exit full screen (Esc)' : 'Full screen'}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </Panel>
        )}

        {(canEdit || nothingShown) && (
          <Panel position="top-center" className="cv-banner-slot">
            {nothingShown && <p className="cv-banner">{filter === 'done' ? 'Nothing is marked done yet.' : 'Everything is done.'}</p>}
            {canEdit && view === 'edit' && <p className="cv-banner">Editing. Checkboxes are paused until you save or discard.</p>}
            {view === 'review' && reviewDiff && (
              <p className="cv-banner">Proposed changes: {summarize(reviewDiff) || 'none'}.{reviewDiff.removed.length > 0 && ` Removed: ${reviewDiff.removed.slice(0, 4).map((node) => node.title).join(', ')}${reviewDiff.removed.length > 4 ? '…' : ''}.`}</p>
            )}
            {view === 'view' && pending && role === 'admin' && (
              <p className="cv-banner">
                A tutor sent changes for approval.{' '}
                <button type="button" className="cv-banner-action" onClick={() => setView('review')}>Review them</button>
              </p>
            )}
            {view === 'view' && pending && role === 'tutor' && (
              <p className="cv-banner">Waiting for admin approval. Students still see the current version.</p>
            )}
            {view === 'view' && !pending && request?.status === 'denied' && role === 'tutor' && (
              <p className="cv-banner is-warn">Your last submission was denied. Edit and send it again.</p>
            )}
          </Panel>
        )}

        <Panel position="bottom-right" className="cv-calendar-slot" ref={calendarRef}>
          {calendarOpen && <CurriculumCalendar nodes={live} onClose={() => setCalendarOpen(false)} />}
          <button
            type="button"
            className={clsx('cv-calendar-btn', calendarOpen && 'is-open')}
            aria-expanded={calendarOpen}
            aria-label="Completed topics calendar"
            onClick={() => setCalendarOpen((open) => !open)}
          >
            <CalendarDays size={18} />
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );

  return fullscreen ? createPortal(canvas, document.body) : canvas;
}
