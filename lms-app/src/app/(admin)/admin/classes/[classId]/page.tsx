'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Pencil, Users, FileText, ClipboardList, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/lib/context/ToastContext';
import { getClassById, regenerateJoinCode, getEnrolledStudents } from '@/lib/mock/classes';
import { getMaterialsByClass } from '@/lib/mock/materials';
import { getAssignmentsByClass } from '@/lib/mock/assignments';
import { getTestsByClass } from '@/lib/mock/tests';
import type { Class, StudyMaterial, Assignment, Test, Profile } from '@/lib/types';

export default function AdminClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const { showToast } = useToast();
  const [cls, setCls] = useState<Class | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    async function load() {
      const [c, m, a, t, s] = await Promise.all([
        getClassById(classId),
        getMaterialsByClass(classId),
        getAssignmentsByClass(classId),
        getTestsByClass(classId),
        getEnrolledStudents(classId),
      ]);
      setCls(c); setMaterials(m); setAssignments(a); setTests(t); setStudents(s);
      setLoading(false);
    }
    load();
  }, [classId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const newCode = await regenerateJoinCode(classId);
      setCls((c) => c ? { ...c, join_code: newCode } : c);
      showToast('Join code regenerated!', 'success');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!cls) return <div className="text-center py-12 text-[var(--text-muted)]">Class not found.</div>;

  const tabs = [
    { label: 'Materials',    value: 'materials',    badge: materials.length },
    { label: 'Assignments',  value: 'assignments',  badge: assignments.length },
    { label: 'Tests',        value: 'tests',        badge: tests.length },
    { label: 'Students',     value: 'students',     badge: students.length },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/classes" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> All Classes
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--primary)]/15 to-[var(--accent)]/8 border border-[var(--primary)]/25 rounded-[20px] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-[14px] bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center">
              <GraduationCap size={26} className="text-[var(--primary)]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--text-primary)]">{cls.name}</h1>
                <Badge variant={cls.is_active ? 'success' : 'danger'} dot>{cls.is_active ? 'Active' : 'Inactive'}</Badge>
                {cls.subject && <Badge variant="info">{cls.subject}</Badge>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-1">{cls.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/classes/${classId}/edit`}><Button size="sm" variant="secondary"><Pencil size={14} /> Edit</Button></Link>
          </div>
        </div>
        <div className="mt-4">
          <CodeBlock code={cls.join_code} label="Student Join Code" />
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} /> Regenerate code
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} defaultValue="materials">
        {(active) => (
          <>
            {/* Materials tab */}
            {active === 'materials' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Link href={`/admin/classes/${classId}/materials/new`}><Button size="sm">+ Add Material</Button></Link>
                </div>
                {materials.length === 0 ? (
                  <Card className="text-center py-10 text-sm text-[var(--text-muted)]">No materials yet.</Card>
                ) : materials.map((mat) => (
                  <Card key={mat.id} className="flex items-center gap-4">
                    <span className="text-xl">{mat.type === 'document' ? '📄' : mat.type === 'link' ? '🔗' : '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{mat.title}</p>
                      {mat.description && <p className="text-xs text-[var(--text-muted)] truncate">{mat.description}</p>}
                    </div>
                    <Badge>{mat.type}</Badge>
                    <Link href={`/admin/classes/${classId}/materials/${mat.id}/edit`}><Button size="sm" variant="ghost"><Pencil size={13} /></Button></Link>
                  </Card>
                ))}
              </div>
            )}

            {/* Assignments tab */}
            {active === 'assignments' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Link href={`/admin/classes/${classId}/assignments/new`}><Button size="sm">+ Create Assignment</Button></Link>
                </div>
                {assignments.length === 0 ? (
                  <Card className="text-center py-10 text-sm text-[var(--text-muted)]">No assignments yet.</Card>
                ) : assignments.map((asgn) => (
                  <Card key={asgn.id} className="flex items-center gap-4">
                    <ClipboardList size={18} className="text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{asgn.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">Max {asgn.max_marks} marks · {asgn.due_date ? `Due ${asgn.due_date.slice(0, 10)}` : 'No deadline'}</p>
                    </div>
                    <Link href={`/admin/classes/${classId}/assignments/${asgn.id}`}><Button size="sm" variant="secondary">View Submissions</Button></Link>
                  </Card>
                ))}
              </div>
            )}

            {/* Tests tab */}
            {active === 'tests' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Link href={`/admin/classes/${classId}/tests/new`}><Button size="sm">+ Create Test</Button></Link>
                </div>
                {tests.length === 0 ? (
                  <Card className="text-center py-10 text-sm text-[var(--text-muted)]">No tests yet.</Card>
                ) : tests.map((test) => (
                  <Card key={test.id} className="flex items-center gap-4">
                    <FileText size={18} className="text-purple-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{test.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{test.question_count} questions · {test.max_marks} marks</p>
                    </div>
                    <Badge variant={test.is_published ? 'success' : 'default'} dot>{test.is_published ? 'Published' : 'Draft'}</Badge>
                    <Link href={`/admin/classes/${classId}/tests/${test.id}/results`}><Button size="sm" variant="secondary">Results</Button></Link>
                  </Card>
                ))}
              </div>
            )}

            {/* Students tab */}
            {active === 'students' && (
              <div className="space-y-3">
                {students.length === 0 ? (
                  <Card className="text-center py-10 text-sm text-[var(--text-muted)]">No students enrolled.</Card>
                ) : students.map((s) => {
                  const initials = s.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-[12px] hover:bg-[var(--bg-elevated)] transition-colors">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{s.full_name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{s.email}</p>
                      </div>
                      <Users size={14} className="text-[var(--text-muted)]" />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}
