import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, ExternalLink, Layers } from 'lucide-react';
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

  if (loading) return <Spinner />;
  if (!student) return <div className="page-section text-[var(--text-muted)]">Student not found</div>;

  return (
    <div className="page-section">
      <Link to="/students" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 w-fit">
        <ArrowLeft size={14} /> Back to Students
      </Link>

      <Card padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-lg font-bold text-[var(--primary)]">
            {student.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight truncate">{student.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[var(--text-muted)]">
              {student.email && <span className="flex items-center gap-1 min-w-0"><Mail size={14} className="shrink-0" /> <span className="truncate">{student.email}</span></span>}
              {student.phone && <span className="flex items-center gap-1"><Phone size={14} className="shrink-0" /> {student.phone}</span>}
            </div>
            <div className="flex gap-3 mt-3">
              {student.github_url && (
                <a href={student.github_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center gap-1">
                  GitHub <ExternalLink size={12} />
                </a>
              )}
              {student.linkedin_url && (
                <a href={student.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center gap-1">
                  LinkedIn <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Batch History" />
        {batchMappings.length === 0 ? (
          <EmptyState icon={<Layers size={32} />} title="Not enrolled in any batches" />
        ) : (
          <div className="space-y-2">
            {batchMappings.map((m) => (
              <Link
                key={m.id}
                to={`/batches/${m.batch_id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-[var(--radius-md)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Layers size={16} className="text-[var(--text-muted)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{m.batch?.name ?? m.batch_id}</p>
                    <p className="text-xs text-[var(--text-muted)]">Joined {formatDate(m.joined_at)}</p>
                  </div>
                </div>
                <Badge variant={m.status === 'active' ? 'success' : 'danger'}>{m.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}