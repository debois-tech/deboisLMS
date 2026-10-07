import { useMemo, useState } from 'react';
import { Eye, FilePlus2, Mail, RotateCw, Search, ScrollText, Send, Share2, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { StudentLink } from '@/components/students/StudentLink';
import { DocumentDatesFields, EMPTY_DATES, datesReady } from '@/components/documents/DocumentDatesFields';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import {
  deleteStoredDocument,
  generateAndStoreDocument,
  getBatchStudents,
  logFailures,
  sendDocumentEmail,
  setDocumentShared,
  viewStoredDocument,
} from '@/lib/supabase';
import type { Batch, DocumentKind, Student, BatchStudentMapping } from '@/lib/types';
import type { DocumentDates } from '@/lib/utils/documents';
import { errorMessage } from '@/lib/utils/errors';

type Row = Student & { mapping: BatchStudentMapping };
type Patch = Partial<BatchStudentMapping>;
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
// Locked once the batch has ended and both documents are generated and shared
function isLocked(row: Row, batch: Batch) {
  return Boolean(batch.ended_at) && statusOf(row.mapping, 'offer_letter') === 'shared' && statusOf(row.mapping, 'cert') === 'shared';
}

const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] disabled:opacity-50';

// A row's status, release switch and buttons, for whichever kind the dropdown has selected
function DocCells({ row, batch, kind, onPatch }: { row: Row; batch: Batch; kind: DocumentKind; onPatch: (patch: Patch) => void }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [redoing, setRedoing] = useState(false);
  const [dates, setDates] = useState<DocumentDates>(EMPTY_DATES);
  const path = pathOf(row.mapping, kind);
  const shared = Boolean(sharedOf(row.mapping, kind));
  const label = LABELS[kind].toLowerCase();
  const locked = isLocked(row, batch);

  const run = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      showToast(errorMessage(err, fallback), 'error');
    } finally {
      setBusy(false);
    }
  };

  const view = () => run(() => viewStoredDocument(path!), `Could not open the ${label}`);
  const toggle = () => run(async () => onPatch(await setDocumentShared(row.mapping.id, kind, !shared)), 'Could not update the release');

  const email = () =>
    run(async () => {
      try {
        await sendDocumentEmail(row.id, batch.id, kind);
      } catch (err) {
        void logFailures('document_email', [`${row.name}: ${errorMessage(err, 'failed')}`]);
        throw err;
      }
      showToast(`Emailed ${row.name}`);
    }, 'Could not send the email');

  const regenerate = () =>
    run(async () => {
      onPatch(await generateAndStoreDocument(kind, row.mapping, row, batch, dates));
      setRedoing(false);
    }, `Could not generate the ${label}`);

  const remove = async () => {
    const accepted = await confirm({
      title: `Delete the ${label}?`,
      message: 'Removes the file and its record. A copy already emailed stays as it was.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (accepted) await run(async () => onPatch(await deleteStoredDocument(row.mapping.id, kind)), `Could not delete the ${label}`);
  };

  const openRegenerate = () => {
    setDates(EMPTY_DATES);
    setRedoing(true);
  };

  return (
    <>
      <TD>
        <div className="flex items-center gap-2">
          <Badge variant={path ? 'success' : 'warning'} dot>{path ? 'Generated' : 'Not generated'}</Badge>
          {path && (
            <button type="button" onClick={() => void view()} disabled={busy} aria-label={`View ${label}`} className={iconButton}>
              <Eye size={15} />
            </button>
          )}
        </div>
      </TD>
      <TD>
        <Switch checked={shared} onChange={() => void toggle()} disabled={!path || busy} label={`Share ${label}`} />
      </TD>
      <TD>
        <div className="flex items-center gap-1">
          {path && !locked && (
            <button type="button" onClick={openRegenerate} disabled={busy} aria-label={`Regenerate ${label}`} className={iconButton}>
              <RotateCw size={15} />
            </button>
          )}
          <button type="button" onClick={() => void email()} disabled={!shared || busy} aria-label={`Email ${label}`} className={iconButton}>
            <Mail size={15} />
          </button>
          {path && !locked && (
            <button type="button" onClick={() => void remove()} disabled={busy} aria-label={`Delete ${label}`} className={iconButton}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </TD>
      <Modal
        open={redoing}
        onClose={() => setRedoing(false)}
        title={`Regenerate ${label}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRedoing(false)}>Cancel</Button>
            <Button className="action-button-compact" loading={busy} disabled={!datesReady(dates)} onClick={() => void regenerate()}>Regenerate</Button>
          </>
        }
      >
        <DocumentDatesFields value={dates} onChange={setDates} />
      </Modal>
    </>
  );
}

/**
 * A batch's document roster: search/filter, a doc-type switch, bulk generate, and per-row or bulk share/email.
 * Shared by the standalone `/documents` page and the Batch Detail "Documents" tab — admin only,
 * the tutor batch-detail page never renders this.
 */
export function BatchDocuments({ batch }: { batch: Batch }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RowStatus | null>(null);
  const [kind, setKind] = useState<DocumentKind>('offer_letter');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [dates, setDates] = useState<DocumentDates>(EMPTY_DATES);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    const roster = await getBatchStudents(batch.id);
    setRows(roster.filter((r) => r.mapping.status === 'active') as Row[]);
  });

  const changeKind = (value: string) => {
    setKind(value as DocumentKind);
    setSelected(new Set());
  };

  const toggleBulk = () => {
    setBulkMode((on) => !on);
    setDates(EMPTY_DATES);
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
      const matchesStatus = !statusFilter || statusOf(row.mapping, kind) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter, kind]);

  // In bulk mode a locked row cannot be replaced, so it cannot be ticked
  const tickable = filteredRows.filter((row) => !(bulkMode && isLocked(row, batch)));
  const allSelected = tickable.length > 0 && tickable.every((row) => selected.has(row.id));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(tickable.map((row) => row.id)));

  const picked = rows.filter((row) => selected.has(row.id));
  const toSend = picked.filter((row) => pathOf(row.mapping, kind));

  // One at a time, and the first failure is read out: a rate limit or a missing release says so, not just a count.
  const runOneByOne = async (verb: string, work: Row[], act: (row: Row) => Promise<void>) => {
    setBulkBusy(true);
    const failures: string[] = [];
    for (const row of work) {
      try {
        await act(row);
      } catch (err) {
        failures.push(`${row.name}: ${errorMessage(err, 'failed')}`);
      }
    }
    if (verb === 'Emailed') void logFailures('document_email', failures);
    const ok = work.length - failures.length;
    showToast(
      failures.length === 0
        ? `${verb} ${ok}`
        : `${verb} ${ok} of ${work.length}. ${failures[0]}${failures.length > 1 ? ` (+${failures.length - 1} more)` : ''}`,
      failures.length === 0 ? 'success' : 'error',
    );
    setSelected(new Set());
    setBulkBusy(false);
  };

  // Each is a PDF built in the browser and an upload.
  const bulkGenerate = async () => {
    await runOneByOne('Generated', picked, async (row) => {
      patchRow(row.id, await generateAndStoreDocument(kind, row.mapping, row, batch, dates));
    });
    toggleBulk();
  };

  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const bulkShare = () =>
    runOneByOne('Shared', toSend, async (row) => {
      patchRow(row.id, await setDocumentShared(row.mapping.id, kind, true));
    });

  // Mail goes out one by one: the email service rate-limits a burst. A document still unshared is refused with its reason.
  const bulkEmail = () => runOneByOne('Emailed', toSend, (row) => sendDocumentEmail(row.id, batch.id, kind));

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (rows.length === 0) return <EmptyState icon={<ScrollText size={20} />} title="No active students in this batch" />;

  return (
    <div className={bulkMode ? 'table-block docs-bulk-active' : 'table-block'}>
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

        <div className="table-toolbar">
          {!bulkMode && toSend.length > 0 && (
            <>
              <Button size="sm" variant="secondary" className="action-button-compact" loading={bulkBusy} disabled={bulkBusy} onClick={() => void bulkShare()}>
                <Share2 size={14} /> Share {toSend.length}
              </Button>
              <Button size="sm" variant="secondary" className="action-button-compact" loading={bulkBusy} disabled={bulkBusy} onClick={() => void bulkEmail()}>
                <Send size={14} /> Email {toSend.length}
              </Button>
            </>
          )}
          <SearchSelect
            options={DOC_TYPE_OPTIONS}
            value={kind}
            onChange={changeKind}
            placeholder="Offer Letter"
            triggerLabel={LABELS[kind]}
            searchPlaceholder=""
            emptyText=""
            showSearch={false}
            className="!w-auto !max-w-none"
          />
          <Button size="sm" variant={bulkMode ? 'ghost' : 'secondary'} className="action-button-compact" disabled={bulkBusy} onClick={toggleBulk}>
            {bulkMode ? <><X size={14} /> Cancel</> : <><FilePlus2 size={14} /> Bulk generate</>}
          </Button>
        </div>
      </div>

      {bulkMode && (
        <div className="docs-bulk-panel">
          <DocumentDatesFields value={dates} onChange={setDates} />
          {toSend.length > 0 && <InlineAlert>{toSend.length} existing {toSend.length === 1 ? 'document' : 'documents'} replaced</InlineAlert>}
          <div className="docs-bulk-actions">
            <Button className="action-button-compact" loading={bulkBusy} disabled={bulkBusy || picked.length === 0 || !datesReady(dates)} onClick={() => void bulkGenerate()}>
              Generate {picked.length}
            </Button>
          </div>
                  </div>
      )}

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
                  disabled={tickable.length === 0}
                  onChange={toggleAll}
                />
              </TH>
              <TH>Student</TH>
              <TH>ID</TH>
              <TH>{LABELS[kind]}</TH>
              <TH>Shared</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filteredRows.map((row) => (
              <TR key={row.id}>
                <TD align="center">
                  <input
                    type="checkbox"
                    className="data-table-checkbox"
                    checked={selected.has(row.id)}
                    disabled={bulkMode && isLocked(row, batch)}
                    onChange={() => toggleOne(row.id)}
                  />
                </TD>
                <TD>
                  <StudentLink studentId={row.id} name={row.name} className="font-medium text-[var(--text-primary)] hover:underline" />
                </TD>
                <TD className="cell-secondary font-mono">{row.student_code || '—'}</TD>
                <DocCells row={row} batch={batch} kind={kind} onPatch={(p) => patchRow(row.id, p)} />
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
