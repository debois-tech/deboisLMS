import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { Modal } from '@/components/ui/Modal';
import { DocumentDatesFields, EMPTY_DATES, datesReady } from '@/components/documents/DocumentDatesFields';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import {
  generateAndStoreDocument,
  logFailures,
  sendDocumentEmail,
  setDocumentShared,
} from '@/lib/supabase';
import type { Batch, BatchStudentMapping, DocumentKind, Student } from '@/lib/types';
import { DOC_LABELS, docLocked, docPath, docShared, type DocumentDates } from '@/lib/utils/documents';
import { errorMessage } from '@/lib/utils/errors';

export type DocAction = 'access' | 'email' | 'generate';
export type DocumentRow = Student & { mapping: BatchStudentMapping };
type Side = 'give' | 'remove';

const TITLES: Record<DocAction, string> = { access: 'Access', email: 'Email', generate: 'Generate' };

interface Props {
  open: boolean;
  mode: DocAction;
  kind: DocumentKind;
  batch: Batch;
  rows: DocumentRow[];
  onClose: () => void;
  onPatch: (studentId: string, patch: Partial<BatchStudentMapping>) => void;
}

// One roster picker behind Access, Email and Generate: tick students, then send or generate.
export function DocumentActionModal({ open, mode, kind, batch, rows, onClose, onPatch }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [side, setSide] = useState<Side>('give');
  const [dates, setDates] = useState<DocumentDates>(EMPTY_DATES);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const { showToast } = useToast();

  const label = DOC_LABELS[kind];
  const give = side === 'give';

  // Fresh on every open: the close path clears the picks, so nothing is remembered between actions.
  const reset = () => {
    setSelected(new Set());
    setSide('give');
    setDates(EMPTY_DATES);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const hasDoc = (row: DocumentRow) => Boolean(docPath(row.mapping, kind));
  const hasAccess = (row: DocumentRow) => docShared(row.mapping, kind);

  const eligible = (row: DocumentRow) => {
    if (mode === 'email') return hasDoc(row);
    // Giving access again would restamp its date and resurface the student's "Document ready" card.
    if (mode === 'access') return give ? hasDoc(row) && !hasAccess(row) : hasAccess(row);
    return !docLocked(row.mapping, batch);
  };

  // What the badge reports: the document in Generate, access everywhere else.
  const on = (row: DocumentRow) => (mode === 'generate' ? hasDoc(row) : hasAccess(row));
  const state = (row: DocumentRow) => (mode === 'generate' ? (on(row) ? 'Generated' : 'Not generated') : on(row) ? 'Access' : 'No access');

  const available = rows.filter(eligible);
  const allSelected = available.length > 0 && available.every((row) => selected.has(row.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(available.map((row) => row.id)));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const apply = async () => {
    const picked = rows.filter((row) => selected.has(row.id));
    if (picked.length === 0) return;

    const existing = mode === 'generate' ? picked.filter(hasDoc) : [];
    if (existing.length > 0) {
      const proceed = await confirm({
        title: `${existing.length} already ${existing.length === 1 ? 'has' : 'have'} this document`,
        message: 'New ones replace them. Access is removed until given again.',
        confirmLabel: 'Proceed',
        requireCheck: 'Replace the existing documents',
        quick: true,
      });
      if (!proceed) return;
    }

    setBusy(true);
    const failures: string[] = [];
    let done = 0;

    for (const row of picked) {
      try {
        if (mode === 'access') {
          onPatch(row.id, await setDocumentShared(row.mapping.id, kind, give));
        } else if (mode === 'email') {
          await sendDocumentEmail(row.id, batch.id, kind);
        } else {
          // The new file overwrites the old one at the same path, so a failed generate leaves the old document intact.
          const hadAccess = hasAccess(row);
          onPatch(row.id, await generateAndStoreDocument(kind, row.mapping, row, batch, dates));
          if (hadAccess) onPatch(row.id, await setDocumentShared(row.mapping.id, kind, false));
        }
        done++;
      } catch (err) {
        failures.push(`${row.name}: ${errorMessage(err, 'failed')}`);
      }
    }

    if (mode === 'email' && failures.length > 0) void logFailures('document_email', failures);

    const verb = { access: give ? 'Access given to' : 'Access removed for', email: 'Emailed', generate: 'Generated' }[mode];
    showToast(
      failures.length === 0
        ? `${verb} ${done}`
        : `${verb} ${done} of ${picked.length} · ${failures[0]}${failures.length > 1 ? ` (+${failures.length - 1} more)` : ''}`,
      failures.length === 0 ? 'success' : 'error',
    );

    setBusy(false);
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={`${TITLES[mode]} — ${label}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button
            className="action-button-compact"
            loading={busy}
            disabled={busy || selected.size === 0 || (mode === 'generate' && !datesReady(dates))}
            onClick={() => void apply()}
          >
            {mode === 'generate' ? 'Generate' : 'Proceed'}
          </Button>
        </>
      }
    >
      <div className="doc-picker">
        {mode === 'generate' && <DocumentDatesFields value={dates} onChange={setDates} />}

        {mode === 'access' && (
          <FilterTabs
            tabs={[
              { value: 'give', label: 'Give', count: rows.filter((row) => hasDoc(row) && !hasAccess(row)).length },
              { value: 'remove', label: 'Remove', count: rows.filter(hasAccess).length },
            ]}
            value={side}
            onChange={(next) => { setSide(next); setSelected(new Set()); }}
            label="Access"
          />
        )}

        <div className="doc-picker-head">
          <button type="button" className="doc-picker-all" onClick={toggleAll} disabled={available.length === 0 || busy}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          <span className="doc-picker-count">{selected.size} selected</span>
        </div>

        <div className="doc-picker-list" role="group" aria-label={`${TITLES[mode]} ${label}`}>
          {available.length === 0 && <p className="doc-picker-empty">No one to select</p>}
          {available.map((row) => (
            <label key={row.id} className="doc-picker-row">
              <input
                type="checkbox"
                className="data-table-checkbox"
                checked={selected.has(row.id)}
                disabled={busy}
                onChange={() => toggle(row.id)}
              />
              <span className="doc-picker-copy">
                <span className="doc-picker-name">{row.name}</span>
                <span className="doc-picker-code">{row.student_code || '—'}</span>
              </span>
              <Badge variant={on(row) ? 'success' : 'default'}>{state(row)}</Badge>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
