import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Archive, ArrowLeft, Edit3, UserMinus, Users, GraduationCap, Layers, ClipboardCheck, FileText, Plus, Trash2, ChevronRight, CalendarDays, Upload } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { Modal } from '@/components/ui/Modal';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentMultiSelect } from '@/components/ui/StudentMultiSelect';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { FormField } from '@/components/ui/FormField';
import { AttendanceRecordsTable } from '@/components/attendance/AttendanceRecordsTable';
import { DEFAULT_LECTURE_MINUTES } from '@/lib/attendance/types';
import { AssignmentSubmissionTable } from '@/components/assignments/AssignmentSubmissionTable';
import { NewAssignmentModal } from '@/components/assignments/NewAssignmentModal';
import { AssignmentFiles } from '@/components/assignments/AssignmentFiles';
import { BatchMaterials } from '@/components/materials/BatchMaterials';
import { DatePicker } from '@/components/ui/DatePicker';
import { StudentLink } from '@/components/students/StudentLink';
import { PaymentLogModal, type PaymentLogFormState } from '@/components/finance/PaymentLogModal';
import { getBatchById, getBatchPrograms, endBatch } from '@/lib/supabase';
import { getBatchStudents, addStudentToBatch, terminateEnrolment, getStudents, createStudentLoginsBulk, importStudentsIntoBatch, deleteFeePayment } from '@/lib/supabase';
import type { BulkLoginResult } from '@/lib/supabase';
import { BulkLoginsModal } from '@/components/students/BulkLoginsModal';
import { DeleteBatchModal } from '@/components/batches/DeleteBatchModal';
import { getBatchTutors, assignTutorToBatch, removeTutorFromBatch, getTutors } from '@/lib/supabase';
import { getLecturesByBatch, createLecture, deleteLecture } from '@/lib/supabase';
import { getAttendanceByLecture, setAttendanceApproved, bulkApproveAttendance } from '@/lib/supabase';
import { getFeesByBatch, getFeePaymentLogs, addFeePaymentLog } from '@/lib/supabase';
import { getAssignmentsByBatch } from '@/lib/supabase';
import type { Batch, BatchProgramOption, Student, Tutor, Lecture, AttendanceRecord, StudentFee, FeePaymentLog, Assignment, BatchStudentMapping, TutorBatchMapping } from '@/lib/types';
import { formatDate, formatCurrency, feeFromDiscount } from '@/lib/utils/format';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { formatDeadline } from '@/lib/utils/deadline';
import { StudentImportModal } from '@/components/students/StudentImportModal';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';
import { useInitialLoad, useReloadableSection } from '@/lib/hooks/useInitialLoad';


export default function BatchDetailPage() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [programs, setPrograms] = useState<BatchProgramOption[]>([]);
  const [ending, setEnding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!batchId) return;
    const [batchRow, programRows] = await Promise.all([getBatchById(batchId), getBatchPrograms()]);
    setBatch(batchRow ?? null);
    setPrograms(programRows);
  });

  const handleEnd = async () => {
    if (!batch) return;
    const ok = await confirm({
      title: `End ${batch.name}?`,
      message: 'Students keep their logins for 30 days, then the logins are deleted. Their records stay.',
      confirmLabel: 'End batch',
      danger: true,
    });
    if (!ok) return;

    setEnding(true);
    try {
      setBatch(await endBatch(batch.id));
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
      <Link to="/batches" className="mb-4 flex w-fit items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} /> Back to Batches
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight truncate">{batch.name}</h1>
            <StatusPill kind="batch" value={batch.status} />
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {programLabel ?? 'No programme'} • Started {batch.start_date ? formatDate(batch.start_date) : 'N/A'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {batch.status !== 'completed' && (
            <Button variant="outline" className="action-button-compact" onClick={handleEnd} loading={ending}>
              <Archive size={14} /> End Batch
            </Button>
          )}
          <Link to={`/batches/${batch.id}/edit`}>
            <Button variant="outline" className="action-button-compact"><Edit3 size={14} /> Edit</Button>
          </Link>
          <Button
            variant="outline"
            className="action-button-compact action-button-danger"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { label: 'Overview', value: 'overview' },
          { label: 'Students', value: 'students' },
          { label: 'Tutors', value: 'tutors' },
          { label: 'Lectures', value: 'lectures' },
          { label: 'Attendance', value: 'attendance' },
          { label: 'Finance', value: 'finance' },
          { label: 'Assignments', value: 'assignments' },
          { label: 'Material', value: 'material' },
        ]}
        defaultValue="overview"
      >
        {(active) => (
          <>
            {active === 'overview' && <OverviewTab batch={batch} programLabel={programLabel} />}
            {active === 'students' && <StudentsTab batch={batch} />}
            {active === 'tutors' && <TutorsTab batchId={batch.id} />}
            {active === 'lectures' && <LecturesTab batchId={batch.id} />}
            {active === 'attendance' && <AttendanceTab batchId={batch.id} />}
            {active === 'finance' && <FinanceTab batchId={batch.id} />}
            {active === 'assignments' && <AssignmentsTab batchId={batch.id} />}
            {active === 'material' && <BatchMaterials batchId={batch.id} batchCode={batch.batch_code} />}
          </>
        )}
      </Tabs>

      <DeleteBatchModal
        key={deleting ? 'open' : 'closed'}
        open={deleting}
        batchId={batch.id}
        batchName={batch.name}
        confirmWord={batch.batch_code ?? batch.name}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate('/batches')}
      />
    </div>
  );
}

function OverviewTab({ batch, programLabel }: { batch: Batch; programLabel?: string }) {
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([getBatchStudents(batch.id), getLecturesByBatch(batch.id)]);
    setStudents(s);
    setLectures(l);
  }, [batch.id]);

  const { error, reload } = useReloadableSection(load);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <Card padding="sm">
        <p className="text-xs text-[var(--text-muted)]">Regular Fees</p>
        <p className="text-lg font-bold text-[var(--text-primary)] mt-1">
          {batch.base_fee == null ? 'Not set' : formatCurrency(batch.base_fee)}
        </p>
      </Card>
    </div>
  );
}

function StudentsTab({ batch }: { batch: Batch }) {
  const batchId = batch.id;
  const baseFee = batch.base_fee ?? null;
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  // A percentage, unlike the CSV's rupee amount. The fee comes off the batch.
  const [discount, setDiscount] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [bulkLogins, setBulkLogins] = useState<BulkLoginResult | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const fetchStudents = useCallback(async () => {
    const [batchRows, allRows] = await Promise.all([getBatchStudents(batchId), getStudents()]);
    setStudents(batchRows);
    setAllStudents(allRows);
  }, [batchId]);

  const { error: loadError, reload: reloadStudents } = useReloadableSection(fetchStudents);

  const payable = baseFee === null ? null : feeFromDiscount(baseFee, Number(discount) || 0);

  // Left mid-batch: settle what came due, kill the login now, keep the record.
  const handleTerminate = async (mappingId: string, name: string) => {
    const ok = await confirm({
      title: `Terminate ${name}?`,
      message: 'Their login is deleted immediately and any instalment already due is settled. Records stay.',
      confirmLabel: 'Terminate',
      danger: true,
    });
    if (!ok) return;

    try {
      const result = await terminateEnrolment(mappingId);
      void reloadStudents();
      showToast(
        result.void_amount > 0
          ? `${name} terminated — ${formatCurrency(result.void_amount)} void`
          : `${name} terminated`,
      );
    } catch (error) {
      showToast(errorMessage(error, 'Failed to terminate student'), 'error');
    }
  };

  const handleAdd = async () => {
    if (!selectedStudents.length || payable === null) return;
    try {
      await Promise.all(selectedStudents.map((studentId) => addStudentToBatch(studentId, batchId, payable)));
      setSelectedStudents([]);
      setDiscount('');
      setShowAdd(false);
      void reloadStudents();
      showToast('Students added');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to add students'), 'error');
    }
  };

  const available = allStudents.filter((s) => !students.some((e) => e.id === s.id));

  // Same routine as the students page, so a sheet imported from either place
  // lands identically. The batch is this one; the CSV's own column only validates.
  const handleImport = async (rows: Record<string, string>[], createLogins: boolean) => {
    if (baseFee == null) throw new Error('This batch has no base fee. Set one on the batch, then import.');

    const imported = await importStudentsIntoBatch(rows, batchId, baseFee);
    void reloadStudents();

    if (!createLogins) {
      showToast('Students imported');
      return;
    }

    // Skip anyone who already has a login: re-running the edge function would
    // reset a password that may already be in the student's hands.
    const needLogins = imported.filter((student) => !student.auth_user_id);
    if (needLogins.length === 0) {
      showToast('Students imported — logins already existed');
      return;
    }

    setBulkLogins(await createStudentLoginsBulk(needLogins.map((s) => ({ id: s.id, name: s.name }))));
    void reloadStudents();
  };

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadStudents} /></Card>;

  return (
    <Card>
      <CardHeader
        title="Enrolled Students"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" className="action-button-import" variant="secondary" onClick={() => setShowImport(true)}><Upload size={14} />Import</Button>
            <Button size="sm" className="action-button-compact" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Students</Button>   
          </div>
        }
      />
      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students enrolled" />
      ) : (
        <div className="batch-list">
          {students.map((s) => (
            <div key={s.id} className="batch-list-item flex items-center justify-between gap-4 hover:bg-[var(--bg-elevated)]">
              <div>
                <p className="text-sm font-medium"><StudentLink studentId={s.id} name={s.name} /></p>
                <p className="text-xs text-[var(--text-muted)]">{s.email ?? s.phone ?? '—'}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill kind="enrollment" value={s.mapping.status} />
                <div className="roster-actions">
                  {s.mapping.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleTerminate(s.mapping.id, s.name)}
                      className="roster-action is-terminate"
                      title="Terminate — settles fees and deletes the login"
                      aria-label={`Terminate ${s.name}`}
                    >
                      <UserMinus size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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

          {baseFee === null && (
            <InlineAlert>
              This batch has no base fee, so a discount has nothing to come off. Set one on
              the batch, then add students.
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

function TutorsTab({ batchId }: { batchId: string }) {
  const [tutors, setTutors] = useState<(Tutor & { mapping: TutorBatchMapping })[]>([]);
  const [allTutors, setAllTutors] = useState<Tutor[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState('');

  const { showToast } = useToast();
  const confirm = useConfirm();

  const fetchTutors = useCallback(async () => {
    const [batchRows, allRows] = await Promise.all([getBatchTutors(batchId), getTutors()]);
    setTutors(batchRows);
    setAllTutors(allRows);
  }, [batchId]);

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

  const handleRemove = async (mappingId: string, name: string) => {
    const ok = await confirm({
      title: `Unassign ${name} from this batch?`,
      message: 'The tutor record stays. Only this assignment is removed.',
      confirmLabel: 'Unassign',
      danger: true,
    });
    if (!ok) return;

    try {
      await removeTutorFromBatch(mappingId);
      void reloadTutors();
      showToast('Tutor removed from batch');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to remove tutor'), 'error');
    }
  };

  const available = allTutors.filter((t) => !tutors.some((e) => e.id === t.id));

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadTutors} /></Card>;

  return (
    <Card>
      <CardHeader
        title="Assigned Tutors"
        action={
            <Button size="sm" className="action-button-compact" onClick={() => setShowAdd(true)}><Plus size={14} /> Assign Tutor</Button>
         
        }
      /> 
      {tutors.length === 0 ? (
        <EmptyState icon={<GraduationCap size={32} />} title="No tutors assigned" />
      ) : (
        <div className="batch-list">
          {tutors.map((t) => (
            <div key={t.id} className="batch-list-item flex items-center justify-between gap-4 hover:bg-[var(--bg-elevated)]">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{t.email ?? t.phone ?? '—'}</p>
              </div>
              <button onClick={() => handleRemove(t.mapping.id, t.name)} aria-label={`Unassign ${t.name} from batch`} className="text-[var(--text-muted)] hover:text-[var(--danger-text)] p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
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
    </Card>
  );
}

function LecturesTab({ batchId }: { batchId: string }) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ lecture_date: '', start_time: '09:00', meeting_code: '', note: '', session_type: 'online' as const, scheduled_duration_minutes: DEFAULT_LECTURE_MINUTES });

  const { showToast } = useToast();
  const confirm = useConfirm();

  const fetchLectures = useCallback(async () => {
    setLectures(await getLecturesByBatch(batchId));
  }, [batchId]);

  const { error: loadError, reload: reloadLectures } = useReloadableSection(fetchLectures);

  const handleCreate = async () => {
    try {
      const start = new Date(`${form.lecture_date}T${form.start_time}:00`);
      const end = new Date(start.getTime() + form.scheduled_duration_minutes * 60_000);
      await createLecture({ batch_id: batchId, lecture_date: form.lecture_date, meeting_code: form.meeting_code || undefined, note: form.note || undefined, session_type: form.session_type, scheduled_duration_minutes: form.scheduled_duration_minutes, start_at: start.toISOString(), end_at: end.toISOString() });
      setShowNew(false);
      setForm({ lecture_date: '', start_time: '09:00', meeting_code: '', note: '', session_type: 'online', scheduled_duration_minutes: DEFAULT_LECTURE_MINUTES });
      void reloadLectures();
      showToast('Lecture created');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to create lecture'), 'error');
    }
  };

  const handleDelete = async (lectureId: string, label: string) => {
    const ok = await confirm({
      title: `Delete the lecture on ${label}?`,
      message: 'Attendance for this lecture is also deleted. This cannot be undone.',
      confirmLabel: 'Delete lecture',
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteLecture(lectureId);
      void reloadLectures();
      showToast('Lecture deleted');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to delete lecture'), 'error');
    }
  };

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadLectures} /></Card>;

  return (
    <Card>
      <CardHeader title="Lectures" action={<Button size="sm" className="action-button-compact" onClick={() => setShowNew(true)}><Plus size={14} /> Add Lecture</Button>} />
      {lectures.length === 0 ? (
        <EmptyState icon={<Layers size={32} />} title="No lectures yet" />
      ) : (
        <div className="batch-list">
          {lectures.map((l) => (
            <div key={l.id} className="batch-list-item flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{formatDate(l.lecture_date)}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {l.session_type} {l.meeting_code ? `• ${l.meeting_code}` : ''} {l.scheduled_duration_minutes ? `• ${l.scheduled_duration_minutes}min` : ''} {l.note ? `• ${l.note}` : ''}
                </p>
              </div>
              <button onClick={() => handleDelete(l.id, formatDate(l.lecture_date))} aria-label={`Delete lecture on ${formatDate(l.lecture_date)}`} className="text-[var(--text-muted)] hover:text-[var(--danger-text)] p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New Lecture"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button className="action-button-compact" onClick={handleCreate} disabled={!form.lecture_date}>
              Create Lecture
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
          <FormField label="Meeting Code">
            <input value={form.meeting_code} onChange={(e) => setForm({ ...form, meeting_code: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mode" required>
              <SearchSelect options={[{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }]} value={form.session_type} onChange={(session_type) => setForm({ ...form, session_type: session_type as typeof form.session_type })} placeholder="Select mode" searchPlaceholder="Search modes" emptyText="No modes found" showSearch={false} />
            </FormField>
            <FormField label="Start time" required><input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></FormField>
          </div>
          <FormField label="Duration (minutes)">
            <input type="number" value={form.scheduled_duration_minutes} onChange={(e) => setForm({ ...form, scheduled_duration_minutes: Number(e.target.value) })} />
          </FormField>
          <FormField label="Note"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormField>
        </div>
      </Modal>
    </Card>
  );
}

function AttendanceTab({ batchId }: { batchId: string }) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const fetchLectures = useCallback(async () => {
    setLectures(await getLecturesByBatch(batchId));
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

  const handleToggleApproved = async (id: string, approved: boolean) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, approved } : r)));
    try {
      const updated = await setAttendanceApproved(id, approved);
      if (updated) {
        setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    } catch (error) {
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, approved: !approved } : r)));
      showToast(errorMessage(error, 'Failed to update approval'), 'error');
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedLecture) return;
    try {
      await bulkApproveAttendance(selectedLecture);
      loadAttendance(selectedLecture);
      showToast('All records approved');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to approve records'), 'error');
    }
  };

  const selectedLectureData = lectures.find((lecture) => lecture.id === selectedLecture);

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadLectures} /></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Select Lecture" />
        {lectures.length === 0 ? (
          <EmptyState icon={<Layers size={32} />} title="No lectures yet" />
        ) : (
          <div className="batch-list">
            {lectures.map((l) => (
              <button
                key={l.id}
                onClick={() => loadAttendance(l.id)}
                className={`batch-list-item flex w-full items-center justify-between gap-4 text-left transition-colors ${
                  selectedLecture === l.id
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <CalendarDays size={18} className="shrink-0 text-[var(--primary)]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text-primary)]">{formatDate(l.lecture_date)}</span>
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">
                      {l.session_type ?? 'Lecture'}{l.meeting_code ? ` • ${l.meeting_code}` : ''}
                    </span>
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selectedLecture)}
        onClose={() => { setSelectedLecture(null); setRecords([]); }}
        title="Attendance Records"
        description={selectedLectureData ? `${formatDate(selectedLectureData.lecture_date)}${selectedLectureData.meeting_code ? ` • ${selectedLectureData.meeting_code}` : ''}` : undefined}
        size="xl"
      >
        {loading ? (
          <Spinner />
        ) : records.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={32} />} title="No attendance records" />
        ) : (
          <AttendanceRecordsTable
            records={records}
            onToggleApproved={handleToggleApproved}
            onApproveAll={handleBulkApprove}
            maxHeight="28rem"
          />
        )}
      </Modal>
    </div>
  );
}

function FinanceTab({ batchId }: { batchId: string }) {
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [loggingFee, setLoggingFee] = useState<StudentFee | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [logForm, setLogForm] = useState<PaymentLogFormState>({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'upi', notes: '' });
  const [logging, setLogging] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
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

  const totalFee = fees.reduce((s, f) => s + f.total_fee, 0);
  const totalPaid = fees.reduce((s, f) => s + f.paid_amount, 0);

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadFees} /></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Total Fees</p><p className="text-lg font-bold text-[var(--text-primary)] mt-1">{formatCurrency(totalFee)}</p></Card>
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Collected</p><p className="text-lg font-bold text-[var(--success-text)] mt-1">{formatCurrency(totalPaid)}</p></Card>
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Pending Due</p><p className="text-lg font-bold text-[var(--danger-text)] mt-1">{formatCurrency(totalFee - totalPaid)}</p></Card>
      </div>

      <Card>
        <CardHeader title="Per-Student Fees" className="mb-8" />
        {fees.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={32} />} title="No fee records" />
        ) : (
          <div style={{ marginTop: '0.75rem' }}>
            <Table maxHeight="28rem">
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
              {fees.map((fee) => {
                const student = students.find((s) => s.id === fee.student_id);
                const remaining = fee.total_fee - fee.paid_amount;
                return (
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
                      <StatusPill kind="fee" value={remaining > 0 ? 'due' : 'paid'} />
                    </TD>
                    <TD>
                      <Button size="sm" className="action-button-compact" onClick={() => openPaymentLogs(fee)}>
                        <Plus size={14} /> Log Payment
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
            </Table>
          </div>
        )}
      </Card>

      <PaymentLogModal
        fee={loggingFee}
        studentName={students.find((s) => s.id === loggingFee?.student_id)?.name ?? 'Student'}
        paymentLogs={paymentLogs}
        form={logForm}
        onFormChange={setLogForm}
        onClose={() => setLoggingFee(null)}
        onSubmit={handleAddPaymentLog}
        submitting={logging}
        onDelete={handleDeletePaymentLog}
        deletingId={deletingLogId}
      />
    </div>
  );
}

function AssignmentsTab({ batchId }: { batchId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAsgn, setSelectedAsgn] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const fetchAssignments = useCallback(async () => {
    setAssignments(await getAssignmentsByBatch(batchId));
  }, [batchId]);

  const { error: loadError, reload: reloadAssignments } = useReloadableSection(fetchAssignments);

  if (loadError) return <Card><ErrorState message={loadError} onRetry={reloadAssignments} /></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Assignments" action={<Button size="sm" className="action-button-compact" onClick={() => setShowNew(true)}><Plus size={14} /> New Assignment</Button>} />
        {assignments.length === 0 ? (
          <EmptyState icon={<FileText size={32} />} title="No assignments" />
        ) : (
          <div className="batch-list">
            {assignments.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelectedAsgn(a.id)}
                className={`batch-list-item cursor-pointer transition-colors ${
                  selectedAsgn === a.id ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{a.title}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {a.description ?? 'No description'} •{' '}
                  {a.due_at ? `Due ${formatDeadline(a.due_at)}` : 'No deadline'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedAsgn && (
        <Card>
          <CardHeader title="Files" />
          <AssignmentFiles key={selectedAsgn} assignmentId={selectedAsgn} batchId={batchId} />
        </Card>
      )}

      {selectedAsgn && (
        <Card>
          <CardHeader title="Submission Status" />
          <AssignmentSubmissionTable
            key={selectedAsgn}
            assignmentId={selectedAsgn}
            batchId={batchId}
            assignmentTitle={assignments.find((a) => a.id === selectedAsgn)?.title ?? 'assignment'}
          />
        </Card>
      )}

      <NewAssignmentModal
        open={showNew}
        onClose={() => setShowNew(false)}
        batchId={batchId}
        onCreated={reloadAssignments}
      />
    </div>
  );
}
