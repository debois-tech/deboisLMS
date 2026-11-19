import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, GraduationCap, Plus, X, Trash2 } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { TutorLoginCard } from '@/components/tutors/TutorLoginCard';
import { UnassignWizard } from '@/components/tutors/UnassignWizard';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getTutorById, getTutorBatches, getBatches, assignTutorToBatch, archiveTutor, deleteTutor } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';
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
  const [deleting, setDeleting] = useState(false);
  // Tick mode, as on a batch's students: tick assignments, then remove them through the wizard.
  const [removing, setRemoving] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [showUnassign, setShowUnassign] = useState(false);
  const navigate = useNavigate();
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

  const exitRemoving = () => {
    setRemoving(false);
    setPicked([]);
    setShowUnassign(false);
  };

  const togglePicked = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  // The login goes, the tutor is archived and leaves every batch; their work stays.
  const handleArchive = async () => {
    if (!tutor) return;
    const ok = await confirm({
      title: `Delete ${tutor.name}'s login?`,
      message: (
        <>
          <span className="block">Login deleted, cannot sign in</span>
          <span className="block">Removed from every batch</span>
          <span className="block">Their work and history stay</span>
          <span className="block">Moves to Archived</span>
        </>
      ),
      confirmLabel: 'Delete login',
      danger: true,
      requireCheck: 'Yes, delete this login',
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await archiveTutor(tutor.id);
      setTutor((await getTutorById(tutor.id)) ?? tutor);
      setBatchMappings([]);
      showToast('Login deleted');
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this login'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (!tutor) return;
    const ok = await confirm({
      title: `Delete ${tutor.name}?`,
      message: 'The tutor record is deleted for good. This cannot be undone.',
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteTutor(tutor.id);
      showToast(`${tutor.name} deleted`);
      navigate('/tutors', { replace: true });
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this tutor'), 'error');
      setDeleting(false);
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
      <BackLink fallback="/tutors" />

      <Card padding="lg">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary)]/10 text-xl font-bold text-[var(--primary)]">
            {tutor.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] break-words">
              {tutor.name}
              {tutor.status === 'archived' && <Badge>Archived</Badge>}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
              {tutor.email && <span className="flex min-w-0 items-center gap-2"><Mail size={15} className="shrink-0 text-[var(--primary)]" /> <span className="break-all">{tutor.email}</span></span>}
              {tutor.email && tutor.phone && <span className="text-[var(--border-strong)]">|</span>}
              {tutor.phone && <span className="flex items-center gap-1"><Phone size={14} className="shrink-0" /> {tutor.phone}</span>}
            </div>
          </div>
          <Button
            variant="outline"
            className="action-button-compact action-button-danger"
            onClick={tutor.status === 'active' ? handleArchive : handleDelete}
            loading={deleting}
          >
            <Trash2 size={14} /> {tutor.status === 'active' ? 'Delete login' : 'Delete'}
          </Button>
        </div>
      </Card>

      {tutor.status === 'active' && (<>
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
          className="card-header-gap"
          action={
            <div className="flex flex-wrap justify-end gap-2">
              {removing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={exitRemoving}>Cancel</Button>
                  <Button size="sm" className="action-button-compact" disabled={picked.length === 0} onClick={() => setShowUnassign(true)}>
                    <X size={14} /> Remove{picked.length > 0 ? ` (${picked.length})` : ''}
                  </Button>
                </>
              ) : (
                <>
                  {batchMappings.length > 0 && (
                    <Button size="sm" variant="secondary" className="action-button-icon" onClick={() => setRemoving(true)} aria-label="Remove batches from this tutor" title="Remove batches from this tutor">
                      <X size={16} />
                    </Button>
                  )}
                  <Button size="sm" className="action-button-compact" onClick={() => setShowAssign(true)} disabled={assignableBatches.length === 0}>
                    <Plus size={14} /> Batch
                  </Button>
                </>
              )}
            </div>
          }
        />
        {batchMappings.length === 0 ? (
          <EmptyState icon={<GraduationCap size={32} />} title="Not assigned to any batches" />
        ) : (
          <Table maxHeight="none" className="data-table-compact">
            <THead>
              <TR>
                {removing && <TH align="center"><span className="sr-only">Select</span></TH>}
                <TH>Batch</TH>
                <TH>Assigned</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {batchMappings.map((m) => (
                <TR key={m.id}>
                  {removing && (
                    <TD align="center">
                      <input
                        type="checkbox"
                        className="data-table-checkbox"
                        checked={picked.includes(m.id)}
                        onChange={() => togglePicked(m.id)}
                        aria-label={`Select ${m.batch?.name ?? 'batch'}`}
                      />
                    </TD>
                  )}
                  <TD>
                    <Link to={`/batches/${m.batch_id}`} className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">
                      {m.batch?.name ?? m.batch_id}
                    </Link>
                  </TD>
                  <TD className="cell-muted">{formatDate(m.assigned_at)}</TD>
                  <TD>{m.batch && <StatusPill kind="batch" value={m.batch.status} />}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      </>)}

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

      <UnassignWizard
        key={showUnassign ? 'unassign-open' : 'unassign-closed'}
        open={showUnassign}
        onClose={() => setShowUnassign(false)}
        tutorName={tutor.name}
        batches={batchMappings.filter((m) => picked.includes(m.id))}
        onDone={() => { exitRemoving(); void reloadBatches(); }}
      />
    </div>
  );
}
