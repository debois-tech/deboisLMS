import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Upload, Search } from 'lucide-react';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { BatchFilter, BatchPills } from '@/components/ui/BatchSelect';
import { SearchSelect } from '@/components/ui/SearchSelect';
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
import type { Student, Batch, BatchStudentMapping, MappingStatus } from '@/lib/types';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';

const NO_BATCH = 'none';

type StudentView = 'live' | 'test';

const VIEW_OPTIONS = [
  { value: 'live', label: 'Original' },
  { value: 'test', label: 'Test' },
];

type SortKey = 'newest' | 'az' | 'za' | 'idasc' | 'iddesc';

const DEFAULT_SORT: SortKey = 'idasc';

// 'archived' is the database name for completed: the batch ended 90+ days ago and the login is gone.
type EnrolmentTab = MappingStatus | 'all';

const ENROLMENT_TABS: { value: EnrolmentTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'archived', label: 'Completed' },
  { value: 'all', label: 'All' },
];

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
  const [enrolment, setEnrolment] = useState<EnrolmentTab>('active');
  const [view, setView] = useState<StudentView>('live');
  const [showImport, setShowImport] = useState(false);
  const [bulkLogins, setBulkLogins] = useState<BulkLoginResult | null>(null);
  const { showToast } = useToast();
  const { isDeveloper } = useAuth();

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

  // Best enrolment wins: active, then archived, then terminated
  const enrolmentOf = (studentId: string): MappingStatus => {
    const mine = mappings.filter((m) => m.student_id === studentId);
    if (mine.some((m) => m.status === 'active')) return 'active';
    if (mine.some((m) => m.status === 'archived')) return 'archived';
    return mine.length ? 'terminated' : 'active';
  };

  const query = search.trim().toLowerCase();
  const queryRef = refKey(query);
  const matches = (s: Student) => {
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
  };

  // Test students live in their own view, with their own batches to filter by.
  const isTest = view === 'test';
  const searched = students.filter((s) => Boolean(s.is_test) === isTest).filter(matches);
  const batchesOf = (studentId: string) =>
    (studentBatchIds.get(studentId) ?? []).map((id) => batches.find((b) => b.id === id)).filter((b): b is Batch => Boolean(b));
  const inTab = (s: Student, tab: EnrolmentTab) => tab === 'all' || enrolmentOf(s.id) === tab;
  const tabs = ENROLMENT_TABS.map((tab) => ({ ...tab, count: searched.filter((s) => inTab(s, tab.value)).length }));

  const filteredStudents = searched.filter((s) => inTab(s, enrolment));

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

  const selectView = (value: string) => {
    setView(value as StudentView);
    setSelectedBatchId(null);
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

    const { imported, failed } = await importStudentsIntoBatch(rows, batch.id, batch.base_fee);

    const [studentData, mappingData] = await Promise.all([getStudents(), getAllBatchStudentMappings()]);
    setStudents(studentData);
    setMappings(mappingData);

    // Students already holding a login are skipped — re-running the edge function
    // would reset a password that may already be in someone's hands.
    const needLogins = createLogins ? imported.filter((student) => !student.auth_user_id) : [];
    if (needLogins.length > 0) {
      const result = await createStudentLoginsBulk(needLogins.map((s) => ({ id: s.id, name: s.name })));
      setStudents(await getStudents());
      setBulkLogins(result);
    } else if (failed.length === 0) {
      showToast(createLogins ? 'Students imported — logins already existed' : 'Students imported');
    }
    return failed;
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader
        title="Students"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button className="action-button-compact" variant="secondary" onClick={() => setShowImport(true)}><Upload size={16} />Import</Button>
            <Link to="/students/new"><Button className="action-button-compact"><Plus size={16} />Add Student</Button></Link>
          </div>
        }
      />

      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students yet" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <FilterTabs tabs={tabs} value={enrolment} onChange={setEnrolment} label="Enrolment" />
            {isDeveloper && (
              <SearchSelect
                options={VIEW_OPTIONS}
                value={view}
                onChange={selectView}
                placeholder="Original"
                searchPlaceholder=""
                emptyText=""
                showSearch={false}
                className="!w-auto !max-w-none"
              />
            )}
          </div>

          <div className="search-row mb-4">
            <SearchFilterBar
              value={search}
              onChange={setSearch}
              placeholder="Search by ref ID, name, phone, or email"
              sortLabel="Sort"
              sortValue={sort}
              sortOptions={SORT_OPTIONS}
              onSortChange={(value) => setSort(value as SortKey)}
              defaultSortValue={DEFAULT_SORT}
            />
            <BatchFilter
              batches={batches.filter((batch) => Boolean(batch.is_test) === isTest)}
              value={selectedBatchId}
              onChange={setSelectedBatchId}
              extraOptions={[{ id: NO_BATCH, name: 'No batch' }]}
            />
          </div>

          {filteredStudents.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title={enrolment === 'all' ? 'No students' : `No ${ENROLMENT_TABS.find((tab) => tab.value === enrolment)!.label.toLowerCase()} students`} />
          ) : (
            <Table maxHeight="none">
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>ID</TH>
                  <TH>Phone</TH>
                  <TH>Email</TH>
                  <TH align="center">Batches</TH>
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
                    <TD align="center" className="cell-secondary"><BatchPills batches={batchesOf(s.id)} /></TD>
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
