import { useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager, usePager } from '@/components/ui/Pager';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getBatches, getTutorActions, type TutorAction } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils/format';

const PER_PAGE = 20;

export default function TutorLogPage() {
  const [actions, setActions] = useState<TutorAction[]>([]);
  const [batchNames, setBatchNames] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState('');
  const [tutor, setTutor] = useState<string | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    const [rows, batches] = await Promise.all([getTutorActions(), getBatches()]);
    setActions(rows);
    setBatchNames(new Map(batches.map((batch) => [batch.id, batch.name])));
  });

  const tutors = useMemo(() => [...new Set(actions.map((action) => action.tutor_name))].sort(), [actions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return actions.filter((action) =>
      (!tutor || action.tutor_name === tutor) &&
      (!term || `${action.item} ${action.detail ?? ''} ${batchNames.get(action.batch_id ?? '') ?? ''}`.toLowerCase().includes(term)),
    );
  }, [actions, tutor, search, batchNames]);

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
          <div className="mb-4 max-w-md">
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
