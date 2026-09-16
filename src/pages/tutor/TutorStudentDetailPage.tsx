import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Layers, ExternalLink } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { StatusPill } from '@/components/ui/StatusPill';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { StudentIdChip } from '@/components/students/StudentLink';
import { getStudentById, getStudentBatches } from '@/lib/supabase';
import type { Student, BatchStudentMapping, Batch } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

// Read-only, and only what a tutor is meant to see: no fees, no login, no edit.
export default function TutorStudentDetailPage() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [batchMappings, setBatchMappings] = useState<(BatchStudentMapping & { batch?: Batch })[]>([]);

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;
    const [s, mappings] = await Promise.all([getStudentById(studentId), getStudentBatches(studentId)]);
    setStudent(s ?? null);
    setBatchMappings(mappings);
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!student) return <NotFound label="Student" />;

  const profileFacts = [
    { label: 'Date of Birth', value: student.date_of_birth ? formatDate(student.date_of_birth) : '' },
    { label: 'Gender', value: student.gender ?? '' },
    { label: 'College', value: student.college ?? '' },
    { label: 'Course', value: student.course ?? '' },
    { label: 'Branch', value: student.branch ?? '' },
    { label: 'Current Year', value: student.current_year ?? '' },
    { label: 'Graduation Year', value: student.graduation_year ? String(student.graduation_year) : '' },
  ].filter((fact) => fact.value);

  return (
    <div className="page-section">
      <Link to="/tutor/students" className="detail-back-link">
        <ArrowLeft size={14} /> Back to Students
      </Link>

      <Card padding="lg">
        <div className="student-identity-row">
          <div className="student-avatar">
            {student.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="student-identity min-w-0 flex-1">
            <div className="student-identity-name">
              <h1 className="student-identity-title">{student.name}</h1>
              <StudentIdChip code={student.student_code} showLabel={false} />
            </div>
            <div className="student-identity-meta">
              {student.email && (
                <span className="flex min-w-0 items-center gap-1.5"><Mail size={14} className="shrink-0" /> <span className="break-all">{student.email}</span></span>
              )}
              {student.phone && (
                <span className="flex items-center gap-1.5"><Phone size={14} className="shrink-0" /> {student.phone}</span>
              )}
            </div>
          </div>
          {(student.github_url || student.linkedin_url) && (
            <div className="student-identity-links">
              {student.github_url && (
                <a href={student.github_url} target="_blank" rel="noreferrer" className="student-link-chip">
                  GitHub <ExternalLink size={12} className="shrink-0" />
                </a>
              )}
              {student.linkedin_url && (
                <a href={student.linkedin_url} target="_blank" rel="noreferrer" className="student-link-chip">
                  LinkedIn <ExternalLink size={12} className="shrink-0" />
                </a>
              )}
            </div>
          )}
        </div>
      </Card>

      {profileFacts.length > 0 && (
        <Card>
          <CardHeader title="Profile" />
          <dl className="student-facts">
            {profileFacts.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="student-fact-label">{label}</dt>
                <dd className="student-fact-value">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card>
        <CardHeader title="Batches" />
        {batchMappings.length === 0 ? (
          <EmptyState icon={<Layers size={32} />} title="Not enrolled in any of your batches" />
        ) : (
          <div className="batch-list">
            {batchMappings.map((m) => (
              <div key={m.id} className="batch-list-item flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Layers size={18} className="shrink-0 text-[var(--primary)]" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{m.batch?.name ?? m.batch_id}</p>
                </div>
                <StatusPill kind="enrollment" value={m.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
