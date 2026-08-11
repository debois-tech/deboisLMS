import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Upload, Search } from 'lucide-react';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentImportModal } from '@/components/students/StudentImportModal';
import { BulkLoginsModal } from '@/components/students/BulkLoginsModal';
import { getStudents, getBatches, getAllBatchStudentMappings, createOrReuseStudent, createStudentLoginsBulk } from '@/lib/supabase';
import type { BulkLoginResult } from '@/lib/supabase';
import type { Student, Batch, BatchStudentMapping } from '@/lib/types';
import { toStudentInput } from '@/lib/utils/studentImport';
import { useToast } from '@/lib/context/ToastContext';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [mappings, setMappings] = useState<BatchStudentMapping[]>([]);
  const [search, setSearch] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [bulkLogins, setBulkLogins] = useState<BulkLoginResult | null>(null);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    const [studentData, batchData, mappingData] = await Promise.all([
      getStudents(),
      getBatches(),
      getAllBatchStudentMappings(),
    ]);
    setStudents(studentData);
    setBatches(batchData);
    setMappings(mappingData);
  });


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
      (s.student_code ?? '').toLowerCase().includes(query) ||
      (s.phone ?? '').toLowerCase().includes(query) ||
      (s.email ?? '').toLowerCase().includes(query)
    );
  });

  const selectBatch = (batchId: string | null) => {
    setSelectedBatchId(batchId);
  };

  const handleImport = async (rows: Record<string, string>[], _fee?: number, createLogins?: boolean) => {
    const imported = await Promise.all(rows.map((row) => createOrReuseStudent(toStudentInput(row))));
    setStudents(await getStudents());

    if (!createLogins) {
      showToast('Students imported');
      return;
    }

    // Students already holding a login are skipped — re-running the edge function
    // would reset a password that may already be in someone's hands.
    const needLogins = imported.filter((student) => !student.auth_user_id);
    if (needLogins.length === 0) {
      showToast('Students imported — logins already existed');
      return;
    }

    const result = await createStudentLoginsBulk(needLogins.map((s) => ({ id: s.id, name: s.name })));
    setStudents(await getStudents());
    setBulkLogins(result);
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

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
            <SearchFilterBar
              value={search}
              onChange={setSearch}
              placeholder="Search by ID, name, phone, or email"
              filterLabel="Filter by batch"
              allLabel="All batches"
              filterValue={selectedBatchId}
              filterOptions={batches.map((batch) => ({ value: batch.id, label: batch.name }))}
              onFilterChange={selectBatch}
            />
          </div>

          {filteredStudents.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title="No matching students" />
          ) : (
            <Table maxHeight="none">
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>ID</TH>
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
                    <TD className="cell-secondary font-mono">{s.student_code || '—'}</TD>
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

      <BulkLoginsModal result={bulkLogins} onClose={() => setBulkLogins(null)} />
    </div>
  );
}
