import { useRef, useState } from 'react';
import { AlertTriangle, Trash2, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { DateTimePicker } from '@/components/ui/DatePicker';
import { MATERIAL_MAX_BYTES, createAssignment, uploadMaterials } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { useNow } from '@/lib/hooks/useNow';
import { isPastDue } from '@/lib/utils/deadline';
import { toDateValue } from '@/lib/utils/date';
import {
  ACCEPTED_FILE_ACCEPT,
  ACCEPTED_TYPES,
  extensionOf,
  fileMimeType,
  fileTypeLabel,
} from '@/lib/utils/files';
import { formatFileSize } from '@/lib/utils/format';
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
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const now = useNow();
  const { showToast } = useToast();

  const deadlineDecided = form.noDeadline || Boolean(form.due_at);

  const close = () => {
    setForm(emptyForm);
    setFiles([]);
    setUploading({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  // Held in state, not uploaded yet: a file needs an assignment to hang off, and
  // that row does not exist until Create is pressed.
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(event.target.files ?? [])];
    if (fileRef.current) fileRef.current.value = '';

    const accepted = chosen.filter((file) => ACCEPTED_TYPES.has(extensionOf(file.name)));
    const tooBig = accepted.find((file) => file.size > MATERIAL_MAX_BYTES);
    if (tooBig) {
      showToast(`${tooBig.name} is ${formatFileSize(tooBig.size)}. The limit is 50 MB.`, 'error');
      return;
    }
    if (accepted.length < chosen.length) {
      showToast(`${chosen.length - accepted.length} unsupported file(s) skipped`, 'error');
    }

    // Re-picking the same file twice is a slip, not an intent to attach it twice.
    setFiles((current) => [
      ...current,
      ...accepted.filter((file) => !current.some((held) => held.name === file.name && held.size === file.size)),
    ]);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const assignment = await createAssignment({
        batch_id: batchId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assigned_date: toDateValue(new Date()),
        due_at: form.noDeadline ? null : form.due_at,
      });

      // The assignment is saved by now; a failed upload is reported, not rolled back.
      if (files.length > 0) {
        setUploading({ done: 0, total: files.length });
        const result = await uploadMaterials(
          files,
          {
            batchId,
            assignmentId: assignment.id,
            uploadedBy: user?.id,
            title: (file) => file.name.replace(/\.[a-z0-9]+$/i, ''),
          },
          (done, total) => setUploading({ done, total }),
        );

        if (result.failed.length > 0) {
          await onCreated();
          close();
          showToast(
            `Assignment created, but ${result.failed.length} file(s) failed: ${result.failed[0].reason}`,
            'error',
          );
          return;
        }
      }

      await onCreated();
      close();
      showToast(files.length > 0 ? 'Assignment created with files' : 'Assignment created');
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
            {saving && uploading.total > 0
              ? `Uploading ${uploading.done}/${uploading.total}`
              : 'Create Assignment'}
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

        <FormField label="Files">
          <label className="import-dropzone">
            <Upload size={16} />
            {files.length === 0 ? 'Attach files' : `Add more (${files.length} attached)`}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_FILE_ACCEPT}
              multiple
              onChange={pick}
              className="hidden"
              disabled={saving}
            />
          </label>

          {files.length > 0 && (
            <ul className="assignment-files-list">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`} className="assignment-files-row">
                  <span className="assignment-files-open is-static">
                    <span className="assignment-files-kind">{fileTypeLabel(fileMimeType(file), file.name)}</span>
                    <span className="assignment-files-name">{file.name}</span>
                    <span className="assignment-files-size">{formatFileSize(file.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((held) => held !== file))}
                    className="assignment-files-remove"
                    aria-label={`Remove ${file.name}`}
                    disabled={saving}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
