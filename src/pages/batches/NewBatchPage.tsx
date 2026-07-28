import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createBatch } from '@/lib/supabase';

export default function NewBatchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    track: '',
    status: 'upcoming' as const,
    start_date: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const batch = await createBatch(form);
      navigate(`/batches/${batch.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">New Batch</h1>
        <p className="text-sm text-[var(--text-muted)]">Create a new training batch</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Batch Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. DevOps Batch 4"
              required
            />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Track</label>
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
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
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
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>Create Batch</Button>
            <Button variant="ghost" onClick={() => navigate('/batches')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}