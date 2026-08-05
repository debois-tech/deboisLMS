import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Layers, CalendarDays, GraduationCap } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getTutorById, getTutorBatches } from '@/lib/supabase';
import type { Tutor, TutorBatchMapping, Batch } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

export default function TutorDetailPage() {
  const { tutorId } = useParams();
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [batchMappings, setBatchMappings] = useState<(TutorBatchMapping & { batch?: Batch })[]>([]);

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!tutorId) return;
    const [t, mappings] = await Promise.all([getTutorById(tutorId), getTutorBatches(tutorId)]);
    setTutor(t ?? null);
    setBatchMappings(mappings);
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!tutor) return <NotFound label="Tutor" />;

  return (
    <div className="page-section">
      <Link to="/tutors" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 w-fit">
        <ArrowLeft size={14} /> Back to Tutors
      </Link>

      <Card padding="lg">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary)]/10 text-xl font-bold text-[var(--primary)]">
            {tutor.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] break-words">{tutor.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
              {tutor.email && <span className="flex min-w-0 items-center gap-2"><Mail size={15} className="shrink-0 text-[var(--primary)]" /> <span className="break-all">{tutor.email}</span></span>}
              {tutor.email && tutor.phone && <span className="text-[var(--border-strong)]">|</span>}
              {tutor.phone && <span className="flex items-center gap-1"><Phone size={14} className="shrink-0" /> {tutor.phone}</span>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Batch History" />
        {batchMappings.length === 0 ? (
          <EmptyState icon={<GraduationCap size={32} />} title="Not assigned to any batches" />
        ) : (
          <div className="batch-list">
            {batchMappings.map((m) => (
              <Link key={m.id} to={`/batches/${m.batch_id}`} className="batch-list-item flex items-center justify-between gap-4 hover:bg-[var(--bg-elevated)] transition-colors">
                <div className="flex items-center gap-3">
                  <Layers size={18} className="shrink-0 text-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{m.batch?.name ?? m.batch_id}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]"><CalendarDays size={12} /> Assigned {formatDate(m.assigned_at)}</p>
                  </div>
                </div>
                <Badge size="lg" variant="success" dot>assigned</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
