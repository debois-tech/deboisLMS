import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Upload, FileSpreadsheet, Search, SlidersHorizontal, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { getStudents, getBatches, getAllBatchStudentMappings, createOrReuseStudent } from '@/lib/supabase';
import type { Student, Batch, BatchStudentMapping } from '@/lib/types';
import { parseCsvTable } from '@/lib/utils/csvParser';
import { useToast } from '@/lib/context/ToastContext';

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
  const [batches, setBatches] = useState<Batch[]>([]);
  const [mappings, setMappings] = useState<BatchStudentMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([getStudents(), getBatches(), getAllBatchStudentMappings()]).then(([studentData, batchData, mappingData]) => {
      setStudents(studentData);
      setBatches(batchData);
      setMappings(mappingData);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const studentBatchIds = new Map<string, string[]>();
  for (const mapping of mappings) {
    if (mapping.status !== 'active') continue;
    const ids = studentBatchIds.get(mapping.student_id) ?? [];
    ids.push(mapping.batch_id);
    studentBatchIds.set(mapping.student_id, ids);
  }

  const query = search.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    if (selectedBatchId && !(studentBatchIds.get(s.id) ?? []).includes(selectedBatchId)) return false;
    if (!query) return true;
    return (
      s.name.toLowerCase().includes(query) ||
      (s.phone ?? '').toLowerCase().includes(query) ||
      (s.email ?? '').toLowerCase().includes(query)
    );
  });

  const selectBatch = (batchId: string | null) => {
    setSelectedBatchId(batchId);
    setFilterOpen(false);
  };

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
      showToast('Students imported successfully');
    } catch (error: any) {
      setImportError(error?.message ?? 'Import failed. Some rows may already have been imported.');
      showToast(error?.message ?? 'Import failed', 'error');
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
            <Link to="/students/new"><Button className="action-button-compact"><Plus size={16} />Add Student</Button></Link>
          </div>
        }
      />

      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students yet" />
      ) : (
        <>
          <div ref={filterRef} className="relative mb-4 max-w-md">
            <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] transition-colors focus-within:border-[var(--primary)]">
              <Search size={16} className="ml-4 shrink-0 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students by name, phone, or email..."
                className="min-h-11 w-full border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                style={{ paddingLeft: '0.75rem', paddingRight: '0.75rem' }}
              />
              <button
                type="button"
                onClick={() => setFilterOpen((current) => !current)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-r-[var(--radius-md)] transition-colors ${selectedBatchId ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                aria-label="Filter by batch"
                aria-expanded={filterOpen}
              >
                <SlidersHorizontal size={16} />
              </button>
            </div>

            {filterOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]">
                <div className="max-h-64 overflow-y-auto p-1" role="listbox">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedBatchId === null}
                    onClick={() => selectBatch(null)}
                    className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-md)] px-4 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <span>All batches</span>
                    {selectedBatchId === null && <Check size={16} className="text-[var(--primary)]" />}
                  </button>
                  {batches.map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      role="option"
                      aria-selected={selectedBatchId === batch.id}
                      onClick={() => selectBatch(batch.id)}
                      className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-md)] px-4 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                    >
                      <span>{batch.name}</span>
                      {selectedBatchId === batch.id && <Check size={16} className="text-[var(--primary)]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title="No matching students" description="Try adjusting your search or filter" />
          ) : (
            <Table maxHeight="none">
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Phone</TH>
                  <TH>Email</TH>
                </TR>
              </THead>
              <TBody>
                {filteredStudents.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <Link to={`/students/${s.id}`} className="flex items-center gap-3 group">
                        <Avatar name={s.name} size="md" />
                        <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)]">{s.name}</span>
                      </Link>
                    </TD>
                    <TD className="cell-secondary">{s.phone || '—'}</TD>
                    <TD className="cell-muted">{s.email || '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
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
