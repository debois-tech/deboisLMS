'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { createClass } from '@/lib/mock/classes';

export default function NewClassPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', description: '', subject: '' });
  const [loading, setLoading] = useState(false);

  const update = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Class name is required.', 'error'); return; }
    setLoading(true);
    try {
      const cls = await createClass(form);
      showToast(`Class "${cls.name}" created! Code: ${cls.join_code}`, 'success');
      router.push(`/admin/classes/${cls.id}`);
    } catch {
      showToast('Failed to create class.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <Link href="/admin/classes" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> All Classes
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create New Class</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">A unique join code will be generated automatically.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Class Name <span className="text-red-400">*</span></label>
            <input
              value={form.name}
              onChange={update('name')}
              placeholder="e.g. Introduction to Web Development"
              className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Subject</label>
            <input
              value={form.subject}
              onChange={update('subject')}
              placeholder="e.g. Web Development, Data Science"
              className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={update('description')}
              rows={4}
              placeholder="Briefly describe what students will learn..."
              className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={loading}>Create Class</Button>
            <Link href="/admin/classes"><Button variant="ghost" type="button">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
