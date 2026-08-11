import { useCallback, useRef, useState } from 'react';
import { Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { MaterialViewer } from '@/components/portal/MaterialViewer';
import {
  MATERIAL_MAX_BYTES,
  deleteMaterial,
  getMaterialsByAssignment,
  uploadMaterials,
} from '@/lib/supabase';
import type { Material } from '@/lib/types';
import { ACCEPTED_FILE_ACCEPT, ACCEPTED_TYPES, extensionOf, fileTypeLabel } from '@/lib/utils/files';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';
import { useReloadableSection } from '@/lib/hooks/useInitialLoad';
import { formatFileSize } from '@/lib/utils/format';

interface AssignmentFilesProps {
  assignmentId: string;
  /** The assignment's batch — the file inherits it, so access follows enrolment. */
  batchId: string;
  /** Student view: open a file, but never upload or delete one. */
  readOnly?: boolean;
}

/**
 * The handouts attached to one assignment — the starter file, the commands to
 * run, the brief. Rows in `materials` with an `assignment_id`, so they open in
 * the same reader and obey the same enrolment rule as study material.
 */
export function AssignmentFiles({ assignmentId, batchId, readOnly }: AssignmentFilesProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<Material[]>([]);
  const [open, setOpen] = useState<Material | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setFiles(await getMaterialsByAssignment(assignmentId));
  }, [assignmentId]);

  const { error, reload } = useReloadableSection(load);

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(event.target.files ?? [])].filter((file) =>
      ACCEPTED_TYPES.has(extensionOf(file.name)),
    );
    if (inputRef.current) inputRef.current.value = '';
    if (chosen.length === 0) return;

    const tooBig = chosen.find((file) => file.size > MATERIAL_MAX_BYTES);
    if (tooBig) {
      showToast(`${tooBig.name} is ${formatFileSize(tooBig.size)}. The limit is 50 MB.`, 'error');
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: chosen.length });
    try {
      const result = await uploadMaterials(
        chosen,
        {
          batchId,
          assignmentId,
          uploadedBy: user?.id,
          // The filename is the title: an attachment is known by what it is called.
          title: (file) => file.name.replace(/\.[a-z0-9]+$/i, ''),
        },
        (done, total) => setProgress({ done, total }),
      );

      void reload();
      if (result.failed.length > 0) {
        showToast(`${result.failed[0].name}: ${result.failed[0].reason}`, 'error');
      } else {
        showToast(result.uploaded.length === 1 ? 'File attached' : `${result.uploaded.length} files attached`);
      }
    } catch (err) {
      showToast(errorMessage(err, 'Upload failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (file: Material) => {
    const ok = await confirm({
      title: `Remove “${file.title}”?`,
      message: 'Students lose access to this file. This cannot be undone.',
      confirmLabel: 'Remove file',
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteMaterial(file);
      void reload();
      showToast('File removed');
    } catch (err) {
      showToast(errorMessage(err, 'Could not remove the file'), 'error');
    }
  };

  // A student with nothing attached is shown nothing at all: an empty "Files"
  // heading is a question they cannot answer.
  if (readOnly && files.length === 0) return null;

  return (
    <div className="assignment-files">
      <div className="assignment-files-head">
        <p className="assignment-files-title">
          <Paperclip size={14} aria-hidden="true" />
          {readOnly ? 'Files for this assignment' : 'Attached files'}
        </p>
        {!readOnly && (
          <label className={`assignment-files-add ${busy ? 'is-busy' : ''}`}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy && progress.total > 1 ? `Uploading ${progress.done}/${progress.total}` : 'Attach files'}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILE_ACCEPT}
              multiple
              onChange={pick}
              className="hidden"
              disabled={busy}
            />
          </label>
        )}
      </div>

      {error ? (
        <p className="assignment-files-empty">{error}</p>
      ) : files.length === 0 ? (
        <p className="assignment-files-empty">
          Nothing attached yet. A brief, a starter file, the commands to run.
        </p>
      ) : (
        <ul className="assignment-files-list">
          {files.map((file) => (
            <li key={file.id} className="assignment-files-row">
              <button
                type="button"
                className="assignment-files-open"
                onClick={() => setOpen(file)}
                aria-label={`Open ${file.title}`}
              >
                <span className="assignment-files-kind">
                  {fileTypeLabel(file.mime_type, file.storage_path)}
                </span>
                <span className="assignment-files-name">{file.title}</span>
                {file.size_bytes && (
                  <span className="assignment-files-size">{formatFileSize(Number(file.size_bytes))}</span>
                )}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(file)}
                  className="assignment-files-remove"
                  aria-label={`Remove ${file.title}`}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <MaterialViewer material={open} onClose={() => setOpen(null)} />
    </div>
  );
}
