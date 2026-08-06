import { useRef, useState } from 'react';
import { BookOpen, Eye, FileText, FolderUp, Trash2, Upload, Users } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { FormField } from '@/components/ui/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { MaterialViewer } from '@/components/portal/MaterialViewer';
import { MaterialViewsModal } from '@/components/materials/MaterialViewsModal';
import {
  MATERIAL_MAX_BYTES,
  deleteMaterial,
  getBatches,
  getMaterialsByBatch,
  getMaterialsForEveryone,
  getTutors,
  uploadMaterials,
} from '@/lib/supabase';
import type { Batch, Material, Tutor } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { formatDateTime, formatFileSize } from '@/lib/utils/format';

/** Sentinel for the "not tied to a batch" option in the batch picker. */
const ALL_STUDENTS = '__all__';

export default function MaterialsPage() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [audience, setAudience] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<Material | null>(null);
  const [viewsFor, setViewsFor] = useState<Material | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    const [batchRows, tutorRows] = await Promise.all([getBatches(), getTutors()]);
    setBatches(batchRows);
    setTutors(tutorRows);
  });

  const selectedBatch = batches.find((batch) => batch.id === audience);
  const isEveryone = audience === ALL_STUDENTS;

  const loadMaterials = (next: string) => {
    setAudience(next);
    const fetch = next === ALL_STUDENTS ? getMaterialsForEveryone() : getMaterialsByBatch(next);
    fetch.then(setMaterials).catch((err) => {
      // Clear first: the previous batch's material must not sit under the new label.
      setMaterials([]);
      showToast(errorMessage(err, 'Could not load material'), 'error');
    });
  };

  const refresh = () => { if (audience) loadMaterials(audience); };

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
      refresh();
      showToast('Material deleted');
    } catch (error) {
      showToast(errorMessage(error, 'Could not delete material'), 'error');
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Study Material" />

      <Card className="step-card">
        <CardHeader title="Select Batch" />
        <BatchSelect
          batches={batches}
          value={audience}
          onChange={loadMaterials}
          placeholder="Select a Batch"
          extraOptions={[{ id: ALL_STUDENTS, name: 'All students' }]}
        />
      </Card>

      {audience && (
        <Card className="material-card">
          <CardHeader
            title={isEveryone ? 'Material for all students' : 'Study material'}
            action={
              <Button size="sm" className="action-button-compact" onClick={() => setShowUpload(true)}>
                <Upload size={14} /> Upload
              </Button>
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
      )}

      <UploadModal
        open={showUpload}
        batchId={isEveryone ? null : audience}
        batchCode={selectedBatch?.batch_code}
        tutors={tutors}
        uploadedBy={user?.id}
        onClose={() => setShowUpload(false)}
        onUploaded={(count) => {
          refresh();
          showToast(count === 1 ? 'Material uploaded' : `${count} files uploaded`);
        }}
      />

      {/* Admins preview through the same reader students get. */}
      <MaterialViewer material={preview} onClose={() => setPreview(null)} />
      <MaterialViewsModal material={viewsFor} onClose={() => setViewsFor(null)} />
    </div>
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
  /** null = for every student. */
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

  /**
   * A folder keeps its own filenames — renaming twelve handouts would throw away
   * the only thing that said which was which. Individual files are named from the
   * batch code plus the typed suffix, numbered if there is more than one.
   */
  const titleFor = (file: File, index: number) => {
    if (folder) return file.name.replace(/\.pdf$/i, '');

    const trimmed = suffix.trim();
    if (!batchCode) return trimmed || file.name.replace(/\.pdf$/i, '');
    if (files.length === 1) return `${batchCode}${trimmed}`;
    return `${batchCode}${trimmed}-${String(index + 1).padStart(2, '0')}`;
  };

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const chosen = [...(event.target.files ?? [])];

    /*
     * A folder pick sets `webkitRelativePath` to "Folder/Sub/file.pdf" on every
     * entry; the first segment is the folder the admin chose, stored per row so
     * listings can group them.
     */
    const relative = (chosen[0] as File & { webkitRelativePath?: string })?.webkitRelativePath;
    setFolder(relative ? relative.split('/')[0] : null);

    // A folder pick brings everything in it, so non-PDFs are filtered rather than errors.
    const pdfs = chosen.filter((file) => file.type === 'application/pdf');
    const skipped = chosen.length - pdfs.length;
    const tooBig = pdfs.filter((file) => file.size > MATERIAL_MAX_BYTES);

    if (tooBig.length > 0) {
      setError(
        `${tooBig[0].name} is ${formatFileSize(tooBig[0].size)}. The limit is 50 MB per file — ` +
        'split it, or upload the parts as a folder.',
      );
      setFiles([]);
      return;
    }
    if (pdfs.length === 0) {
      setError(chosen.length > 0 ? 'No PDFs in that selection.' : '');
      setFiles([]);
      return;
    }
    if (skipped > 0) {
      setError(`${skipped} non-PDF ${skipped === 1 ? 'file was' : 'files were'} skipped.`);
    }

    setFiles(pdfs);
    if (!batchCode && pdfs.length === 1 && !suffix.trim()) {
      setSuffix(pdfs[0].name.replace(/\.pdf$/i, ''));
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
      title="Upload study material"
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
            {files.length === 1 ? files[0].name : files.length > 1 ? `${files.length} PDFs` : 'Choose PDFs'}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={pick}
              className="hidden"
              disabled={busy}
            />
          </label>

          <label className="import-dropzone">
            <FolderUp size={16} />
            {folder ? `Folder: ${folder}` : 'Choose a folder'}
            {/* Non-standard but supported everywhere this app runs; the PDFs
                inside are uploaded as one material each. */}
            <input
              ref={folderRef}
              type="file"
              accept="application/pdf"
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
                placeholder="01"
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
