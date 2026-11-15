import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Layers, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { getBatches, getBatchPrograms } from '@/lib/supabase';
import type { Batch, BatchProgramOption, BatchStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

type BatchTab = BatchStatus | 'all';

const TAB_LABELS: Record<BatchTab, string> = {
  ongoing: 'Active',
  upcoming: 'Upcoming',
  completed: 'Completed',
  all: 'All',
};

const TAB_ORDER: BatchTab[] = ['ongoing', 'upcoming', 'completed', 'all'];

const inTab = (batch: Batch, tab: BatchTab) => tab === 'all' || batch.status === tab;

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programs, setPrograms] = useState<BatchProgramOption[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BatchTab>('ongoing');

  const { loading, error, retry } = useInitialLoad(async () => {
    const [batchRows, programRows] = await Promise.all([getBatches(), getBatchPrograms()]);
    setBatches(batchRows);
    setPrograms(programRows);
  });

  // Code in, name out — the table and the search box both read the label.
  const programName = useMemo(
    () => (batch: Batch) => programs.find((p) => p.code === batch.program)?.name ?? '',
    [programs],
  );

  const matchesSearch = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (batch: Batch) =>
      !term || `${batch.name} ${programName(batch)} ${batch.program ?? ''}`.toLowerCase().includes(term);
  }, [search, programName]);

  // Counts ignore the active tab so every tab shows its own total, not the filtered one.
  const tabs = TAB_ORDER.map((value) => ({
    value,
    label: TAB_LABELS[value],
    count: batches.filter((batch) => inTab(batch, value) && matchesSearch(batch)).length,
  }));

  const filteredBatches = batches.filter((batch) => inTab(batch, status) && matchesSearch(batch));
  // Only a finished batch has an end date, so the column shows where it can.
  const showEnd = status === 'completed' || status === 'all';

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
          <div className="mb-4">
            <FilterTabs tabs={tabs} value={status} onChange={setStatus} label="Batch status" />
          </div>

          <div className="mb-4">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name or track" />
          </div>

          {filteredBatches.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title={status === 'all' ? 'No batches' : `No ${TAB_LABELS[status].toLowerCase()} batches`} />
          ) : (
            <Table maxHeight="none">
              <THead>
                <TR>
                  <TH>Batch</TH>
                  <TH>Track</TH>
                  <TH>Start Date</TH>
                  {showEnd && <TH>End Date</TH>}
                </TR>
              </THead>
              <TBody>
                {filteredBatches.map((batch) => (
                  <TR key={batch.id}>
                    <TD>
                      <Link to={`/batches/${batch.id}`} className="flex items-center gap-3 group">
                        <span className="batch-chip"><Layers size={16} /></span>
                        <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)]">{batch.name}</span>
                        {batch.is_test && <Badge variant="warning">Test</Badge>}
                      </Link>
                    </TD>
                    <TD className="cell-secondary">{programName(batch) || '—'}</TD>
                    <TD className="cell-muted">{batch.start_date ? formatDate(batch.start_date) : '—'}</TD>
                    {showEnd && <TD className="cell-muted">{batch.ended_at ? formatDate(batch.ended_at) : '—'}</TD>}
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
