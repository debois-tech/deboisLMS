import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { getStudents, createOrReuseStudent } from '@/lib/supabase';
import type { Student } from '@/lib/types';
import { parseCsvTable } from '@/lib/utils/csvParser';

// Add future student fields here. Matching uses headers, not column positions.
const STUDENT_IMPORT_FIELDS = [
  { key: 'name', aliases: ['name', 'full name', 'student name'] },
  { key: 'phone', aliases: ['phone', 'ph no', 'phone number', 'mobile'] },
  { key: 'email', aliases: ['email', 'email address'] },
  { key: 'github_url', aliases: ['github', 'github link', 'github url', 'githublink'] },
  { key: 'linkedin_url', aliases: ['linkedin', 'linkedin link', 'linkedin url', 'linkedinlink'] },
] as const;

const normalizeCsvHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');
const getImportValue = (row: Record<string, string>, aliases: readonly string[]) => {
  const entry = Object.entries(row).find(([header]) => aliases.some((alias) => normalizeCsvHeader(header) === normalizeCsvHeader(alias)));
  return entry?.[1]?.trim() || undefined;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStudents().then((data) => {
      setStudents(data);
      setLoading(false);
    });
  }, []);

  const resetImport = () => {
    setShowImport(false);
    setImportRows([]);
    setImportHeaders([]);
    setImportError('');
    setImporting(false);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const table = parseCsvTable(String(reader.result ?? ''));
      const rows = table.rows.filter((row) => getImportValue(row, ['name']));
      setImportHeaders(table.headers);
      setImportRows(rows);
      setImportError(!table.headers.length || !rows.length ? 'CSV must include a Name column and at least one student row.' : '');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    setImportError('');
    try {
      await Promise.all(importRows.map((row) => {
        const input = STUDENT_IMPORT_FIELDS.reduce<Record<string, string>>((student, field) => {
          const value = getImportValue(row, field.aliases);
          if (value) student[field.key] = value;
          return student;
        }, {});
        return createOrReuseStudent(input as Omit<Student, 'id' | 'created_at'>);
      }));
      const updated = await getStudents();
      setStudents(updated);
      resetImport();
    } catch (error: any) {
      setImportError(error?.message ?? 'Import failed. Some rows may already have been imported.');
      setImporting(false);
    }
  };

  if (loading) return <Spinner centered />;

  return (
    <div className="page-section">
      <PageHeader
        title="Students"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button className="action-button-import" variant="secondary" onClick={() => setShowImport(true)}><Upload size={16} />Import</Button>
            <Link to="/students/new"><Button className="action-button"><Plus size={16} />Add Student</Button></Link>
          </div>
        }
      />

      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s) => (
            <Link key={s.id} to={`/students/${s.id}`} className="block group">
              <Card hover padding="md" className="flex h-full min-h-[5rem] items-center gap-4">
                <Avatar name={s.name} size="lg" />
                <h3 className="min-w-0 text-base font-bold text-[var(--text-primary)] break-words">{s.name}</h3>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showImport} onClose={resetImport} title="Import Students" size="lg">
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)]" style={{ padding: '1rem 1.25rem' }}>
            <p className="font-semibold text-[var(--text-primary)]">Upload CSV!</p>          </div>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)]" style={{ padding: '0.75rem 1rem' }}>
            <FileSpreadsheet size={16} /> Choose CSV file
            <input ref={importFileRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />
          </label>
          {importHeaders.length > 0 && importRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Preview ({importRows.length} students)</p>
              <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead><tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">{importHeaders.map((header) => <th key={header} className="whitespace-nowrap text-left font-medium text-[var(--text-muted)]" style={{ padding: '0.75rem 1rem' }}>{header}</th>)}</tr></thead>
                  <tbody>{importRows.slice(0, 5).map((row, index) => <tr key={index} className="border-b border-[var(--border)] last:border-0">{importHeaders.map((header) => <td key={header} className="max-w-[14rem] truncate text-[var(--text-secondary)]" style={{ padding: '0.75rem 1rem' }}>{row[header] || '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {importRows.length > 5 && <p className="text-xs text-[var(--text-muted)]">Showing first 5 rows. All {importRows.length} valid rows will be imported.</p>}
            </div>
          )}
          {importError && <InlineAlert>{importError}</InlineAlert>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={resetImport} disabled={importing}>Cancel</Button>
            <Button className="action-button-import" onClick={handleImport} loading={importing} disabled={!importRows.length}>Import</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
