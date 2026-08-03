import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Upload, Check, Search } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentImportModal } from '@/components/students/StudentImportModal';
import { getStudents, getBatches, getAllBatchStudentMappings, createOrReuseStudent } from '@/lib/supabase';
import type { Student, Batch, BatchStudentMapping } from '@/lib/types';
import { toStudentInput } from '@/lib/utils/studentImport';
import { useToast } from '@/lib/context/ToastContext';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [mappings, setMappings] = useState<BatchStudentMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([getStudents(), getBatches(), getAllBatchStudentMappings()]).then(([studentData, batchData, mappingData]) => {
      setStudents(studentData);
      setBatches(batchData);
      setMappings(mappingData);
      setLoading(false);
    });
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

  const handleImport = async (rows: Record<string, string>[]) => {
    await Promise.all(rows.map((row) => createOrReuseStudent(toStudentInput(row))));
    setStudents(await getStudents());
    showToast('Students imported successfully');
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
          <div className="mb-4 max-w-md">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, phone, or email"
              filter={{
                open: filterOpen,
                onOpenChange: setFilterOpen,
                active: selectedBatchId !== null,
                label: 'Filter by batch',
                panel: (
                  <div className="searchbar-panel-scroll" role="listbox">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedBatchId === null}
                      onClick={() => selectBatch(null)}
                      className="searchbar-option"
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
                        className="searchbar-option"
                      >
                        <span>{batch.name}</span>
                        {selectedBatchId === batch.id && <Check size={16} className="text-[var(--primary)]" />}
                      </button>
                    ))}
                  </div>
                ),
              }}
            />
          </div>

          {filteredStudents.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title="No matching students" />
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

      <StudentImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
      />
    </div>
  );
}
