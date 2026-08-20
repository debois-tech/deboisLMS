import { useCallback, useRef, useState } from 'react';
import { BookOpen, Eye, FileText, FolderUp, Trash2, Upload, Users } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { MaterialViewer } from '@/components/portal/MaterialViewer';
import { MaterialViewsModal } from '@/components/materials/MaterialViewsModal';
import {
  MATERIAL_MAX_BYTES,
  deleteMaterial,
  deleteBatchMaterials,
  getMaterialsByBatch,
  getMaterialsForEveryone,
  getTutors,
  uploadMaterials,
} from '@/lib/supabase';
import { ACCEPTED_FILE_ACCEPT, ACCEPTED_TYPES, extensionOf, fileTypeLabel } from '@/lib/utils/files';
import type { Material, Tutor } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';
import { useReloadableSection } from '@/lib/hooks/useInitialLoad';
import { formatDateTime, formatFileSize } from '@/lib/utils/format';

// One batch's study material: list, upload, preview, open-log.
export function BatchMaterials({
  batchId,
  batchCode,
  title = 'Study material',
}: {
  // null = not tied to a batch, i.e. for every student.
  batchId: string | null;
  batchCode?: string;
  title?: string;
}) {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<Material | null>(null);
  const [viewsFor, setViewsFor] = useState<Material | null>(null);
  const [purging, setPurging] = useState(false);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    // Cleared first: the previous batch's material must not sit under the new label.
    setMaterials([]);
    const [rows, tutorRows] = await Promise.all([
      batchId ? getMaterialsByBatch(batchId) : getMaterialsForEveryone(),
      getTutors(),
    ]);
    setMaterials(rows);
    setTutors(tutorRows);
  }, [batchId]);

  const { error, reload } = useReloadableSection(load);

  const handleDelete = async (material: Material) => {
    const ok = await confirm({
      title: `Delete “${material.title}”?`,
      message: 'Students lose access. This cannot be undone.',
      confirmLabel: 'Delete material',
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteMaterial(material);
      void reload();
      showToast('Material deleted');
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete material'), 'error');
    }
  };

  // Wipes every file for this batch, rows and objects together.
  const handlePurge = async () => {
    if (!batchId) return;
    const ok = await confirm({
      title: `Delete all ${materials.length} files?`,
      message: 'Removed from the database and the file storage. This cannot be undone.',
      confirmLabel: 'Delete all',
      danger: true,
    });
    if (!ok) return;

    setPurging(true);
    try {
      const removed = await deleteBatchMaterials(batchId, true);
      showToast(`${removed} ${removed === 1 ? 'file' : 'files'} deleted`);
      void reload();
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete the files'), 'error');
    }
    setPurging(false);
  };

  if (error) return <Card><ErrorState message={error} onRetry={reload} /></Card>;

  return (
    <>
      <Card className="material-card">
        <CardHeader
          title={title}
          action={
            <div className="flex flex-wrap justify-end gap-2">
              {batchId && materials.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="action-button-compact action-button-danger"
                  onClick={handlePurge}
                  loading={purging}
                >
                  <Trash2 size={14} /> Delete all
                </Button>
              )}
              <Button size="sm" className="action-button-compact" onClick={() => setShowUpload(true)}>
                <Upload size={14} /> Upload
              </Button>
            </div>
          }
        />

        {materials.length === 0 ? (
          <EmptyState icon={<BookOpen size={32} />} title="No material uploaded" />
        ) : (
          <div className="material-admin-list">
            {materials.map((material) => (
              <div key={material.id} className="material-admin-row">
                <span className="material-admin-icon">
                  {material.batch_id ? <FileText size={16} /> : <Users size={16} />}
                </span>

                <div className="material-admin-body">
                  <p className="material-admin-title">{material.title}</p>
                  <p className="material-admin-meta">
                    {fileTypeLabel(material.mime_type, material.storage_path)} ·{' '}
                    {material.folder ? `${material.folder} · ` : ''}
                    {formatDateTime(material.created_at)}
                    {material.tutor?.name ? ` · ${material.tutor.name}` : ''}
                    {material.size_bytes ? ` · ${formatFileSize(Number(material.size_bytes))}` : ''}
                  </p>
                </div>

                <div className="material-admin-actions">
                  <Button size="sm" variant="ghost" onClick={() => setViewsFor(material)}>
                    <Eye size={15} /> Opens
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPreview(material)}>
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="material-admin-delete"
                    onClick={() => handleDelete(material)}
                    aria-label={`Delete ${material.title}`}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <UploadModal
        open={showUpload}
        batchId={batchId}
        batchCode={batchCode}
        tutors={tutors}
        uploadedBy={user?.id}
        onClose={() => setShowUpload(false)}
        onUploaded={(count) => {
          void reload();
          showToast(count === 1 ? 'Material uploaded' : `${count} files uploaded`);
        }}
      />

      {/* Admins preview through the same reader students get. */}
      <MaterialViewer material={preview} onClose={() => setPreview(null)} />
      <MaterialViewsModal material={viewsFor} onClose={() => setViewsFor(null)} />
    </>
  );
}

function UploadModal({
  open,
  batchId,
  batchCode,
  tutors,
  uploadedBy,
  onClose,
  onUploaded,
}: {
  open: boolean;
  // null = for every student.
  batchId: string | null;
  batchCode?: string;
  tutors: Tutor[];
  uploadedBy?: string;
  onClose: () => void;
  onUploaded: (count: number) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [suffix, setSuffix] = useState('');
  const [description, setDescription] = useState('');
  const [tutorId, setTutorId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setFolder(null);
    setSuffix('');
    setDescription('');
    setTutorId('');
    setError('');
    setBusy(false);
    setProgress({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = '';
    if (folderRef.current) folderRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  // Folder uploads keep their filenames; single files are renamed from the batch code.
  const dropExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, '');

  const titleFor = (file: File, index: number) => {
    if (folder) return dropExtension(file.name);

    const trimmed = suffix.trim();
    if (!batchCode) return trimmed || dropExtension(file.name);
    if (files.length === 1) return `${batchCode}${trimmed}`;
    return `${batchCode}${trimmed}-${String(index + 1).padStart(2, '0')}`;
  };

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const chosen = [...(event.target.files ?? [])];

    // A folder pick reports "Folder/Sub/file.pdf"; the first segment is the chosen folder.
    const relative = (chosen[0] as File & { webkitRelativePath?: string })?.webkitRelativePath;
    setFolder(relative ? relative.split('/')[0] : null);

    // A folder pick brings everything in it, so unsupported types are filtered
    // rather than turned into an error the admin has to clear one file at a time.
    const accepted = chosen.filter((file) => ACCEPTED_TYPES.has(extensionOf(file.name)));
    const skipped = chosen.length - accepted.length;
    const tooBig = accepted.filter((file) => file.size > MATERIAL_MAX_BYTES);

    if (tooBig.length > 0) {
      setError(
        `${tooBig[0].name} is ${formatFileSize(tooBig[0].size)}. The limit is 50 MB per file — ` +
        'split it, or upload the parts as a folder.',
      );
      setFiles([]);
      return;
    }
    if (accepted.length === 0) {
      setError(chosen.length > 0 ? 'Nothing in that selection can be uploaded.' : '');
      setFiles([]);
      return;
    }
    if (skipped > 0) {
      setError(`${skipped} unsupported ${skipped === 1 ? 'file was' : 'files were'} skipped.`);
    }

    setFiles(accepted);
    if (!batchCode && accepted.length === 1 && !suffix.trim()) {
      setSuffix(dropExtension(accepted[0].name));
    }
  };

  const submit = async () => {
    if (files.length === 0) return;
    if (!folder && !suffix.trim()) {
      setError(batchCode ? 'Add the rest of the name.' : 'Add a title.');
      return;
    }

    setBusy(true);
    setError('');
    setProgress({ done: 0, total: files.length });

    try {
      const result = await uploadMaterials(
        files,
        { batchId, tutorId: tutorId || null, folder, description, uploadedBy, title: titleFor },
        (done, total) => setProgress({ done, total }),
      );

      if (result.failed.length > 0) {
        setError(
          `${result.failed.length} failed: ${result.failed.map((f) => `${f.name} (${f.reason})`).join(', ')}`,
        );
        setBusy(false);
        if (result.uploaded.length > 0) onUploaded(result.uploaded.length);
        return;
      }

      reset();
      onClose();
      onUploaded(result.uploaded.length);
    } catch (err) {
      setError(errorMessage(err, 'Upload failed.'));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : close}
      title="Upload files"
      size="lg"
      footer={
        <>
          <Button className="action-button-compact" variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button
            className="action-button-compact"
            onClick={submit}
            loading={busy}
            disabled={files.length === 0 || (!folder && !suffix.trim())}
          >
            {busy && progress.total > 1 ? `Uploading ${progress.done}/${progress.total}` : 'Upload'}
          </Button>
        </>
      }
    >
      <div className="popup-form-spaced">
        <div className="material-pick-row">
          <label className="import-dropzone">
            <Upload size={16} />
            {files.length === 1 ? files[0].name : files.length > 1 ? `${files.length} files` : 'Choose files'}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_FILE_ACCEPT}
              multiple
              onChange={pick}
              className="hidden"
              disabled={busy}
            />
          </label>

          <label className="import-dropzone">
            <FolderUp size={16} />
            {folder ? `Folder: ${folder}` : 'Choose a folder'}
            {/* Non-standard but supported everywhere this app runs; the files
                inside are uploaded as one material each. */}
            <input
              ref={folderRef}
              type="file"
              accept={ACCEPTED_FILE_ACCEPT}
              multiple
              // @ts-expect-error -- webkitdirectory is not in React's DOM typings
              webkitdirectory=""
              directory=""
              onChange={pick}
              className="hidden"
              disabled={busy}
            />
          </label>
        </div>

        {/* What happens to a file is decided by its type, and an admin choosing
            between a .docx and a PDF should know that before uploading. */}
        <p className="field-hint">
          PDFs and images are watermarked and open in the reader. Word files are converted
          to PDF — the text survives, the layout does not. Markdown and text are shown as
          written. Spreadsheets, slides and archives are downloaded as they are.
        </p>

        {folder ? (
          <FormField label="Name">
            <p className="material-folder-note">
              These {files.length} files keep their own names, grouped under :
              <strong> {folder}</strong>.
            </p>
          </FormField>
        ) : batchCode ? (
          <FormField label="Name" required>
            <div className="material-name-row">
              <span className="material-name-prefix" title="From the batch code">{batchCode}</span>
              <input
                value={suffix}
                onChange={(event) => setSuffix(event.target.value)}
                disabled={busy}
                required
              />
            </div>
            <p className="field-hint">
              Students see <strong>{`${batchCode}${suffix.trim() || '…'}`}</strong>
              {files.length > 1 ? ', numbered -01, -02 … for each file in the folder.' : '.'}
            </p>
          </FormField>
        ) : (
          <FormField label="Title" required>
            <input
              value={suffix}
              onChange={(event) => setSuffix(event.target.value)}
              disabled={busy}
              required
            />
          </FormField>
        )}

        <FormField label="Tutor">
          <SearchSelect
            options={[
              { value: '', label: 'No tutor' },
              ...tutors.map((tutor) => ({ value: tutor.id, label: tutor.name })),
            ]}
            value={tutorId || null}
            onChange={setTutorId}
            placeholder="No tutor"
            searchPlaceholder="Search tutors"
            emptyText="No tutors found"
            className={busy ? 'pointer-events-none opacity-60' : ''}
          />
        </FormField>

        <FormField label="Description">
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} disabled={busy} />
        </FormField>

        {error && <InlineAlert>{error}</InlineAlert>}
      </div>
    </Modal>
  );
}
