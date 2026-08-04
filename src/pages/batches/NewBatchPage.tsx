import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { createBatch } from '@/lib/supabase';
import { useToast } from '@/lib/context/ToastContext';

export default function NewBatchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    track: '',
    status: 'upcoming' as const,
    start_date: '',
  });
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const batch = await createBatch(form);
      showToast('Batch created');
      navigate(`/batches/${batch.id}`);
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to create batch', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section narrow">
      <PageHeader title="New Batch" />

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Batch Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. DevOps Batch 4"
              required
            />
          </FormField>
          <FormField label="Track">
            <select
              value={form.track}
              onChange={(e) => setForm({ ...form, track: e.target.value })}
            >
              <option value="">Select track</option>
              <option value="DevOps">DevOps</option>
              <option value="AI/ML">AI/ML</option>
              <option value="Full Stack">Full Stack</option>
              <option value="Cloud">Cloud</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </FormField>
          <FormField label="Start Date">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button className="action-button-compact" type="submit" loading={loading}>Create Batch</Button>
            <Button className="action-button-compact" variant="ghost" onClick={() => navigate('/batches')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
