import { useState, useEffect, useRef } from 'react';
import { ClipboardCheck, Upload, Loader2, Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { LectureSelect } from '@/components/ui/LectureSelect';
import { FormField } from '@/components/ui/FormField';
import { AttendanceRecordsTable } from '@/components/attendance/AttendanceRecordsTable';
import { getLecturesByBatch, createLecture } from '@/lib/supabase';
import { getAttendanceByLecture, insertUploadRows, processAttendance, setAttendanceApproved, bulkApproveAttendance } from '@/lib/supabase';
import type { ProcessingReport } from '@/lib/supabase';
import { getBatches } from '@/lib/supabase';
import type { Batch, Lecture, AttendanceRecord } from '@/lib/types';
import { parseCsv } from '@/lib/utils/csvParser';
import type { CsvRow } from '@/lib/utils/csvParser';
import { useToast } from '@/lib/context/ToastContext';

export default function AttendancePage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [showNewLecture, setShowNewLecture] = useState(false);
  const [newLectureDate, setNewLectureDate] = useState('');
  const [newLectureMeeting, setNewLectureMeeting] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [lastReport, setLastReport] = useState<ProcessingReport | null>(null);

  useEffect(() => {
    getBatches().then(setBatches);
  }, []);

  useEffect(() => {
    if (!selectedBatch) return;
    getLecturesByBatch(selectedBatch).then(setLectures);
    setSelectedLecture(null);
    setRecords([]);
    setCsvRows([]);
    setCsvFileName('');
  }, [selectedBatch]);

  const loadRecords = (lecId: string) => {
    setSelectedLecture(lecId);
    setLoading(true);
    getAttendanceByLecture(lecId).then((data) => {
      setRecords(data);
      setLoading(false);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setCsvRows(parsed);
    };
    reader.readAsText(file);
  };

  // Uploads the CSV into the `uploads` table, then immediately processes it into
  // attendance records and clears the uploads — one action end-to-end for the admin.
  const handleUploadAndProcess = async () => {
    if (!selectedLecture || csvRows.length === 0) return;
    setProcessing(true);
    setLastReport(null);

    try {
      const lecture = lectures.find((l) => l.id === selectedLecture);
      await insertUploadRows(selectedLecture, lecture?.meeting_code ?? '', lecture?.lecture_date, csvRows);
      const report = await processAttendance(selectedLecture);
      setLastReport(report);
      loadRecords(selectedLecture);
      setCsvRows([]);
      setCsvFileName('');
      if (fileRef.current) fileRef.current.value = '';

      const parts = [`${report.attendanceInserted} attendance records created`];
      if (report.tutorsDetected.length > 0) parts.push(`${report.tutorsDetected.length} tutor(s) detected`);
      if (report.duplicateRowsIgnored > 0) parts.push(`${report.duplicateRowsIgnored} duplicate rows merged`);
      if (report.unmatched.length > 0) parts.push(`${report.unmatched.length} participant(s) need review`);
      showToast(parts.join(' · '), report.unmatched.length > 0 ? 'warning' : 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Upload & processing failed', 'error');
    }
    setProcessing(false);
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
    try {
      await bulkApproveAttendance(selectedLecture);
      loadRecords(selectedLecture);
      showToast('All records approved');
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to approve records', 'error');
    }
  };

  const handleCreateLecture = async () => {
    if (!selectedBatch || !newLectureDate) return;
    try {
      await createLecture({
        batch_id: selectedBatch,
        lecture_date: newLectureDate,
        meeting_code: newLectureMeeting || undefined,
        session_type: 'online',
        scheduled_duration_minutes: 90,
      });
      setShowNewLecture(false);
      setNewLectureDate('');
      setNewLectureMeeting('');
      getLecturesByBatch(selectedBatch).then(setLectures);
      showToast('Lecture created');
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to create lecture', 'error');
    }
  };

  const showUploadAction = csvRows.length > 0 && selectedLecture && !processing;

  return (
    <div className="page-section">
      <PageHeader title="Attendance" />

      <Card>
        <CardHeader title="1. Select Batch" />
        <BatchSelect batches={batches} value={selectedBatch} onChange={setSelectedBatch} />
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader
            title="2. Select Lecture"
            action={
              <Button size="sm" className="action-button-compact" onClick={() => setShowNewLecture(true)}>
                <Plus size={14} /> New Lecture
              </Button>
            }
          />
          {lectures.length === 0 ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)]" style={{ padding: '1rem 1.25rem' }}>
              No lectures available. Create a new lecture to continue.
            </p>
          ) : (
            <LectureSelect lectures={lectures} value={selectedLecture} onChange={loadRecords} />
          )}
        </Card>
      )}

      {selectedLecture && (
        <>
          <Card>
            <CardHeader title="3. Upload CSV" />
            <div className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-[var(--radius-md)] file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)] file:text-white hover:file:bg-[var(--primary-light)] file:cursor-pointer"
              />

              {csvFileName && (
                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)]/50 text-sm">
                  <span className="text-[var(--text-primary)] font-medium">{csvFileName}</span>
                  <span className="text-[var(--text-muted)] ml-2">— {csvRows.length} participants parsed</span>
                </div>
              )}

              {lastReport && (lastReport.unmatched.length > 0 || lastReport.tutorsDetected.length > 0 || lastReport.geminiUnavailableReason) && (
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-elevated)]/50 border border-[var(--border)] text-sm">
                  {lastReport.geminiUnavailableReason && (
                    <p className="mb-2 text-xs text-amber-500">
                      AI name matching unavailable — {lastReport.geminiUnavailableReason}
                    </p>
                  )}
                  {lastReport.unmatched.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-500">Needs manual review</p>
                      {lastReport.unmatched.map((u) => (
                        <p key={u.name} className="text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)]">{u.name}</span>
                          <span className="text-[var(--text-muted)]"> — {u.reason}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {lastReport.tutorsDetected.length > 0 && (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Tutor(s) detected (excluded from attendance): {lastReport.tutorsDetected.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {showUploadAction && (
                <Button onClick={handleUploadAndProcess} loading={processing}>
                  <Upload size={16} /> Upload &amp; Process Attendance
                </Button>
              )}

              {processing && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 size={16} className="animate-spin" />
                  Uploading and processing attendance — matching students, calculating status...
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="4. Attendance Records" />
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
          </Card>
        </>
      )}

      <Modal
        open={showNewLecture}
        onClose={() => setShowNewLecture(false)}
        title="New Lecture"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewLecture(false)}>Cancel</Button>
            <Button className="action-button-compact" onClick={handleCreateLecture} disabled={!newLectureDate}>
              Create Lecture
            </Button>
          </>
        }
      >
        <div className="popup-form-spaced">
          <FormField label="Date" required>
            <input type="date" value={newLectureDate} onChange={(e) => setNewLectureDate(e.target.value)} required />
          </FormField>
          <FormField label="Meeting Code">
            <input value={newLectureMeeting} onChange={(e) => setNewLectureMeeting(e.target.value)} placeholder="e.g. meet-xyz" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
