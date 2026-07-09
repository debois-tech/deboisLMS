'use client';

import { useEffect, useState, useCallback } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import { getTestById, getQuestionsByTest, getMyAttempt, submitTest } from '@/lib/mock/tests';
import type { Test, TestQuestion, TestAttempt } from '@/lib/types';

export default function TakeTestPage({ params }: { params: Promise<{ classId: string; testId: string }> }) {
  const { classId, testId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const [t, q, a] = await Promise.all([
        getTestById(testId),
        getQuestionsByTest(testId),
        getMyAttempt(testId, user?.id ?? ''),
      ]);
      setTest(t); setQuestions(q); setAttempt(a);
      if (t?.duration_mins) setTimeLeft(t.duration_mins * 60);
      setLoading(false);
    }
    load();
  }, [testId, user?.id]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || attempt?.status === 'submitted') return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const timer = setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, attempt?.status]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setConfirmOpen(false);
    try {
      const result = await submitTest(testId, user?.id ?? '', answers);
      setAttempt(result);
      showToast('Test submitted!', 'success');
      router.push(`/dashboard/classes/${classId}/tests/${testId}/result`);
    } catch {
      showToast('Failed to submit test.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [answers, classId, router, showToast, testId, user?.id]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const unanswered = questions.length - Object.keys(answers).length;

  if (loading) return <PageLoader />;
  if (!test) return <div className="text-center py-12 text-[var(--text-muted)]">Test not found.</div>;

  // Already attempted — redirect
  if (attempt?.status === 'submitted') {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/15 border border-[var(--primary)]/25 flex items-center justify-center mx-auto text-2xl">✅</div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Already Submitted</h2>
        <p className="text-sm text-[var(--text-muted)]">You have already completed this test.</p>
        <Link href={`/dashboard/classes/${classId}/tests/${testId}/result`}>
          <Button>View Results</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Sticky header */}
      <div className="sticky top-16 z-30 bg-[var(--bg-base)]/80 backdrop-blur-md py-3 -mx-6 px-6 border-b border-[var(--border)] flex items-center gap-4">
        <Link href={`/dashboard/classes/${classId}`} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-[var(--text-primary)] truncate">{test.title}</h1>
          <p className="text-xs text-[var(--text-muted)]">{questions.length} questions · {test.max_marks} marks</p>
        </div>
        {timeLeft !== null && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-mono font-bold ${timeLeft < 120 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'}`}>
            <Clock size={14} /> {formatTime(timeLeft)}
          </div>
        )}
        <Button size="sm" onClick={() => {
          if (unanswered > 0) setConfirmOpen(true);
          else handleSubmit();
        }} loading={submitting}>
          Submit
        </Button>
      </div>

      {/* Questions */}
      <div className="space-y-5 pt-2">
        {questions.map((q, idx) => (
          <Card key={q.id} className={answers[q.id] ? 'border-[var(--primary)]/30' : ''}>
            <div className="flex items-start gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">{q.question_text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={q.question_type === 'mcq' ? 'info' : 'purple'}>{q.question_type === 'mcq' ? 'MCQ' : 'Short Answer'}</Badge>
                  <span className="text-xs text-[var(--text-muted)]">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {q.question_type === 'mcq' && q.options ? (
              <div className="space-y-2 ml-10">
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-[10px] cursor-pointer transition-all duration-150 ${
                      answers[q.id] === opt
                        ? 'bg-[var(--primary)]/15 border border-[var(--primary)]/40'
                        : 'hover:bg-[var(--bg-elevated)] border border-transparent'
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      className="accent-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--text-primary)]">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="ml-10">
                <textarea
                  rows={3}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Type your answer..."
                  className="w-full px-3 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-none"
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Submit confirm modal */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit Test?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Go Back</Button>
            <Button onClick={handleSubmit} loading={submitting}>Submit Anyway</Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)]">
            You have <strong className="text-[var(--text-primary)]">{unanswered} unanswered question{unanswered !== 1 ? 's' : ''}</strong>.
            Once submitted you cannot re-take this test.
          </p>
        </div>
      </Modal>
    </div>
  );
}
