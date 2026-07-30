import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Layers, CalendarDays } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { getStudentById, getStudentBatches } from '@/lib/supabase';
import { getBatchById } from '@/lib/supabase';
import type { Student, BatchStudentMapping, Batch } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [batchMappings, setBatchMappings] = useState<(BatchStudentMapping & { batch?: Batch })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    Promise.all([getStudentById(studentId), getStudentBatches(studentId)]).then(async ([s, mappings]) => {
      setStudent(s ?? null);
      const withBatches = await Promise.all(
        mappings.map(async (m) => {
          const batch = await getBatchById(m.batch_id);
          return { ...m, batch };
        })
      );
      setBatchMappings(withBatches);
      setLoading(false);
    });
  }, [studentId]);

  if (loading) return <Spinner centered />;
  if (!student) return <div className="page-section text-[var(--text-muted)]">Student not found</div>;

  return (
    <div className="page-section">
      <Link to="/students" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 w-fit">
        <ArrowLeft size={14} /> Back to Students
      </Link>

      <Card padding="lg">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary)]/10 text-xl font-bold text-[var(--primary)]">
            {student.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] break-words">{student.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
              {student.email && <span className="flex min-w-0 items-center gap-2"><Mail size={15} className="shrink-0 text-[var(--primary)]" /> <span className="break-all">{student.email}</span></span>}
              {student.email && student.phone && <span className="text-[var(--border-strong)]">|</span>}
              {student.phone && <span className="flex items-center gap-1"><Phone size={14} className="shrink-0" /> {student.phone}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:ml-auto">
              {student.github_url && (
                <a href={student.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-[var(--radius-md)] bg-[#24292f] text-sm font-semibold text-white transition-colors hover:bg-[#3b434b]" style={{ padding: '1rem 2rem' }}>
                  GitHub
                </a>
              )}
              {student.linkedin_url && (
                <a href={student.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-[var(--radius-md)] bg-[#0a66c2] text-sm font-semibold text-white transition-colors hover:bg-[#0b78df]" style={{ padding: '1rem 2rem' }}>
                  LinkedIn
                </a>
              )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Batch History" />
        {batchMappings.length === 0 ? (
          <EmptyState icon={<Layers size={32} />} title="Not enrolled in any batches" />
        ) : (
          <div className="batch-list">
            {batchMappings.map((m) => (
              <Link
                key={m.id}
                to={`/batches/${m.batch_id}`}
                className="batch-list-item flex items-center justify-between gap-4 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Layers size={18} className="shrink-0 text-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{m.batch?.name ?? m.batch_id}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]"><CalendarDays size={12} /> Joined {formatDate(m.joined_at)}</p>
                  </div>
                </div>
                <Badge size="lg" variant={m.status === 'active' ? 'success' : 'danger'} dot>{m.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
