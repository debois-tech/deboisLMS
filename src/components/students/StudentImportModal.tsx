import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { findProgramMismatches, getImportFee, parseStudentCsv } from '@/lib/utils/studentImport';
import { errorMessage } from '@/lib/utils/errors';
import type { BatchProgram, BatchProgramOption } from '@/lib/types';

interface StudentImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Programme list for a caller with no batch of its own. Shows names, validates on the code. */
  programs?: BatchProgramOption[];
  /** Pass the batch's own programme instead, from a batch page. Rows are checked against it. */
  batchProgram?: BatchProgram;
  /** Throw to show a message; the modal owns the busy state. */
  onImport: (
    rows: Record<string, string>[],
    fallbackFee: number | undefined,
    createLogins: boolean,
    program: BatchProgram | undefined,
  ) => Promise<void>;
}

const PREVIEW_ROWS = 5;

/** The one CSV import dialog, shared by the students list and a batch's students tab. */
export function StudentImportModal({ open, onClose, programs, batchProgram, onImport }: StudentImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fee, setFee] = useState('');
  const [program, setProgram] = useState<BatchProgram | null>(batchProgram ?? null);
  const [createLogins, setCreateLogins] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The batch page already knows its programme; the students page asks for one.
  const target = batchProgram ?? program;
  const needsProgram = Boolean(programs) && !batchProgram;

  // The sheet carries a fee per student now. The field below only covers rows
  // that left it blank, so a complete sheet never has to answer it.
  const missingFee = useMemo(() => rows.filter((row) => getImportFee(row) === undefined).length, [rows]);
  const mismatches = useMemo(
    () => (target ? findProgramMismatches(rows, target) : []),
    [rows, target],
  );

  const incomplete =
    !rows.length ||
    (needsProgram && !program) ||
    (missingFee > 0 && (!fee || Number(fee) < 0)) ||
    mismatches.length > 0;

  const reset = () => {
    setRows([]);
    setHeaders([]);
    setFee('');
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
    if (missingFee > 0 && !fee) {
      setError(`${missingFee} rows have no fee. Enter one to cover them.`);
      return;
    }
    setImporting(true);
    setError('');
    try {
      await onImport(rows, fee ? Number(fee) : undefined, createLogins, target ?? undefined);
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

        {headers.length > 0 && rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Preview ({rows.length} students)
            </p>
            <div className="import-preview">
              <table>
                <thead>
                  <tr>
                    {headers.map((header) => <th key={header}>{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                    <tr key={index}>
                      {headers.map((header) => <td key={header}>{row[header] || '—'}</td>)}
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
          </div>
        )}

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
            <p className="field-hint">Students join the open batch running this programme.</p>
          </FormField>
        )}

        {/* Only asked when the sheet left it out, so a complete file skips it. */}
        {missingFee > 0 && (
          <FormField label={missingFee === rows.length ? 'Fee per student' : 'Fee for rows without one'} required>
            <input
              type="number"
              min="0"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              placeholder="e.g. 15000"
              disabled={importing}
            />
            <p className="field-hint">
              {missingFee === rows.length
                ? 'No Fees column found in this file.'
                : `${missingFee} of ${rows.length} rows have no fee.`}
            </p>
          </FormField>
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
