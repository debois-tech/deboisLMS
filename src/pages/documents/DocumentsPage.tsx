import { useMemo, useState } from 'react';
import { Search, ScrollText, Send } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { StudentLink } from '@/components/students/StudentLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { generateAndStoreDocuments, getBatches, getBatchStudents, sendDocumentEmail, setDocumentShared } from '@/lib/supabase';
import type { Batch, DocumentKind, Student, BatchStudentMapping } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

type Row = Student & { mapping: BatchStudentMapping };
type Patch = Partial<Pick<BatchStudentMapping, 'offer_letter_path' | 'cert_path' | 'offer_letter_shared' | 'cert_shared'>>;
type RowStatus = 'missing' | 'pending' | 'shared';

const LABELS: Record<DocumentKind, string> = { offer_letter: 'Offer Letter', cert: 'Certificate' };

const STATUS_OPTIONS = [
  { value: 'missing', label: 'Not generated' },
  { value: 'pending', label: 'Generated, not shared' },
  { value: 'shared', label: 'Fully shared' },
];

function rowStatus(mapping: BatchStudentMapping): RowStatus {
  if (!mapping.offer_letter_path || !mapping.cert_path) return 'missing';
  return mapping.offer_letter_shared && mapping.cert_shared ? 'shared' : 'pending';
}

/**
 * One doc's cell. Rows added before this feature existed have no stored file yet — "Generate"
 * makes one on demand. Once a path exists: a click-to-flip release pill, plus a mail button.
 */
function DocCell({ row, batch, kind, onPatch }: { row: Row; batch: Batch; kind: DocumentKind; onPatch: (patch: Patch) => void }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const path = kind === 'offer_letter' ? row.mapping.offer_letter_path : row.mapping.cert_path;
  const shared = kind === 'offer_letter' ? row.mapping.offer_letter_shared : row.mapping.cert_shared;

  const generate = async () => {
    setBusy(true);
    try {
      onPatch(await generateAndStoreDocuments(row.mapping, row, batch));
    } catch (err) {
      showToast(errorMessage(err, 'Could not generate the documents'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!path) {
    return (
      <Button size="sm" variant="secondary" className="action-button-compact" loading={busy} onClick={() => void generate()}>
        Generate
      </Button>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      await setDocumentShared(row.mapping.id, kind, !shared);
      onPatch({ [kind === 'offer_letter' ? 'offer_letter_shared' : 'cert_shared']: !shared });
    } catch (err) {
      showToast(errorMessage(err, 'Could not update the release'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const email = async () => {
    if (!row.email) {
      showToast('This student has no email on file.', 'error');
      return;
    }
    setBusy(true);
    try {
      await sendDocumentEmail(row.id, batch.id, kind);
      showToast(`${LABELS[kind]} emailed to ${row.name}`);
    } catch (err) {
      showToast(errorMessage(err, `Could not email the ${LABELS[kind].toLowerCase()}`), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => void toggle()} disabled={busy} className="disabled:opacity-50">
        <Badge variant={shared ? 'success' : 'default'} dot>{shared ? 'Shared' : 'Not shared'}</Badge>
      </button>
      <button
        type="button"
        title={`Email the ${LABELS[kind].toLowerCase()}`}
        aria-label={`Email the ${LABELS[kind].toLowerCase()} to ${row.name}`}
        onClick={() => void email()}
        disabled={!shared || busy}
        className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Send size={14} className={busy ? 'animate-pulse' : undefined} />
      </button>
    </div>
  );
}

export default function DocumentsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rosterError, setRosterError] = useState('');
  const [rosterLoading, setRosterLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RowStatus | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    setBatches(await getBatches());
  });

  const selectedBatch = batches.find((b) => b.id === batchId) ?? null;

  const pickBatch = async (id: string) => {
    setBatchId(id);
    setSearch('');
    setStatusFilter(null);
    setRosterLoading(true);
    setRosterError('');
    try {
      const roster = await getBatchStudents(id);
      setRows(roster.filter((r) => r.mapping.status === 'active') as Row[]);
    } catch (err) {
      setRosterError(errorMessage(err, 'Could not load the roster'));
    } finally {
      setRosterLoading(false);
    }
  };

  const patchRow = (studentId: string, patch: Patch) =>
    setRows((current) =>
      current.map((row) => (row.id === studentId ? { ...row, mapping: { ...row.mapping, ...patch } } : row)),
    );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !q || row.name.toLowerCase().includes(q) || (row.student_code ?? '').toLowerCase().includes(q);
      const matchesStatus = !statusFilter || rowStatus(row.mapping) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Documents" />

      <Card className="step-card sticky top-[calc(var(--navbar-h)_+_1rem)] z-20">
        <CardHeader title="Select Batch" />
        <BatchSelect batches={batches} value={batchId} onChange={pickBatch} />
      </Card>

      {batchId && selectedBatch && (
        <Card>
          <CardHeader title={selectedBatch.name} className="mb-5" />
          {rosterLoading ? (
            <Spinner centered />
          ) : rosterError ? (
            <ErrorState centered message={rosterError} onRetry={() => void pickBatch(batchId)} />
          ) : rows.length === 0 ? (
            <EmptyState icon={<ScrollText size={20} />} title="No active students in this batch" />
          ) : (
            <div className="table-block">
              <SearchFilterBar
                className="max-w-md"
                value={search}
                onChange={setSearch}
                placeholder="Search by name or ID"
                filterLabel="Status"
                allLabel="All students"
                filterValue={statusFilter}
                filterOptions={STATUS_OPTIONS}
                onFilterChange={(value) => setStatusFilter(value as RowStatus | null)}
              />

              {filteredRows.length === 0 ? (
                <EmptyState icon={<Search size={20} />} title="No students match" />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Student</TH>
                      <TH>ID</TH>
                      <TH>Offer Letter</TH>
                      <TH>Certificate</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {filteredRows.map((row) => (
                      <TR key={row.id}>
                        <TD>
                          <StudentLink studentId={row.id} name={row.name} className="font-medium text-[var(--text-primary)] hover:underline" />
                        </TD>
                        <TD className="cell-secondary font-mono">{row.student_code || '—'}</TD>
                        <TD>
                          <DocCell row={row} batch={selectedBatch} kind="offer_letter" onPatch={(p) => patchRow(row.id, p)} />
                        </TD>
                        <TD>
                          <DocCell row={row} batch={selectedBatch} kind="cert" onPatch={(p) => patchRow(row.id, p)} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
