import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowUpRight, Layers } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { getBatches, getTutorDashboardStats } from '@/lib/supabase';
import type { TutorDashboardStats } from '@/lib/supabase';
import type { Batch } from '@/lib/types';

export default function TutorDashboardPage() {
  const [stats, setStats] = useState<TutorDashboardStats | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);

  const { loading, error, retry } = useInitialLoad(async () => {
    const [s, b] = await Promise.all([getTutorDashboardStats(), getBatches()]);
    setStats(s);
    setBatches(b);
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  // One batch is the common case — go straight to it, nothing to pick between.
  if (batches.length === 1) return <Navigate to={`/tutor/batches/${batches[0].id}`} replace />;

  return (
    <div className="page-section">
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="My Batches" value={stats?.batch_count ?? 0} />
        <StatCard label="My Students" value={stats?.student_count ?? 0} />
        <StatCard label="Pending Grading" value={stats?.pending_grading ?? 0} valueClassName="text-[var(--danger-text)]" />
      </div>

      <Card>
        <CardHeader title="My Batches" />
        <div className="dashboard-section-content">
          {batches.length === 0 ? (
            <EmptyState icon={<Layers size={32} />} title="No batches assigned yet" />
          ) : (
            <div className="flex flex-col gap-2">
              {batches.map((batch) => (
                <Link
                  key={batch.id}
                  to={`/tutor/batches/${batch.id}`}
                  className="dashboard-item flex min-h-[4.5rem] items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)]/40 hover:bg-[var(--bg-elevated)] transition-colors group"
                >
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <p className="text-sm font-semibold leading-5 text-[var(--text-primary)] break-words">{batch.name}</p>
                    <p className="shrink-0 text-right text-xs leading-4 text-[var(--text-muted)]">{batch.program ?? ''}</p>
                  </div>
                  <ArrowUpRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
