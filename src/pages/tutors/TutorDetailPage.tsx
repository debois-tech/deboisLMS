import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Layers, CalendarDays, GraduationCap, Plus, X } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { TutorLoginCard } from '@/components/tutors/TutorLoginCard';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getTutorById, getTutorBatches, getBatches, assignTutorToBatch, removeTutorFromBatch } from '@/lib/supabase';
import type { Tutor, TutorBatchMapping, Batch } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';

export default function TutorDetailPage() {
  const { tutorId } = useParams();
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [batchMappings, setBatchMappings] = useState<(TutorBatchMapping & { batch?: Batch })[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignBatchId, setAssignBatchId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!tutorId) return;
    const [t, mappings, batches] = await Promise.all([getTutorById(tutorId), getTutorBatches(tutorId), getBatches()]);
    setTutor(t ?? null);
    setBatchMappings(mappings);
    setAllBatches(batches);
  });

  const reloadBatches = async () => {
    if (!tutorId) return;
    setBatchMappings(await getTutorBatches(tutorId));
  };

  const handleAssign = async () => {
    if (!tutorId || !assignBatchId) return;
    setAssigning(true);
    try {
      await assignTutorToBatch(tutorId, assignBatchId);
      setShowAssign(false);
      setAssignBatchId(null);
      await reloadBatches();
      showToast('Batch assigned');
    } catch (err) {
      showToast(errorMessage(err, 'Could not assign the batch'), 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (mapping: TutorBatchMapping & { batch?: Batch }) => {
    const ok = await confirm({
      title: `Remove ${mapping.batch?.name ?? 'this batch'}?`,
      message: 'The tutor loses access to this batch.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;

    try {
      await removeTutorFromBatch(mapping.id);
      await reloadBatches();
      showToast('Batch removed');
    } catch (err) {
      showToast(errorMessage(err, 'Could not remove the batch'), 'error');
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!tutor) return <NotFound label="Tutor" />;

  const assignableBatches = allBatches.filter(
    (batch) => !batchMappings.some((m) => m.batch_id === batch.id),
  );

  return (
    <div className="page-section">
      <Link to="/tutors" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 w-fit">
        <ArrowLeft size={14} /> Back to Tutors
      </Link>

      <Card padding="lg">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary)]/10 text-xl font-bold text-[var(--primary)]">
            {tutor.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] break-words">{tutor.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
              {tutor.email && <span className="flex min-w-0 items-center gap-2"><Mail size={15} className="shrink-0 text-[var(--primary)]" /> <span className="break-all">{tutor.email}</span></span>}
              {tutor.email && tutor.phone && <span className="text-[var(--border-strong)]">|</span>}
              {tutor.phone && <span className="flex items-center gap-1"><Phone size={14} className="shrink-0" /> {tutor.phone}</span>}
            </div>
          </div>
        </div>
      </Card>

      <Card className="portal-login-card">
        <CardHeader title="Portal Login" className="portal-login-header" />
        <TutorLoginCard
          tutorId={tutor.id}
          email={tutor.email}
          phone={tutor.phone}
          hasLogin={Boolean(tutor.auth_user_id)}
          passwordRotated={tutor.password_rotated}
          onCreated={() => getTutorById(tutor.id).then((t) => setTutor(t ?? tutor))}
        />
      </Card>

      <Card>
        <CardHeader
          title="Assigned Batches"
          action={
            <Button size="sm" className="action-button-compact" onClick={() => setShowAssign(true)} disabled={assignableBatches.length === 0}>
              <Plus size={14} /> Assign Batch
            </Button>
          }
        />
        {batchMappings.length === 0 ? (
          <EmptyState icon={<GraduationCap size={32} />} title="Not assigned to any batches" />
        ) : (
          <div className="batch-list">
            {batchMappings.map((m) => (
              <div key={m.id} className="batch-list-item flex items-center justify-between gap-4">
                <Link to={`/batches/${m.batch_id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <Layers size={18} className="shrink-0 text-[var(--primary)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)]">{m.batch?.name ?? m.batch_id}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]"><CalendarDays size={12} /> Assigned {formatDate(m.assigned_at)}</p>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge size="lg" variant="success" dot>assigned</Badge>
                  <button
                    type="button"
                    onClick={() => handleRemove(m)}
                    aria-label={`Remove ${m.batch?.name ?? 'batch'}`}
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--danger-text)]"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        title="Assign Batch"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button className="action-button-compact" onClick={handleAssign} disabled={!assignBatchId} loading={assigning}>
              Assign
            </Button>
          </>
        }
      >
        <FormField label="Batch">
          <BatchSelect batches={assignableBatches} value={assignBatchId} onChange={setAssignBatchId} />
        </FormField>
      </Modal>
    </div>
  );
}
