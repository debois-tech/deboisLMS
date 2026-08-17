import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { Pager, usePager } from '@/components/ui/Pager';
import {
  findDiscountProblems,
  findProgramMismatches,
  getImportDiscount,
  parseStudentCsv,
} from '@/lib/utils/studentImport';
import { errorMessage } from '@/lib/utils/errors';
import { feeFromDiscount, formatCurrency, formatDate } from '@/lib/utils/format';
import type { Batch } from '@/lib/types';

interface StudentImportModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Batches a caller with none of its own may import into. The admin names the
   * batch outright rather than a programme the app then has to resolve — two live
   * batches under one programme used to make that resolution impossible.
   */
  batches?: Batch[];
  /** The caller's own batch, from a batch page. Nothing to choose. */
  batch?: Batch;
  /** Throw to show a message; the modal owns the busy state. */
  onImport: (
    rows: Record<string, string>[],
    createLogins: boolean,
    batch: Batch,
  ) => Promise<void>;
}

/** Every row is reachable, a page at a time — a sheet is checked in full or not at all. */
const PREVIEW_ROWS = 5;

/** The one CSV import dialog, shared by the students list and a batch's students tab. */
export function StudentImportModal({ open, onClose, batches, batch, onImport }: StudentImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [createLogins, setCreateLogins] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pager = usePager(rows, PREVIEW_ROWS);

  // A finished batch is not something to import a new intake into.
  const options = useMemo(() => (batches ?? []).filter((b) => b.status !== 'completed'), [batches]);
  const needsBatch = Boolean(batches) && !batch;

  // Everything below hangs off one known batch: its fee, its programme, its id.
  const target = batch ?? options.find((b) => b.id === pickedId) ?? null;
  const base = target?.base_fee ?? null;
  const blocker = target && base === null
    ? `${target.name} has no base fee, so the discounts have nothing to come off. Set one on the batch, then import.`
    : '';

  const mismatches = useMemo(
    () => (target?.program ? findProgramMismatches(rows, target.program) : []),
    [rows, target],
  );
  const discountProblems = useMemo(() => findDiscountProblems(rows), [rows]);

  // What the sheet actually does to the money, before anyone commits to it.
  const outcome = useMemo(() => {
    if (base === null) return null;
    const fees = rows.map((row) => feeFromDiscount(base, getImportDiscount(row)));
    return {
      discounted: fees.filter((fee) => fee < base).length,
      free: fees.filter((fee) => fee === 0).length,
      // No Discount column, or every cell blank. Legitimate, but a silent
      // full-price import is not something to find out about afterwards.
      noDiscounts: rows.every((row) => getImportDiscount(row) === undefined),
    };
  }, [rows, base]);

  const incomplete =
    !rows.length ||
    !target ||
    base === null ||
    discountProblems.length > 0 ||
    mismatches.length > 0;

  const reset = () => {
    setRows([]);
    setHeaders([]);
    setPickedId(null);
    pager.reset();
    setCreateLogins(true);
    setError('');
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseStudentCsv(String(reader.result ?? ''));
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setError(parsed.error);
      // A different sheet starts at its own beginning, not wherever the last one left off.
      pager.reset();
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    if (!target) {
      setError('Choose the batch these students join.');
      return;
    }
    if (base === null) {
      setError(blocker);
      return;
    }
    setImporting(true);
    setError('');
    try {
      await onImport(rows, createLogins, target);
      reset();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Import failed. Some rows may already exist.'));
      setImporting(false);
    }
  };

  return (
    <Modal open={open} onClose={importing ? () => {} : close} title="Import Students" size="lg">
      <div className="popup-form-spaced">
        <label className="import-dropzone">
          <FileSpreadsheet size={16} />
          {rows.length > 0 ? 'Choose a different CSV' : 'Choose CSV file'}
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </label>

        {needsBatch && (
          <FormField label="Batch" required>
            <BatchSelect
              batches={options}
              value={pickedId}
              onChange={(id) => { setPickedId(id); setError(''); }}
              // Two batches under one programme are often near-namesakes, and this
              // is the one screen where picking the wrong one misfiles an intake.
              label={(option) => [
                option.name,
                option.start_date ? formatDate(option.start_date) : 'No start date',
              ].join(' · ')}
            />
          </FormField>
        )}

        {headers.length > 0 && rows.length > 0 && (
          <div className="space-y-2">
            {/* The whole point of the preview: what each row will be charged, before
                anyone commits to it. The Fee column is derived, never read. */}
            <p className="import-summary">
              {base === null ? (
                <span>{rows.length} students</span>
              ) : (
                <>
                  <span><strong>{formatCurrency(base)}</strong> Regular Fees</span>
                  <span>{rows.length} students</span>
                  {outcome && outcome.discounted > 0 && <span>{outcome.discounted} discounted</span>}
                  {outcome && outcome.free > 0 && <span>{outcome.free} pay nothing</span>}
                </>
              )}
            </p>
            <div className="import-preview">
              <table>
                <thead>
                  <tr>
                    {headers.map((header) => <th key={header}>{header}</th>)}
                    <th className="import-preview-derived">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.slice.map((row, index) => (
                    <tr key={pager.from + index}>
                      {headers.map((header) => <td key={header}>{row[header] || '—'}</td>)}
                      <td className="import-preview-derived">
                        {base === null ? '—' : formatCurrency(feeFromDiscount(base, getImportDiscount(row)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...pager} onChange={pager.setPage} />
            {base !== null && outcome?.noDiscounts && (
              <p className="text-xs text-[var(--text-muted)]">
                No discounts in this file — every student is charged the full {formatCurrency(base)}.
              </p>
            )}
          </div>
        )}

        {/* Every fee comes off the batch's own number, so there is nothing to import
            into without one. Said as soon as it is known, not swallowed as zeroes. */}
        {blocker && <InlineAlert>{blocker}</InlineAlert>}

        {discountProblems.length > 0 && (
          <InlineAlert>
            {discountProblems.length} {discountProblems.length === 1 ? 'row has' : 'rows have'} a
            discount that is not a percentage between 0 and 100 —{' '}
            {discountProblems.slice(0, 3).map((r) => `${r.name} (${r.found})`).join(', ')}
            {discountProblems.length > 3 ? `, and ${discountProblems.length - 3} more` : ''}. Fix
            those cells and choose the file again. A blank cell is full price.
          </InlineAlert>
        )}

        {mismatches.length > 0 && (
          <InlineAlert>
            {mismatches.length} {mismatches.length === 1 ? 'row belongs' : 'rows belong'} to another
            programme — {mismatches.slice(0, 3).map((r) => `${r.name} (${r.found})`).join(', ')}
            {mismatches.length > 3 ? `, and ${mismatches.length - 3} more` : ''}. Import that
            programme separately, or remove those rows.
          </InlineAlert>
        )}

        {/* Default on: an imported student with no login cannot use the portal. */}
        <label className={`repo-confirm ${createLogins ? 'is-checked' : ''}`}>
          <input
            type="checkbox"
            checked={createLogins}
            onChange={(event) => setCreateLogins(event.target.checked)}
            disabled={importing}
          />
          Create portal logins for these students
        </label>

        {createLogins && (
          <p className="text-xs text-[var(--text-muted)]">
            Email required. Passwords appear after import. Rows without email are skipped.
          </p>
        )}

        {error && <InlineAlert>{error}</InlineAlert>}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={close} disabled={importing}>Cancel</Button>
          <Button
            className="action-button-import"
            onClick={handleImport}
            loading={importing}
            disabled={incomplete}
          >
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}
