'use client';

import { useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/lib/context/ToastContext';
import { createTest, addQuestion } from '@/lib/mock/tests';
import type { QuestionType } from '@/lib/types';

interface QuestionDraft {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  correct_answer: string;
  marks: number;
}

export default function CreateTestPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [testId, setTestId] = useState<string | null>(null);
  const [testForm, setTestForm] = useState({ title: '', description: '', duration_mins: '', is_published: false });
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const updateTest = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setTestForm((prev) => ({ ...prev, [f]: e.target.value }));

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testForm.title.trim()) { showToast('Test title is required.', 'error'); return; }
    setSaving(true);
    try {
      const test = await createTest({
        class_id: classId,
        title: testForm.title,
        description: testForm.description,
        duration_mins: testForm.duration_mins ? Number(testForm.duration_mins) : undefined,
        is_published: testForm.is_published,
        created_by: 'user-admin-001',
      });
      setTestId(test.id);
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const addEmptyQuestion = () => {
    setQuestions((q) => [...q, {
      id: `draft-${Date.now()}`,
      question_text: '',
      question_type: 'mcq',
      options: ['', '', '', ''],
      correct_answer: '',
      marks: 1,
    }]);
  };

  const updateQuestion = (id: string, field: string, value: unknown) => {
    setQuestions((q) => q.map((x) => x.id === id ? { ...x, [field]: value } : x));
  };

  const updateOption = (qId: string, idx: number, value: string) => {
    setQuestions((q) => q.map((x) => {
      if (x.id !== qId) return x;
      const opts = [...x.options];
      opts[idx] = value;
      return { ...x, options: opts };
    }));
  };

  const removeQuestion = (id: string) => setQuestions((q) => q.filter((x) => x.id !== id));

  const handleFinish = async () => {
    if (!testId) return;
    setSaving(true);
    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await addQuestion({
          test_id: testId,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.question_type === 'mcq' ? q.options.filter(Boolean) : undefined,
          correct_answer: q.correct_answer || undefined,
          marks: q.marks,
          order_index: i,
        });
      }
      showToast('Test created successfully!', 'success');
      router.push(`/admin/classes/${classId}`);
    } catch {
      showToast('Error saving questions.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/admin/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {[{ n: 1, label: 'Test Details' }, { n: 2, label: 'Add Questions' }].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= n ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{n}</div>
            <span className={`text-sm font-medium ${step >= n ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{label}</span>
            {n < 2 && <div className={`w-8 h-px ${step > n ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1 — Test Details */}
      {step === 1 && (
        <Card>
          <h2 className="font-semibold text-[var(--text-primary)] mb-5">Test Details</h2>
          <form onSubmit={handleCreateTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Title <span className="text-red-400">*</span></label>
              <input value={testForm.title} onChange={updateTest('title')} placeholder="e.g. HTML & CSS Quiz"
                className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Instructions</label>
              <textarea value={testForm.description} onChange={updateTest('description')} rows={3} placeholder="Instructions for students..."
                className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Duration (minutes) <span className="text-[var(--text-muted)] font-normal">— leave blank for no limit</span></label>
              <input type="number" min="1" value={testForm.duration_mins} onChange={updateTest('duration_mins')} placeholder="e.g. 30"
                className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={testForm.is_published} onChange={(e) => setTestForm((f) => ({ ...f, is_published: e.target.checked }))} className="accent-[var(--primary)] w-4 h-4" />
              <span className="text-sm text-[var(--text-secondary)]">Publish immediately after creation</span>
            </label>
            <Button type="submit" loading={saving}>Continue to Questions →</Button>
          </form>
        </Card>
      )}

      {/* Step 2 — Questions */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[var(--text-primary)]">Questions ({questions.length})</h2>
            <Button size="sm" variant="secondary" onClick={addEmptyQuestion}><Plus size={14} /> Add Question</Button>
          </div>

          {questions.length === 0 && (
            <Card className="text-center py-10">
              <p className="text-sm text-[var(--text-muted)] mb-3">No questions yet. Add your first one.</p>
              <Button size="sm" onClick={addEmptyQuestion}><Plus size={14} /> Add Question</Button>
            </Card>
          )}

          {questions.map((q, idx) => (
            <Card key={q.id}>
              <div className="flex items-start gap-3">
                <GripVertical size={18} className="text-[var(--text-muted)] mt-2 shrink-0 cursor-grab" />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[var(--text-muted)]">Q{idx + 1}</span>
                    <select
                      value={q.question_type}
                      onChange={(e) => updateQuestion(q.id, 'question_type', e.target.value)}
                      className="text-xs px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[6px] text-[var(--text-secondary)] focus:outline-none"
                    >
                      <option value="mcq">MCQ</option>
                      <option value="short_answer">Short Answer</option>
                    </select>
                    <input
                      type="number" min="1" value={q.marks}
                      onChange={(e) => updateQuestion(q.id, 'marks', Number(e.target.value))}
                      className="w-16 text-xs px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[6px] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">marks</span>
                    <Badge variant={q.question_type === 'mcq' ? 'info' : 'purple'} size="sm">{q.question_type === 'mcq' ? 'MCQ' : 'Short Ans'}</Badge>
                  </div>

                  <input
                    value={q.question_text}
                    onChange={(e) => updateQuestion(q.id, 'question_text', e.target.value)}
                    placeholder="Enter question text..."
                    className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                  />

                  {q.question_type === 'mcq' && (
                    <div className="space-y-2">
                      <p className="text-xs text-[var(--text-muted)]">Options — click radio to mark correct answer</p>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${q.id}`} checked={q.correct_answer === opt && opt !== ''} onChange={() => updateQuestion(q.id, 'correct_answer', opt)} className="accent-[var(--primary)]" />
                          <input
                            value={opt}
                            onChange={(e) => updateOption(q.id, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === 'short_answer' && (
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Model answer (only visible to admin)</label>
                      <input
                        value={q.correct_answer}
                        onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)}
                        placeholder="Reference answer..."
                        className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>
                  )}
                </div>
                <button onClick={() => removeQuestion(q.id)} className="text-[var(--text-muted)] hover:text-red-400 transition-colors mt-2">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}

          <div className="flex gap-3">
            <Button onClick={handleFinish} loading={saving}>Save Test</Button>
            <Button variant="secondary" onClick={addEmptyQuestion}><Plus size={15} /> Add Another Question</Button>
          </div>
        </div>
      )}
    </div>
  );
}
