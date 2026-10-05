import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, Phone, Layers, ExternalLink } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { StatusPill } from '@/components/ui/StatusPill';
import { EnrolmentSelect } from '@/components/ui/BatchSelect';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { StudentIdChip } from '@/components/students/StudentLink';
import { getStudentById, getStudentBatches, getLecturesByBatch } from '@/lib/supabase';
import type { Student, BatchStudentMapping, Batch, Lecture } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

// Read-only, and only what a tutor is meant to see: no fees, no login, no edit.
export default function TutorStudentDetailPage() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [batchMappings, setBatchMappings] = useState<(BatchStudentMapping & { batch?: Batch })[]>([]);
  const [nextLectures, setNextLectures] = useState<Record<string, Lecture | undefined>>({});
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;
    const [s, all] = await Promise.all([getStudentById(studentId), getStudentBatches(studentId)]);
    // RLS returns every enrolment but only the tutor's own batches; the rest come back unnamed.
    const mappings = all.filter((m) => m.batch);
    setStudent(s ?? null);
    setBatchMappings(mappings);

    const live = mappings.filter((m) => m.status === 'active');
    const lectureSets = await Promise.all(live.map((m) => getLecturesByBatch(m.batch_id)));
    const today = new Date().toISOString().slice(0, 10);
    setNextLectures(Object.fromEntries(live.map((m, i) => [
      m.batch_id,
      lectureSets[i]
        .filter((l) => l.lecture_date.slice(0, 10) >= today)
        .sort((a, b) => a.lecture_date.localeCompare(b.lecture_date))[0],
    ])));
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!student) return <NotFound label="Student" />;

  const newestFirst = [...batchMappings].sort(
    (a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
  );
  const current =
    batchMappings.find((m) => m.batch_id === selectedBatchId)
    ?? newestFirst.find((m) => m.status === 'active')
    ?? newestFirst[0];
  const nextLecture = current ? nextLectures[current.batch_id] : undefined;

  const profileFacts = [
    { label: 'Date of Birth', value: student.date_of_birth ? formatDate(student.date_of_birth) : '' },
    { label: 'Gender', value: student.gender ?? '' },
    { label: 'College', value: student.college ?? '' },
    { label: 'Course', value: student.course ?? '' },
    { label: 'Branch', value: student.branch ?? '' },
    { label: 'Current Year', value: student.current_year ?? '' },
    { label: 'Graduation Year', value: student.graduation_year ? String(student.graduation_year) : '' },
    { label: 'Internship Role', value: student.internship_role ?? '' },
  ].filter((fact) => fact.value);

  return (
    <div className="page-section">
      <BackLink fallback="/tutor/students" />

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

      {current && (
        <div className="student-summary-grid">
          <Card padding="sm" className="student-summary-card">
            <p className="student-summary-label">Current Batch</p>
            {batchMappings.length > 1 ? (
              <EnrolmentSelect mappings={newestFirst} value={current.batch_id} onChange={setSelectedBatchId} />
            ) : (
              <p className="student-summary-value">{current.batch?.name}</p>
            )}
          </Card>
          <Card padding="sm" className="student-summary-card">
            <p className="student-summary-label">Enrolment</p>
            <div className="student-summary-lecture">
              <StatusPill kind="enrollment" value={current.status} />
              <p className="student-summary-meta">Joined {formatDate(current.joined_at)}</p>
            </div>
          </Card>
          <Card padding="sm" className="student-summary-card">
            <p className="student-summary-label">Next Lecture</p>
            {nextLecture ? (
              <div className="student-summary-lecture">
                <p className="student-summary-value">{formatDate(nextLecture.lecture_date)}</p>
                <p className="student-summary-meta">
                  {nextLecture.session_type}{nextLecture.meeting_code ? ` • ${nextLecture.meeting_code}` : ''}
                </p>
              </div>
            ) : (
              <p className="student-summary-empty">{current.status === 'active' ? 'All lectures up to date' : '—'}</p>
            )}
          </Card>
        </div>
      )}

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
