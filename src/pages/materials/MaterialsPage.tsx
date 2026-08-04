import { useEffect, useRef, useState } from 'react';
import { BookOpen, Eye, FileText, Trash2, Upload } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { MaterialViewer } from '@/components/portal/MaterialViewer';
import { MaterialViewsModal } from '@/components/materials/MaterialViewsModal';
import { deleteMaterial, getBatches, getMaterialsByBatch, uploadMaterial } from '@/lib/supabase';
import type { Batch, Material } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { formatDateTime, formatFileSize } from '@/lib/utils/format';

const MAX_BYTES = 50 * 1024 * 1024;

export default function MaterialsPage() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<Material | null>(null);
  const [viewsFor, setViewsFor] = useState<Material | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    getBatches().then((data) => {
      setBatches(data);
      setLoading(false);
    });
  }, []);

  const loadMaterials = (batchId: string) => {
    setSelectedBatch(batchId);
    getMaterialsByBatch(batchId).then(setMaterials);
  };

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
      if (selectedBatch) loadMaterials(selectedBatch);
      showToast('Material deleted');
    } catch (error: any) {
      showToast(error?.message ?? 'Could not delete material', 'error');
    }
  };

  if (loading) return <Spinner centered />;

  return (
    <div className="page-section">
      <PageHeader title="Study Material" />

      <Card>
      <CardHeader title="Select batch" />
        <BatchSelect batches={batches} value={selectedBatch} onChange={loadMaterials} />
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader
            title="Study material"
            action={
              <Button size="sm" className="action-button-compact" onClick={() => setShowUpload(true)}>
                <Upload size={14} /> Upload PDF
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
                    <FileText size={16} />
                  </span>

                  <div className="material-admin-body">
                    <p className="material-admin-title">{material.title}</p>
                    <p className="material-admin-meta">
                      {formatDateTime(material.created_at)}
                      {material.size_bytes ? ` · ${formatFileSize(Number(material.size_bytes))}` : ''}
                    </p>
                  </div>

                  <div className="material-admin-actions">
                    <Button size="sm" variant="ghost" onClick={() => setViewsFor(material)}>
                      <Eye size={14} /> Opens
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setPreview(material)}>
                      Preview
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(material)} aria-label={`Delete ${material.title}`}>
                      <Trash2 size={14} />
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
        batchId={selectedBatch}
        uploadedBy={user?.id}
        onClose={() => setShowUpload(false)}
        onUploaded={() => {
          if (selectedBatch) loadMaterials(selectedBatch);
          showToast('Material uploaded');
        }}
      />

      {/* Admins preview through the same reader students get, stamped with the
          admin's own identity — a leaked preview is as traceable as a student's. */}
      <MaterialViewer material={preview} onClose={() => setPreview(null)} />
      <MaterialViewsModal material={viewsFor} onClose={() => setViewsFor(null)} />
    </div>
  );
}

function UploadModal({
  open,
  batchId,
  uploadedBy,
  onClose,
  onUploaded,
}: {
  open: boolean;
  batchId: string | null;
  uploadedBy?: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    setError('');
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    setError('');

    if (chosen && chosen.type !== 'application/pdf') {
      setError('Only PDF files can be uploaded.');
      setFile(null);
      return;
    }
    if (chosen && chosen.size > MAX_BYTES) {
      setError(`File size: ${formatFileSize(chosen.size)}. Limit: 50 MB.`);
      setFile(null);
      return;
    }

    setFile(chosen);
    // Default the title to the filename — most uploads want exactly that.
    if (chosen && !title.trim()) setTitle(chosen.name.replace(/\.pdf$/i, ''));
  };

  const submit = async () => {
    if (!batchId || !file || !title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await uploadMaterial({ batchId, title: title.trim(), description, file, uploadedBy });
      reset();
      onClose();
      onUploaded();
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed.');
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : close}
      title="Upload study material"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button
            className="action-button-compact"
            onClick={submit}
            loading={busy}
            disabled={!file || !title.trim()}
          >
            Upload
          </Button>
        </>
      }
    >
      <div className="popup-form-spaced">
        <label className="import-dropzone">
          <Upload size={16} />
          {file ? file.name : 'Choose a PDF'}
          <input ref={fileRef} type="file" accept="application/pdf" onChange={pick} className="hidden" disabled={busy} />
        </label>

        <FormField label="Title" required>
          <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy} required />
        </FormField>

        <FormField label="Description">
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} disabled={busy} />
        </FormField>

        {error && <InlineAlert>{error}</InlineAlert>}

        <p className="text-xs text-[var(--text-muted)]">
          Portal view only. Pages show the reader's name and phone number. Downloads are disabled.
        </p>
      </div>
    </Modal>
  );
}
