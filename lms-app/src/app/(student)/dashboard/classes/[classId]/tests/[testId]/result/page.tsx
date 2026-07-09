'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { getTestById, getQuestionsByTest, getMyAttempt } from '@/lib/mock/tests';
import { useAuth } from '@/lib/context/AuthContext';
import { formatDateTime } from '@/lib/utils/format';
import type { Test, TestQuestion, TestAttempt } from '@/lib/types';

export default function TestResultPage({ params }: { params: Promise<{ classId: string; testId: string }> }) {
  const { classId, testId } = use(params);
  const { user } = useAuth();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, q, a] = await Promise.all([
        getTestById(testId),
        getQuestionsByTest(testId),
        getMyAttempt(testId, user?.id ?? ''),
      ]);
      setTest(t); setQuestions(q); setAttempt(a); setLoading(false);
    }
    load();
  }, [testId, user?.id]);

  if (loading) return <PageLoader />;
  if (!test || !attempt) return <div className="text-center py-12 text-[var(--text-muted)]">Result not available.</div>;

  const mcqQuestions = questions.filter((q) => q.question_type === 'mcq');
  const mcqMax = mcqQuestions.reduce((s, q) => s + q.marks, 0);
  const percentage = attempt.score !== undefined && test.max_marks ? Math.round((attempt.score / mcqMax) * 100) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/dashboard/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>

      <h1 className="text-2xl font-bold text-[var(--text-primary)]">{test.title} — Results</h1>

      {/* Score card */}
      <Card className="bg-gradient-to-br from-[var(--primary)]/10 to-[var(--accent)]/5 border-[var(--primary)]/25 text-center py-8">
        <p className="text-6xl font-black text-[var(--text-primary)] mb-1">
          {attempt.score ?? '—'}<span className="text-2xl text-[var(--text-muted)] font-normal">/{mcqMax}</span>
        </p>
        {percentage !== null && (
          <p className="text-lg font-semibold text-[var(--text-secondary)] mb-2">{percentage}%</p>
        )}
        <Badge variant={percentage !== null && percentage >= 70 ? 'success' : percentage !== null && percentage >= 40 ? 'warning' : 'danger'} size="md">
          {percentage !== null && percentage >= 70 ? 'Excellent' : percentage !== null && percentage >= 40 ? 'Fair' : 'Needs Improvement'}
        </Badge>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Submitted {attempt.submitted_at ? formatDateTime(attempt.submitted_at) : '—'}
        </p>
        {questions.some((q) => q.question_type === 'short_answer') && (
          <p className="text-xs text-amber-400 mt-2">⚠️ Short answer marks pending instructor review.</p>
        )}
      </Card>

      {/* Question review */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Answer Review</h2>
        {questions.map((q, idx) => {
          const studentAnswer = attempt.answers[q.id] ?? '';
          const isCorrect = q.question_type === 'mcq' && studentAnswer === q.correct_answer;
          const isWrong = q.question_type === 'mcq' && studentAnswer && !isCorrect;

          return (
            <Card key={q.id} className={isCorrect ? 'border-emerald-500/30' : isWrong ? 'border-red-500/30' : ''}>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] shrink-0 mt-0.5">{idx + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-3">{q.question_text}</p>

                  {q.question_type === 'mcq' ? (
                    <div className="space-y-1.5">
                      {q.options?.map((opt) => {
                        const isStudent = opt === studentAnswer;
                        const isAnswer = opt === q.correct_answer;
                        return (
                          <div key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm ${
                            isAnswer ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' :
                            isStudent && !isAnswer ? 'bg-red-500/15 border border-red-500/30 text-red-300' :
                            'text-[var(--text-muted)]'
                          }`}>
                            {isAnswer ? <CheckCircle2 size={14} /> : isStudent ? <XCircle size={14} /> : <span className="w-3.5" />}
                            {opt}
                            {isAnswer && !isStudent && <span className="ml-auto text-xs text-emerald-400">Correct</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-[var(--bg-elevated)] rounded-[8px]">
                        <p className="text-xs text-[var(--text-muted)] mb-1">Your answer:</p>
                        <p className="text-sm text-[var(--text-secondary)]">{studentAnswer || <em className="text-[var(--text-muted)]">No answer</em>}</p>
                      </div>
                      <Badge variant="warning">Pending manual grading</Badge>
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {q.question_type === 'mcq' && (
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {isCorrect ? q.marks : 0}/{q.marks}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
