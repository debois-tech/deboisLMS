import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { getStudents, getBatches, getAllBatchStudentMappings } from '@/lib/supabase';
import type { Student, Batch, BatchStudentMapping } from '@/lib/types';

// RLS already scopes every one of these to the signed-in tutor's own batches.
export default function TutorStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [mappings, setMappings] = useState<BatchStudentMapping[]>([]);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(searchParams.get('batch'));

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

  const studentBatchIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const mapping of mappings) {
      if (mapping.status !== 'active') continue;
      const ids = map.get(mapping.student_id) ?? [];
      ids.push(mapping.batch_id);
      map.set(mapping.student_id, ids);
    }
    return map;
  }, [mappings]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter((s) => {
      const batchIds = studentBatchIds.get(s.id) ?? [];
      if (selectedBatchId && !batchIds.includes(selectedBatchId)) return false;
      if (!query) return true;
      return (
        s.name.toLowerCase().includes(query) ||
        (s.phone ?? '').toLowerCase().includes(query) ||
        (s.email ?? '').toLowerCase().includes(query)
      );
    });
  }, [students, studentBatchIds, search, selectedBatchId]);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Students" />

      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students in your batches yet" />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <SearchFilterBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, phone, or email"
              filterLabel="Batch"
              allLabel="All my batches"
              filterValue={selectedBatchId}
              filterOptions={batches.map((batch) => ({ value: batch.id, label: batch.name }))}
              onFilterChange={setSelectedBatchId}
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
                      <Link to={`/tutor/students/${s.id}`} className="flex items-center gap-3 group">
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
    </div>
  );
}
