import { useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { parseStudentCsv } from '@/lib/utils/studentImport';
import { errorMessage } from '@/lib/utils/errors';

interface StudentImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Batch enrolment needs a per-student fee; the global students list does not. */
  requireFee?: boolean;
  /**
   * Throw to surface a message in the dialog; the modal owns the busy state.
   * `createLogins` reflects the checkbox — the caller decides what that means,
   * since only it knows which students the rows resolved to.
   */
  onImport: (rows: Record<string, string>[], fee?: number, createLogins?: boolean) => Promise<void>;
}

const PREVIEW_ROWS = 5;

/** The one CSV import dialog, shared by the students list and a batch's students tab. */
export function StudentImportModal({ open, onClose, requireFee, onImport }: StudentImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fee, setFee] = useState('');
  const [createLogins, setCreateLogins] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setHeaders([]);
    setFee('');
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
    if (requireFee && (!fee || Number(fee) <= 0)) {
      setError('Total fee per student is required to import.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      await onImport(rows, requireFee ? Number(fee) : undefined, createLogins);
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

        {requireFee && (
          <FormField label="Fee per student" required>
            <input
              type="number"
              min="1"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              placeholder="e.g. 15000"
              disabled={importing}
            />
          </FormField>
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
            disabled={!rows.length || (requireFee && (!fee || Number(fee) <= 0))}
          >
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}
