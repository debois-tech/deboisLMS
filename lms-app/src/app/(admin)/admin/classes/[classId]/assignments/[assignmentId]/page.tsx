'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/lib/context/ToastContext';
import { getAssignmentById, getSubmissionsByAssignment, gradeSubmission } from '@/lib/mock/assignments';
import { formatDateTime } from '@/lib/utils/format';
import type { Assignment, AssignmentSubmission } from '@/lib/types';

export default function AssignmentSubmissionsPage({ params }: { params: Promise<{ classId: string; assignmentId: string }> }) {
  const { classId, assignmentId } = use(params);
  const { showToast } = useToast();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingTarget, setGradingTarget] = useState<AssignmentSubmission | null>(null);
  const [gradeForm, setGradeForm] = useState({ marks: '', feedback: '' });
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    async function load() {
      const [a, s] = await Promise.all([getAssignmentById(assignmentId), getSubmissionsByAssignment(assignmentId)]);
      setAssignment(a); setSubmissions(s); setLoading(false);
    }
    load();
  }, [assignmentId]);

  const handleGrade = async () => {
    if (!gradingTarget) return;
    const marks = Number(gradeForm.marks);
    if (isNaN(marks) || marks < 0) { showToast('Enter valid marks.', 'error'); return; }
    setGrading(true);
    try {
      const updated = await gradeSubmission(gradingTarget.id, marks, gradeForm.feedback);
      setSubmissions((s) => s.map((x) => x.id === updated.id ? { ...x, ...updated } : x));
      showToast('Submission graded!', 'success');
      setGradingTarget(null);
      setGradeForm({ marks: '', feedback: '' });
    } finally {
      setGrading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!assignment) return <div className="text-center py-12 text-[var(--text-muted)]">Assignment not found.</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <Link href={`/admin/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>

      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{assignment.title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{submissions.length} submission{submissions.length !== 1 ? 's' : ''} · Max {assignment.max_marks} marks</p>
      </div>

      {submissions.length === 0 ? (
        <Card className="text-center py-12 text-sm text-[var(--text-muted)]">No submissions yet.</Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const initials = sub.student?.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
            return (
              <Card key={sub.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-[var(--text-primary)]">{sub.student?.full_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">Submitted {formatDateTime(sub.submitted_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {sub.status === 'graded' ? (
                      <>
                        <Badge variant="success" dot>Graded</Badge>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{sub.marks_obtained}/{assignment.max_marks}</span>
                      </>
                    ) : (
                      <Badge variant="warning" dot>Pending</Badge>
                    )}
                    {sub.status !== 'graded' && (
                      <Button size="sm" onClick={() => { setGradingTarget(sub); setGradeForm({ marks: '', feedback: '' }); }}>
                        Grade
                      </Button>
                    )}
                  </div>
                </div>

                {sub.text_answer && (
                  <div className="mt-3 p-3 bg-[var(--bg-elevated)] rounded-[10px]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Answer</p>
                    <p className="text-sm text-[var(--text-secondary)]">{sub.text_answer}</p>
                  </div>
                )}
                {sub.file_name && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--primary)]">
                    📎 {sub.file_name}
                  </div>
                )}
                {sub.status === 'graded' && sub.feedback && (
                  <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-[10px]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Your feedback</p>
                    <p className="text-sm text-emerald-300">{sub.feedback}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Grading modal */}
      <Modal
        open={!!gradingTarget}
        onClose={() => setGradingTarget(null)}
        title={`Grade — ${gradingTarget?.student?.full_name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setGradingTarget(null)}>Cancel</Button>
            <Button onClick={handleGrade} loading={grading}>Save Grade</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Marks Obtained <span className="text-[var(--text-muted)]">(out of {assignment?.max_marks})</span>
            </label>
            <input
              type="number"
              min="0"
              max={assignment?.max_marks}
              value={gradeForm.marks}
              onChange={(e) => setGradeForm((f) => ({ ...f, marks: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Feedback <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
            <textarea
              rows={3}
              value={gradeForm.feedback}
              onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))}
              placeholder="Leave constructive feedback for the student..."
              className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
