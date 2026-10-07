import { useMemo, useState } from 'react';
import { Eye, FilePlus2, RotateCw, Search, ScrollText, Send, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { StudentLink } from '@/components/students/StudentLink';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { generateAndStoreDocument, getBatchStudents, logFailures, sendDocumentEmail, setDocumentShared, viewStoredDocument } from '@/lib/supabase';
import type { Batch, DocumentKind, Student, BatchStudentMapping } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

type Row = Student & { mapping: BatchStudentMapping };
type Patch = Partial<Pick<
  BatchStudentMapping,
  'offer_letter_path' | 'cert_path' | 'offer_letter_shared' | 'cert_shared' | 'offer_letter_shared_at' | 'cert_shared_at'
>>;
type RowStatus = 'missing' | 'pending' | 'shared';

const LABELS: Record<DocumentKind, string> = { offer_letter: 'Offer Letter', cert: 'Certificate' };

// "Both" works on the offer letter and the certificate together: one set of buttons, two columns.
type DocType = DocumentKind | 'both';
const KINDS: Record<DocType, DocumentKind[]> = { offer_letter: ['offer_letter'], cert: ['cert'], both: ['offer_letter', 'cert'] };
const TYPE_LABELS: Record<DocType, string> = { ...LABELS, both: 'Both' };

const DOC_TYPE_OPTIONS = [
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'cert', label: 'Certificate' },
  { value: 'both', label: 'Both' },
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
/** Across several documents the weakest one decides: any missing, else any unshared, else shared. */
function statusAcross(mapping: BatchStudentMapping, kinds: DocumentKind[]): RowStatus {
  const all = kinds.map((kind) => statusOf(mapping, kind));
  return all.includes('missing') ? 'missing' : all.includes('pending') ? 'pending' : 'shared';
}

/** One doc's cell, for whichever kind the dropdown currently has selected. */
function DocCell({ row, batch, kind, onPatch }: { row: Row; batch: Batch; kind: DocumentKind; onPatch: (patch: Patch) => void }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const path = pathOf(row.mapping, kind);
  const shared = sharedOf(row.mapping, kind);

  const generate = async () => {
    setBusy(true);
    try {
      onPatch(await generateAndStoreDocument(kind, row.mapping, row, batch));
    } catch (err) {
      showToast(errorMessage(err, `Could not generate the ${LABELS[kind].toLowerCase()}`), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Nothing is generated automatically, not even for a student who has just joined: every document is made
  // by this button, from the student's role and the batch's dates.
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

  // Locked once the batch has ended and both documents are generated and shared
  const locked = Boolean(batch.ended_at) && statusAcross(row.mapping, KINDS.both) === 'shared';

  const regenerate = async () => {
    const accepted = await confirm({
      title: `Regenerate the ${LABELS[kind].toLowerCase()}?`,
      message: 'Replaces the current file. A copy already emailed stays as it was.',
      confirmLabel: 'Regenerate',
      danger: true,
    });
    if (accepted) await generate();
  };

  const view = async () => {
    try {
      await viewStoredDocument(path);
    } catch (err) {
      showToast(errorMessage(err, `Could not open the ${LABELS[kind].toLowerCase()}`), 'error');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => void toggle()} disabled={busy} className="disabled:opacity-50">
        <Badge variant={shared ? 'success' : 'default'} dot>{shared ? 'Shared' : 'Not shared'}</Badge>
      </button>
      <button
        type="button"
        onClick={() => void view()}
        aria-label={`View ${LABELS[kind].toLowerCase()}`}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
      >
        <Eye size={15} />
      </button>
      {!locked && (
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={busy}
          aria-label={`Regenerate ${LABELS[kind].toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          <RotateCw size={15} />
        </button>
      )}
    </div>
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
  const [docType, setDocType] = useState<DocType>('offer_letter');
  const kinds = KINDS[docType];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    const roster = await getBatchStudents(batch.id);
    setRows(roster.filter((r) => r.mapping.status === 'active') as Row[]);
  });

  const changeDocType = (value: string) => {
    setDocType(value as DocType);
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
      const matchesStatus = !statusFilter || statusAcross(row.mapping, KINDS[docType]) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter, docType]);

  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.has(row.id));

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filteredRows.map((row) => row.id)));

  // Generating, sharing and emailing each act on the selected documents they apply to: share and email need a
  // generated one, generate needs one that does not exist yet. With "Both" that is up to two per student.
  const picked = rows.filter((row) => selected.has(row.id));
  const jobs = (wanted: (row: Row, kind: DocumentKind) => boolean) =>
    picked.flatMap((row) => kinds.filter((kind) => wanted(row, kind)).map((kind) => ({ row, kind })));
  const toGenerate = jobs((row, kind) => !pathOf(row.mapping, kind));
  const toSend = jobs((row, kind) => Boolean(pathOf(row.mapping, kind)));

  // Names the document too when there are two, so a failure points at the right one.
  const tag = (row: Row, kind: DocumentKind) => (kinds.length > 1 ? `${row.name} (${LABELS[kind]})` : row.name);

  // One at a time, and the first failure is read out: a rate limit or a missing release says so, not just a count.
  const runOneByOne = async (verb: string, work: typeof toSend, act: (row: Row, kind: DocumentKind) => Promise<void>) => {
    setBulkBusy(true);
    const failures: string[] = [];
    for (const { row, kind } of work) {
      try {
        await act(row, kind);
      } catch (err) {
        failures.push(`${tag(row, kind)}: ${errorMessage(err, 'failed')}`);
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
  const bulkGenerate = () =>
    runOneByOne('Generated', toGenerate, async (row, kind) => {
      patchRow(row.id, await generateAndStoreDocument(kind, row.mapping, row, batch));
    });

  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const bulkShare = () =>
    runOneByOne('Shared', toSend, async (row, kind) => {
      patchRow(row.id, await setDocumentShared(row.mapping.id, kind, true));
    });

  // Mail goes out one by one: the email service rate-limits a burst. A document still unshared is refused with its reason.
  const bulkEmail = () => runOneByOne('Emailed', toSend, (row, kind) => sendDocumentEmail(row.id, batch.id, kind));

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
            triggerLabel={TYPE_LABELS[docType]}
            searchPlaceholder=""
            emptyText=""
            showSearch={false}
            className="!w-auto !max-w-none"
          />
        ) : (
          <div className="table-toolbar">
            <span className="text-xs text-[var(--text-muted)]">{selected.size} selected</span>
            {toGenerate.length > 0 && (
              <Button size="sm" className="action-button-compact" loading={bulkBusy} disabled={bulkBusy} onClick={() => void bulkGenerate()}>
                <FilePlus2 size={14} /> Generate {toGenerate.length}
              </Button>
            )}
            {toSend.length > 0 && (
              <>
                <Button size="sm" variant="secondary" className="action-button-compact" loading={bulkBusy} disabled={bulkBusy} onClick={() => void bulkShare()}>
                  <Share2 size={14} /> Share {toSend.length}
                </Button>
                <Button size="sm" variant="secondary" className="action-button-compact" loading={bulkBusy} disabled={bulkBusy} onClick={() => void bulkEmail()}>
                  <Send size={14} /> Email {toSend.length}
                </Button>
              </>
            )}
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
                  onChange={toggleAll}
                />
              </TH>
              <TH>Student</TH>
              <TH>ID</TH>
              {kinds.map((kind) => <TH key={kind}>{LABELS[kind]}</TH>)}
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
                      onChange={() => toggleOne(row.id)}
                    />
                  </TD>
                  <TD>
                    <StudentLink studentId={row.id} name={row.name} className="font-medium text-[var(--text-primary)] hover:underline" />
                  </TD>
                  <TD className="cell-secondary font-mono">{row.student_code || '—'}</TD>
                  {kinds.map((kind) => (
                    <TD key={kind}>
                      <DocCell row={row} batch={batch} kind={kind} onPatch={(p) => patchRow(row.id, p)} />
                    </TD>
                  ))}
                </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
