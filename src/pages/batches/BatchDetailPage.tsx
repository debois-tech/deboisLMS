import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit3, Users, GraduationCap, Layers, ClipboardCheck, DollarSign, FileText, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { getBatchById } from '@/lib/supabase';
import { getBatchStudents, getStudentById, addStudentToBatch, removeStudentFromBatch, getStudents } from '@/lib/supabase';
import { getBatchTutors, assignTutorToBatch, removeTutorFromBatch, getTutors } from '@/lib/supabase';
import { getLecturesByBatch, createLecture, deleteLecture } from '@/lib/supabase';
import { getAttendanceByLecture, approveAttendance, bulkApproveAttendance } from '@/lib/supabase';
import { getFeesByBatch, updateFeePayment } from '@/lib/supabase';
import { getAssignmentsByBatch, getCompletionsByAssignment, markSubmission, createAssignment } from '@/lib/supabase';
import type { Batch, Student, Tutor, Lecture, AttendanceRecord, StudentFee, Assignment, AssignmentCompletion, BatchStudentMapping, TutorBatchMapping } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

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

  if (loading) return <Spinner />;
  if (!batch) return <div className="p-6 text-[var(--text-muted)]">Batch not found</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{batch.name}</h1>
            <Badge variant={batch.status === 'ongoing' ? 'success' : batch.status === 'upcoming' ? 'warning' : 'info'}>{batch.status}</Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            {batch.track} • Started {batch.start_date ? formatDate(batch.start_date) : 'N/A'}
          </p>
        </div>
        <Link to={`/batches/${batch.id}/edit`}>
          <Button variant="outline"><Edit3 size={14} /> Edit</Button>
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
      <Card className="p-4">
        <p className="text-xs text-[var(--text-muted)]">Total Students</p>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{students.filter((s) => s.mapping.status === 'active').length}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-[var(--text-muted)]">Lectures Held</p>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{lectures.length}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-[var(--text-muted)]">Track</p>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{batch.track ?? 'N/A'}</p>
      </Card>
    </div>
  );
}

function StudentsTab({ batchId }: { batchId: string }) {
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');

  const fetchStudents = () => {
    getBatchStudents(batchId).then(setStudents);
    getStudents().then(setAllStudents);
  };

  useEffect(() => { fetchStudents(); }, [batchId]);

  const handleAdd = async () => {
    if (!selectedStudent) return;
    await addStudentToBatch(selectedStudent, batchId);
    setSelectedStudent('');
    setShowAdd(false);
    fetchStudents();
  };

  const handleRemove = async (mappingId: string) => {
    await removeStudentFromBatch(mappingId);
    fetchStudents();
  };

  const available = allStudents.filter((s) => !students.some((e) => e.id === s.id));

  return (
    <Card>
      <CardHeader
        title="Enrolled Students"
        subtitle={`${students.filter((s) => s.mapping.status === 'active').length} active`}
        action={<Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Student</Button>}
      />
      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students enrolled" />
      ) : (
        <div className="space-y-1">
          {students.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-[10px] hover:bg-[var(--bg-elevated)]">
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
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Select Student</label>
            <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
              <option value="">Choose a student...</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
          </div>
          <Button onClick={handleAdd} disabled={!selectedStudent}>Add to Batch</Button>
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
        action={<Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Assign Tutor</Button>}
      />
      {tutors.length === 0 ? (
        <EmptyState icon={<GraduationCap size={32} />} title="No tutors assigned" />
      ) : (
        <div className="space-y-1">
          {tutors.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-[10px] hover:bg-[var(--bg-elevated)]">
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
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Select Tutor</label>
            <select value={selectedTutor} onChange={(e) => setSelectedTutor(e.target.value)}>
              <option value="">Choose a tutor...</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleAdd} disabled={!selectedTutor}>Assign</Button>
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
      <CardHeader title="Lectures" subtitle={`${lectures.length} sessions`} action={<Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Add Lecture</Button>} />
      {lectures.length === 0 ? (
        <EmptyState icon={<Layers size={32} />} title="No lectures yet" />
      ) : (
        <div className="space-y-2">
          {lectures.map((l) => (
            <div key={l.id} className="flex items-center justify-between p-3 rounded-[10px] bg-[var(--bg-elevated)]/50">
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
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Date *</label>
            <input type="date" value={form.lecture_date} onChange={(e) => setForm({ ...form, lecture_date: e.target.value })} required />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Meeting Code</label>
            <input value={form.meeting_code} onChange={(e) => setForm({ ...form, meeting_code: e.target.value })} placeholder="e.g. meet-xyz" />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Duration (minutes)</label>
            <input type="number" value={form.scheduled_duration_minutes} onChange={(e) => setForm({ ...form, scheduled_duration_minutes: Number(e.target.value) })} />
          </div>
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

  const handleApprove = async (id: string) => {
    await approveAttendance(id);
    if (selectedLecture) loadAttendance(selectedLecture);
  };

  const handleBulkApprove = async () => {
    if (!selectedLecture) return;
    await bulkApproveAttendance(selectedLecture);
    loadAttendance(selectedLecture);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Select Lecture" />
        <div className="flex flex-wrap gap-2">
          {lectures.map((l) => (
            <button
              key={l.id}
              onClick={() => loadAttendance(l.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedLecture === l.id
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
              }`}
            >
              {formatDate(l.lecture_date)}
            </button>
          ))}
        </div>
      </Card>

      {selectedLecture && (
        <Card>
          <CardHeader
            title="Attendance Records"
            action={
              records.some((r) => !r.approved) ? (
                <Button size="sm" onClick={handleBulkApprove}>
                  <CheckCircle size={14} /> Approve All
                </Button>
              ) : undefined
            }
          />
          {loading ? (
            <Spinner />
          ) : records.length === 0 ? (
            <EmptyState icon={<ClipboardCheck size={32} />} title="No attendance records" description="Upload a CSV or add records manually" />
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-[10px] bg-[var(--bg-elevated)]/50">
                  <div className="flex items-center gap-3">
                    <Badge variant={r.status === 'present' ? 'success' : r.status === 'partial' ? 'warning' : 'danger'}>
                      {r.status}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Student #{r.student_id.slice(-4)}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {r.total_attended_minutes != null ? `${r.total_attended_minutes} min` : '—'} • {r.source}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!r.approved ? (
                      <button onClick={() => handleApprove(r.id)} className="text-emerald-400 hover:text-emerald-300 p-1" title="Approve">
                        <CheckCircle size={16} />
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Approved</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FinanceTab({ batchId }: { batchId: string }) {
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchFees = () => {
    Promise.all([getFeesByBatch(batchId), getBatchStudents(batchId)]).then(([f, s]) => {
      setFees(f);
      setStudents(s);
    });
  };

  useEffect(() => { fetchFees(); }, [batchId]);

  const handleSavePayment = async (feeId: string) => {
    const val = Number(editValue);
    if (isNaN(val)) return;
    await updateFeePayment(feeId, val);
    setEditingId(null);
    fetchFees();
  };

  const totalFee = fees.reduce((s, f) => s + f.total_fee, 0);
  const totalPaid = fees.reduce((s, f) => s + f.paid_amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-[var(--text-muted)]">Total Fees</p><p className="text-xl font-bold text-[var(--text-primary)]">₹{totalFee.toLocaleString()}</p></Card>
        <Card className="p-4"><p className="text-xs text-[var(--text-muted)]">Collected</p><p className="text-xl font-bold text-emerald-400">₹{totalPaid.toLocaleString()}</p></Card>
        <Card className="p-4"><p className="text-xs text-[var(--text-muted)]">Outstanding</p><p className="text-xl font-bold text-red-400">₹{(totalFee - totalPaid).toLocaleString()}</p></Card>
      </div>

      <Card>
        <CardHeader title="Per-Student Fees" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left p-3 text-[var(--text-muted)] font-medium">Student</th>
                <th className="text-left p-3 text-[var(--text-muted)] font-medium">Total Fee</th>
                <th className="text-left p-3 text-[var(--text-muted)] font-medium">Paid</th>
                <th className="text-left p-3 text-[var(--text-muted)] font-medium">Remaining</th>
                <th className="text-left p-3 text-[var(--text-muted)] font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => {
                const student = students.find((s) => s.id === fee.student_id);
                const remaining = fee.total_fee - fee.paid_amount;
                return (
                  <tr key={fee.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50">
                    <td className="p-3 text-[var(--text-primary)]">{student?.name ?? 'Unknown'}</td>
                    <td className="p-3 text-[var(--text-primary)]">₹{fee.total_fee.toLocaleString()}</td>
                    <td className="p-3">
                      {editingId === fee.id ? (
                        <div className="flex gap-2">
                          <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-24" autoFocus />
                          <button onClick={() => handleSavePayment(fee.id)} className="text-emerald-400 hover:text-emerald-300"><CheckCircle size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="text-[var(--text-muted)] hover:text-red-400"><XCircle size={16} /></button>
                        </div>
                      ) : (
                        <span className="text-[var(--text-primary)]">₹{fee.paid_amount.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={remaining > 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {remaining > 0 ? `₹${remaining.toLocaleString()}` : 'Paid'}
                      </span>
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(fee.id); setEditValue(String(fee.paid_amount)); }}>
                        Update
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
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
        <CardHeader title="Assignments" action={<Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> New Assignment</Button>} />
        {assignments.length === 0 ? (
          <EmptyState icon={<FileText size={32} />} title="No assignments" />
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                onClick={() => loadCompletions(a.id)}
                className={`p-3 rounded-[10px] cursor-pointer transition-colors ${
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
          <div className="overflow-x-auto">
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
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Assigned Date</label>
            <input type="date" value={form.assigned_date} onChange={(e) => setForm({ ...form, assigned_date: e.target.value })} />
          </div>
          <Button onClick={handleCreate}>Create Assignment</Button>
        </div>
      </Modal>
    </div>
  );
}