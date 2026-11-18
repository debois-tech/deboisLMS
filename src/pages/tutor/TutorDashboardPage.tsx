import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, GraduationCap, Layers, Users, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useAuth } from '@/lib/context/AuthContext';
import { getBatches, getCurriculumProgress, getTutorDashboardStats, getTutorRecentActivity } from '@/lib/supabase';
import type { RecentActivity, TutorDashboardStats } from '@/lib/supabase';
import type { Batch } from '@/lib/types';
import { timeAgo } from '@/lib/utils/format';
import { greetingParts } from '@/lib/utils/loginIntro';

function Stat({ icon, label, value, to, alert }: { icon: ReactNode; label: string; value: number; to?: string; alert?: boolean }) {
  const body = (
    <>
      <span className="tdash-icon">{icon}</span>
      <span className="tdash-stat-text">
        <span className="tdash-stat-label">{label}</span>
        <span className="tdash-stat-value">{value}</span>
      </span>
      {to && <span className="tdash-chevron"><ChevronRight size={16} /></span>}
    </>
  );
  const className = `tdash-stat${alert ? ' is-alert' : ''}`;
  return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}

function Head({ icon, title, to, linkLabel }: { icon: ReactNode; title: string; to?: string; linkLabel?: string }) {
  return (
    <div className="tdash-head">
      <h2 className="tdash-head-title">{icon}{title}</h2>
      {to && <Link to={to} className="tdash-link">{linkLabel} <ArrowRight size={14} /></Link>}
    </div>
  );
}

const ACTIONS = [
  { to: '/tutor/assignments', label: 'Grade Submissions', icon: CheckCircle2 },
  { to: '/tutor/attendance', label: 'Mark Attendance', icon: ClipboardCheck },
  { to: '/tutor/students', label: 'View Students', icon: GraduationCap },
];

export default function TutorDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<TutorDashboardStats | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [progress, setProgress] = useState<Map<string, { done: number; total: number }>>(new Map());
  const [activity, setActivity] = useState<RecentActivity[]>([]);

  const { loading, error, retry } = useInitialLoad(async () => {
    const [s, b, p, a] = await Promise.all([getTutorDashboardStats(), getBatches(), getCurriculumProgress(), getTutorRecentActivity()]);
    setStats(s);
    setBatches(b);
    setProgress(p);
    setActivity(a);
  });

  // Every running batch (this list is the way into one); no curriculum yet shows a dash.
  const courses = batches
    .filter((batch) => batch.status === 'ongoing')
    .map((batch) => {
      const { done, total } = progress.get(batch.id) ?? { done: 0, total: 0 };
      return { batch, done, total, percent: total > 0 ? `${Math.round((done / total) * 100)}%` : '—' };
    });
  const pending = stats?.pending_grading ?? 0;
  const { lead, name } = greetingParts(new Date().getHours(), user?.full_name);

  return (
    <div className="page-section" data-intro-ready={loading ? undefined : '1'}>
      <div className="tdash-greeting">
        <h1 data-intro-target>
          {lead}{name && <>, <span className="greeting-name">{name}</span></>}!
        </h1>
        <p>A quick overview of your batches</p>
      </div>

      {loading ? (
        <Spinner centered />
      ) : error ? (
        <ErrorState centered message={error} onRetry={retry} />
      ) : (
        <>
          <div className="tdash-stats">
            <Stat icon={<Users size={36} />} label="My Batches" value={stats?.batch_count ?? 0} />
            <Stat icon={<GraduationCap size={36} />} label="My Students" value={stats?.student_count ?? 0} to="/tutor/students" />
            <Stat icon={<CheckCircle2 size={36} />} label="Pending Grading" value={pending} to="/tutor/assignments" alert={pending > 0} />
          </div>

          <div className="tdash-main">
            <Card padding="lg">
              <Head icon={<BarChart3 size={20} />} title="Course Progress" to="/tutor/curriculum" linkLabel="View All" />
              {courses.length === 0 ? (
                <EmptyState icon={<Layers size={32} />} title="No running batches" />
              ) : (
                <div className="tdash-progress-list">
                  {courses.map(({ batch, done, total, percent }) => (
                    <Link key={batch.id} to={`/tutor/batches/${batch.id}`} className="tdash-progress-row">
                      <span className="tdash-progress-name">{batch.name}</span>
                      <ProgressBar done={done} total={total} label={`${batch.name} course progress`} />
                      <span className="tdash-progress-percent">{percent}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="lg">
              <Head icon={<Zap size={20} />} title="Quick Actions" />
              <div className="tdash-actions">
                {ACTIONS.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} className="tdash-action">
                    <Icon size={20} className="tdash-action-icon" />
                    <span>{label}</span>
                    <ChevronRight size={16} className="tdash-action-chevron" />
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <Card padding="lg">
            <Head icon={<CalendarDays size={20} />} title="Recent Activity" />
            {activity.length === 0 ? (
              <EmptyState icon={<Layers size={32} />} title="No recent activity" />
            ) : (
              <ul className="tdash-activity">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className={`tdash-dot${item.type === 'lecture_added' ? ' is-info' : ''}`} aria-hidden="true" />
                    <span className="tdash-activity-text">{item.text}</span>
                    <span className="tdash-activity-time">{timeAgo(item.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
