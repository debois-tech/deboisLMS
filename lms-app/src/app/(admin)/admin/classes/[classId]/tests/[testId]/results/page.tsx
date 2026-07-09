'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { getTestById, getQuestionsByTest, getAllAttempts } from '@/lib/mock/tests';
import { MOCK_STUDENTS } from '@/lib/mock/classes';
import { formatDateTime } from '@/lib/utils/format';
import type { Test, TestQuestion, TestAttempt } from '@/lib/types';

export default function TestResultsAdminPage({ params }: { params: Promise<{ classId: string; testId: string }> }) {
  const { classId, testId } = use(params);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, q, a] = await Promise.all([getTestById(testId), getQuestionsByTest(testId), getAllAttempts(testId)]);
      setTest(t); setQuestions(q); setAttempts(a); setLoading(false);
    }
    load();
  }, [testId]);

  if (loading) return <PageLoader />;
  if (!test) return <div className="text-center py-12 text-[var(--text-muted)]">Test not found.</div>;

  const mcqMax = questions.filter((q) => q.question_type === 'mcq').reduce((s, q) => s + q.marks, 0);
  const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attempts.length) : 0;

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={`/admin/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{test.title} — Results</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-2xl font-black text-[var(--text-primary)]">{avgScore}<span className="text-sm text-[var(--text-muted)] font-normal">/{mcqMax}</span></p>
            <p className="text-xs text-[var(--text-muted)]">Avg Score</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-[var(--text-primary)]">{attempts.length}</p>
            <p className="text-xs text-[var(--text-muted)]">Attempts</p>
          </div>
        </div>
      </div>

      {/* Attempts table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Student</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Score</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => {
              const student = MOCK_STUDENTS.find((s) => s.id === attempt.student_id);
              const pct = attempt.score !== undefined && mcqMax > 0 ? Math.round((attempt.score / mcqMax) * 100) : null;
              const initials = student?.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
              return (
                <tr key={attempt.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-[10px] font-bold shrink-0">{initials}</div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{student?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{student?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-[var(--text-primary)]">{attempt.score ?? '—'}/{mcqMax}</span>
                    {pct !== null && <span className="text-xs text-[var(--text-muted)] ml-2">({pct}%)</span>}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={attempt.status === 'submitted' ? 'success' : 'warning'} dot>
                      {attempt.status === 'submitted' ? 'Submitted' : 'In Progress'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-[var(--text-muted)]">
                    {attempt.submitted_at ? formatDateTime(attempt.submitted_at) : '—'}
                  </td>
                </tr>
              );
            })}
            {attempts.length === 0 && (
              <tr><td colSpan={4} className="py-10 text-center text-sm text-[var(--text-muted)]">No attempts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
