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
import { getBatchById, getBatchPrograms, updateBatch } from '@/lib/supabase';
import type { Batch, BatchProgram, BatchProgramOption } from '@/lib/types';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

export default function EditBatchPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Batch | null>(null);
  const [programs, setPrograms] = useState<BatchProgramOption[]>([]);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!batchId) return;
    const [batch, programRows] = await Promise.all([getBatchById(batchId), getBatchPrograms()]);
    if (batch) setForm(batch);
    setPrograms(programRows);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.program) {
      showToast('Select a programme for this batch', 'error');
      return;
    }
    if (form.base_fee == null || form.base_fee < 0) {
      showToast('Set a base fee for this batch', 'error');
      return;
    }
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
          <FormField label="Programme" required>
            <SearchSelect
              options={programs.map((option) => ({ value: option.code, label: `${option.name} (${option.code})` }))}
              value={form.program ?? ''}
              onChange={(program) => setForm({ ...form, program: program as BatchProgram })}
              placeholder="Select programme"
              searchPlaceholder="Search programmes"
              emptyText="No programmes found"
            />
          </FormField>
          <FormField label="Base Fee" required>
            <input
              type="number"
              min="0"
              value={form.base_fee ?? ''}
              onChange={(e) => setForm({ ...form, base_fee: e.target.value === '' ? null : Number(e.target.value) })}
              required
            />
          </FormField>

          <FormField label="Batch Code">
            <input
              value={form.batch_code ?? ''}
              onChange={(e) => setForm({ ...form, batch_code: e.target.value })}
              autoCapitalize="characters"
              spellCheck={false}
            />
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
