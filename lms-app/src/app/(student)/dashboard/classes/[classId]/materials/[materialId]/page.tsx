'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { getMaterialById } from '@/lib/mock/materials';
import { formatDate, formatFileSize } from '@/lib/utils/format';
import type { StudyMaterial } from '@/lib/types';

export default function MaterialDetailPage({ params }: { params: Promise<{ classId: string; materialId: string }> }) {
  const { classId, materialId } = use(params);
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMaterialById(materialId).then((m) => { setMaterial(m); setLoading(false); });
  }, [materialId]);

  if (loading) return <PageLoader />;
  if (!material) return <div className="text-[var(--text-muted)] py-12 text-center">Material not found.</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/dashboard/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={15} /> Back to Class
      </Link>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <Badge>{material.type}</Badge>
          <span className="text-xs text-[var(--text-muted)]">Posted {formatDate(material.created_at)}</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{material.title}</h1>
        {material.description && <p className="text-sm text-[var(--text-muted)] mt-2">{material.description}</p>}
      </div>

      {/* Document */}
      {material.type === 'document' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[20px] p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[12px] bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-2xl">📄</div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--text-primary)]">{material.file_name}</p>
              {material.file_size && <p className="text-xs text-[var(--text-muted)]">{formatFileSize(material.file_size)}</p>}
            </div>
            <Button size="sm" variant="secondary">
              <Download size={15} /> Download
            </Button>
          </div>
          {/* PDF preview placeholder */}
          <div className="mt-4 h-64 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center">
            <p className="text-sm text-[var(--text-muted)]">PDF preview available after Supabase storage is connected.</p>
          </div>
        </div>
      )}

      {/* Link */}
      {material.type === 'link' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[20px] p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-[12px] bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-2xl">🔗</div>
          <div className="flex-1">
            <p className="text-sm text-[var(--text-muted)] break-all">{material.content}</p>
          </div>
          <a href={material.content} target="_blank" rel="noopener noreferrer">
            <Button size="sm">
              <ExternalLink size={15} /> Open Link
            </Button>
          </a>
        </div>
      )}

      {/* Text / rich text */}
      {material.type === 'text' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[20px] p-6">
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--text-secondary)] leading-relaxed">
              {material.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
