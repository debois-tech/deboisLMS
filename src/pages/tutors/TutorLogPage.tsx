import { useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager, usePager } from '@/components/ui/Pager';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getBatches, getTutorActions, type TutorAction } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils/format';

const PER_PAGE = 20;

const VIEW_OPTIONS = [
  { value: 'live', label: 'Original' },
  { value: 'test', label: 'Test' },
];

export default function TutorLogPage() {
  const [actions, setActions] = useState<TutorAction[]>([]);
  const [batchNames, setBatchNames] = useState<Map<string, string>>(new Map());
  const [testBatches, setTestBatches] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [tutor, setTutor] = useState<string | null>(null);
  const [view, setView] = useState('live');

  const { loading, error, retry } = useInitialLoad(async () => {
    const [rows, batches] = await Promise.all([getTutorActions(), getBatches()]);
    setActions(rows);
    setBatchNames(new Map(batches.map((batch) => [batch.id, batch.name])));
    setTestBatches(new Set(batches.filter((batch) => batch.is_test).map((batch) => batch.id)));
  });

  // Actions in a test batch live in their own view, like test students.
  const inView = useMemo(
    () => actions.filter((action) => testBatches.has(action.batch_id ?? '') === (view === 'test')),
    [actions, testBatches, view],
  );

  const tutors = useMemo(() => [...new Set(inView.map((action) => action.tutor_name))].sort(), [inView]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return inView.filter((action) =>
      (!tutor || action.tutor_name === tutor) &&
      (!term || `${action.item} ${action.detail ?? ''} ${batchNames.get(action.batch_id ?? '') ?? ''}`.toLowerCase().includes(term)),
    );
  }, [inView, tutor, search, batchNames]);

  const pager = usePager(filtered, PER_PAGE);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Tutor Log" />

      {actions.length === 0 ? (
        <EmptyState icon={<History size={32} />} title="No tutor activity yet" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 max-w-md flex-1">
              <SearchFilterBar
                value={search}
                onChange={(value) => { setSearch(value); pager.reset(); }}
                placeholder="Search by item, detail or batch"
                filterLabel="Tutor"
                allLabel="All tutors"
                filterValue={tutor}
                filterOptions={tutors.map((name) => ({ value: name, label: name }))}
                onFilterChange={(value) => { setTutor(value); pager.reset(); }}
              />
            </div>
            <SearchSelect
              options={VIEW_OPTIONS}
              value={view}
              onChange={(value) => { setView(value); setTutor(null); pager.reset(); }}
              placeholder="Original"
              searchPlaceholder=""
              emptyText=""
              showSearch={false}
              className="!w-auto !max-w-none"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title="No matching activity" />
          ) : (
            <>
              <Table maxHeight="none">
                <THead>
                  <TR>
                    <TH>When</TH>
                    <TH>Tutor</TH>
                    <TH>Action</TH>
                    <TH>Detail</TH>
                    <TH>Batch</TH>
                  </TR>
                </THead>
                <TBody>
                  {pager.slice.map((action) => (
                    <TR key={action.id}>
                      <TD className="cell-muted">{formatDateTime(action.created_at)}</TD>
                      <TD className="font-semibold text-[var(--text-primary)]">{action.tutor_name}</TD>
                      <TD className="cell-secondary capitalize">
                        {action.op} {action.item.toLowerCase()}{action.times > 1 ? ` ×${action.times}` : ''}
                      </TD>
                      <TD className="cell-secondary">{action.detail || '—'}</TD>
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
    </div>
  );
}
