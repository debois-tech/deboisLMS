'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/lib/context/ToastContext';
import { getClassById, updateClass } from '@/lib/mock/classes';
import type { Class } from '@/lib/types';

export default function EditClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [cls, setCls] = useState<Class | null>(null);
  const [form, setForm] = useState({ name: '', description: '', subject: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getClassById(classId).then((c) => {
      if (c) { setCls(c); setForm({ name: c.name, description: c.description ?? '', subject: c.subject ?? '' }); }
      setLoading(false);
    });
  }, [classId]);

  const update = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [f]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Class name is required.', 'error'); return; }
    setSaving(true);
    try {
      await updateClass(classId, form);
      showToast('Class updated!', 'success');
      router.push(`/admin/classes/${classId}`);
    } catch {
      showToast('Failed to update.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!cls) return <div className="text-center py-12 text-[var(--text-muted)]">Class not found.</div>;

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/admin/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Edit Class</h1>

      <Card>
        <form onSubmit={handleSave} className="space-y-5">
          {[
            { f: 'name',        label: 'Class Name *', placeholder: 'Class name' },
            { f: 'subject',     label: 'Subject',      placeholder: 'e.g. Web Development' },
          ].map(({ f, label, placeholder }) => (
            <div key={f}>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>
              <input value={form[f as keyof typeof form]} onChange={update(f)} placeholder={placeholder}
                className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
            <textarea value={form.description} onChange={update('description')} rows={4} placeholder="Class description..."
              className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-none" />
          </div>
          <div className="flex gap-3">
            <Button type="submit" loading={saving}>Save Changes</Button>
            <Link href={`/admin/classes/${classId}`}><Button variant="ghost" type="button">Cancel</Button></Link>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Current Join Code</h2>
        <CodeBlock code={cls.join_code} />
        <p className="text-xs text-[var(--text-muted)] mt-2">To regenerate the code, go back to the class overview page.</p>
      </Card>
    </div>
  );
}
