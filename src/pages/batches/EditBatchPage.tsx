import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotFound } from '@/components/ui/NotFound';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { FormField } from '@/components/ui/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { getBatchById, updateBatch } from '@/lib/supabase';
import type { Batch } from '@/lib/types';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

export default function EditBatchPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Batch | null>(null);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!batchId) return;
    const batch = await getBatchById(batchId);
    if (batch) setForm(batch);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await updateBatch(form.id, form);
      showToast('Batch updated');
      navigate(`/batches/${form.id}`);
    } catch (error) {
      showToast(errorMessage(error, 'Failed to update batch'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!form) return <NotFound label="Batch" />;

  return (
    <div className="page-section narrow">
          <PageHeader title="Edit Batch" />

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Batch Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              value={form.track ?? ''}
              onChange={(track) => setForm({ ...form, track })}
              placeholder="Select track"
              searchPlaceholder="Search tracks"
              emptyText="No tracks found"
            />
          </FormField>
          <FormField label="Batch Code">
            <input
              value={form.batch_code ?? ''}
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
              value={form.start_date ?? ''}
              onChange={(start_date) => setForm({ ...form, start_date })}
              placeholder="Pick a start date"
              ariaLabel="Start date"
            />
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button className='action-button-compact' type="submit" loading={saving}>Save Changes</Button>
            <Button variant="ghost" onClick={() => navigate(`/batches/${form.id}`)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
