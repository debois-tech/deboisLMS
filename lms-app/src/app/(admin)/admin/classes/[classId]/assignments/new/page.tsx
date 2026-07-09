'use client';

import { useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { createAssignment } from '@/lib/mock/assignments';

export default function CreateAssignmentPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ title: '', description: '', due_date: '', max_marks: '100', allow_file: true });
  const [loading, setLoading] = useState(false);

  const update = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast('Title is required.', 'error'); return; }
    setLoading(true);
    try {
      await createAssignment({
        class_id: classId,
        title: form.title,
        description: form.description,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
        max_marks: Number(form.max_marks) || 100,
        allow_file: form.allow_file,
        created_by: 'user-admin-001',
      });
      showToast('Assignment created!', 'success');
      router.push(`/admin/classes/${classId}`);
    } catch {
      showToast('Failed to create assignment.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/admin/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create Assignment</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Title <span className="text-red-400">*</span></label>
            <input value={form.title} onChange={update('title')} placeholder="Assignment title"
              className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Instructions</label>
            <textarea value={form.description} onChange={update('description')} rows={5} placeholder="Describe what students need to do..."
              className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Due Date</label>
              <input type="datetime-local" value={form.due_date} onChange={update('due_date')}
                className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Max Marks</label>
              <input type="number" min="1" value={form.max_marks} onChange={update('max_marks')}
                className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.allow_file} onChange={(e) => setForm((f) => ({ ...f, allow_file: e.target.checked }))} className="accent-[var(--primary)] w-4 h-4" />
            <span className="text-sm text-[var(--text-secondary)]">Allow file attachment in submission</span>
          </label>
          <div className="flex gap-3">
            <Button type="submit" loading={loading}>Create Assignment</Button>
            <Link href={`/admin/classes/${classId}`}><Button variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
