import { useMemo, useState } from 'react';
import { Search, ScrollText, Send, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { StudentLink } from '@/components/students/StudentLink';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { generateAndStoreDocuments, getBatchStudents, sendDocumentEmail, setDocumentShared } from '@/lib/supabase';
import type { Batch, DocumentKind, Student, BatchStudentMapping } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

type Row = Student & { mapping: BatchStudentMapping };
type Patch = Partial<Pick<
  BatchStudentMapping,
  'offer_letter_path' | 'cert_path' | 'offer_letter_shared' | 'cert_shared' | 'offer_letter_shared_at' | 'cert_shared_at'
>>;
type RowStatus = 'missing' | 'pending' | 'shared';

const LABELS: Record<DocumentKind, string> = { offer_letter: 'Offer Letter', cert: 'Certificate' };

const DOC_TYPE_OPTIONS = [
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'cert', label: 'Certificate' },
];

const STATUS_OPTIONS = [
  { value: 'missing', label: 'Not generated' },
  { value: 'pending', label: 'Generated, not shared' },
  { value: 'shared', label: 'Fully shared' },
];

function pathOf(mapping: BatchStudentMapping, kind: DocumentKind) {
  return kind === 'offer_letter' ? mapping.offer_letter_path : mapping.cert_path;
}
function sharedOf(mapping: BatchStudentMapping, kind: DocumentKind) {
  return kind === 'offer_letter' ? mapping.offer_letter_shared : mapping.cert_shared;
}
function statusOf(mapping: BatchStudentMapping, kind: DocumentKind): RowStatus {
  if (!pathOf(mapping, kind)) return 'missing';
  return sharedOf(mapping, kind) ? 'shared' : 'pending';
}

/** One doc's cell, for whichever kind the dropdown currently has selected. */
function DocCell({ row, batch, kind, onPatch }: { row: Row; batch: Batch; kind: DocumentKind; onPatch: (patch: Patch) => void }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const path = pathOf(row.mapping, kind);
  const shared = sharedOf(row.mapping, kind);

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

  // Missing, not stale: generation already runs automatically on enrolment, so this only
  // covers a row from before that existed, or one where the background attempt failed.
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
      onPatch(await setDocumentShared(row.mapping.id, kind, !shared));
    } catch (err) {
      showToast(errorMessage(err, 'Could not update the release'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={() => void toggle()} disabled={busy} className="disabled:opacity-50">
      <Badge variant={shared ? 'success' : 'default'} dot>{shared ? 'Shared' : 'Not shared'}</Badge>
    </button>
  );
}

/**
 * A batch's document roster: search/filter, a doc-type switch, and per-row or bulk share/email.
 * Shared by the standalone `/documents` page and the Batch Detail "Documents" tab — admin only,
 * the tutor batch-detail page never renders this.
 */
export function BatchDocuments({ batch }: { batch: Batch }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RowStatus | null>(null);
  const [docType, setDocType] = useState<DocumentKind>('offer_letter');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    const roster = await getBatchStudents(batch.id);
    setRows(roster.filter((r) => r.mapping.status === 'active') as Row[]);
  });

  const changeDocType = (value: string) => {
    setDocType(value as DocumentKind);
    setSelected(new Set());
  };

  const patchRow = (studentId: string, patch: Patch) =>
    setRows((current) =>
      current.map((row) => (row.id === studentId ? { ...row, mapping: { ...row.mapping, ...patch } } : row)),
    );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !q || row.name.toLowerCase().includes(q) || (row.student_code ?? '').toLowerCase().includes(q);
      const matchesStatus = !statusFilter || statusOf(row.mapping, docType) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter, docType]);

  const selectableRows = filteredRows.filter((row) => pathOf(row.mapping, docType));
  const allSelected = selectableRows.length > 0 && selectableRows.every((row) => selected.has(row.id));

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectableRows.map((row) => row.id)));

  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const bulkShare = async () => {
    setBulkBusy(true);
    const ids = [...selected];
    const outcomes = await Promise.allSettled(
      ids.map(async (id) => {
        const target = rows.find((row) => row.id === id)!;
        patchRow(id, await setDocumentShared(target.mapping.id, docType, true));
      }),
    );
    const ok = outcomes.filter((o) => o.status === 'fulfilled').length;
    showToast(ok === ids.length ? `Shared with ${ok}` : `Shared with ${ok} of ${ids.length}`, ok === ids.length ? 'success' : 'error');
    setSelected(new Set());
    setBulkBusy(false);
  };

  const bulkEmail = async () => {
    setBulkBusy(true);
    const ids = [...selected];
    const outcomes = await Promise.allSettled(ids.map((id) => sendDocumentEmail(id, batch.id, docType)));
    const ok = outcomes.filter((o) => o.status === 'fulfilled').length;
    showToast(ok === ids.length ? `Emailed ${ok}` : `Emailed ${ok} of ${ids.length}`, ok === ids.length ? 'success' : 'error');
    setSelected(new Set());
    setBulkBusy(false);
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (rows.length === 0) return <EmptyState icon={<ScrollText size={20} />} title="No active students in this batch" />;

  return (
    <div className="table-block">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

        {selected.size === 0 ? (
          <SearchSelect
            options={DOC_TYPE_OPTIONS}
            value={docType}
            onChange={changeDocType}
            placeholder="Offer Letter"
            triggerLabel={LABELS[docType]}
            searchPlaceholder=""
            emptyText=""
            showSearch={false}
            className="!w-auto !max-w-none"
          />
        ) : (
          <div className="table-toolbar">
            <span className="text-xs text-[var(--text-muted)]">{selected.size} selected</span>
            <Button size="sm" variant="secondary" className="action-button-compact" loading={bulkBusy} onClick={() => void bulkShare()}>
              <Share2 size={14} /> Share
            </Button>
            <Button size="sm" className="action-button-compact" loading={bulkBusy} onClick={() => void bulkEmail()}>
              <Send size={14} /> Email
            </Button>
          </div>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState icon={<Search size={20} />} title="No students match" />
      ) : (
        <Table maxHeight="none">
          <THead>
            <TR>
              <TH align="center" className="w-10">
                <input
                  type="checkbox"
                  className="data-table-checkbox"
                  checked={allSelected}
                  disabled={selectableRows.length === 0}
                  onChange={toggleAll}
                />
              </TH>
              <TH>Student</TH>
              <TH>ID</TH>
              <TH>{LABELS[docType]}</TH>
            </TR>
          </THead>
          <TBody>
            {filteredRows.map((row) => {
              const path = pathOf(row.mapping, docType);
              return (
                <TR key={row.id}>
                  <TD align="center">
                    <input
                      type="checkbox"
                      className="data-table-checkbox"
                      checked={selected.has(row.id)}
                      disabled={!path}
                      onChange={() => toggleOne(row.id)}
                    />
                  </TD>
                  <TD>
                    <StudentLink studentId={row.id} name={row.name} className="font-medium text-[var(--text-primary)] hover:underline" />
                  </TD>
                  <TD className="cell-secondary font-mono">{row.student_code || '—'}</TD>
                  <TD>
                    <DocCell row={row} batch={batch} kind={docType} onPatch={(p) => patchRow(row.id, p)} />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
