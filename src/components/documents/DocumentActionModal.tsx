import { useState } from 'react';
import { clsx } from 'clsx';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { Modal } from '@/components/ui/Modal';
import { DocumentDatesFields, EMPTY_DATES, datesReady } from '@/components/documents/DocumentDatesFields';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import {
  deleteStoredDocument,
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
    if (mode === 'email') return hasDoc(row) && hasAccess(row);
    if (mode === 'access') return give ? hasDoc(row) : hasAccess(row);
    return !docLocked(row.mapping, batch);
  };

  const reason = (row: DocumentRow) => {
    if (mode === 'generate') return docLocked(row.mapping, batch) ? 'Locked' : null;
    if (!hasDoc(row)) return 'Not generated';
    if (mode === 'email' || !give) return hasAccess(row) ? null : 'No access';
    return null;
  };

  const state = (row: DocumentRow) =>
    mode === 'generate'
      ? (hasDoc(row) ? 'Generated' : 'Not generated')
      : (hasAccess(row) ? 'Access' : 'No access');

  const tone = (row: DocumentRow) =>
    mode === 'generate' ? (hasDoc(row) ? 'success' : 'default') : (hasAccess(row) ? 'success' : 'default');

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
        title: `Replace ${existing.length} existing ${existing.length === 1 ? 'document' : 'documents'}?`,
        message: 'Old files are deleted first. Access resets.',
        confirmLabel: 'Proceed',
        danger: true,
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
          if (hasDoc(row)) onPatch(row.id, await deleteStoredDocument(row.mapping.id, kind));
          onPatch(row.id, await generateAndStoreDocument(kind, row.mapping, row, batch, dates));
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
        : `${verb} ${done} of ${picked.length}. ${failures[0]}${failures.length > 1 ? ` (+${failures.length - 1} more)` : ''}`,
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
            {mode === 'generate' ? 'Generate' : 'Send'}
          </Button>
        </>
      }
    >
      <div className="doc-picker">
        {mode === 'generate' && <DocumentDatesFields value={dates} onChange={setDates} />}

        {mode === 'access' && (
          <FilterTabs
            tabs={[
              { value: 'give', label: 'Give', count: rows.filter(hasDoc).length },
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
          {rows.map((row) => {
            const off = !eligible(row);
            return (
              <label key={row.id} className={clsx('doc-picker-row', off && 'is-off')}>
                <input
                  type="checkbox"
                  className="data-table-checkbox"
                  checked={selected.has(row.id)}
                  disabled={off || busy}
                  onChange={() => toggle(row.id)}
                />
                <span className="doc-picker-copy">
                  <span className="doc-picker-name">{row.name}</span>
                  <span className="doc-picker-code">{row.student_code || '—'}</span>
                </span>
                <Badge variant={off ? 'default' : tone(row)}>{reason(row) ?? state(row)}</Badge>
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
