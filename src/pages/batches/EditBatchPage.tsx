import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGoBack } from '@/components/ui/BackLink';
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
import { BatchRoleField, roleReady, saveRole, type RoleDraft } from '@/components/batches/BatchRoleField';
import { getBatchById, getBatchPrograms, getInternshipRoles, updateBatch } from '@/lib/supabase';
import type { Batch, BatchProgram, BatchProgramOption } from '@/lib/types';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

export default function EditBatchPage() {
  const { batchId } = useParams();
  const goBack = useGoBack(`/batches/${batchId}`);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Batch | null>(null);
  const [programs, setPrograms] = useState<BatchProgramOption[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleDraft, setRoleDraft] = useState<RoleDraft>({ pick: '', name: '' });
  const [savedEnd, setSavedEnd] = useState<string | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!batchId) return;
    const [batch, programRows, roleRows] = await Promise.all([getBatchById(batchId), getBatchPrograms(), getInternshipRoles()]);
    if (batch) {
      setForm(batch);
      setSavedEnd(batch.ended_at?.slice(0, 10) ?? null);
      setRoleDraft({ pick: batch.internship_role ?? '', name: '' });
    }
    setPrograms(programRows);
    setRoles(roleRows);
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
    if (!roleReady(roleDraft)) {
      showToast('Pick an internship role', 'error');
      return;
    }
    const endChanged = Boolean(form.ended_at) && form.ended_at?.slice(0, 10) !== savedEnd;
    if (endChanged && form.start_date && form.ended_at!.slice(0, 10) < form.start_date.slice(0, 10)) {
      showToast('A batch cannot end before it starts', 'error');
      return;
    }
    if (endChanged) {
      const accepted = await confirm({
        title: 'Change the end date?',
        message: (
          <>
            <span className="block">{savedEnd ? formatDate(savedEnd) : 'None'} → {formatDate(form.ended_at!)}</span>
            <span className="block">Certificates use the new date</span>
            <span className="block">Student logins delete 30 days after it</span>
          </>
        ),
        confirmLabel: 'Change date',
        danger: true,
        requireText: 'DATE',
      });
      if (!accepted) return;
    }
    setSaving(true);
    try {
      await updateBatch(form.id, { ...form, internship_role: await saveRole(roleDraft, roles) });
      showToast('Batch updated');
      goBack();
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
          <BatchRoleField roles={roles} draft={roleDraft} onChange={setRoleDraft} />
          <FormField label="Base Fee" required>
            <input
              type="number"
              min="0"
              value={form.base_fee ?? ''}
              onChange={(e) => setForm({ ...form, base_fee: e.target.value === '' ? null : Number(e.target.value) })}
              required
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
          {savedEnd && (
            <FormField label="End Date">
              <DatePicker
                value={form.ended_at?.slice(0, 10) ?? ''}
                onChange={(ended_at) => setForm({ ...form, ended_at })}
                min={form.start_date?.slice(0, 10)}
                placeholder="Pick an end date"
                ariaLabel="End date"
              />
            </FormField>
          )}
          <div className="flex gap-3 pt-2">
            <Button className='action-button-compact' type="submit" loading={saving}>Save Changes</Button>
            <Button variant="ghost" onClick={goBack}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
