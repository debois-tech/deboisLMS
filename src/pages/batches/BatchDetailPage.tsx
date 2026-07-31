import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, Users, GraduationCap, Layers, ClipboardCheck, FileText, Plus, Trash2, CheckCircle, XCircle, ChevronRight, CalendarDays, History, Upload, FileSpreadsheet } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { NotFound } from '@/components/ui/NotFound';
import { Modal } from '@/components/ui/Modal';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentMultiSelect } from '@/components/ui/StudentMultiSelect';
import { FormField } from '@/components/ui/FormField';
import { AttendanceRecordsTable } from '@/components/attendance/AttendanceRecordsTable';
import { getBatchById } from '@/lib/supabase';
import { getBatchStudents, addStudentToBatch, removeStudentFromBatch, getStudents, createOrReuseStudent } from '@/lib/supabase';
import { getBatchTutors, assignTutorToBatch, removeTutorFromBatch, getTutors } from '@/lib/supabase';
import { getLecturesByBatch, createLecture, deleteLecture } from '@/lib/supabase';
import { getAttendanceByLecture, setAttendanceApproved, bulkApproveAttendance } from '@/lib/supabase';
import { getFeesByBatch, getFeePaymentLogs, addFeePaymentLog } from '@/lib/supabase';
import { getAssignmentsByBatch, getCompletionsByAssignment, markSubmission, createAssignment } from '@/lib/supabase';
import type { Batch, Student, Tutor, Lecture, AttendanceRecord, StudentFee, FeePaymentLog, Assignment, AssignmentCompletion, BatchStudentMapping, TutorBatchMapping, PaymentMethod } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { parseCsvTable } from '@/lib/utils/csvParser';

// Add future student fields here. Matching uses headers, not column positions.
const STUDENT_IMPORT_FIELDS = [
  { key: 'name', aliases: ['name', 'full name', 'student name'] },
  { key: 'phone', aliases: ['phone', 'ph no', 'phone number', 'mobile'] },
  { key: 'email', aliases: ['email', 'email address'] },
  { key: 'github_url', aliases: ['github', 'github link', 'github url', 'githublink'] },
  { key: 'linkedin_url', aliases: ['linkedin', 'linkedin link', 'linkedin url', 'linkedinlink'] },
] as const;

const normalizeCsvHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');
const getImportValue = (row: Record<string, string>, aliases: readonly string[]) => {
  const entry = Object.entries(row).find(([header]) => aliases.some((alias) => normalizeCsvHeader(header) === normalizeCsvHeader(alias)));
  return entry?.[1]?.trim() || undefined;
};

export default function BatchDetailPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!batchId) return;
    getBatchById(batchId).then((b) => {
      setBatch(b ?? null);
      setLoading(false);
    });
  }, [batchId]);

  if (loading) return <Spinner centered />;
  if (!batch) return <NotFound label="Batch" />;

  return (
    <div className="page-section">
      <Link to="/batches" className="mb-4 flex w-fit items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} /> Back to Batches
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight truncate">{batch.name}</h1>
            <Badge variant={batch.status === 'ongoing' ? 'success' : batch.status === 'upcoming' ? 'warning' : 'info'}>{batch.status}</Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {batch.track} • Started {batch.start_date ? formatDate(batch.start_date) : 'N/A'}
          </p>
        </div>
        <Link to={`/batches/${batch.id}/edit`} className="shrink-0">
          <Button variant="outline" className="min-w-[8rem]"><Edit3 size={14} /> Edit</Button>
        </Link>
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
        ]}
        defaultValue="overview"
      >
        {(active) => (
          <>
            {active === 'overview' && <OverviewTab batch={batch} />}
            {active === 'students' && <StudentsTab batchId={batch.id} />}
            {active === 'tutors' && <TutorsTab batchId={batch.id} />}
            {active === 'lectures' && <LecturesTab batchId={batch.id} />}
            {active === 'attendance' && <AttendanceTab batchId={batch.id} />}
            {active === 'finance' && <FinanceTab batchId={batch.id} />}
            {active === 'assignments' && <AssignmentsTab batchId={batch.id} />}
          </>
        )}
      </Tabs>
    </div>
  );
}

function OverviewTab({ batch }: { batch: Batch }) {
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);

  useEffect(() => {
    Promise.all([getBatchStudents(batch.id), getLecturesByBatch(batch.id)]).then(([s, l]) => {
      setStudents(s);
      setLectures(l);
    });
  }, [batch.id]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card padding="sm">
        <p className="text-xs text-[var(--text-muted)]">Total Students</p>
        <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{students.filter((s) => s.mapping.status === 'active').length}</p>
      </Card>
      <Card padding="sm">
        <p className="text-xs text-[var(--text-muted)]">Lectures Held</p>
        <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{lectures.length}</p>
      </Card>
      <Card padding="sm">
        <p className="text-xs text-[var(--text-muted)]">Track</p>
        <p className="text-lg font-bold text-[var(--text-primary)] mt-1 truncate">{batch.track ?? 'N/A'}</p>
      </Card>
    </div>
  );
}

function StudentsTab({ batchId }: { batchId: string }) {
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [totalFee, setTotalFee] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importFee, setImportFee] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

  const fetchStudents = () => {
    getBatchStudents(batchId).then(setStudents);
    getStudents().then(setAllStudents);
  };

  useEffect(() => { fetchStudents(); }, [batchId]);

  const handleAdd = async () => {
    if (!selectedStudents.length || !totalFee || Number(totalFee) <= 0) return;
    await Promise.all(selectedStudents.map((studentId) => addStudentToBatch(studentId, batchId, Number(totalFee))));
    setSelectedStudents([]);
    setTotalFee('');
    setShowAdd(false);
    fetchStudents();
  };

  const handleRemove = async (mappingId: string) => {
    await removeStudentFromBatch(mappingId);
    fetchStudents();
  };

  const available = allStudents.filter((s) => !students.some((e) => e.id === s.id));

  const resetImport = () => {
    setShowImport(false);
    setImportRows([]);
    setImportHeaders([]);
    setImportError('');
    setImporting(false);
    setImportFee('');
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const table = parseCsvTable(String(reader.result ?? ''));
      const rows = table.rows.filter((row) => getImportValue(row, ['name']));
      setImportHeaders(table.headers);
      setImportRows(rows);
      setImportError(!table.headers.length || !rows.length ? 'CSV must include a Name column and at least one student row.' : '');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    setImportError('');
    if (!importFee || Number(importFee) <= 0) {
      setImportError('Total Fee per Student is required to import.');
      setImporting(false);
      return;
    }
    const fee = Number(importFee);
    try {
      const [enrolledStudents] = await Promise.all([getBatchStudents(batchId)]);
      await Promise.all(importRows.map(async (row) => {
        const input = STUDENT_IMPORT_FIELDS.reduce<Record<string, string>>((student, field) => {
          const value = getImportValue(row, field.aliases);
          if (value) student[field.key] = value;
          return student;
        }, {});
        const student = await createOrReuseStudent(input as Omit<Student, 'id' | 'created_at'>);
        const alreadyEnrolled = enrolledStudents.some((e) => e.id === student.id);
        if (!alreadyEnrolled) {
          await addStudentToBatch(student.id, batchId, fee);
        }
      }));
      fetchStudents();
      resetImport();
    } catch (error: any) {
      setImportError(error?.message ?? 'Import failed. Some rows may already have been imported.');
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Enrolled Students"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" className="action-button-import" variant="secondary" onClick={() => setShowImport(true)}><Upload size={14} />Import</Button>
            <Button size="sm" className="action-button" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Students</Button>
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
                <p className="text-sm font-medium text-[var(--text-primary)]">{s.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{s.email ?? s.phone ?? '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.mapping.status === 'active' ? 'success' : 'danger'}>{s.mapping.status}</Badge>
                <button onClick={() => handleRemove(s.mapping.id)} className="text-[var(--text-muted)] hover:text-red-400 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Student">
        <div className="space-y-4">
          <FormField label="Select Students">
            <StudentMultiSelect students={available} value={selectedStudents} onChange={setSelectedStudents} />
          </FormField>
          <FormField label="Total Fee per Student (₹)" required>
            <input type="number" min="1" value={totalFee} onChange={(event) => setTotalFee(event.target.value)} placeholder="e.g. 15000" required />
          </FormField>
          <Button className="action-button-wide" onClick={handleAdd} disabled={!selectedStudents.length || !totalFee || Number(totalFee) <= 0}>Add Selected to Batch</Button>
        </div>
      </Modal>

      <Modal open={showImport} onClose={resetImport} title="Import Students" size="lg">
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)]" style={{ padding: '1rem 1.25rem' }}>
            <p className="font-semibold text-[var(--text-primary)]">Upload CSV!</p>
          </div>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)]" style={{ padding: '0.75rem 1rem' }}>
            <FileSpreadsheet size={16} /> Choose CSV file
            <input ref={importFileRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />
          </label>
          {importHeaders.length > 0 && importRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Preview ({importRows.length} students)</p>
              <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead><tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">{importHeaders.map((header) => <th key={header} className="whitespace-nowrap text-left font-medium text-[var(--text-muted)]" style={{ padding: '0.75rem 1rem' }}>{header}</th>)}</tr></thead>
                  <tbody>{importRows.slice(0, 5).map((row, index) => <tr key={index} className="border-b border-[var(--border)] last:border-0">{importHeaders.map((header) => <td key={header} className="max-w-[14rem] truncate text-[var(--text-secondary)]" style={{ padding: '0.75rem 1rem' }}>{row[header] || '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {importRows.length > 5 && <p className="text-xs text-[var(--text-muted)]">Showing first 5 rows. All {importRows.length} valid rows will be imported.</p>}
            </div>
          )}
          <FormField label="Total Fee per Student (₹)" required>
            <input type="number" min="1" value={importFee} onChange={(event) => setImportFee(event.target.value)} placeholder="e.g. 15000" required />
          </FormField>
          {importError && <InlineAlert>{importError}</InlineAlert>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={resetImport} disabled={importing}>Cancel</Button>
            <Button className="action-button-import" onClick={handleImport} loading={importing} disabled={!importRows.length || !importFee || Number(importFee) <= 0}>Import</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function TutorsTab({ batchId }: { batchId: string }) {
  const [tutors, setTutors] = useState<(Tutor & { mapping: TutorBatchMapping })[]>([]);
  const [allTutors, setAllTutors] = useState<Tutor[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState('');

  const fetchTutors = () => {
    getBatchTutors(batchId).then(setTutors);
    getTutors().then(setAllTutors);
  };

  useEffect(() => { fetchTutors(); }, [batchId]);

  const handleAdd = async () => {
    if (!selectedTutor) return;
    await assignTutorToBatch(selectedTutor, batchId);
    setSelectedTutor('');
    setShowAdd(false);
    fetchTutors();
  };

  const handleRemove = async (mappingId: string) => {
    await removeTutorFromBatch(mappingId);
    fetchTutors();
  };

  const available = allTutors.filter((t) => !tutors.some((e) => e.id === t.id));

  return (
    <Card>
      <CardHeader
        title="Assigned Tutors"
        action={<Button size="sm" className="action-button" onClick={() => setShowAdd(true)}><Plus size={14} /> Assign Tutor</Button>}
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
              <button onClick={() => handleRemove(t.mapping.id)} className="text-[var(--text-muted)] hover:text-red-400 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Assign Tutor">
        <div className="space-y-4">
          <FormField label="Select Tutor">
            <select value={selectedTutor} onChange={(e) => setSelectedTutor(e.target.value)}>
              <option value="">Choose a tutor...</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
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
  const [form, setForm] = useState({ lecture_date: '', meeting_code: '', scheduled_duration_minutes: 90 });

  const fetchLectures = () => getLecturesByBatch(batchId).then(setLectures);
  useEffect(() => { fetchLectures(); }, [batchId]);

  const handleCreate = async () => {
    await createLecture({ ...form, batch_id: batchId, session_type: 'online' });
    setShowNew(false);
    setForm({ lecture_date: '', meeting_code: '', scheduled_duration_minutes: 90 });
    fetchLectures();
  };

  return (
    <Card>
      <CardHeader title="Lectures" action={<Button size="sm" className="action-button" onClick={() => setShowNew(true)}><Plus size={14} /> Add Lecture</Button>} />
      {lectures.length === 0 ? (
        <EmptyState icon={<Layers size={32} />} title="No lectures yet" />
      ) : (
        <div className="batch-list">
          {lectures.map((l) => (
            <div key={l.id} className="batch-list-item flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{formatDate(l.lecture_date)}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {l.session_type} {l.meeting_code ? `• ${l.meeting_code}` : ''} {l.scheduled_duration_minutes ? `• ${l.scheduled_duration_minutes}min` : ''}
                </p>
              </div>
              <button onClick={() => deleteLecture(l.id).then(fetchLectures)} className="text-[var(--text-muted)] hover:text-red-400 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Lecture">
        <div className="space-y-4">
          <FormField label="Date" required>
            <input type="date" value={form.lecture_date} onChange={(e) => setForm({ ...form, lecture_date: e.target.value })} required />
          </FormField>
          <FormField label="Meeting Code">
            <input value={form.meeting_code} onChange={(e) => setForm({ ...form, meeting_code: e.target.value })} placeholder="e.g. meet-xyz" />
          </FormField>
          <FormField label="Duration (minutes)">
            <input type="number" value={form.scheduled_duration_minutes} onChange={(e) => setForm({ ...form, scheduled_duration_minutes: Number(e.target.value) })} />
          </FormField>
          <Button onClick={handleCreate}>Create Lecture</Button>
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

  useEffect(() => { getLecturesByBatch(batchId).then(setLectures); }, [batchId]);

  const loadAttendance = async (lecId: string) => {
    setLoading(true);
    const data = await getAttendanceByLecture(lecId);
    setRecords(data);
    setSelectedLecture(lecId);
    setLoading(false);
  };

  const handleToggleApproved = async (id: string, approved: boolean) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, approved } : r)));
    try {
      const updated = await setAttendanceApproved(id, approved);
      if (updated) {
        setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    } catch {
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, approved: !approved } : r)));
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedLecture) return;
    await bulkApproveAttendance(selectedLecture);
    loadAttendance(selectedLecture);
  };

  const selectedLectureData = lectures.find((lecture) => lecture.id === selectedLecture);

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
        <div className="space-y-4">
          {records.some((r) => !r.approved) && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleBulkApprove}>
                <CheckCircle size={14} /> Approve All
              </Button>
            </div>
          )}
          {loading ? (
            <Spinner />
          ) : records.length === 0 ? (
            <EmptyState icon={<ClipboardCheck size={32} />} title="No attendance records" description="Upload a CSV or add records manually" />
          ) : (
            <AttendanceRecordsTable records={records} onToggleApproved={handleToggleApproved} maxHeight="28rem" />
          )}
        </div>
      </Modal>
    </div>
  );
}

function FinanceTab({ batchId }: { batchId: string }) {
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [loggingFee, setLoggingFee] = useState<StudentFee | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [logForm, setLogForm] = useState({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other' as PaymentMethod, notes: '' });
  const [logging, setLogging] = useState(false);

  const fetchFees = () => {
    Promise.all([getFeesByBatch(batchId), getBatchStudents(batchId)]).then(([f, s]) => {
      setFees(f);
      setStudents(s);
    });
  };

  useEffect(() => { fetchFees(); }, [batchId]);

  const openPaymentLogs = async (fee: StudentFee) => {
    setLoggingFee(fee);
    setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other', notes: '' });
    setPaymentLogs(await getFeePaymentLogs(fee.id));
  };

  const handleAddPaymentLog = async () => {
    if (!loggingFee || !logForm.amount || Number(logForm.amount) <= 0 || !logForm.payment_date) return;
    setLogging(true);
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
      setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other', notes: '' });
    }
    setLogging(false);
  };

  const totalFee = fees.reduce((s, f) => s + f.total_fee, 0);
  const totalPaid = fees.reduce((s, f) => s + f.paid_amount, 0);
  const loggingRemaining = loggingFee ? Math.max(0, loggingFee.total_fee - loggingFee.paid_amount) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Total Fees</p><p className="text-lg font-bold text-[var(--text-primary)] mt-1">{formatCurrency(totalFee)}</p></Card>
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Collected</p><p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(totalPaid)}</p></Card>
        <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Outstanding</p><p className="text-lg font-bold text-red-400 mt-1">{formatCurrency(totalFee - totalPaid)}</p></Card>
      </div>

      <Card>
        <CardHeader title="Per-Student Fees" />
        {fees.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={32} />} title="No fee records" />
        ) : (
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
                      <Link to={`/students/${fee.student_id}`} className="text-[var(--text-primary)] hover:underline">
                        {student?.name ?? 'Unknown'}
                      </Link>
                    </TD>
                    <TD>{formatCurrency(fee.total_fee)}</TD>
                    <TD>{formatCurrency(fee.paid_amount)}</TD>
                    <TD>
                      <span className={remaining > 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {remaining > 0 ? formatCurrency(remaining) : '—'}
                      </span>
                    </TD>
                    <TD>
                      {remaining > 0 ? <Badge variant="warning">Due</Badge> : <Badge variant="success">Paid</Badge>}
                    </TD>
                    <TD>
                      <Button size="sm" className="action-button" onClick={() => openPaymentLogs(fee)}>
                        <Plus size={14} /> Log Payment
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal open={!!loggingFee} onClose={() => setLoggingFee(null)} title="Payment Log" size="xl">
        {loggingFee && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Student</p>
                <p className="mt-1.5 font-semibold text-[var(--text-primary)]">{students.find((s) => s.id === loggingFee.student_id)?.name ?? 'Student'}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Paid</p>
                <p className="mt-1.5 font-semibold text-emerald-400">{formatCurrency(loggingFee.paid_amount)}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Remaining</p>
                <p className={`mt-1.5 font-semibold ${loggingRemaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {loggingRemaining > 0 ? formatCurrency(loggingRemaining) : 'Paid in full'}
                </p>
              </div>
            </div>

            <div className="payment-log-form space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Amount (₹)" required>
                  <input type="number" min="1" value={logForm.amount} onChange={(event) => setLogForm({ ...logForm, amount: event.target.value })} />
                </FormField>
                <FormField label="Payment Date" required>
                  <input type="date" value={logForm.payment_date} onChange={(event) => setLogForm({ ...logForm, payment_date: event.target.value })} />
                </FormField>
              </div>
              <FormField label="Payment Method">
                <select value={logForm.payment_method} onChange={(event) => setLogForm({ ...logForm, payment_method: event.target.value as PaymentMethod })}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField label="Notes">
                <textarea value={logForm.notes} onChange={(event) => setLogForm({ ...logForm, notes: event.target.value })} placeholder="Optional note" />
              </FormField>
              <div className="flex justify-end">
                <Button className="action-button" onClick={handleAddPaymentLog} loading={logging} disabled={!logForm.amount || Number(logForm.amount) <= 0}>
                  <Plus size={14} /> Add Log
                </Button>
              </div>
            </div>

            <hr className="divider m-0" />

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <History size={15} /> Previous Payments
              </div>
              {paymentLogs.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No payment logs yet.</p>
              ) : (
                <Table maxHeight="16rem">
                  <THead>
                    <TR>
                      <TH>Amount</TH>
                      <TH>Date</TH>
                      <TH>Method</TH>
                      <TH>Notes</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {paymentLogs.map((log) => (
                      <TR key={log.id}>
                        <TD className="font-semibold text-emerald-400">{formatCurrency(Number(log.amount))}</TD>
                        <TD className="cell-secondary">{log.payment_date}</TD>
                        <TD className="cell-muted capitalize">{(log.payment_method ?? '—').replace('_', ' ')}</TD>
                        <TD className="cell-muted">{log.notes || '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AssignmentsTab({ batchId }: { batchId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [selectedAsgn, setSelectedAsgn] = useState<string | null>(null);
  const [completions, setCompletions] = useState<(AssignmentCompletion & { student_name: string })[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigned_date: '' });

  const fetchAssignments = () => {
    Promise.all([getAssignmentsByBatch(batchId), getBatchStudents(batchId)]).then(([a, s]) => {
      setAssignments(a);
      setStudents(s.filter((st) => st.mapping.status === 'active'));
    });
  };

  useEffect(() => { fetchAssignments(); }, [batchId]);

  const loadCompletions = (asgnId: string) => {
    setSelectedAsgn(asgnId);
    getCompletionsByAssignment(asgnId).then(setCompletions);
  };

  const handleCreate = async () => {
    await createAssignment({ ...form, batch_id: batchId });
    setShowNew(false);
    setForm({ title: '', description: '', assigned_date: '' });
    fetchAssignments();
  };

  const handleToggle = async (studentId: string, assignmentId: string, current: boolean) => {
    await markSubmission(assignmentId, studentId, !current);
    loadCompletions(assignmentId);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Assignments" action={<Button size="sm" className="action-button" onClick={() => setShowNew(true)}><Plus size={14} /> New Assignment</Button>} />
        {assignments.length === 0 ? (
          <EmptyState icon={<FileText size={32} />} title="No assignments" />
        ) : (
          <div className="batch-list">
            {assignments.map((a) => (
              <div
                key={a.id}
                onClick={() => loadCompletions(a.id)}
                className={`batch-list-item cursor-pointer transition-colors ${
                  selectedAsgn === a.id ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{a.title}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {a.description ?? 'No description'} • {a.assigned_date ? formatDate(a.assigned_date) : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedAsgn && (
        <Card>
          <CardHeader title="Submission Status" />
          <div className="batch-list-content overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Student</th>
                  <th className="text-center p-3 text-[var(--text-muted)] font-medium">Submitted</th>
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Via</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const comp = completions.find((c) => c.student_id === s.id);
                  const submitted = comp?.submitted ?? false;
                  return (
                    <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50">
                      <td className="p-3 text-[var(--text-primary)]">{s.name}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggle(s.id, selectedAsgn, submitted)}
                          className={submitted ? 'text-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}
                        >
                          {submitted ? <CheckCircle size={18} /> : <XCircle size={18} />}
                        </button>
                      </td>
                      <td className="p-3 text-[var(--text-secondary)]">{comp?.submitted_via ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Assignment">
        <div className="space-y-4">
          <FormField label="Title" required>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </FormField>
          <FormField label="Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </FormField>
          <FormField label="Due Date">
            <input type="date" value={form.assigned_date} onChange={(e) => setForm({ ...form, assigned_date: e.target.value })} />
          </FormField>
          <Button onClick={handleCreate}>Create Assignment</Button>
        </div>
      </Modal>
    </div>
  );
}
