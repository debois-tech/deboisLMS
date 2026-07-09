'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Users, ClipboardList, Activity, Plus, ArrowRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/context/AuthContext';
import { getAdminStats, getRecentActivity } from '@/lib/mock/dashboard';
import { timeAgo } from '@/lib/utils/format';
import type { AdminStats, ActivityItem } from '@/lib/types';

const activityIcons: Record<string, string> = {
  enrollment: '👤', submission: '📎', material: '📄', test: '📝',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAdminStats(), getRecentActivity()]).then(([s, a]) => {
      setStats(s); setActivity(a); setLoading(false);
    });
  }, []);

  if (loading) return <PageLoader />;

  const statCards = [
    { label: 'Total Classes',    value: stats!.total_classes,    icon: BookOpen,      color: 'text-[var(--primary)]',   bg: 'bg-[var(--primary)]/10' },
    { label: 'Total Students',   value: stats!.total_students,   icon: Users,         color: 'text-emerald-400',        bg: 'bg-emerald-500/10' },
    { label: 'Pending Grading',  value: stats!.pending_grading,  icon: ClipboardList, color: 'text-amber-400',          bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Here&apos;s an overview of your platform.</p>
        </div>
        <Link href="/admin/classes/new">
          <Button size="sm"><Plus size={15} /> New Class</Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} glass>
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-[12px] ${s.bg} flex items-center justify-center`}>
                  <Icon size={22} className={s.color} />
                </div>
                <div>
                  <p className="text-3xl font-black text-[var(--text-primary)]">{s.value}</p>
                  <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Create Class',     href: '/admin/classes/new',  icon: Plus },
              { label: 'View Classes',     href: '/admin/classes',       icon: BookOpen },
              { label: 'View Students',    href: '/admin/students',      icon: Users },
              { label: 'Pending Grading',  href: '/admin/classes',       icon: ClipboardList },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all text-center group"
                >
                  <Icon size={20} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                  <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader
            title="Recent Activity"
            action={<Activity size={16} className="text-[var(--text-muted)]" />}
          />
          <div className="space-y-3">
            {activity.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">{activityIcons[item.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{item.text}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{timeAgo(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Classes overview */}
      <Card>
        <CardHeader
          title="My Classes"
          action={
            <Link href="/admin/classes" className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          }
        />
        <div className="space-y-2">
          {[
            { name: 'Introduction to Web Development', students: 24, subject: 'Web Dev', active: true },
            { name: 'Python for Data Science',         students: 18, subject: 'Data Science', active: true },
            { name: 'React & Next.js Masterclass',     students: 31, subject: 'Frontend', active: true },
          ].map((cls) => (
            <div key={cls.name} className="flex items-center gap-4 p-3 rounded-[10px] hover:bg-[var(--bg-elevated)] transition-colors">
              <div className="w-8 h-8 rounded-[8px] bg-[var(--primary)]/15 flex items-center justify-center shrink-0">
                <BookOpen size={15} className="text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{cls.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{cls.students} students</p>
              </div>
              <Badge>{cls.subject}</Badge>
              {cls.active && <Badge variant="success" dot>Active</Badge>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
