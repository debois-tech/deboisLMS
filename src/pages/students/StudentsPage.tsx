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
import { getStudents, getBatches, getAllBatchStudentMappings, createStudentLoginsBulk, importStudentsIntoBatch } from '@/lib/supabase';
import type { BulkLoginResult } from '@/lib/supabase';
import type { Student, Batch, BatchStudentMapping } from '@/lib/types';
import { useToast } from '@/lib/context/ToastContext';

const NO_BATCH = 'none';

type SortKey = 'newest' | 'az' | 'za' | 'idasc' | 'iddesc';

//newest first is what the query already returns
const DEFAULT_SORT: SortKey = 'newest';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'az', label: 'Name (A–Z)' },
  { value: 'za', label: 'Name (Z–A)' },
  { value: 'idasc', label: 'ID (low–high)' },
  { value: 'iddesc', label: 'ID (high–low)' },
];

// Ref IDs get typed with any or none of their dashes — match on the bare characters
const refKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * DBT-INT-2026-001 in issue order. Numeric collation compares each run of digits
 * as a number, so -057 sorts before -1000 rather than after it, and the year
 * ahead of the counter keeps a 2027 intake below every 2026 one.
 */
const compareRef = (a?: string, b?: string) =>
  (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' });

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [mappings, setMappings] = useState<BatchStudentMapping[]>([]);
  const [search, setSearch] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
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
  const queryRef = refKey(query);
  const filteredStudents = students.filter((s) => {
    const batchIds = studentBatchIds.get(s.id) ?? [];
    if (selectedBatchId === NO_BATCH && batchIds.length > 0) return false;
    if (selectedBatchId && selectedBatchId !== NO_BATCH && !batchIds.includes(selectedBatchId)) return false;
    if (!query) return true;
    return (
      s.name.toLowerCase().includes(query) ||
      (queryRef !== '' && refKey(s.student_code ?? '').includes(queryRef)) ||
      (s.phone ?? '').toLowerCase().includes(query) ||
      (s.email ?? '').toLowerCase().includes(query)
    );
  });

  if (sort === 'az' || sort === 'za') {
    const direction = sort === 'az' ? 1 : -1;
    filteredStudents.sort((a, b) => direction * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  } else if (sort === 'idasc' || sort === 'iddesc') {
    const direction = sort === 'idasc' ? 1 : -1;
    filteredStudents.sort((a, b) => {
      // A student with no code yet has no place in an ID order — last either way,
      // rather than heading the list the moment you reverse the sort.
      if (!a.student_code !== !b.student_code) return a.student_code ? -1 : 1;
      return direction * compareRef(a.student_code, b.student_code);
    });
  }

  const selectBatch = (batchId: string | null) => {
    setSelectedBatchId(batchId);
  };

  // The batch is chosen in the dialog, so there is nothing to resolve and no way
  // for two live batches under one programme to be ambiguous.
  const handleImport = async (
    rows: Record<string, string>[],
    createLogins: boolean,
    batch: Batch,
  ) => {
    if (batch.base_fee == null) {
      throw new Error(`${batch.name} has no base fee. Set one on the batch, then import.`);
    }

    const imported = await importStudentsIntoBatch(rows, batch.id, batch.base_fee);

    const [studentData, mappingData] = await Promise.all([getStudents(), getAllBatchStudentMappings()]);
    setStudents(studentData);
    setMappings(mappingData);

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
              placeholder="Search by ref ID, name, phone, or email"
              filterLabel="Batch"
              allLabel="All batches"
              filterValue={selectedBatchId}
              filterOptions={[
                ...batches.map((batch) => ({ value: batch.id, label: batch.name })),
                { value: NO_BATCH, label: 'No batch' },
              ]}
              onFilterChange={selectBatch}
              sortLabel="Sort"
              sortValue={sort}
              sortOptions={SORT_OPTIONS}
              onSortChange={(value) => setSort(value as SortKey)}
              defaultSortValue={DEFAULT_SORT}
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
        batches={batches}
        onImport={handleImport}
      />

      <BulkLoginsModal result={bulkLogins} onClose={() => setBulkLogins(null)} />
    </div>
  );
}
