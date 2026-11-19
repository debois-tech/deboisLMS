import { useMemo, useState } from 'react';
import { Eye, FilePlus2, LockOpen, Mail, Search, ScrollText, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { StudentLink } from '@/components/students/StudentLink';
import { DocumentActionModal, type DocAction, type DocumentRow } from '@/components/documents/DocumentActionModal';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { deleteStoredDocument, getBatchStudents, viewStoredDocument } from '@/lib/supabase';
import type { Batch, BatchStudentMapping, DocumentKind } from '@/lib/types';
import { DOC_LABELS, docLocked, docPath, docShared, docStatus, type DocStatus } from '@/lib/utils/documents';
import { errorMessage } from '@/lib/utils/errors';

type Patch = Partial<BatchStudentMapping>;

const DOC_TYPE_OPTIONS = [
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'cert', label: 'Certificate' },
];

const STATUS_OPTIONS: { value: DocStatus; label: string }[] = [
  { value: 'missing', label: 'Not generated' },
  { value: 'pending', label: 'Generated, no access' },
  { value: 'shared', label: 'Access' },
];

const iconBase =
  'flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] disabled:opacity-50';
const iconButton = `${iconBase} h-8 w-8`;
// The row's one destructive control gets a full 44px target.
const deleteButton = `${iconBase} h-11 w-11`;

// A row's document status, access badge and delete button, for whichever kind the dropdown has selected.
function RowCells({ row, batch, kind, onPatch }: { row: DocumentRow; batch: Batch; kind: DocumentKind; onPatch: (patch: Patch) => void }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const path = docPath(row.mapping, kind);
  const shared = docShared(row.mapping, kind);
  const locked = docLocked(row.mapping, batch);
  const label = DOC_LABELS[kind].toLowerCase();

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

  const remove = async () => {
    const accepted = await confirm({
      title: `Delete the ${label}?`,
      message: 'The file, its record and access go. A copy already emailed stays.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (accepted) await run(async () => onPatch(await deleteStoredDocument(row.mapping.id, kind)), `Could not delete the ${label}`);
  };

  return (
    <>
      <TD>
        <div className="flex items-center gap-2">
          <Badge variant={path ? 'success' : 'default'} dot>{path ? 'Generated' : 'Not generated'}</Badge>
          {path && (
            <button type="button" onClick={() => void view()} disabled={busy} aria-label={`View ${label}`} className={iconButton}>
              <Eye size={15} />
            </button>
          )}
        </div>
      </TD>
      <TD>
        {path
          ? <Badge variant={shared ? 'success' : 'default'} dot>{shared ? 'Access' : 'No access'}</Badge>
          : <span className="cell-muted">—</span>}
      </TD>
      <TD align="center">
        {path && !locked && (
          <button type="button" onClick={() => void remove()} disabled={busy} aria-label={`Delete ${label}`} className={deleteButton}>
            <Trash2 size={15} />
          </button>
        )}
      </TD>
    </>
  );
}

/**
 * A batch's document roster: search/filter, a doc-type switch and three popups — Access, Email, Generate.
 * Shared by the standalone `/documents` page and the Batch Detail "Documents" tab — admin and developer only,
 * the tutor batch-detail page never renders this.
 */
export function BatchDocuments({ batch }: { batch: Batch }) {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocStatus | null>(null);
  const [kind, setKind] = useState<DocumentKind>('offer_letter');
  const [action, setAction] = useState<DocAction | null>(null);
  // Kept while the modal animates out, so its title and list do not swap to another action.
  const [shown, setShown] = useState<DocAction>('access');

  const { loading, error, retry } = useInitialLoad(async () => {
    const roster = await getBatchStudents(batch.id);
    setRows(roster.filter((r) => r.mapping.status === 'active') as DocumentRow[]);
  });

  const patchRow = (studentId: string, patch: Patch) =>
    setRows((current) =>
      current.map((row) => (row.id === studentId ? { ...row, mapping: { ...row.mapping, ...patch } } : row)),
    );

  const openAction = (next: DocAction) => {
    setShown(next);
    setAction(next);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !q || row.name.toLowerCase().includes(q) || (row.student_code ?? '').toLowerCase().includes(q);
      const matchesStatus = !statusFilter || docStatus(row.mapping, kind) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter, kind]);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (rows.length === 0) return <EmptyState icon={<ScrollText size={20} />} title="No active students in this batch" />;

  return (
    <div className="table-block">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name or ID"
          filterLabel="Status"
          allLabel="All students"
          filterValue={statusFilter}
          filterOptions={STATUS_OPTIONS}
          onFilterChange={(value) => setStatusFilter(value as DocStatus | null)}
        />

        <div className="table-toolbar">
          <SearchSelect
            options={DOC_TYPE_OPTIONS}
            value={kind}
            onChange={(value) => setKind(value as DocumentKind)}
            placeholder="Offer Letter"
            triggerLabel={DOC_LABELS[kind]}
            searchPlaceholder=""
            emptyText=""
            showSearch={false}
            className="!w-auto !max-w-none"
          />
          <Button size="sm" variant="secondary" className="action-button-compact" onClick={() => openAction('access')}>
            <LockOpen size={14} /> Access
          </Button>
          <Button size="sm" variant="secondary" className="action-button-compact" onClick={() => openAction('email')}>
            <Mail size={14} /> Email
          </Button>
          <Button size="sm" className="action-button-compact" onClick={() => openAction('generate')}>
            <FilePlus2 size={14} /> Generate
          </Button>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState icon={<Search size={20} />} title="No students match" />
      ) : (
        <Table maxHeight="none">
          <THead>
            <TR>
              <TH>Student</TH>
              <TH>ID</TH>
              <TH>{DOC_LABELS[kind]}</TH>
              <TH>Access</TH>
              <TH><span className="sr-only">Delete</span></TH>
            </TR>
          </THead>
          <TBody>
            {filteredRows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <StudentLink studentId={row.id} name={row.name} className="font-medium text-[var(--text-primary)] hover:underline" />
                </TD>
                <TD className="cell-secondary font-mono">{row.student_code || '—'}</TD>
                <RowCells row={row} batch={batch} kind={kind} onPatch={(patch) => patchRow(row.id, patch)} />
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <DocumentActionModal
        open={action !== null}
        mode={shown}
        kind={kind}
        batch={batch}
        rows={rows}
        onClose={() => setAction(null)}
        onPatch={patchRow}
      />
    </div>
  );
}
