'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, ClipboardList, GraduationCap, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { getClassById } from '@/lib/mock/classes';
import { getMaterialsByClass } from '@/lib/mock/materials';
import { getAssignmentsByClass } from '@/lib/mock/assignments';
import { getTestsByClass } from '@/lib/mock/tests';
import { formatDate, isOverdue, daysUntil } from '@/lib/utils/format';
import type { Class, StudyMaterial, Assignment, Test } from '@/lib/types';

export default function ClassHomePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const [cls, setCls] = useState<Class | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [c, m, a, t] = await Promise.all([
        getClassById(classId),
        getMaterialsByClass(classId),
        getAssignmentsByClass(classId),
        getTestsByClass(classId),
      ]);
      setCls(c); setMaterials(m); setAssignments(a);
      setTests(t.filter((x) => x.is_published));
      setLoading(false);
    }
    load();
  }, [classId]);

  if (loading) return <PageLoader />;
  if (!cls) return <div className="text-[var(--text-muted)] py-12 text-center">Class not found.</div>;

  const tabs = [
    { label: 'Materials',    value: 'materials',    badge: materials.length },
    { label: 'Assignments',  value: 'assignments',  badge: assignments.length },
    { label: 'Tests',        value: 'tests',        badge: tests.length },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/dashboard/classes" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> My Classes
      </Link>

      {/* Class header */}
      <div className="bg-gradient-to-r from-[var(--primary)]/15 to-[var(--accent)]/8 border border-[var(--primary)]/25 rounded-[20px] p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-[14px] bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center shrink-0">
            <GraduationCap size={26} className="text-[var(--primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{cls.name}</h1>
              {cls.subject && <Badge variant="info">{cls.subject}</Badge>}
            </div>
            <p className="text-sm text-[var(--text-muted)]">{cls.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><Users size={12} /> {cls.student_count} students</span>
          <span>Joined {formatDate(cls.created_at)}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} defaultValue="materials">
        {(active) => (
          <>
            {/* Materials */}
            {active === 'materials' && (
              <div className="space-y-3">
                {materials.length === 0 ? (
                  <Card className="text-center py-10 text-sm text-[var(--text-muted)]">No materials posted yet.</Card>
                ) : materials.map((mat) => (
                  <Link key={mat.id} href={`/dashboard/classes/${classId}/materials/${mat.id}`}>
                    <Card hover className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-[10px] bg-[var(--bg-elevated)] flex items-center justify-center text-lg shrink-0">
                        {mat.type === 'document' ? '📄' : mat.type === 'link' ? '🔗' : '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[var(--text-primary)] truncate">{mat.title}</p>
                        {mat.description && <p className="text-xs text-[var(--text-muted)] truncate">{mat.description}</p>}
                      </div>
                      <Badge>{mat.type}</Badge>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {/* Assignments */}
            {active === 'assignments' && (
              <div className="space-y-3">
                {assignments.length === 0 ? (
                  <Card className="text-center py-10 text-sm text-[var(--text-muted)]">No assignments yet.</Card>
                ) : assignments.map((asgn) => {
                  const overdue = asgn.due_date && isOverdue(asgn.due_date);
                  const days = asgn.due_date ? daysUntil(asgn.due_date) : null;
                  return (
                    <Link key={asgn.id} href={`/dashboard/classes/${classId}/assignments/${asgn.id}`}>
                      <Card hover className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[10px] bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <ClipboardList size={18} className="text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-[var(--text-primary)] truncate">{asgn.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">Max marks: {asgn.max_marks}</p>
                        </div>
                        <div className="shrink-0">
                          {overdue ? <Badge variant="danger">Overdue</Badge>
                            : days !== null && days <= 3 ? <Badge variant="warning">{days === 0 ? 'Due today' : `${days}d left`}</Badge>
                            : asgn.due_date ? <span className="text-xs text-[var(--text-muted)]">{formatDate(asgn.due_date)}</span>
                            : <Badge>No deadline</Badge>}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Tests */}
            {active === 'tests' && (
              <div className="space-y-3">
                {tests.length === 0 ? (
                  <Card className="text-center py-10 text-sm text-[var(--text-muted)]">No tests published yet.</Card>
                ) : tests.map((test) => (
                  <Link key={test.id} href={`/dashboard/classes/${classId}/tests/${test.id}`}>
                    <Card hover className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-[10px] bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[var(--text-primary)] truncate">{test.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {test.question_count} questions · {test.duration_mins ? `${test.duration_mins} min` : 'No time limit'}
                        </p>
                      </div>
                      <Badge variant="purple">{test.max_marks} marks</Badge>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}
