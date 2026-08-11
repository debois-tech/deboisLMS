import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Layers, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { getBatches } from '@/lib/supabase';
import type { Batch, BatchStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

const STATUSES: BatchStatus[] = ['upcoming', 'ongoing', 'completed'];

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BatchStatus | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    setBatches(await getBatches());
  });

  const filteredBatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return batches.filter((batch) => {
      if (status && batch.status !== status) return false;
      if (!term) return true;
      return `${batch.name} ${batch.track ?? ''}`.toLowerCase().includes(term);
    });
  }, [batches, search, status]);

  const selectStatus = (next: BatchStatus | null) => {
    setStatus(next);
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader
        title="Batches"
        action={<Link to="/batches/new"><Button className="action-button-compact"><Plus size={16} /> New Batch</Button></Link>}
      />

      {batches.length === 0 ? (
        <EmptyState icon={<Layers size={32} />} title="No batches yet" />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <SearchFilterBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name or track"
              filterLabel="Filter by status"
              allLabel="All statuses"
              filterValue={status}
              filterOptions={STATUSES.map((option) => ({ value: option, label: option }))}
              onFilterChange={(next) => selectStatus(next as BatchStatus | null)}
            />
          </div>

          {filteredBatches.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title="No matching batches" />
          ) : (
            <Table maxHeight="none">
              <THead>
                <TR>
                  <TH>Batch</TH>
                  <TH>Track</TH>
                  <TH>Status</TH>
                  <TH>Start Date</TH>
                </TR>
              </THead>
              <TBody>
                {filteredBatches.map((batch) => (
                  <TR key={batch.id}>
                    <TD>
                      <Link to={`/batches/${batch.id}`} className="flex items-center gap-3 group">
                        <span className="batch-chip"><Layers size={16} /></span>
                        <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)]">{batch.name}</span>
                      </Link>
                    </TD>
                    <TD className="cell-secondary">{batch.track || '—'}</TD>
                    <TD>
                      <StatusPill kind="batch" value={batch.status} />
                    </TD>
                    <TD className="cell-muted">{batch.start_date ? formatDate(batch.start_date) : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
