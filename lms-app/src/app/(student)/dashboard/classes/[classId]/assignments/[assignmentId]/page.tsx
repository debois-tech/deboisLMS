'use client';

import { useEffect, useState, useRef } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import { getAssignmentById, getMySubmission, submitAssignment } from '@/lib/mock/assignments';
import { formatDate, formatDateTime, isOverdue } from '@/lib/utils/format';
import type { Assignment, AssignmentSubmission } from '@/lib/types';

export default function AssignmentDetailPage({ params }: { params: Promise<{ classId: string; assignmentId: string }> }) {
  const { classId, assignmentId } = use(params);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [textAnswer, setTextAnswer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const [a, s] = await Promise.all([
        getAssignmentById(assignmentId),
        getMySubmission(assignmentId, user?.id ?? ''),
      ]);
      setAssignment(a); setSubmission(s); setLoading(false);
    }
    load();
  }, [assignmentId, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textAnswer.trim() && !file) { showToast('Please add a text answer or upload a file.', 'error'); return; }
    setSubmitting(true);
    try {
      const sub = await submitAssignment({
        assignment_id: assignmentId,
        student_id: user?.id ?? '',
        text_answer: textAnswer || undefined,
        file_name: file?.name,
      });
      setSubmission(sub);
      showToast('Assignment submitted successfully!', 'success');
    } catch {
      showToast('Failed to submit. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!assignment) return <div className="text-center py-12 text-[var(--text-muted)]">Assignment not found.</div>;

  const overdue = assignment.due_date && isOverdue(assignment.due_date);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/dashboard/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          {overdue ? <Badge variant="danger">Overdue</Badge> : <Badge variant="warning">Assignment</Badge>}
          {assignment.due_date && <span className="text-xs text-[var(--text-muted)]">Due {formatDateTime(assignment.due_date)}</span>}
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{assignment.title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Max marks: {assignment.max_marks}</p>
      </div>

      {/* Instructions */}
      <Card>
        <h2 className="font-semibold text-[var(--text-primary)] mb-3">Instructions</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--text-secondary)] leading-relaxed">
          {assignment.description}
        </pre>
      </Card>

      {/* Submission */}
      {submission ? (
        <Card className="border-emerald-500/25">
          {submission.status === 'graded' ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 size={22} className="text-emerald-400" />
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">Graded</h3>
                  <p className="text-xs text-[var(--text-muted)]">Graded on {formatDate(submission.graded_at!)}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-black text-[var(--primary)]">{submission.marks_obtained}<span className="text-sm text-[var(--text-muted)] font-normal">/{assignment.max_marks}</span></p>
                </div>
              </div>
              {submission.feedback && (
                <div className="p-4 bg-[var(--bg-elevated)] rounded-[10px]">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Instructor Feedback</p>
                  <p className="text-sm text-[var(--text-secondary)]">{submission.feedback}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <CheckCircle2 size={22} className="text-blue-400" />
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Submitted</h3>
                <p className="text-xs text-[var(--text-muted)]">Submitted on {formatDateTime(submission.submitted_at)}. Awaiting grading.</p>
              </div>
            </div>
          )}
          {submission.text_answer && (
            <div className="mt-4 p-4 bg-[var(--bg-elevated)] rounded-[10px]">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Your Answer</p>
              <p className="text-sm text-[var(--text-secondary)]">{submission.text_answer}</p>
            </div>
          )}
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <h2 className="font-semibold text-[var(--text-primary)] mb-4">Your Submission</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Written Answer</label>
                <textarea
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  rows={5}
                  placeholder="Type your answer here..."
                  className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-none"
                />
              </div>

              {assignment.allow_file && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Attach File <span className="text-[var(--text-muted)] font-normal">(optional, max 10MB)</span></label>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)]/50 rounded-[12px] flex flex-col items-center gap-2 transition-colors group"
                  >
                    <Upload size={20} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                    <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
                      {file ? file.name : 'Click to upload a file'}
                    </span>
                  </button>
                </div>
              )}

              <Button type="submit" loading={submitting} className="w-full">
                Submit Assignment
              </Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
