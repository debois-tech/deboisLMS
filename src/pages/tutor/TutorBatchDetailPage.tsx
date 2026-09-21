import { lazy, Suspense, useCallback, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { Avatar } from '@/components/ui/Avatar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { BatchMaterials } from '@/components/materials/BatchMaterials';
import { OverviewTab, LecturesTab, AttendanceTab, AssignmentsTab } from '@/pages/batches/BatchDetailPage';
import { getBatchById, getBatchPrograms, getBatchStudents } from '@/lib/supabase';
import type { Batch, BatchProgramOption, BatchStudentMapping, Student } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';
import { useInitialLoad, useReloadableSection } from '@/lib/hooks/useInitialLoad';

const CurriculumCanvas = lazy(() => import('@/components/curriculum/CurriculumCanvas').then((m) => ({ default: m.CurriculumCanvas })));

// Same shell as the admin BatchDetailPage, reusing its Overview/Lectures/
// Attendance/Assignments tabs verbatim (RLS already scopes them). No Tutors
// or Finance tab, no edit/end/delete actions, and Students is read-only.
export default function TutorBatchDetailPage() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [programs, setPrograms] = useState<BatchProgramOption[]>([]);

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!batchId) return;
    const [batchRow, programRows] = await Promise.all([getBatchById(batchId), getBatchPrograms()]);
    setBatch(batchRow ?? null);
    setPrograms(programRows);
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!batch) return <NotFound label="Batch" />;

  const programLabel = programs.find((p) => p.code === batch.program)?.name;

  return (
    <div className="page-section">
      <Link to="/tutor" className="mb-4 flex w-fit items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight truncate">{batch.name}</h1>
            <StatusPill kind="batch" value={batch.status} />
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {programLabel ?? 'No programme'} • Started {batch.start_date ? formatDate(batch.start_date) : 'N/A'}
          </p>
        </div>
      </div>

      <Tabs
        tabs={[
          { label: 'Overview', value: 'overview' },
          { label: 'Students', value: 'students' },
          { label: 'Lectures', value: 'lectures' },
          { label: 'Attendance', value: 'attendance' },
          { label: 'Assignments', value: 'assignments' },
          { label: 'Curriculum', value: 'curriculum' },
          { label: 'Material', value: 'material' },
        ]}
        defaultValue="overview"
      >
        {(active) => (
          <>
            {active === 'overview' && <OverviewTab batch={batch} programLabel={programLabel} showFees={false} />}
            {active === 'students' && <TutorBatchStudentsTab batchId={batch.id} />}
            {active === 'lectures' && <LecturesTab batchId={batch.id} />}
            {active === 'attendance' && <AttendanceTab batchId={batch.id} batchName={batch.name} />}
            {active === 'assignments' && <AssignmentsTab batchId={batch.id} />}
            {active === 'curriculum' && (
              <Suspense fallback={<Spinner centered />}>
                <CurriculumCanvas batchId={batch.id} batchName={batch.name} role="tutor" height="calc(100vh - 17rem)" />
              </Suspense>
            )}
            {active === 'material' && <BatchMaterials batchId={batch.id} batchCode={batch.batch_code} />}
          </>
        )}
      </Tabs>
    </div>
  );
}

// Read-only roster: name, ID, phone, email — no add/import/terminate.
function TutorBatchStudentsTab({ batchId }: { batchId: string }) {
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);

  const load = useCallback(async () => {
    setStudents(await getBatchStudents(batchId));
  }, [batchId]);

  const { error, reload } = useReloadableSection(load);

  if (error) return <Card><ErrorState message={error} onRetry={reload} /></Card>;

  return (
    <Card>
      <CardHeader title="Enrolled Students" />
      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students enrolled" />
      ) : (
        <Table maxHeight="none">
          <THead>
            <TR>
              <TH>Student</TH>
              <TH>ID</TH>
              <TH>Phone</TH>
              <TH>Email</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {students.map((s) => (
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
                <TD><StatusPill kind="enrollment" value={s.mapping.status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
