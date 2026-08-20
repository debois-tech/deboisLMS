import { useState, useRef } from 'react';
import { ClipboardCheck, Upload, Loader2, Plus, AlertTriangle, PenLine } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { LectureSelect } from '@/components/ui/LectureSelect';
import { FormField } from '@/components/ui/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { AttendanceRecordsTable } from '@/components/attendance/AttendanceRecordsTable';
import { ManualAttendance } from '@/components/attendance/ManualAttendance';
import { DEFAULT_LECTURE_MINUTES } from '@/lib/attendance/types';
import { getLecturesByBatch, createLecture } from '@/lib/supabase';
import { getAttendanceByLecture, insertUploadRows, processAttendance, setAttendanceApproved, bulkApproveAttendance, updateLecture } from '@/lib/supabase';
import type { ProcessingReport } from '@/lib/supabase';
import { getBatches } from '@/lib/supabase';
import type { Batch, Lecture, AttendanceRecord } from '@/lib/types';
import { meetingCodesMatch, parseCsv } from '@/lib/utils/csvParser';
import type { CsvRow } from '@/lib/utils/csvParser';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

export default function AttendancePage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvMeetingCode, setCsvMeetingCode] = useState('');
  const [forceUpload, setForceUpload] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showNewLecture, setShowNewLecture] = useState(false);
  const [newLectureDate, setNewLectureDate] = useState('');
  const [newLectureTime, setNewLectureTime] = useState('09:00');
  const [newLectureMeeting, setNewLectureMeeting] = useState('');
  const [newLectureNote, setNewLectureNote] = useState('');
  const [newLectureMode, setNewLectureMode] = useState<'online' | 'offline'>('online');
  const [newLectureDuration, setNewLectureDuration] = useState(DEFAULT_LECTURE_MINUTES);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [lastReport, setLastReport] = useState<ProcessingReport | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    setBatches(await getBatches());
  });

  // Picking a batch resets everything downstream of it, so this runs from the
  // change handler rather than an effect on `selectedBatch`.
  const selectBatch = async (batchId: string) => {
    setSelectedBatch(batchId);
    setSelectedLecture(null);
    setRecords([]);
    resetCsv();
    try {
      setLectures(await getLecturesByBatch(batchId));
    } catch (err) {
      setLectures([]);
      showToast(errorMessage(err, 'Failed to load lectures for this batch'), 'error');
    }
  };

  const loadRecords = async (lecId: string) => {
    setSelectedLecture(lecId);
    setLoadingRecords(true);
    try {
      setRecords(await getAttendanceByLecture(lecId));
    } catch (err) {
      setRecords([]);
      showToast(errorMessage(err, 'Failed to load attendance records'), 'error');
    }
    setLoadingRecords(false);
  };

  const resetCsv = () => {
    setCsvRows([]);
    setCsvFileName('');
    setCsvMeetingCode('');
    setForceUpload(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setForceUpload(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setCsvRows(parsed.rows);
      setCsvMeetingCode(parsed.meetingCode ?? '');
    };
    reader.readAsText(file);
  };

  const lecture = lectures.find((l) => l.id === selectedLecture);

  const meetingCodeMismatch = Boolean(
    csvRows.length > 0 && lecture?.session_type === 'online' && !meetingCodesMatch(lecture.meeting_code, csvMeetingCode),
  );

  // Re-upload guard: the pipeline upserts, so a duplicate would rewrite hand-corrected records. A warning, not a wall.
  const looksAlreadyUploaded = Boolean(
    records.length > 0 &&
    csvRows.length > 0 &&
    csvMeetingCode &&
    lecture?.meeting_code &&
    meetingCodesMatch(lecture.meeting_code, csvMeetingCode),
  );

  // Uploads the CSV into the `uploads` table, then immediately processes it into
  // attendance records and clears the uploads — one action end-to-end for the admin.
  const handleUploadAndProcess = async () => {
    if (!selectedLecture || csvRows.length === 0 || meetingCodeMismatch) return;
    setProcessing(true);
    setLastReport(null);

    try {
      const code = lecture?.meeting_code || csvMeetingCode;
      await insertUploadRows(selectedLecture, code, lecture?.lecture_date, csvRows);
      const report = await processAttendance(selectedLecture);

      // Remember the code the export came with, so the next upload of the same
      // file has something to be recognised against.
      if (lecture?.session_type !== 'online' && !lecture?.meeting_code && csvMeetingCode) {
        await updateLecture(selectedLecture, { meeting_code: csvMeetingCode });
        setLectures(await getLecturesByBatch(selectedBatch!));
      }

      setLastReport(report);
      loadRecords(selectedLecture);
      resetCsv();

      const parts = [`${report.attendanceInserted} attendance records created`];
      if (report.tutorsDetected.length > 0) parts.push(`${report.tutorsDetected.length} tutor(s) detected`);
      if (report.duplicateRowsIgnored > 0) parts.push(`${report.duplicateRowsIgnored} duplicate rows merged`);
      if (report.unmatched.length > 0) parts.push(`${report.unmatched.length} participant(s) need review`);
      showToast(parts.join(' · '), report.unmatched.length > 0 ? 'warning' : 'success');
    } catch (err) {
      showToast(errorMessage(err, 'Attendance upload failed'), 'error');
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
    } catch (error) {
      showToast(errorMessage(error, 'Failed to approve records'), 'error');
    }
  };

  const handleCreateLecture = async () => {
    if (!selectedBatch || !newLectureDate) return;
    try {
      const start = new Date(`${newLectureDate}T${newLectureTime}:00`);
      const end = new Date(start.getTime() + newLectureDuration * 60_000);
      await createLecture({
        batch_id: selectedBatch,
        lecture_date: newLectureDate,
        meeting_code: newLectureMeeting || undefined,
        note: newLectureNote || undefined,
        session_type: newLectureMode,
        scheduled_duration_minutes: newLectureDuration,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      });
      setShowNewLecture(false);
      setNewLectureDate('');
      setNewLectureTime('09:00');
      setNewLectureMeeting('');
      setNewLectureNote('');
      setNewLectureMode('online');
      setNewLectureDuration(DEFAULT_LECTURE_MINUTES);
      setLectures(await getLecturesByBatch(selectedBatch));
      showToast('Lecture created');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to create lecture'), 'error');
    }
  };

  const showUploadAction = csvRows.length > 0 && selectedLecture && !processing;

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Attendance" />

      <Card className="step-card">
        <CardHeader title="Select Batch" />
        <BatchSelect batches={batches} value={selectedBatch} onChange={selectBatch} />
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader
            title="Select lecture"
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
            <CardHeader title="Upload CSV" />
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
                      AI matching unavailable — {lastReport.geminiUnavailableReason}
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
                      Tutors excluded: {lastReport.tutorsDetected.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {looksAlreadyUploaded && (
                <div className="repo-notice is-warning">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>
                    This lecture already has attendance from meeting code{' '}
                    <strong>{lecture?.meeting_code}</strong>, and this file carries the same one —
                    it looks like it has been uploaded already. Re-processing overwrites records,
                    including any you have corrected by hand.
                  </span>
                </div>
              )}

              {meetingCodeMismatch && (
                <div className="repo-notice is-warning">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>
                    Meet code mismatch. Lecture: <strong>{lecture?.meeting_code || 'missing'}</strong> · CSV: <strong>{csvMeetingCode || 'missing'}</strong>
                  </span>
                </div>
              )}

              {showUploadAction && (
                meetingCodeMismatch ? null : looksAlreadyUploaded && !forceUpload ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setForceUpload(true)}>
                      Upload anyway
                    </Button>
                    <Button variant="ghost" onClick={resetCsv}>Choose another file</Button>
                  </div>
                ) : (
                  <Button onClick={handleUploadAndProcess} loading={processing}>
                    <Upload size={16} /> Upload &amp; Process Attendance
                  </Button>
                )
              )}

              {processing && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 size={16} className="animate-spin" />
                  Processing attendance — matching students and calculating status...
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Attendance records"
              action={
                <Button size="sm" variant="secondary" className="action-button-compact" onClick={() => setShowManual(true)}>
                  <PenLine size={14} /> Mark manually
                </Button>
              }
            />
            {loadingRecords ? (
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
        open={showManual}
        onClose={() => setShowManual(false)}
        title="Mark attendance"
        description={lecture ? `${formatDate(lecture.lecture_date)}${lecture.meeting_code ? ` · ${lecture.meeting_code}` : ''}` : undefined}
        size="xl"
      >
        {selectedLecture && selectedBatch && (
          <ManualAttendance
            key={selectedLecture}
            lectureId={selectedLecture}
            batchId={selectedBatch}
            scheduledMinutes={lecture?.scheduled_duration_minutes ?? undefined}
            onChanged={() => loadRecords(selectedLecture)}
          />
        )}
      </Modal>

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
            <DatePicker
              value={newLectureDate}
              onChange={setNewLectureDate}
              placeholder="Pick a date"
              ariaLabel="Lecture date"
            />
          </FormField>
          <FormField label="Meeting Code">
            <input value={newLectureMeeting} onChange={(e) => setNewLectureMeeting(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mode" required>
              <SearchSelect options={[{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }]} value={newLectureMode} onChange={(value) => setNewLectureMode(value as typeof newLectureMode)} placeholder="Select mode" searchPlaceholder="Search modes" emptyText="No modes found" showSearch={false} />
            </FormField>
            <FormField label="Start time" required><input type="time" value={newLectureTime} onChange={(e) => setNewLectureTime(e.target.value)} /></FormField>
          </div>
          <FormField label="Duration (minutes)" required><input type="number" min="1" value={newLectureDuration} onChange={(e) => setNewLectureDuration(Number(e.target.value))} /></FormField>
          <FormField label="Note"><input value={newLectureNote} onChange={(e) => setNewLectureNote(e.target.value)} /></FormField>
        </div>
      </Modal>
    </div>
  );
}
