import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { DateTimePicker } from '@/components/ui/DatePicker';
import { createAssignment } from '@/lib/supabase';
import { useNow } from '@/lib/hooks/useNow';
import { isPastDue } from '@/lib/utils/deadline';
import { toDateValue } from '@/lib/utils/date';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

interface NewAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  /** Refetch the list. Called after the row is in. */
  onCreated: () => void | Promise<void>;
}

const emptyForm = { title: '', description: '', due_at: null as string | null, noDeadline: false };

/** Shared by the Assignments page and a batch's Assignments tab. */
export function NewAssignmentModal({ open, onClose, batchId, onCreated }: NewAssignmentModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const now = useNow();
  const { showToast } = useToast();

  const deadlineDecided = form.noDeadline || Boolean(form.due_at);

  const close = () => {
    setForm(emptyForm);
    onClose();
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createAssignment({
        batch_id: batchId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assigned_date: toDateValue(new Date()),
        due_at: form.noDeadline ? null : form.due_at,
      });
      await onCreated();
      close();
      showToast('Assignment created');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to create assignment'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : close}
      title="New Assignment"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button
            className="action-button-compact"
            onClick={handleCreate}
            loading={saving}
            disabled={!form.title.trim() || !deadlineDecided}
          >
            Create Assignment
          </Button>
        </>
      }
    >
      <div className="popup-form-spaced">
        <FormField label="Title" required>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </FormField>

        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </FormField>

        <FormField label="Deadline" required>
          <DateTimePicker
            value={form.due_at}
            onChange={(due_at) => setForm({ ...form, due_at, noDeadline: false })}
            placeholder="Pick a date and time"
            min={toDateValue(new Date())}
            disabled={form.noDeadline}
            ariaLabel="Deadline"
          />
        </FormField>

        {/* The grid blocks past days, but a time earlier today gets through. */}
        {isPastDue(form.due_at, now) && (
          <p className="repo-notice is-warning">
            <AlertTriangle size={14} className="shrink-0" />
            <span>That time has already passed. Students won't be able to submit at all.</span>
          </p>
        )}

        <label className={`repo-confirm ${form.noDeadline ? 'is-checked' : ''}`}>
          <input
            type="checkbox"
            checked={form.noDeadline}
            onChange={(e) => setForm({ ...form, noDeadline: e.target.checked, due_at: null })}
          />
          No due date
        </label>
      </div>
    </Modal>
  );
}
