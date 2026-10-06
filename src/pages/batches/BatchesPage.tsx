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
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { convertBatchToTest, getBatches, getBatchPrograms, getConversionPreview } from '@/lib/supabase';
import type { Batch, BatchProgramOption, BatchStatus } from '@/lib/types';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

const TAB_LABELS: Record<BatchStatus, string> = {
  ongoing: 'Active',
  upcoming: 'Upcoming',
  completed: 'Completed',
};

const TAB_ORDER: BatchStatus[] = ['ongoing', 'upcoming', 'completed'];

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programs, setPrograms] = useState<BatchProgramOption[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BatchStatus>('ongoing');
  const confirm = useConfirm();
  const { showToast } = useToast();

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
    count: batches.filter((batch) => batch.status === value && matchesSearch(batch)).length,
  }));

  const filteredBatches = batches.filter((batch) => batch.status === status && matchesSearch(batch));

  // One way, behind a ticked box and a typed word. The dialog says when refs in the middle of the stack are involved.
  const convert = async (batch: Batch) => {
    try {
      const { students, midStack } = await getConversionPreview(batch.id);
      const accepted = await confirm({
        title: `Make ${batch.name} a test batch?`,
        message: (
          <>
            <span className="block">Out of every total, finance included</span>
            {students > 0 && <span className="block">{students} {students === 1 ? 'student gets' : 'students get'} test refs</span>}
            {midStack && <span className="block">Not the latest refs: the live series keeps a gap</span>}
            <span className="block">Cannot be undone</span>
          </>
        ),
        confirmLabel: 'Convert',
        danger: true,
        requireCheck: 'Yes, make this batch unaffecting to the LMS',
        requireText: 'CONVERT',
      });
      if (!accepted) return;

      const { converted } = await convertBatchToTest(batch.id);
      setBatches((current) => current.map((b) => (b.id === batch.id ? { ...b, is_test: true } : b)));
      showToast(converted > 0 ? `Converted, ${converted} refs reissued` : 'Converted');
    } catch (err) {
      showToast(errorMessage(err, 'Could not convert this batch'), 'error');
    }
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
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name or track" />
          </div>

          <div className="mb-4">
            <FilterTabs tabs={tabs} value={status} onChange={setStatus} label="Batch status" />
          </div>

          {filteredBatches.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title={`No ${TAB_LABELS[status].toLowerCase()} batches`} />
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
                        {batch.is_test && <Badge variant="warning">Test</Badge>}
                      </Link>
                    </TD>
                    <TD className="cell-secondary">{programName(batch) || '—'}</TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <StatusPill kind="batch" value={batch.status} />
                        <Switch
                          checked={!batch.is_test}
                          onChange={() => void convert(batch)}
                          label={`${batch.name} counts toward the LMS`}
                          disabled={batch.is_test}
                        />
                      </div>
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
