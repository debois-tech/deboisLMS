import { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BackLink } from '@/components/ui/BackLink';
import { Archive, ArrowRightLeft, PenLine, X, Users, GraduationCap, Layers, ClipboardCheck, FileText, Plus, Trash2, Download } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { Modal } from '@/components/ui/Modal';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentMultiSelect } from '@/components/ui/StudentMultiSelect';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { FormField } from '@/components/ui/FormField';
import { AttendanceRecordsTable } from '@/components/attendance/AttendanceRecordsTable';
import { LectureTable } from '@/components/attendance/LectureTable';
import { DEFAULT_LECTURE_MINUTES } from '@/lib/attendance/types';
import { exportBatchAttendanceCsv } from '@/lib/attendance/exportCsv';
import { AssignmentSubmissionTable } from '@/components/assignments/AssignmentSubmissionTable';
import { NewAssignmentModal } from '@/components/assignments/NewAssignmentModal';
import { BatchMaterials } from '@/components/materials/BatchMaterials';
import { BatchBadges } from '@/components/badges/BatchBadges';
import { BatchDocuments } from '@/components/documents/BatchDocuments';
import { DatePicker } from '@/components/ui/DatePicker';
import { StudentLink } from '@/components/students/StudentLink';
import { BatchPills } from '@/components/ui/BatchSelect';
import { PaymentLogModal, type PaymentLogFormState } from '@/components/finance/PaymentLogModal';
import { getBatchById, getBatches, getBatchPrograms, endBatch, deleteBatch, getBatchDeletionCounts, getBatchFeeSummary, getCurriculumProgress } from '@/lib/supabase';
import type { BatchDeletionCounts } from '@/lib/supabase';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getBatchStudents, getAllBatchStudentMappings, addStudentToBatch, terminateEnrolment, getStudents, createStudentLoginsBulk, importStudentsIntoBatch, deleteFeePayment } from '@/lib/supabase';
import type { BulkLoginResult } from '@/lib/supabase';
import { BulkLoginsModal } from '@/components/students/BulkLoginsModal';
import { getBatchTutors, assignTutorToBatch, getTutors } from '@/lib/supabase';
import { getLecturesByBatch, createLecture, updateLecture, deleteLecture, getLectureSummaries } from '@/lib/supabase';
import type { LectureAttendanceSummary } from '@/lib/supabase';
import { getAttendanceByLecture } from '@/lib/supabase';
import { getFeesByBatch, getFeePaymentLogs, addFeePaymentLog } from '@/lib/supabase';
import { getAssignmentsByBatch } from '@/lib/supabase';
import type { Batch, BatchProgramOption, Student, Tutor, Lecture, AttendanceRecord, StudentFee, FeeStatus, FeePaymentLog, Assignment, BatchStudentMapping, TutorBatchMapping, SessionType } from '@/lib/types';
import { formatDate, formatCurrency, feeFromDiscount } from '@/lib/utils/format';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { StudentImportModal } from '@/components/students/StudentImportModal';
import { EarlierWorkTick } from '@/components/batches/EarlierWorkTick';
import { TransferWizard } from '@/components/batches/TransferWizard';
import { RemoveWizard } from '@/components/batches/RemoveWizard';
import { UnassignWizard } from '@/components/tutors/UnassignWizard';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useAuth } from '@/lib/context/AuthContext';
import { errorMessage } from '@/lib/utils/errors';
import { toDateValue } from '@/lib/utils/date';
import { useInitialLoad, useReloadableSection } from '@/lib/hooks/useInitialLoad';

const MODE_LABEL = { terminate: 'Terminate', transfer: 'Transfer', remove: 'Remove' } as const;

const BATCH_DELETION_LABELS: [keyof BatchDeletionCounts, string][] = [
  ['students', 'Enrolments'],
  ['fees', 'Fee records'],
  ['payments', 'Payment logs'],
  ['lectures', 'Lectures'],
  ['attendance', 'Attendance records'],
  ['assignments', 'Assignments'],
  ['materials', 'Files'],
  ['tutors', 'Tutor assignments'],
];

// React Flow is ~65 kB gzipped: fetched when the tab opens, not with every batch page.
const CurriculumCanvas = lazy(() => import('@/components/curriculum/CurriculumCanvas').then((m) => ({ default: m.CurriculumCanvas })));

export default function BatchDetailPage() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [programs, setPrograms] = useState<BatchProgramOption[]>([]);
  const [ending, setEnding] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!batchId) return;
    const [batchRow, programRows] = await Promise.all([getBatchById(batchId), getBatchPrograms()]);
    setBatch(batchRow ?? null);
    setPrograms(programRows);
  });

  const handleDelete = async () => {
    if (!batch) return;
    setDeleting(true);
    try {
      const counts = await getBatchDeletionCounts(batch.id);
      const impact = BATCH_DELETION_LABELS.map(([key, label]) => ({ label, count: counts[key] })).filter((row) => row.count > 0);
      const accepted = await confirm({
        title: `Delete ${batch.name}?`,
        message: 'Removed from the database and file storage',
        impact,
        confirmLabel: 'Delete forever',
        danger: true,
        requireCheck: 'Yes, delete this batch and everything in it, payments included',
        requireText: batch.batch_code ?? batch.name,
      });
      if (!accepted) return;
      await deleteBatch(batch.id);
      showToast(`${batch.name} deleted`);
      navigate('/batches', { replace: true });
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this batch'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleEnd = async () => {
    if (!batch || !endDate) return;
    // The date picker steps aside while the confirm is up
    setConfirmingEnd(true);
    const owed = (await getBatchFeeSummary().catch(() => [])).find((fee) => fee.batch_id === batch.id)?.total_outstanding ?? 0;
    const accepted = await confirm({
      title: `End ${batch.name}?`,
      message: (
        <>
          <span className="block">Ends on {formatDate(endDate)}</span>
          {owed > 0 && <span className="block">{formatCurrency(owed)} still unpaid</span>}
          <span className="block">Student logins and documents deleted 90 days after</span>
          <span className="block">Cannot be reopened</span>
        </>
      ),
      confirmLabel: 'End batch',
      danger: true,
      requireCheck: 'Yes, end this batch',
      requireText: 'END',
    });
    setConfirmingEnd(false);
    if (!accepted) return;
    setEnding(true);
    try {
      setBatch(await endBatch(batch.id, endDate));
      setEndOpen(false);
      showToast('Batch ended');
    } catch (err) {
      showToast(errorMessage(err, 'Could not end this batch'), 'error');
    } finally {
      setEnding(false);
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!batch) return <NotFound label="Batch" />;

  const programLabel = programs.find((p) => p.code === batch.program)?.name;

  return (
    <div className="page-section">
      <BackLink fallback="/batches" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight truncate">{batch.name}</h1>
            <StatusPill kind="batch" value={batch.status} />
            {batch.is_test && <Badge variant="warning">Test</Badge>}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {programLabel ?? 'No programme'} • Started {batch.start_date ? formatDate(batch.start_date) : 'N/A'}{batch.ended_at && <> • Ended {formatDate(batch.ended_at)}</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {batch.status !== 'completed' && (
            <Button
              variant="outline"
              className="action-button-compact"
              onClick={() => { setEndDate(toDateValue(new Date())); setEndOpen(true); }}
            >
              <Archive size={14} /> End Batch
            </Button>
          )}
          <Link to={`/batches/${batch.id}/edit`}>
            <Button variant="outline" className="action-button-compact"><PenLine size={14} /> Edit</Button>
          </Link>
          <Button
            variant="outline"
            className="action-button-compact action-button-danger"
            onClick={() => void handleDelete()}
            loading={deleting}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { label: 'Overview', value: 'overview' },
          { label: 'Students', value: 'students' },
          { label: 'Lectures', value: 'lectures' },
          { label: 'Attendance', value: 'attendance' },
          { label: 'Finance', value: 'finance' },
          { label: 'Assignments', value: 'assignments' },
          { label: 'Curriculum', value: 'curriculum' },
          { label: 'Badges', value: 'badges' },
          { label: 'Documents', value: 'documents' },
          { label: 'Material', value: 'material' },
        ]}
        defaultValue="overview"
      >
        {(active) => (
          <>
            {active === 'overview' && <OverviewTab batch={batch} programLabel={programLabel} />}
            {active === 'students' && <StudentsTab batch={batch} />}
            {active === 'lectures' && <LecturesTab batchId={batch.id} />}
            {active === 'attendance' && <AttendanceTab batchId={batch.id} batchName={batch.name} />}
            {active === 'finance' && <FinanceTab batchId={batch.id} batchName={batch.name} />}
            {active === 'assignments' && <AssignmentsTab batchId={batch.id} />}
            {active === 'curriculum' && (
              <Suspense fallback={<Spinner centered />}>
                <CurriculumCanvas batchId={batch.id} batchName={batch.name} role="admin" height="calc(100vh - 17rem)" />
              </Suspense>
            )}
            {active === 'badges' && <BatchBadges batchId={batch.id} />}
            {active === 'documents' && <BatchDocuments batch={batch} />}
            {active === 'material' && <BatchMaterials batchId={batch.id} batchCode={batch.batch_code} />}
          </>
        )}
      </Tabs>

      <Modal
        open={endOpen && !confirmingEnd}
        onClose={() => !ending && setEndOpen(false)}
        title={`End ${batch.name}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEndOpen(false)} disabled={ending}>Cancel</Button>
            <Button className="action-button-compact" variant="danger" onClick={handleEnd} loading={ending} disabled={!endDate}>
              End batch
            </Button>
          </>
        }
      >
        <div className="popup-form-spaced">
          <FormField label="End Date" required>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              min={batch.start_date?.slice(0, 10)}
              placeholder="Pick a date"
              ariaLabel="Batch end date"
            />
          </FormField>
          <div className="flex flex-col gap-1">
            <p className="field-hint">Internship end dates set to this date</p>
            <p className="field-hint">Student logins and documents deleted 90 days after</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function OverviewTab({ batch, programLabel, showFees = true }: { batch: Batch; programLabel?: string; showFees?: boolean }) {
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [topics, setTopics] = useState<{ done: number; total: number } | undefined>();

  const load = useCallback(async () => {
    const [s, l, progress] = await Promise.all([getBatchStudents(batch.id), getLecturesByBatch(batch.id), getCurriculumProgress(batch.id)]);
    setStudents(s);
    setLectures(l);
    setTopics(progress.get(batch.id));
  }, [batch.id]);

  const { error, reload } = useReloadableSection(load);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="flex flex-col gap-4">
      <div className={showFees ? 'fluid-grid fluid-grid-4' : 'fluid-grid'}>
        <Card padding="sm">
          <p className="text-xs text-[var(--text-muted)]">Total Students</p>
          <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{students.filter((s) => s.mapping.status === 'active').length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-[var(--text-muted)]">Lectures Held</p>
          <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{lectures.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-[var(--text-muted)]">Programme</p>
          <p className="text-lg font-bold text-[var(--text-primary)] mt-1 truncate">{programLabel ?? 'Not set'}</p>
        </Card>
        {showFees && (
          <Card padding="sm">
            <p className="text-xs text-[var(--text-muted)]">Regular Fees</p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1">
              {batch.base_fee == null ? 'Not set' : formatCurrency(batch.base_fee)}
            </p>
          </Card>
        )}
      </div>
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Course progress</p>
            <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
              {topics ? `${Math.round((topics.done / topics.total) * 100)}%` : 'No curriculum yet'}
            </p>
          </div>
          {topics && (
            <div className="min-w-[10rem] flex-1">
              <ProgressBar count done={topics.done} total={topics.total} label="Course progress" />
            </div>
          )}
        </div>
      </Card>
      <TutorsCard batch={batch} />
    </div>
  );
}

function StudentsTab({ batch }: { batch: Batch }) {
  const batchId = batch.id;
  const baseFee = batch.base_fee ?? null;
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [countEarlier, setCountEarlier] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  // A percentage, unlike the CSV's rupee amount. The fee comes off the batch.
  const [discount, setDiscount] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [bulkLogins, setBulkLogins] = useState<BulkLoginResult | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  // Tick mode: students get a checkbox column, for a transfer or a removal.
  const [selecting, setSelecting] = useState<'terminate' | 'transfer' | 'remove' | null>(null);
  // Mapping ids, since that is what the transfer takes.
  const [picked, setPicked] = useState<string[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  // Student id -> the other batches they are active in. Only these students can be removed from this one.
  const [otherBatches, setOtherBatches] = useState<Map<string, Batch[]>>(new Map());
  const { showToast } = useToast();
  const confirm = useConfirm();

  const fetchStudents = useCallback(async () => {
    const [batchRows, allRows, batchList, allMappings] = await Promise.all([getBatchStudents(batchId), getStudents(), getBatches(), getAllBatchStudentMappings()]);
    // Students whose every enrolment is terminated or archived come back as a new account, not through this list
    const closed = new Set(allRows.filter((s) => {
      const mine = allMappings.filter((m) => m.student_id === s.id);
      return mine.length > 0 && mine.every((m) => m.status !== 'active');
    }).map((s) => s.id));
    setStudents(batchRows);
    setAllStudents(allRows.filter((s) => !closed.has(s.id)));
    setAllBatches(batchList);
    const byId = new Map(batchList.map((b) => [b.id, b]));
    const others = new Map<string, Batch[]>();
    for (const m of allMappings) {
      const other = byId.get(m.batch_id);
      if (m.batch_id === batchId || m.status !== 'active' || !other) continue;
      others.set(m.student_id, [...(others.get(m.student_id) ?? []), other]);
    }
    setOtherBatches(others);
  }, [batchId]);

  const { error: loadError, reload: reloadStudents } = useReloadableSection(fetchStudents);

  const payable = baseFee === null ? null : feeFromDiscount(baseFee, Number(discount) || 0);

  // Removed students are a hidden record; the roster is everyone else.
  const roster = students.filter((s) => s.mapping.status !== 'removed');
  const removable = roster.filter((s) => s.mapping.status === 'active' && otherBatches.has(s.id));

  // Left mid-batch: settle what came due, kill the login now, keep the record. One confirm for everyone ticked.
  const handleTerminate = async () => {
    const leavers = roster.filter((s) => picked.includes(s.mapping.id));
    if (leavers.length === 0) return;
    const ok = await confirm({
      title: `Terminate ${leavers.length === 1 ? leavers[0].name : `${leavers.length} students`}?`,
      message: 'Their login is deleted immediately and any instalment already due is settled. Records stay.',
      confirmLabel: 'Terminate',
      danger: true,
      requireCheck: 'Yes, they have left',
      requireText: 'TERMINATE',
    });
    if (!ok) return;

    const failures: string[] = [];
    let voided = 0;
    for (const student of leavers) {
      try {
        voided += (await terminateEnrolment(student.mapping.id)).void_amount;
      } catch (error) {
        failures.push(`${student.name}: ${errorMessage(error, 'failed')}`);
      }
    }
    exitSelecting();
    void reloadStudents();
    const done = leavers.length - failures.length;
    showToast(
      failures.length === 0
        ? `${done} terminated${voided > 0 ? ` — ${formatCurrency(voided)} void` : ''}`
        : `Terminated ${done} of ${leavers.length} · ${failures[0]}`,
      failures.length === 0 ? 'success' : 'error',
    );
  };

  const handleAdd = async () => {
    if (!selectedStudents.length || payable === null) return;
    try {
      const outcomes = await Promise.allSettled(selectedStudents.map((studentId) => addStudentToBatch(studentId, batchId, payable, undefined, countEarlier)));
      const failed = outcomes.flatMap((outcome) => (outcome.status === 'rejected' ? [errorMessage(outcome.reason, 'Could not add the student')] : []));
      void reloadStudents();
      if (failed.length > 0) {
        // Whoever went in is in; only the refused stay ticked.
        setSelectedStudents(selectedStudents.filter((_, index) => outcomes[index].status === 'rejected'));
        showToast(`Added ${outcomes.length - failed.length} of ${outcomes.length} · ${failed[0]}`, 'error');
        return;
      }
      setSelectedStudents([]);
      setDiscount('');
      setShowAdd(false);
      showToast('Students added');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to add students'), 'error');
    }
  };

  // A test batch takes test students and a live one takes live students; the database refuses the rest.
  const available = allStudents.filter(
    (s) => !students.some((e) => e.id === s.id) && Boolean(s.is_test) === Boolean(batch.is_test),
  );

  // Running batches of the same kind; the database refuses anything else
  const transferTargets = allBatches.filter(
    (b) => b.id !== batchId && !b.ended_at && b.status !== 'completed' && Boolean(b.is_test) === Boolean(batch.is_test),
  );

  const exitSelecting = () => {
    setSelecting(null);
    setPicked([]);
    setShowTransfer(false);
    setShowRemove(false);
  };

  const togglePicked = (mappingId: string) =>
    setPicked((current) => (current.includes(mappingId) ? current.filter((id) => id !== mappingId) : [...current, mappingId]));

  // Same routine as the students page, so a sheet imported from either place
  // lands identically. The batch is this one; the CSV's own column only validates.
  const handleImport = async (rows: Record<string, string>[], createLogins: boolean) => {
    if (baseFee == null) throw new Error('This batch has no base fee, set one first');

    const { imported, failed } = await importStudentsIntoBatch(rows, batchId, baseFee);
    void reloadStudents();

    // Skip anyone who already has a login: re-running the edge function would
    // reset a password that may already be in the student's hands.
    const needLogins = createLogins ? imported.filter((student) => !student.auth_user_id) : [];
    if (needLogins.length > 0) {
      setBulkLogins(await createStudentLoginsBulk(needLogins.map((s) => ({ id: s.id, name: s.name }))));
      void reloadStudents();
    } else if (failed.length === 0) {
      showToast(createLogins ? 'Students imported — logins already existed' : 'Students imported');
    }
    return failed;
  };

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadStudents} /></Card>;

  return (
    <Card>
      <CardHeader
        title="Enrolled Students"
        className="card-header-gap"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {selecting ? (
              <>
                <Button size="sm" variant="ghost" onClick={exitSelecting}>Cancel</Button>
                <Button
                  size="sm"
                  variant={selecting === 'terminate' ? 'danger' : 'primary'}
                  className="action-button-compact"
                  disabled={picked.length === 0}
                  onClick={() => (selecting === 'transfer' ? setShowTransfer(true) : selecting === 'remove' ? setShowRemove(true) : void handleTerminate())}
                >
                  {selecting === 'transfer' ? <ArrowRightLeft size={14} /> : selecting === 'remove' ? <X size={14} /> : <Trash2 size={14} />} {MODE_LABEL[selecting]}{picked.length > 0 ? ` (${picked.length})` : ''}
                </Button>
              </>
            ) : (
              <>
                {/* Three levels of change, mildest last: a login deleted, then a student moved or taken out, then just adding. */}
                {roster.some((s) => s.mapping.status === 'active') && (
                  <Button size="sm" className="action-button-icon action-button-danger" variant="secondary" onClick={() => setSelecting('terminate')} aria-label="Terminate students" title="Terminate: settles fees and deletes the login"><Trash2 size={16} /></Button>
                )}
                <span className="toolbar-sep" aria-hidden="true" />
                {!batch.ended_at && <Button size="sm" className="action-button-icon" variant="secondary" onClick={() => setSelecting('transfer')} aria-label="Transfer students" title="Transfer students"><ArrowRightLeft size={16} /></Button>}
                {removable.length > 0 && <Button size="sm" className="action-button-icon" variant="secondary" onClick={() => setSelecting('remove')} aria-label="Remove students from this batch" title="Remove students from this batch"><X size={16} /></Button>}
                <span className="toolbar-sep" aria-hidden="true" />
                <Button size="sm" className="action-button-icon" variant="secondary" onClick={() => setShowImport(true)} aria-label="Import students" title="Import students"><Download size={16} /></Button>
                <Button size="sm" className="action-button-compact" onClick={() => setShowAdd(true)}><Plus size={14} /> Students</Button>
              </>
            )}
          </div>
        }
      />
      {roster.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students enrolled" />
      ) : (
        <Table maxHeight="none" className="data-table-compact">
          <THead>
            <TR>
              {selecting && <TH align="center"><span className="sr-only">Select</span></TH>}
              <TH>Student</TH>
              <TH>ID</TH>
              <TH>Join date</TH>
              <TH>Status</TH>
              {selecting === 'remove' && <TH align="center">Other batches</TH>}
            </TR>
          </THead>
          <TBody>
            {/* Remove mode lists only the students who can be removed. */}
            {(selecting === 'remove' ? removable : roster).map((s) => (
              <TR key={s.id} className={s.mapping.status === 'transferred' ? 'opacity-60' : undefined}>
                {selecting && (
                  <TD align="center">
                    {(selecting === 'remove' ? removable.includes(s) : s.mapping.status === 'active') && (
                      <input
                        type="checkbox"
                        className="data-table-checkbox"
                        checked={picked.includes(s.mapping.id)}
                        onChange={() => togglePicked(s.mapping.id)}
                        aria-label={`Select ${s.name}`}
                      />
                    )}
                  </TD>
                )}
                <TD>
                  <StudentLink studentId={s.id} name={s.name} className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]" />
                </TD>
                <TD className="cell-secondary font-mono">{s.student_code || '—'}</TD>
                <TD className="cell-muted">{s.mapping.joined_at ? formatDate(s.mapping.joined_at) : '—'}</TD>
                <TD><StatusPill kind="enrollment" value={s.mapping.status} /></TD>
                {selecting === 'remove' && <TD align="center"><BatchPills batches={otherBatches.get(s.id) ?? []} /></TD>}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Student">
        <div className="popup-form-spaced">
          <FormField label="Select Students">
            <StudentMultiSelect students={available} value={selectedStudents} onChange={setSelectedStudents} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Discount %">
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </FormField>
            {/* Read-only: worked out from the batch, never typed. */}
            <FormField label="Fee each">
              <input value={payable === null ? '—' : formatCurrency(payable)} readOnly disabled />
            </FormField>
          </div>

          <EarlierWorkTick batch={batch} checked={countEarlier} onChange={setCountEarlier} />

          {baseFee === null && (
            <InlineAlert>
              This batch has no base fee, set one first
            </InlineAlert>
          )}

          <Button
            className="action-button-compact"
            onClick={handleAdd}
            disabled={!selectedStudents.length || payable === null}
          >
            Add Selected
          </Button>
        </div>
      </Modal>

      <TransferWizard
        key={showTransfer ? 'transfer-open' : 'transfer-closed'}
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        source={batch}
        students={students.filter((s) => picked.includes(s.mapping.id))}
        targets={transferTargets}
        onDone={() => { exitSelecting(); void reloadStudents(); }}
      />

      <RemoveWizard
        key={showRemove ? 'remove-open' : 'remove-closed'}
        open={showRemove}
        onClose={() => setShowRemove(false)}
        batch={batch}
        students={removable.filter((s) => picked.includes(s.mapping.id))}
        onDone={() => { setShowRemove(false); exitSelecting(); void reloadStudents(); }}
      />

      <StudentImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        batch={batch}
        onImport={handleImport}
      />

      <BulkLoginsModal result={bulkLogins} onClose={() => setBulkLogins(null)} />
    </Card>
  );
}

// The batch's tutors, in the overview. Everyone reads it; only admin and developer get the buttons.
function TutorsCard({ batch }: { batch: Batch }) {
  const { isAdmin } = useAuth();
  const batchId = batch.id;
  const [tutors, setTutors] = useState<(Tutor & { mapping: TutorBatchMapping })[]>([]);
  const [allTutors, setAllTutors] = useState<Tutor[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState('');
  const [unassigning, setUnassigning] = useState<(Tutor & { mapping: TutorBatchMapping }) | null>(null);

  const { showToast } = useToast();

  const fetchTutors = useCallback(async () => {
    // A tutor only reads the list, so the full tutor roster is for the people who can assign.
    const [batchRows, allRows] = await Promise.all([getBatchTutors(batchId), isAdmin ? getTutors() : Promise.resolve([] as Tutor[])]);
    setTutors(batchRows);
    setAllTutors(allRows);
  }, [batchId, isAdmin]);

  const { error: loadError, reload: reloadTutors } = useReloadableSection(fetchTutors);

  const handleAdd = async () => {
    if (!selectedTutor) return;
    try {
      await assignTutorToBatch(selectedTutor, batchId);
      setSelectedTutor('');
      setShowAdd(false);
      void reloadTutors();
      showToast('Tutor assigned to batch');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to assign tutor'), 'error');
    }
  };

  const available = allTutors.filter((t) => !tutors.some((e) => e.id === t.id));

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadTutors} /></Card>;

  return (
    <Card>
      <CardHeader
        title="Assigned Tutors"
        className="card-header-gap"
        action={isAdmin && <Button size="sm" className="action-button-compact" onClick={() => setShowAdd(true)}><Plus size={14} /> Assign Tutor</Button>}
      />
      {tutors.length === 0 ? (
        <EmptyState icon={<GraduationCap size={32} />} title="No tutors assigned" />
      ) : (
        <Table maxHeight="none" className="data-table-compact">
          <THead>
            <TR>
              <TH>Tutor</TH>
              <TH>Email</TH>
              <TH>Assigned</TH>
              {isAdmin && <TH align="center"><span className="sr-only">Actions</span></TH>}
            </TR>
          </THead>
          <TBody>
            {tutors.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium text-[var(--text-primary)]">{t.name}</TD>
                <TD className="cell-secondary">{t.email ?? t.phone ?? '—'}</TD>
                <TD className="cell-muted whitespace-nowrap">{formatDate(t.mapping.assigned_at)}</TD>
                {isAdmin && (
                  <TD align="center">
                    <Button size="sm" variant="ghost" className="action-button-icon" onClick={() => setUnassigning(t)} aria-label={`Unassign ${t.name} from batch`} title="Unassign">
                      <Trash2 size={15} />
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Assign Tutor">
        <div className="popup-form-spaced">
          <FormField label="Select Tutor">
            <SearchSelect
              options={available.map((tutor) => ({ value: tutor.id, label: tutor.name }))}
              value={selectedTutor || null}
              onChange={setSelectedTutor}
              placeholder="Choose a tutor"
              searchPlaceholder="Search tutors"
              emptyText="No tutors found"
            />
          </FormField>
          <Button className="action-button" onClick={handleAdd} disabled={!selectedTutor}>Assign</Button>
        </div>
      </Modal>

      <UnassignWizard
        key={unassigning ? `unassign-${unassigning.mapping.id}` : 'unassign-closed'}
        open={unassigning !== null}
        onClose={() => setUnassigning(null)}
        tutorName={unassigning?.name ?? ''}
        batches={unassigning ? [{ ...unassigning.mapping, batch }] : []}
        onDone={() => { setUnassigning(null); void reloadTutors(); }}
      />
    </Card>
  );
}

type LectureForm = {
  lecture_date: string;
  start_time: string;
  tutor_id: string;
  note: string;
  session_type: SessionType;
  scheduled_duration_minutes: number;
};

const BLANK_LECTURE: LectureForm = {
  lecture_date: '',
  start_time: '09:00',
  tutor_id: '',
  note: '',
  session_type: 'online',
  scheduled_duration_minutes: DEFAULT_LECTURE_MINUTES,
};

export function LecturesTab({ batchId }: { batchId: string }) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [summaries, setSummaries] = useState<Map<string, LectureAttendanceSummary>>(new Map());
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Lecture | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<LectureForm>(BLANK_LECTURE);

  const { showToast } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  const fetchLectures = useCallback(async () => {
    const [list, batchTutors] = await Promise.all([getLecturesByBatch(batchId), getBatchTutors(batchId)]);
    setLectures(list);
    setSummaries(await getLectureSummaries(batchId));
    setTutors(batchTutors);
  }, [batchId]);

  const { error: loadError, reload: reloadLectures } = useReloadableSection(fetchLectures);

  // You, when you are one of the batch's tutors; otherwise its first.
  const defaultTutor = tutors.find((tutor) => tutor.id === user?.tutor_id)?.id ?? tutors[0]?.id ?? '';

  const openNew = () => {
    setEditing(null);
    setForm({ ...BLANK_LECTURE, tutor_id: defaultTutor });
    setShowNew(true);
  };

  // The same dialog edits a lecture later — chiefly to correct the tutor.
  const openEdit = (lecture: Lecture) => {
    setEditing(lecture);
    setForm({
      lecture_date: lecture.lecture_date,
      start_time: lecture.start_at ? new Date(lecture.start_at).toTimeString().slice(0, 5) : '09:00',
      tutor_id: lecture.tutor_id ?? '',
      note: lecture.note ?? '',
      session_type: lecture.session_type,
      scheduled_duration_minutes: lecture.scheduled_duration_minutes ?? DEFAULT_LECTURE_MINUTES,
    });
    setShowNew(true);
  };

  const closeForm = () => {
    setShowNew(false);
    setEditing(null);
    setForm(BLANK_LECTURE);
  };

  const handleSave = async () => {
    if (!form.lecture_date || saving) return;
    const start = new Date(`${form.lecture_date}T${form.start_time}:00`);
    const end = new Date(start.getTime() + form.scheduled_duration_minutes * 60_000);
    const patch = {
      lecture_date: form.lecture_date,
      tutor_id: form.tutor_id || defaultTutor || null,
      note: form.note || undefined,
      session_type: form.session_type,
      scheduled_duration_minutes: form.scheduled_duration_minutes,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    };

    setSaving(true);
    try {
      if (editing) {
        await updateLecture(editing.id, patch);
      } else {
        await createLecture({ batch_id: batchId, ...patch });
      }
      const wasEditing = Boolean(editing);
      closeForm();
      void reloadLectures();
      showToast(wasEditing ? 'Lecture updated' : 'Lecture created');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to save the lecture'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lecture: Lecture) => {
    const label = formatDate(lecture.lecture_date);
    const ok = await confirm({
      title: `Delete the lecture on ${label}?`,
      message: 'Attendance for this lecture is also deleted. This cannot be undone.',
      confirmLabel: 'Delete lecture',
      danger: true,
    });
    if (!ok) return;

    setDeletingId(lecture.id);
    try {
      await deleteLecture(lecture.id);
      void reloadLectures();
      showToast('Lecture deleted');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to delete lecture'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadLectures} /></Card>;

  return (
    <Card>
      <CardHeader title="Lectures" className="card-header-gap" action={<Button size="sm" className="action-button-compact" onClick={openNew}><Plus size={14} /> Add Lecture</Button>} />
      {lectures.length === 0 ? (
        <EmptyState icon={<Layers size={32} />} title="No lectures yet" />
      ) : (
        <LectureTable
          lectures={lectures}
          summaries={summaries}
          variant="lectures"
          onEdit={openEdit}
          onDelete={(lecture) => void handleDelete(lecture)}
          deletingId={deletingId}
        />
      )}

      <Modal
        open={showNew}
        onClose={closeForm}
        title={editing ? 'Edit' : 'New'}
        footer={
          <>
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button className="action-button-compact" onClick={handleSave} loading={saving} disabled={!form.lecture_date}>
              {editing ? 'Save changes' : 'Create Lecture'}
            </Button>
          </>
        }
      >
        <div className="popup-form-spaced">
          <FormField label="Date" required>
            <DatePicker
              value={form.lecture_date}
              onChange={(lecture_date) => setForm({ ...form, lecture_date })}
              placeholder="Pick a date"
              ariaLabel="Lecture date"
            />
          </FormField>
          <FormField label="Tutor" required>
            <SearchSelect
              options={tutors.map((tutor) => ({ value: tutor.id, label: tutor.name }))}
              value={form.tutor_id || defaultTutor || null}
              onChange={(tutor_id) => setForm({ ...form, tutor_id })}
              placeholder="Select a tutor"
              searchPlaceholder="Search tutors"
              emptyText="No tutors assigned to this batch"
              showSearch={tutors.length > 6}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mode" required>
              <SearchSelect options={[{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }]} value={form.session_type} onChange={(session_type) => setForm({ ...form, session_type: session_type as typeof form.session_type })} placeholder="Select mode" searchPlaceholder="Search modes" emptyText="No modes found" showSearch={false} />
            </FormField>
            <FormField label="Start time" required><input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></FormField>
          </div>
          <FormField label="Duration (minutes)" required>
            <input type="number" min="1" value={form.scheduled_duration_minutes} onChange={(e) => setForm({ ...form, scheduled_duration_minutes: Number(e.target.value) })} />
          </FormField>
          <FormField label="Note"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormField>
        </div>
      </Modal>
    </Card>
  );
}

export function AttendanceTab({ batchId, batchName }: { batchId: string; batchName: string }) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [summaries, setSummaries] = useState<Map<string, LectureAttendanceSummary>>(new Map());
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const fetchLectures = useCallback(async () => {
    const list = await getLecturesByBatch(batchId);
    setLectures(list);
    setSummaries(await getLectureSummaries(batchId));
  }, [batchId]);

  const { error: loadError, reload: reloadLectures } = useReloadableSection(fetchLectures);

  const loadAttendance = async (lecId: string) => {
    setLoading(true);
    setSelectedLecture(lecId);
    try {
      setRecords(await getAttendanceByLecture(lecId));
    } catch (err) {
      setRecords([]);
      showToast(errorMessage(err, 'Failed to load attendance records'), 'error');
    }
    setLoading(false);
  };

  const handleDelete = async (lecture: Lecture) => {
    const label = formatDate(lecture.lecture_date);
    const ok = await confirm({
      title: `Delete the lecture on ${label}?`,
      message: 'Attendance for this lecture is also deleted. This cannot be undone.',
      confirmLabel: 'Delete lecture',
      danger: true,
    });
    if (!ok) return;

    setDeletingId(lecture.id);
    try {
      await deleteLecture(lecture.id);
      if (selectedLecture === lecture.id) {
        setSelectedLecture(null);
        setRecords([]);
      }
      void reloadLectures();
      showToast('Lecture deleted');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to delete lecture'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedLectureData = lectures.find((lecture) => lecture.id === selectedLecture);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await exportBatchAttendanceCsv(batchId, batchName);
    } catch (err) {
      showToast(errorMessage(err, 'Could not export attendance'), 'error');
    }
    setExporting(false);
  };

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadLectures} /></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Attendance"
          className="card-header-gap"
          action={lectures.length > 0 && (
            <Button size="sm" variant="secondary" className="action-button-compact" onClick={handleExportCsv} loading={exporting}>
              <Download size={14} /> Export
            </Button>
          )}
        />
        {lectures.length === 0 ? (
          <EmptyState icon={<Layers size={32} />} title="No lectures yet" />
        ) : (
          <LectureTable
            lectures={lectures}
            summaries={summaries}
            variant="attendance"
            selectedId={selectedLecture}
            onSelect={(lecture) => void loadAttendance(lecture.id)}
            onDelete={(lecture) => void handleDelete(lecture)}
            deletingId={deletingId}
          />
        )}
      </Card>

      <Modal
        open={Boolean(selectedLecture)}
        onClose={() => { setSelectedLecture(null); setRecords([]); }}
        title="Attendance Records"
        description={selectedLectureData ? `${formatDate(selectedLectureData.lecture_date)}${selectedLectureData.tutor ? ` • ${selectedLectureData.tutor.name}` : ''}` : undefined}
        size="xl"
      >
        {loading ? (
          <Spinner />
        ) : records.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={32} />} title="No attendance records" />
        ) : (
          <AttendanceRecordsTable records={records} maxHeight="28rem" />
        )}
      </Modal>
    </div>
  );
}

function FinanceTab({ batchId, batchName }: { batchId: string; batchName: string }) {
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [loggingFee, setLoggingFee] = useState<StudentFee | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [logForm, setLogForm] = useState<PaymentLogFormState>({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'upi', notes: '' });
  const [logging, setLogging] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeeStatus | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const fetchFees = useCallback(async () => {
    const [f, s] = await Promise.all([getFeesByBatch(batchId), getBatchStudents(batchId)]);
    setFees(f);
    setStudents(s);
  }, [batchId]);

  const { error: loadError, reload: reloadFees } = useReloadableSection(fetchFees);

  const openPaymentLogs = async (fee: StudentFee) => {
    setLoggingFee(fee);
    setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'upi', notes: '' });
    try {
      setPaymentLogs(await getFeePaymentLogs(fee.id));
    } catch (err) {
      setPaymentLogs([]);
      showToast(errorMessage(err, 'Failed to load payment history'), 'error');
    }
  };

  const handleAddPaymentLog = async () => {
    if (!loggingFee || !logForm.amount || Number(logForm.amount) <= 0 || !logForm.payment_date) return;
    setLogging(true);
    try {
      const result = await addFeePaymentLog({
        student_fee_id: loggingFee.id,
        amount: Number(logForm.amount),
        payment_date: logForm.payment_date,
        payment_method: logForm.payment_method,
        notes: logForm.notes,
      });
      if (result) {
        setLoggingFee(result.fee);
        setPaymentLogs((prev) => [result.log, ...prev]);
        setFees((prev) => prev.map((f) => (f.id === result.fee.id ? result.fee : f)));
        setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'upi', notes: '' });
        showToast('Payment logged');
      }
    } catch (error) {
      showToast(errorMessage(error, 'Failed to log payment'), 'error');
    }
    setLogging(false);
  };

  // The balance goes back where it came from — pending for an enrolled student,
  // void for one who left — because both are worked out from what was paid.
  const handleDeletePaymentLog = async (log: FeePaymentLog) => {
    const ok = await confirm({
      title: `Delete this ${formatCurrency(Number(log.amount))} payment?`,
      message: 'The amount goes back to what is owed. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    setDeletingLogId(log.id);
    try {
      const fee = await deleteFeePayment(log.id);
      setLoggingFee(fee);
      setPaymentLogs((prev) => prev.filter((entry) => entry.id !== log.id));
      setFees((prev) => prev.map((f) => (f.id === fee.id ? fee : f)));
      showToast('Payment deleted');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to delete payment'), 'error');
    }
    setDeletingLogId(null);
  };

  // Same split as batch_fee_summary: leavers' fees and balances stay out; what they paid is still collected.
  const enrolled = fees.filter((f) => f.status !== 'terminated');
  const totalFee = enrolled.reduce((s, f) => s + f.total_fee, 0);
  const totalPaid = fees.reduce((s, f) => s + f.paid_amount, 0);
  const totalPending = enrolled.reduce((s, f) => s + Math.max(f.total_fee - f.paid_amount, 0), 0);

  const feeRows = useMemo(
    () => fees.map((fee) => {
      const student = students.find((s) => s.id === fee.student_id);
      // A leaver owes their void, not the rest of the fee.
      const remaining = Math.max((fee.status === 'terminated' ? Number(fee.expected_on_exit) : fee.total_fee) - fee.paid_amount, 0);
      const status: FeeStatus = fee.status === 'terminated' ? 'terminated' : remaining <= 0 ? 'paid' : 'due';
      return { fee, student, remaining, status };
    }),
    [fees, students],
  );

  const filteredFeeRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return feeRows.filter((row) => {
      if (statusFilter && statusFilter !== row.status) return false;
      if (!term) return true;
      return (row.student?.name ?? 'unknown').toLowerCase().includes(term);
    });
  }, [feeRows, search, statusFilter]);

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadFees} /></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Total Fees</p><p className="text-lg font-bold text-[var(--text-primary)] mt-1">{formatCurrency(totalFee)}</p></Card>
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Collected</p><p className="text-lg font-bold text-[var(--success-text)] mt-1">{formatCurrency(totalPaid)}</p></Card>
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Pending Due</p><p className="text-lg font-bold text-[var(--danger-text)] mt-1">{formatCurrency(totalPending)}</p></Card>
      </div>

      <Card>
        <CardHeader title="Per-Student Fees" className="mb-8" />
        {fees.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={32} />} title="No fee records" />
        ) : (
          <div className="table-block" style={{ marginTop: '0.75rem' }}>
            <SearchFilterBar
              value={search}
              onChange={setSearch}
              placeholder="Search by student name"
              filterLabel="Status"
              allLabel="All statuses"
              filterValue={statusFilter}
              filterOptions={[{ value: 'due', label: 'Due' }, { value: 'paid', label: 'Paid' }, { value: 'terminated', label: 'Terminated' }]}
              onFilterChange={(value) => setStatusFilter(value as FeeStatus | null)}
            />

            {filteredFeeRows.length === 0 ? (
              <EmptyState icon={<ClipboardCheck size={32} />} title="No matching records" />
            ) : (
              <Table maxHeight="none">
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Total Fee</TH>
                  <TH>Paid</TH>
                  <TH>Remaining</TH>
                  <TH>Status</TH>
                  <TH>Action</TH>
                </TR>
              </THead>
              <TBody>
                {filteredFeeRows.map(({ fee, student, remaining, status }) => (
                  <TR key={fee.id}>
                    <TD className="font-medium">
                      <StudentLink studentId={fee.student_id} name={student?.name ?? 'Unknown'} />
                    </TD>
                    <TD>{formatCurrency(fee.total_fee)}</TD>
                    <TD>{formatCurrency(fee.paid_amount)}</TD>
                    <TD>
                      <span className={remaining > 0 ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]'}>
                        {remaining > 0 ? formatCurrency(remaining) : '—'}
                      </span>
                    </TD>
                    <TD>
                      {student?.mapping.status === 'transferred'
                        ? <StatusPill kind="enrollment" value="transferred" />
                        : <StatusPill kind="fee" value={status} />}
                    </TD>
                    <TD>
                      {student?.mapping.status === 'transferred' ? (
                        <span className="cell-muted">—</span>
                      ) : (
                        <Button size="sm" className="action-button-compact" onClick={() => openPaymentLogs(fee)}>
                          <Plus size={14} /> Log Payment
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
              </Table>
            )}
          </div>
        )}
      </Card>

      <PaymentLogModal
        fee={loggingFee}
        studentName={students.find((s) => s.id === loggingFee?.student_id)?.name ?? 'Student'}
        student={students.find((s) => s.id === loggingFee?.student_id)}
        batchName={batchName}
        paymentLogs={paymentLogs}
        form={logForm}
        onFormChange={setLogForm}
        onClose={() => setLoggingFee(null)}
        onSubmit={handleAddPaymentLog}
        submitting={logging}
        onDelete={handleDeletePaymentLog}
        deletingId={deletingLogId}
        onLogUpdated={({ log, fee }) => {
          setLoggingFee(fee);
          setPaymentLogs((prev) => prev.map((entry) => (entry.id === log.id ? log : entry)));
          setFees((prev) => prev.map((f) => (f.id === fee.id ? fee : f)));
        }}
        onClaimApproved={({ log, fee }) => {
          setLoggingFee(fee);
          setPaymentLogs((prev) => [log, ...prev]);
          setFees((prev) => prev.map((f) => (f.id === fee.id ? fee : f)));
        }}
      />
    </div>
  );
}

export function AssignmentsTab({ batchId }: { batchId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAsgn, setSelectedAsgn] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const selectedAssignment = assignments.find((a) => a.id === selectedAsgn);

  const fetchAssignments = useCallback(async () => {
    setAssignments(await getAssignmentsByBatch(batchId));
  }, [batchId]);

  const { error: loadError, reload: reloadAssignments } = useReloadableSection(fetchAssignments);

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadAssignments} /></Card>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
      <Card className="lg:sticky lg:top-[calc(var(--navbar-h)_+_1rem)]">
        <CardHeader
          title="Assignments"
          action={
            <div className="flex gap-2">
              {selectedAssignment && (
                <Button size="sm" variant="secondary" className="action-button-icon" onClick={() => setShowEdit(true)} aria-label="Edit assignment">
                  <PenLine size={14} />
                </Button>
              )}
              <Button size="sm" className="action-button-compact" onClick={() => setShowNew(true)}><Plus size={14} />Create</Button>
            </div>
          }
        />
        {assignments.length === 0 ? (
          <EmptyState icon={<FileText size={32} />} title="No assignments" />
        ) : (
          <div className="batch-list max-h-[32rem] overflow-y-auto pr-1">
            {assignments.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelectedAsgn(a.id)}
                className={`batch-list-item cursor-pointer transition-colors ${
                  selectedAsgn === a.id ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{a.title}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedAsgn ? (
        <div className="space-y-4">
          <Card>
            <AssignmentSubmissionTable
              key={selectedAsgn}
              assignmentId={selectedAsgn}
              batchId={batchId}
              assignmentTitle={selectedAssignment?.title ?? 'assignment'}
              dueAt={selectedAssignment?.due_at}
            />
          </Card>
        </div>
      ) : (
        assignments.length > 0 && (
          <Card>
            <EmptyState icon={<FileText size={32} />} title="Select an assignment" />
          </Card>
        )
      )}

      <NewAssignmentModal
        key={showEdit ? (selectedAsgn ?? 'edit') : 'new'}
        open={showNew || showEdit}
        onClose={() => { setShowNew(false); setShowEdit(false); }}
        batchId={batchId}
        assignment={showEdit ? selectedAssignment : undefined}
        onSaved={reloadAssignments}
      />
    </div>
  );
}
