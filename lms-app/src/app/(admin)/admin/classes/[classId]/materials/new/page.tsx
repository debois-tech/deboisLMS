'use client';

import { useState, useRef } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { createMaterial } from '@/lib/mock/materials';
import type { MaterialType } from '@/lib/types';

export default function AddMaterialPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [type, setType] = useState<MaterialType>('link');
  const [form, setForm] = useState({ title: '', description: '', content: '' });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast('Title is required.', 'error'); return; }
    setLoading(true);
    try {
      await createMaterial({
        class_id: classId,
        title: form.title,
        description: form.description,
        type,
        content: type === 'document' ? `/uploads/${file?.name}` : form.content,
        file_name: file?.name,
        file_size: file?.size,
        created_by: 'user-admin-001',
      });
      showToast('Material added!', 'success');
      router.push(`/admin/classes/${classId}`);
    } catch {
      showToast('Failed to add material.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/admin/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Add Study Material</h1>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Material Type</label>
            <div className="flex gap-2">
              {(['link', 'document', 'text'] as MaterialType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 px-3 rounded-[10px] text-sm font-medium transition-all capitalize ${
                    type === t ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                  }`}
                >
                  {t === 'link' ? '🔗 Link' : t === 'document' ? '📄 Document' : '📝 Text'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Title <span className="text-red-400">*</span></label>
            <input value={form.title} onChange={update('title')} placeholder="Material title"
              className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
            <input value={form.description} onChange={update('description')} placeholder="Optional description"
              className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
          </div>

          {/* Type-specific content */}
          {type === 'link' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">URL <span className="text-red-400">*</span></label>
              <input value={form.content} onChange={update('content')} placeholder="https://..."
                className="w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors" />
            </div>
          )}

          {type === 'document' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Upload File <span className="text-[var(--text-muted)] font-normal">(max 50MB)</span></label>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)]/50 rounded-[12px] flex flex-col items-center gap-2 transition-colors group">
                <Upload size={22} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                <span className="text-sm text-[var(--text-muted)]">{file ? file.name : 'Click to upload file'}</span>
              </button>
            </div>
          )}

          {type === 'text' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Content</label>
              <textarea value={form.content} onChange={update('content')} rows={8} placeholder="Write your content in plain text or Markdown..."
                className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-none" />
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" loading={loading}>Add Material</Button>
            <Link href={`/admin/classes/${classId}`}><Button variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
