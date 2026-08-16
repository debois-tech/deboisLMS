import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SearchSelect } from '@/components/ui/SearchSelect';
import {
  feeFromDiscount,
  findDiscountProblems,
  findProgramMismatches,
  getImportDiscount,
  parseStudentCsv,
} from '@/lib/utils/studentImport';
import { errorMessage } from '@/lib/utils/errors';
import { formatCurrency } from '@/lib/utils/format';
import type { BatchProgram, BatchProgramOption } from '@/lib/types';

interface StudentImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Programme list for a caller with no batch of its own. Shows names, validates on the code. */
  programs?: BatchProgramOption[];
  /** Pass the batch's own programme instead, from a batch page. Rows are checked against it. */
  batchProgram?: BatchProgram;
  /**
   * The target batch's full fee, which every row's Discount % comes off. Returns
   * `problem` instead when there is none to apply — no batch resolved, or a batch
   * with no base fee set. The import blocks on that sentence rather than running
   * every row at zero, so the caller owns the wording of its own failure.
   */
  baseFee: (program: BatchProgram | undefined) => { fee: number } | { problem: string };
  /** Throw to show a message; the modal owns the busy state. */
  onImport: (
    rows: Record<string, string>[],
    createLogins: boolean,
    program: BatchProgram | undefined,
  ) => Promise<void>;
}

const PREVIEW_ROWS = 5;

/** The one CSV import dialog, shared by the students list and a batch's students tab. */
export function StudentImportModal({ open, onClose, programs, batchProgram, baseFee, onImport }: StudentImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [program, setProgram] = useState<BatchProgram | null>(batchProgram ?? null);
  const [createLogins, setCreateLogins] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The batch page already knows its programme; the students page asks for one.
  const target = batchProgram ?? program;
  const needsProgram = Boolean(programs) && !batchProgram;
  const resolved = target ? baseFee(target) : null;
  const base = resolved && 'fee' in resolved ? resolved.fee : null;
  const blocker = resolved && 'problem' in resolved ? resolved.problem : '';

  const mismatches = useMemo(
    () => (target ? findProgramMismatches(rows, target) : []),
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
    (needsProgram && !program) ||
    base === null ||
    discountProblems.length > 0 ||
    mismatches.length > 0;

  const reset = () => {
    setRows([]);
    setHeaders([]);
    setProgram(batchProgram ?? null);
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
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    if (needsProgram && !program) {
      setError('Choose the programme these students join.');
      return;
    }
    if (base === null) {
      setError(blocker || 'There is no base fee to take these discounts off.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      await onImport(rows, createLogins, target ?? undefined);
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

        {needsProgram && programs && (
          <FormField label="Programme" required>
            <SearchSelect
              options={programs.map((option) => ({ value: option.code, label: option.name }))}
              value={program}
              onChange={(code) => { setProgram(code as BatchProgram); setError(''); }}
              placeholder="Select programme"
              searchPlaceholder="Search programmes"
              emptyText="No programmes found"
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
                  <span><strong>{formatCurrency(base)}</strong> base fee</span>
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
                  {rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                    <tr key={index}>
                      {headers.map((header) => <td key={header}>{row[header] || '—'}</td>)}
                      <td className="import-preview-derived">
                        {base === null ? '—' : formatCurrency(feeFromDiscount(base, getImportDiscount(row)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > PREVIEW_ROWS && (
              <p className="text-xs text-[var(--text-muted)]">
                Showing {PREVIEW_ROWS} of {rows.length} rows.
              </p>
            )}
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
