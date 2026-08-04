import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Layers, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { getBatches } from '@/lib/supabase';
import type { Batch, BatchStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

const STATUSES: BatchStatus[] = ['upcoming', 'ongoing', 'completed'];

function statusVariant(status: BatchStatus) {
  if (status === 'ongoing') return 'success' as const;
  if (status === 'upcoming') return 'info' as const;
  return 'default' as const;
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBatches().then((data) => {
      setBatches(data);
      setLoading(false);
    });
  }, []);

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
                      <Badge variant={statusVariant(batch.status)} dot>{batch.status}</Badge>
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
