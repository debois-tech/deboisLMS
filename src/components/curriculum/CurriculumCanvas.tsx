import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BookOpen, CalendarDays, Check, FileText, Layers, LibraryBig, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
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
  diffSummary,
  layoutTree,
  nextPosition,
  nextStatus,
  progressOf,
  removeSubtree,
  toDraft,
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
  onCycle: (node: CurriculumNode) => void;
  onDate: (node: CurriculumNode, date: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (node: CurriculumNode) => void;
}
/** `beside`: the next-module "+", which hangs off the batch card; every other "+" ends a stack. */
interface GhostData extends Record<string, unknown> { hint: string; beside: boolean; onAdd: () => void }
interface RootData extends Record<string, unknown> { name: string; done: number; total: number }

type CardNode = Node<CardData, 'card'>;
type GhostNode = Node<GhostData, 'ghost'>;
type RootNode = Node<RootData, 'root'>;

const KIND_ICON = { module: Layers, topic: BookOpen, subtopic: FileText } as const;

function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="cv-progress">
      <div className="cv-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <span className="cv-progress-text">{done}/{total}</span>
    </div>
  );
}

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
      <Bar done={data.done} total={data.total} label={`${data.name} overall progress`} />
    </div>
  );
}

function CurriculumCard({ data }: NodeProps<CardNode>) {
  const { node, done, total, view, canTick, isNew, autoFocus } = data;
  const Icon = KIND_ICON[node.kind];
  const editing = view === 'edit';

  return (
    <div className={clsx('cv-card', `is-${node.status}`, isNew && 'is-new')}>
      <Handle type="target" position={node.kind === 'module' ? Position.Top : Position.Left} className="cv-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className="cv-handle is-trunk" isConnectable={false} />
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
          <Bar done={done} total={total} label={`${node.title} progress`} />
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
    </div>
  );
}

function GhostAdd({ data }: NodeProps<GhostNode>) {
  return (
    <button type="button" className="cv-ghost nodrag" data-hint={data.hint} aria-label={data.hint} onClick={data.onAdd}>
      <Handle type="target" position={data.beside ? Position.Top : Position.Left} className="cv-handle" isConnectable={false} />
      <Plus size={18} />
    </button>
  );
}

const nodeTypes = { root: RootCard, card: CurriculumCard, ghost: GhostAdd };

type Role = 'admin' | 'tutor' | 'student';

function summarize(diff: ReturnType<typeof diffSummary>): string {
  return [
    diff.added.length && `${diff.added.length} added`,
    diff.removed.length && `${diff.removed.length} removed`,
    diff.renamed.length && `${diff.renamed.length} renamed`,
  ].filter(Boolean).join(', ');
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

  // Editing takes the whole screen: nothing else on the dashboard is reachable until Save or Discard.
  const fullscreen = view === 'edit';
  useEffect(() => {
    if (!fullscreen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

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
      const accepted = await confirm({ title: 'Discard your changes?', message: summarize(changed) + '.', confirmLabel: 'Discard', danger: true });
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

  const { flowNodes, flowEdges } = useMemo(() => {
    const byParent = childMap(shown);
    const slots = layoutTree(byParent, view === 'edit');
    const byId = new Map(shown.map((node) => [node.id, node]));
    const newIds = view === 'review' ? new Set(reviewDiff?.added.map((node) => node.id)) : new Set<string>();
    const modules = byParent.get(null) ?? [];
    const overall = progressOf(modules);

    const flowNodes: (RootNode | CardNode | GhostNode)[] = [];
    const flowEdges: Edge[] = [];

    for (const slot of slots) {
      const position = { x: slot.x, y: slot.y };
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
          data: { hint, beside: kind === 'module', onAdd: () => addNode(parentId, kind) },
          draggable: false, selectable: false, focusable: false,
        });
        flowEdges.push({ id: `e-${slot.id}`, source: parentId ?? 'root', target: slot.id, type: 'smoothstep', style: { strokeDasharray: '4 4' }, className: 'cv-edge is-ghost' });
      } else {
        const node = byId.get(slot.id)!;
        const kids = byParent.get(node.id) ?? [];
        flowNodes.push({
          id: node.id,
          type: 'card',
          position,
          data: {
            node,
            ...progressOf(kids),
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
        flowEdges.push({ id: `e-${node.id}`, source: node.parent_id ?? 'root', target: node.id, type: 'smoothstep', className: clsx('cv-edge', node.status === 'done' && 'is-done') });
      }
    }
    return { flowNodes, flowEdges };
  }, [shown, view, batchName, canEdit, focusId, reviewDiff, addNode, cycle, mark, rename, remove]);

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
    <div className={clsx('cv-canvas', fullscreen && 'is-full')} style={fullscreen ? undefined : { height, minHeight: 520 }}>
      <ReactFlow
        key={batchId}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        zoomOnDoubleClick={false}
        attributionPosition="bottom-center"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--cv-dot)" />
        <Controls showInteractive={false} position="bottom-left" />

        {canEdit && (
          <Panel position="top-left" className="cv-toolbar">
            {view === 'view' && (
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
          </Panel>
        )}

        {canEdit && (
          <Panel position="top-center" className="cv-banner-slot">
            {view === 'edit' && <p className="cv-banner">Editing. Checkboxes are paused until you save or discard.</p>}
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
