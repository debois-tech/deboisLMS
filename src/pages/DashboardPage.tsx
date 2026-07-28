import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Users, ClipboardCheck, DollarSign, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { getDashboardStats, getRecentActivity, type DashboardStats, type RecentActivity } from '@/lib/supabase';
import { getBatches } from '@/lib/supabase';
import type { Batch } from '@/lib/types';
import { timeAgo } from '@/lib/utils/format';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getRecentActivity(), getBatches()]).then(
      ([s, a, b]) => {
        setStats(s);
        setActivity(a);
        setBatches(b);
        setLoading(false);
      }
    );
  }, []);

  if (loading) return <Spinner />;

  const ongoingBatches = batches.filter((b) => b.status === 'ongoing');

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of all training programs" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Batches" value={stats?.total_batches ?? 0} icon={Layers} color="var(--primary)" />
        <StatCard label="Active Batches" value={stats?.active_batches ?? 0} icon={Layers} color="#10b981" />
        <StatCard label="Total Students" value={stats?.total_students ?? 0} icon={Users} color="#8b5cf6" />
        <StatCard label="Pending Approval" value={stats?.pending_attendance ?? 0} icon={ClipboardCheck} color="#f59e0b" />
        <StatCard label="Fees Collected" value={`₹${(stats?.total_fees_collected ?? 0).toLocaleString()}`} icon={DollarSign} color="#10b981" />
        <StatCard label="Outstanding" value={`₹${(stats?.total_fees_outstanding ?? 0).toLocaleString()}`} icon={DollarSign} color="#ef4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Active Batches" subtitle="Current training programs" />
          {ongoingBatches.length === 0 ? (
            <EmptyState icon={<Layers size={32} />} title="No active batches" />
          ) : (
            <div className="space-y-2">
              {ongoingBatches.map((batch) => (
                <Link
                  key={batch.id}
                  to={`/batches/${batch.id}`}
                  className="flex items-center justify-between p-3 rounded-[10px] hover:bg-[var(--bg-elevated)] transition-colors group"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{batch.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{batch.track}</p>
                  </div>
                  <ArrowUpRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Activity" subtitle="Latest updates" />
          {activity.length === 0 ? (
            <EmptyState icon={<Layers size={32} />} title="No recent activity" />
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-[10px] hover:bg-[var(--bg-elevated)] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mt-0.5">
                    {a.type === 'batch_created' && <Layers size={14} className="text-[var(--primary)]" />}
                    {a.type === 'student_joined' && <Users size={14} className="text-[var(--primary)]" />}
                    {a.type === 'attendance_approved' && <ClipboardCheck size={14} className="text-[var(--primary)]" />}
                    {a.type === 'payment_made' && <DollarSign size={14} className="text-[var(--primary)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">{a.text}</p>
                    <p className="text-xs text-[var(--text-muted)]">{timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}