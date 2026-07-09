'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, FileText, Plus, ArrowRight, Calendar } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/context/AuthContext';
import { getStudentClasses } from '@/lib/mock/classes';
import { getAssignmentsByClass } from '@/lib/mock/assignments';
import { getMaterialsByClass } from '@/lib/mock/materials';
import { formatDate, daysUntil, isOverdue } from '@/lib/utils/format';
import type { Class, Assignment, StudyMaterial } from '@/lib/types';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<(Assignment & { className: string })[]>([]);
  const [recentMaterials, setRecentMaterials] = useState<(StudyMaterial & { className: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const cls = await getStudentClasses();
      setClasses(cls);

      const asgns: (Assignment & { className: string })[] = [];
      const mats: (StudyMaterial & { className: string })[] = [];
      for (const c of cls) {
        const a = await getAssignmentsByClass(c.id);
        asgns.push(...a.map((x) => ({ ...x, className: c.name })));
        const m = await getMaterialsByClass(c.id);
        mats.push(...m.map((x) => ({ ...x, className: c.name })));
      }
      setUpcomingAssignments(
        asgns
          .filter((a) => a.due_date)
          .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
          .slice(0, 5)
      );
      setRecentMaterials(
        mats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3)
      );
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Good day, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Here&apos;s what&apos;s happening in your classes.</p>
      </div>

      {/* Join CTA */}
      <Card glass className="border-[var(--primary)]/30 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] mb-1">Join a new class</h3>
            <p className="text-sm text-[var(--text-muted)]">Got a class code? Enter it to enroll instantly.</p>
          </div>
          <Link href="/dashboard/join">
            <Button size="sm" className="shrink-0">
              <Plus size={15} /> Enter Class Code
            </Button>
          </Link>
        </div>
      </Card>

      {/* My Classes grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">My Classes</h2>
          <Link href="/dashboard/classes" className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {classes.length === 0 ? (
          <Card className="text-center py-12 text-[var(--text-muted)] text-sm">
            You haven&apos;t joined any classes yet. <Link href="/dashboard/join" className="text-[var(--primary)] hover:underline">Join one now.</Link>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <Link key={cls.id} href={`/dashboard/classes/${cls.id}`}>
                <Card hover className="h-full">
                  <div className="w-10 h-10 rounded-[10px] bg-[var(--primary)]/15 border border-[var(--primary)]/20 flex items-center justify-center mb-3">
                    <BookOpen size={20} className="text-[var(--primary)]" />
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1 line-clamp-2">{cls.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] mb-3 line-clamp-2">{cls.description}</p>
                  <div className="flex items-center gap-2">
                    {cls.subject && <Badge>{cls.subject}</Badge>}
                    <span className="text-xs text-[var(--text-muted)]">{cls.student_count} students</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Assignments */}
        <Card>
          <CardHeader
            title="Upcoming Due Dates"
            subtitle={`${upcomingAssignments.length} assignments`}
            action={<Calendar size={16} className="text-[var(--text-muted)]" />}
          />
          {upcomingAssignments.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">No upcoming assignments. 🎉</p>
          ) : (
            <div className="space-y-2">
              {upcomingAssignments.map((asgn) => {
                const overdue = asgn.due_date && isOverdue(asgn.due_date);
                const days = asgn.due_date ? daysUntil(asgn.due_date) : null;
                return (
                  <Link
                    key={asgn.id}
                    href={`/dashboard/classes/${asgn.class_id}/assignments/${asgn.id}`}
                    className="flex items-center justify-between p-3 rounded-[10px] hover:bg-[var(--bg-elevated)] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{asgn.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{asgn.className}</p>
                    </div>
                    <div className="shrink-0 ml-3">
                      {overdue ? (
                        <Badge variant="danger" dot>Overdue</Badge>
                      ) : days !== null && days <= 3 ? (
                        <Badge variant="warning" dot>{days === 0 ? 'Due today' : `${days}d left`}</Badge>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">{asgn.due_date ? formatDate(asgn.due_date) : '—'}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent Materials */}
        <Card>
          <CardHeader
            title="Recent Materials"
            subtitle="Latest uploads from your classes"
            action={<FileText size={16} className="text-[var(--text-muted)]" />}
          />
          {recentMaterials.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">No materials yet.</p>
          ) : (
            <div className="space-y-2">
              {recentMaterials.map((mat) => (
                <Link
                  key={mat.id}
                  href={`/dashboard/classes/${mat.class_id}/materials/${mat.id}`}
                  className="flex items-center gap-3 p-3 rounded-[10px] hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-[8px] bg-[var(--bg-overlay)] flex items-center justify-center shrink-0">
                    {mat.type === 'document' ? '📄' : mat.type === 'link' ? '🔗' : '📝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{mat.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{mat.className}</p>
                  </div>
                  <Clock size={13} className="text-[var(--text-muted)] shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
