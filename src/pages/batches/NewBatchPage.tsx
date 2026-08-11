import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { createBatch } from '@/lib/supabase';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

export default function NewBatchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    track: '',
    // Status is not picked by hand — it follows the start date.
    status: 'upcoming' as const,
    start_date: '',
    batch_code: '',
  });
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const batch = await createBatch(form);
      showToast('Batch created');
      navigate(`/batches/${batch.id}`);
    } catch (error) {
      showToast(errorMessage(error, 'Failed to create batch'), 'error');
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
            <SearchSelect
              options={[
                { value: '', label: 'Select track' },
                { value: 'DevOps', label: 'DevOps' },
                { value: 'AI/ML', label: 'AI/ML' },
                { value: 'Full Stack', label: 'Full Stack' },
                { value: 'Cloud', label: 'Cloud' },
              ]}
              value={form.track}
              onChange={(track) => setForm({ ...form, track })}
              placeholder="Select track"
              searchPlaceholder="Search tracks"
              emptyText="No tracks found"
            />
          </FormField>
          <FormField label="Batch Code">
            <input
              value={form.batch_code}
              onChange={(e) => setForm({ ...form, batch_code: e.target.value })}
              placeholder="e.g. DBT-TEPC-2026-D"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <p className="field-hint">
              Prefix for this batch's study material. Uploads add a suffix to it, e.g.
              DBT-TEPC-2026-D01.
            </p>
          </FormField>
          <FormField label="Start Date">
            <DatePicker
              value={form.start_date}
              onChange={(start_date) => setForm({ ...form, start_date })}
              placeholder="Pick a start date"
              ariaLabel="Start date"
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
