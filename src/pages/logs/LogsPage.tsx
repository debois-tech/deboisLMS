import { useMemo, useState } from 'react';
import { History, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager, usePager } from '@/components/ui/Pager';
import { Modal } from '@/components/ui/Modal';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getBatches, getLogActions, deleteOldLogs, type LogAction, type LogKind } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils/format';
import { useAuth } from '@/lib/context/AuthContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

const PER_PAGE = 20;

const VIEW_OPTIONS = [
  { value: 'live', label: 'Original' },
  { value: 'test', label: 'Test' },
];

const CLEAR_OPTIONS = [7, 30, 60, 90].map((days) => ({ value: String(days), label: `Older than ${days} days` }));

const WHO: Record<LogKind, string> = { tutor: 'Tutor', admin: 'Admin' };

// One line per entry; the sentence about it opens on click.
const titleOf = (action: LogAction) =>
  `${action.op[0].toUpperCase()}${action.op.slice(1)} ${action.item.toLowerCase()}${action.detail ? ` · ${action.detail}` : ''}${action.times > 1 ? ` ×${action.times}` : ''}`;

// Tutor and admin logs side by side; the nightly job keeps 90 days, only the developer can clear sooner.
export default function LogsPage() {
  return (
    <div className="page-section">
      <PageHeader title="Logs" />
      <Tabs tabs={[{ label: 'Tutor log', value: 'tutor' }, { label: 'Admin log', value: 'admin' }]}>
        {(active) => <LogTable key={active} kind={active as LogKind} />}
      </Tabs>
    </div>
  );
}

function LogTable({ kind }: { kind: LogKind }) {
  const { isDeveloper } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [actions, setActions] = useState<LogAction[]>([]);
  const [batchNames, setBatchNames] = useState<Map<string, string>>(new Map());
  const [testBatches, setTestBatches] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [actor, setActor] = useState<string | null>(null);
  const [view, setView] = useState('live');
  const [days, setDays] = useState('90');
  const [opened, setOpened] = useState<LogAction | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    const [rows, batches] = await Promise.all([getLogActions(kind), getBatches()]);
    setActions(rows);
    setBatchNames(new Map(batches.map((batch) => [batch.id, batch.name])));
    setTestBatches(new Set(batches.filter((batch) => batch.is_test).map((batch) => batch.id)));
  });

  // Test activity lives in its own view: a test batch's entries, and anything the developer did.
  const inView = useMemo(
    () => actions.filter((action) => (testBatches.has(action.batch_id ?? '') || action.role === 'developer') === (view === 'test')),
    [actions, testBatches, view],
  );

  const actors = useMemo(() => [...new Set(inView.map((action) => action.actor))].sort(), [inView]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return inView.filter((action) =>
      (!actor || action.actor === actor) &&
      (!term || `${action.item} ${action.detail ?? ''} ${action.description ?? ''} ${batchNames.get(action.batch_id ?? '') ?? ''}`.toLowerCase().includes(term)),
    );
  }, [inView, actor, search, batchNames]);

  const pager = usePager(filtered, PER_PAGE);

  const clearOld = async () => {
    const yes = await confirm({
      title: `Clear ${kind} logs older than ${days} days?`,
      message: 'They are deleted for good.',
      confirmLabel: 'Clear',
      danger: true,
    });
    if (!yes) return;
    try {
      const removed = await deleteOldLogs(kind, Number(days));
      setActions(await getLogActions(kind));
      pager.reset();
      showToast(removed ? `${removed} old logs cleared` : 'No old logs');
    } catch (err) {
      showToast(errorMessage(err, 'Could not clear old logs'), 'error');
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="table-block">
      {isDeveloper && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <SearchSelect
            options={CLEAR_OPTIONS}
            value={days}
            onChange={setDays}
            placeholder="Older than"
            searchPlaceholder=""
            emptyText=""
            showSearch={false}
            className="!w-auto !max-w-none"
          />
          <Button variant="outline" className="action-button-compact action-button-danger" onClick={() => void clearOld()}>
            <Trash2 size={14} /> Clear
          </Button>
        </div>
      )}

      {actions.length === 0 ? (
        <EmptyState icon={<History size={32} />} title={`No ${kind} activity yet`} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchFilterBar
              value={search}
              onChange={(value) => { setSearch(value); pager.reset(); }}
              placeholder="Search by item, detail or batch"
              filterLabel={WHO[kind]}
              allLabel={`All ${kind === 'tutor' ? 'tutors' : 'admins'}`}
              filterValue={actor}
              filterOptions={actors.map((name) => ({ value: name, label: name }))}
              onFilterChange={(value) => { setActor(value); pager.reset(); }}
            />
            {isDeveloper && (
              <SearchSelect
                options={VIEW_OPTIONS}
                value={view}
                onChange={(value) => { setView(value); setActor(null); pager.reset(); }}
                placeholder="Original"
                searchPlaceholder=""
                emptyText=""
                showSearch={false}
                className="!w-auto !max-w-none"
              />
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title="No matching activity" />
          ) : (
            <>
              <Table maxHeight="none">
                <THead>
                  <TR>
                    <TH>When</TH>
                    <TH>{WHO[kind]}</TH>
                    <TH>Title</TH>
                    <TH>Batch</TH>
                  </TR>
                </THead>
                <TBody from={pager.from}>
                  {pager.slice.map((action) => (
                    <TR key={action.id} onActivate={() => setOpened(action)}>
                      <TD className="cell-muted">{formatDateTime(action.created_at)}</TD>
                      <TD className="font-semibold text-[var(--text-primary)]">
                        {action.actor} {action.role === 'developer' && <Badge variant="warning">Developer</Badge>}
                      </TD>
                      <TD className="cell-secondary">{titleOf(action)}</TD>
                      <TD className="cell-secondary">{batchNames.get(action.batch_id ?? '') ?? '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pager {...pager} onChange={pager.setPage} />
            </>
          )}
        </>
      )}

      <Modal open={opened !== null} onClose={() => setOpened(null)} title={opened ? titleOf(opened) : ''} size="md">
        {opened && (
          <dl className="log-facts">
            <div><dt className="student-fact-label">Time</dt><dd className="student-fact-value">{formatDateTime(opened.created_at)}</dd></div>
            <div><dt className="student-fact-label">Account</dt><dd className="student-fact-value">{opened.account ?? opened.actor}</dd></div>
            <div><dt className="student-fact-label">Description</dt><dd className="log-description">{opened.description ?? 'Not recorded'}</dd></div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
