import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Layers, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { getDashboardStats, getRecentActivity, type DashboardStats, type RecentActivity } from '@/lib/supabase';
import { getBatches, getCurriculumProgress, getEarningBreakdown, processDocumentCleanup } from '@/lib/supabase';
import { CurriculumAverage } from '@/components/curriculum/CurriculumAverage';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { averageProgress } from '@/lib/utils/curriculum';
import { EarningBreakdownModal } from '@/components/finance/EarningBreakdownModal';
import type { Batch, EarningBreakdown } from '@/lib/types';
import { timeAgo, formatCurrency } from '@/lib/utils/format';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [breakdown, setBreakdown] = useState<EarningBreakdown[]>([]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progress, setProgress] = useState<Map<string, { done: number; total: number }>>(new Map());

  const { loading, error, retry } = useInitialLoad(async () => {
    // Files queued for removal by terminate and the 90-day clean-up
    void processDocumentCleanup().catch(console.error);
    const [s, a, b, e, p] = await Promise.all([
      getDashboardStats(),
      getRecentActivity(),
      getBatches(),
      getEarningBreakdown(),
      getCurriculumProgress(),
    ]);
    setStats(s);
    setActivity(a);
    setBatches(b);
    setBreakdown(e);
    setProgress(p);
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  const ongoingBatches = batches.filter((b) => b.status === 'ongoing' && !b.is_test);
  const average = averageProgress(progress, ongoingBatches.map((batch) => batch.id));

  return (
    <div className="page-section">
      <PageHeader
        title="Dashboard"
        action={
          <Button className="action-button-compact" variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} /> Settings
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Batches" value={stats?.total_batches ?? 0} />
        <StatCard label="Active Batches" value={stats?.active_batches ?? 0} />
        <StatCard label="Total Students" value={stats?.total_students ?? 0} />
        <StatCard
          label="Fees Collected"
          value={formatCurrency(stats?.total_fees_collected ?? 0)}
          valueClassName="text-[var(--success-text)]"
          onClick={() => setBreakdownOpen(true)}
          actionLabel="Fees collected — open the earning breakdown"
        />
        <StatCard
          label="Pending Due"
          value={formatCurrency(stats?.total_fees_outstanding ?? 0)}
          valueClassName="text-[var(--danger-text)]"
          onClick={() => setBreakdownOpen(true)}
          actionLabel="Pending due — open the earning breakdown"
        />
        <StatCard
          label="Earning breakdown"
          value={<ArrowRight size={18} />}
          valueClassName="text-[var(--text-muted)]"
          onClick={() => setBreakdownOpen(true)}
          actionLabel="Open the earning breakdown"
        />
      </div>

      <CurriculumAverage average={average} outOf={ongoingBatches.length} />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <EarningBreakdownModal
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        breakdown={breakdown}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Active Batches"/>
          <div className="dashboard-section-content">
          {ongoingBatches.length === 0 ? (
            <EmptyState icon={<Layers size={32} />} title="No active batches" />
          ) : (
            <div className="flex flex-col gap-2">
              {ongoingBatches.map((batch) => {
                const topics = progress.get(batch.id);
                return (
                <Link
                  key={batch.id}
                  to={`/batches/${batch.id}`}
                  className="dashboard-item flex min-h-[4.5rem] items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)]/40 hover:bg-[var(--bg-elevated)] transition-colors group"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold leading-5 text-[var(--text-primary)] break-words">{batch.name}</p>
                      <p className="shrink-0 text-right text-xs leading-4 text-[var(--text-muted)]">{batch.program ?? ''}</p>
                    </div>
                    {topics && <ProgressBar count done={topics.done} total={topics.total} label={`${batch.name} course progress`} />}
                  </div>
                  <ArrowUpRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                );
              })}
            </div>
          )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Activity" />
          <div className="dashboard-section-content">
          {activity.length === 0 ? (
            <EmptyState icon={<Layers size={32} />} title="No recent activity" />
          ) : (
            <div className="flex flex-col gap-2">
              {activity.map((a) => (
                <div key={a.id} className="dashboard-item flex min-h-[4.5rem] items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)]/40 hover:bg-[var(--bg-elevated)] transition-colors">
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <p className="text-sm leading-5 text-[var(--text-primary)] break-words">{a.text}</p>
                    <p className="shrink-0 text-right text-xs leading-4 text-[var(--text-muted)]">{timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </Card>
      </div>
    </div>
  );
}
