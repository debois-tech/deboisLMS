import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { getBatchById, updateBatch } from '@/lib/supabase';
import type { Batch } from '@/lib/types';

export default function EditBatchPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Batch | null>(null);

  useEffect(() => {
    if (!batchId) return;
    getBatchById(batchId).then((batch) => {
      if (batch) setForm(batch);
      setLoading(false);
    });
  }, [batchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await updateBatch(form.id, form);
      navigate(`/batches/${form.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner centered />;
  if (!form) return <div className="page-section text-[var(--text-muted)]">Batch not found</div>;

  return (
    <div className="page-section narrow">
          <PageHeader title="Edit Batch" />

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Batch Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Track</label>
            <select
              value={form.track ?? ''}
              onChange={(e) => setForm({ ...form, track: e.target.value })}
            >
              <option value="">Select track</option>
              <option value="DevOps">DevOps</option>
              <option value="AI/ML">AI/ML</option>
            </select>
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Batch['status'] })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Start Date</label>
            <input
              type="date"
              value={form.start_date ?? ''}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving}>Save Changes</Button>
            <Button variant="ghost" onClick={() => navigate(`/batches/${form.id}`)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
