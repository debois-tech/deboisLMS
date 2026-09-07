import { useRef, useState } from 'react';
import { AlertTriangle, Trash2, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { DateTimePicker } from '@/components/ui/DatePicker';
import { MATERIAL_MAX_BYTES, createAssignment, updateAssignment, uploadMaterials } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { useNow } from '@/lib/hooks/useNow';
import { isPastDue } from '@/lib/utils/deadline';
import { toDateValue } from '@/lib/utils/date';
import type { Assignment } from '@/lib/types';
import {
  ACCEPTED_FILE_ACCEPT,
  ACCEPTED_TYPES,
  extensionOf,
  fileMimeType,
  filesFromDataTransfer,
  fileTypeLabel,
} from '@/lib/utils/files';
import { formatFileSize } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

interface NewAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  // Present to edit an existing assignment; absent to create a new one.
  assignment?: Assignment | null;
  // Refetch the list. Called after the row is saved.
  onSaved: () => void | Promise<void>;
}

const formFrom = (assignment?: Assignment | null) => ({
  title: assignment?.title ?? '',
  description: assignment?.description ?? '',
  due_at: assignment?.due_at ?? null,
  noDeadline: Boolean(assignment) && !assignment?.due_at,
});

// Shared by the Assignments page and a batch's Assignments tab, for both create and edit.
export function NewAssignmentModal({ open, onClose, batchId, assignment, onSaved }: NewAssignmentModalProps) {
  const [form, setForm] = useState(() => formFrom(assignment));
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const now = useNow();
  const { showToast } = useToast();

  const deadlineDecided = form.noDeadline || Boolean(form.due_at);

  const close = () => {
    setForm(formFrom(assignment));
    setFiles([]);
    setUploading({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  // Held in state, not uploaded yet: a file needs an assignment to hang off, and
  // that row does not exist until Create is pressed.
  const addFiles = (chosen: File[]) => {
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

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(event.target.files ?? [])];
    if (fileRef.current) fileRef.current.value = '';
    addFiles(chosen);
  };

  const [dragOver, setDragOver] = useState(false);

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (saving) return;
    const dropped = await filesFromDataTransfer(event.dataTransfer);
    addFiles(dropped.map((d) => d.file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        due_at: form.noDeadline ? null : form.due_at,
      };

      if (assignment) {
        await updateAssignment(assignment.id, payload);
        await onSaved();
        close();
        showToast('Assignment updated');
        return;
      }

      const created = await createAssignment({ batch_id: batchId, ...payload, assigned_date: toDateValue(new Date()) });

      // The assignment is saved by now; a failed upload is reported, not rolled back.
      if (files.length > 0) {
        setUploading({ done: 0, total: files.length });
        const result = await uploadMaterials(
          files,
          {
            batchId,
            assignmentId: created.id,
            uploadedBy: user?.id,
            title: (file) => file.name.replace(/\.[a-z0-9]+$/i, ''),
          },
          (done, total) => setUploading({ done, total }),
        );

        if (result.failed.length > 0) {
          await onSaved();
          close();
          showToast(
            `Assignment created, but ${result.failed.length} file(s) failed: ${result.failed[0].reason}`,
            'error',
          );
          return;
        }
      }

      await onSaved();
      close();
      showToast(files.length > 0 ? 'Assignment created with files' : 'Assignment created');
    } catch (error) {
      showToast(errorMessage(error, assignment ? 'Failed to update assignment' : 'Failed to create assignment'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : close}
      title={assignment ? 'Edit Assignment' : 'New Assignment'}
      footer={
        <>
          <Button className='cancel-button-compact' variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button
            className="action-button-compact"
            onClick={handleSave}
            loading={saving}
            disabled={!form.title.trim() || !deadlineDecided}
          >
            {saving && uploading.total > 0
              ? `Uploading ${uploading.done}/${uploading.total}`
              : assignment ? 'Save Changes' : 'Create Assignment'}
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

        {!assignment && (
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

            <div
              className={`drop-zone ${dragOver ? 'is-active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={18} />
              <p>Drag and drop files here</p>
            </div>

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
        )}

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
            <span>Due date/time already passed — submissions will be marked late.</span>
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
