import { useState, useRef } from 'react';
import { ClipboardCheck, Upload, Loader2, Plus, PenLine, Download, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInFlight, useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { Modal } from '@/components/ui/Modal';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { LectureSelect } from '@/components/ui/LectureSelect';
import { FormField } from '@/components/ui/FormField';
import { FieldNotice } from '@/components/ui/FieldNotice';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { AttendanceRecordsTable } from '@/components/attendance/AttendanceRecordsTable';
import { ManualAttendance } from '@/components/attendance/ManualAttendance';
import { DEFAULT_LECTURE_MINUTES } from '@/lib/attendance/types';
import { exportBatchAttendanceCsv } from '@/lib/attendance/exportCsv';
import { clearUploads, createLecture, deleteLecture, getAttendanceByLecture, getBatches, getBatchTutors, getLecturesByBatch, insertUploadRows, processAttendance } from '@/lib/supabase';
import type { ProcessingReport } from '@/lib/supabase';
import type { Batch, Lecture, AttendanceRecord, Tutor } from '@/lib/types';
import { parseCsv } from '@/lib/utils/csvParser';
import type { CsvRow } from '@/lib/utils/csvParser';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useAuth } from '@/lib/context/AuthContext';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

export default function AttendancePage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showNewLecture, setShowNewLecture] = useState(false);
  const [newLectureDate, setNewLectureDate] = useState('');
  const [newLectureTime, setNewLectureTime] = useState('09:00');
  const [batchTutors, setBatchTutors] = useState<Tutor[]>([]);
  const [newLectureTutor, setNewLectureTutor] = useState('');
  const [newLectureNote, setNewLectureNote] = useState('');
  const [newLectureMode, setNewLectureMode] = useState<'online' | 'offline'>('online');
  const [newLectureDuration, setNewLectureDuration] = useState(DEFAULT_LECTURE_MINUTES);
  const [exporting, setExporting] = useState(false);
  // Keys: 'upload' and 'create'.
  const { busy, begin, finish } = useInFlight();
  const processing = busy.has('upload');
  const creatingLecture = busy.has('create');
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

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
      setBatchTutors(await getBatchTutors(batchId));
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

  // A queued file belongs to the lecture it was chosen for, so picking another one drops it.
  const selectLecture = (lecId: string) => {
    if (lecId !== selectedLecture) {
      resetCsv();
      setLastReport(null);
    }
    return loadRecords(lecId);
  };

  const resetCsv = () => {
    setCsvRows([]);
    setCsvFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const readCsv = (file: File | undefined) => {
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setCsvRows(parsed.rows);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => readCsv(e.target.files?.[0]);

  const openImport = () => {
    resetCsv();
    setLastReport(null);
    setShowImport(true);
  };

  const closeImport = () => {
    if (processing) return;
    setShowImport(false);
    resetCsv();
    setLastReport(null);
  };

  const lecture = lectures.find((l) => l.id === selectedLecture);

  // Uploads the CSV into the `uploads` table, then immediately processes it into
  // attendance records and clears the uploads — one action end-to-end for the admin.
  const handleUploadAndProcess = async () => {
    if (!selectedLecture || csvRows.length === 0 || !begin('upload')) return;
    setLastReport(null);

    try {
      // Anything still in `uploads` is left over from a run that failed; a clean run clears it.
      await clearUploads(selectedLecture);
      await insertUploadRows(selectedLecture, lecture?.lecture_date, csvRows);
      const report = await processAttendance(selectedLecture);

      setLastReport(report);
      loadRecords(selectedLecture);
      resetCsv();

      const parts = [`${report.attendanceInserted} attendance records created`];
      if (report.tutorsDetected.length > 0) parts.push(`${report.tutorsDetected.length} tutor(s) detected`);
      if (report.duplicateRowsIgnored > 0) parts.push(`${report.duplicateRowsIgnored} duplicate rows merged`);
      if (report.existingKept > 0) parts.push(`${report.existingKept} manual record(s) kept`);
      if (report.unmatched.length > 0) parts.push(`${report.unmatched.length} unmatched name(s)`);
      showToast(parts.join(' · '), report.unmatched.length > 0 ? 'warning' : 'success');
    } catch (err) {
      // Don't leave this file's rows behind to be processed with the next upload.
      await clearUploads(selectedLecture).catch(() => undefined);
      showToast(errorMessage(err, 'Attendance upload failed'), 'error');
    }
    finish('upload');
  };

  // The tutor taking a new lecture: you, if you are one of the batch's tutors, else the first.
  const defaultTutor = batchTutors.find((t) => t.id === user?.tutor_id)?.id ?? batchTutors[0]?.id ?? '';

  // Present or partial, out of the students who applied (N/A rows left out).
  const applicable = records.filter((r) => r.status !== 'no_appli').length;
  const attended = records.filter((r) => r.status === 'present' || r.status === 'partial').length;

  const handleDeleteLecture = async () => {
    if (!selectedLecture || !lecture) return;
    const accepted = await confirm({
      title: `Delete the lecture on ${formatDate(lecture.lecture_date)}?`,
      message: 'Attendance for this lecture is also deleted. This cannot be undone.',
      confirmLabel: 'Delete lecture',
      danger: true,
    });
    if (!accepted) return;
    try {
      await deleteLecture(selectedLecture);
      setSelectedLecture(null);
      setRecords([]);
      resetCsv();
      setLectures(await getLecturesByBatch(selectedBatch!));
      showToast('Lecture deleted');
    } catch (err) {
      showToast(errorMessage(err, 'Failed to delete lecture'), 'error');
    }
  };

  const handleCreateLecture = async () => {
    if (!selectedBatch || !newLectureDate || !begin('create')) return;
    try {
      const start = new Date(`${newLectureDate}T${newLectureTime}:00`);
      const end = new Date(start.getTime() + newLectureDuration * 60_000);
      await createLecture({
        batch_id: selectedBatch,
        lecture_date: newLectureDate,
        tutor_id: newLectureTutor || defaultTutor || null,
        note: newLectureNote || undefined,
        session_type: newLectureMode,
        scheduled_duration_minutes: newLectureDuration,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      });
      setShowNewLecture(false);
      setNewLectureDate('');
      setNewLectureTime('09:00');
      setNewLectureTutor('');
      setNewLectureNote('');
      setNewLectureMode('online');
      setNewLectureDuration(DEFAULT_LECTURE_MINUTES);
      setLectures(await getLecturesByBatch(selectedBatch));
      showToast('Lecture created');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to create lecture'), 'error');
    } finally {
      finish('create');
    }
  };

  const handleExportCsv = async () => {
    if (!selectedBatch) return;
    const batchName = batches.find((b) => b.id === selectedBatch)?.name ?? 'batch';
    setExporting(true);
    try {
      await exportBatchAttendanceCsv(selectedBatch, batchName);
    } catch (err) {
      showToast(errorMessage(err, 'Could not export attendance'), 'error');
    }
    setExporting(false);
  };

  const showUploadAction = csvRows.length > 0 && selectedLecture && !processing;

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Attendance" />

      <Card className="step-card sticky top-[calc(var(--navbar-h)_+_1rem)] z-20">
        <CardHeader
          title="Select batch & lecture"
          action={selectedBatch && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="action-button-compact"
                onClick={handleExportCsv}
                loading={exporting}
              >
                <Download size={14} /> Export
              </Button>
              <Button size="sm" className="action-button-compact" onClick={() => setShowNewLecture(true)}>
                <Plus size={14} /> New
              </Button>
              {selectedLecture && (
                <Button size="sm" variant="secondary" className="action-button-icon action-button-danger" onClick={() => void handleDeleteLecture()} aria-label="Delete this lecture" title="Delete this lecture">
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Batch">
            <BatchSelect batches={batches} value={selectedBatch} onChange={selectBatch} />
          </FormField>
          <FormField label="Lecture">
            {!selectedBatch ? (
              <FieldNotice>Select a batch first</FieldNotice>
            ) : lectures.length === 0 ? (
              <FieldNotice>No lectures yet — create one</FieldNotice>
            ) : (
              <LectureSelect lectures={lectures} value={selectedLecture} onChange={selectLecture} />
            )}
          </FormField>
        </div>
      </Card>

      {selectedLecture && (
        <>
          <Card>
            <CardHeader
              title="Attendance records"
              titleAdornment={records.length > 0 && <Badge variant="info">{attended}/{applicable} attended</Badge>}
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="action-button-compact" onClick={openImport}>
                    <Upload size={14} /> CSV
                  </Button>
                  <Button size="sm" variant="secondary" className="action-button-compact" onClick={() => setShowManual(true)}>
                    <PenLine size={14} /> Mark manually
                  </Button>
                </div>
              }
            />
            {loadingRecords ? (
              <Spinner />
            ) : records.length === 0 ? (
              <EmptyState icon={<ClipboardCheck size={32} />} title="No attendance records" />
            ) : (
              <AttendanceRecordsTable records={records} maxHeight="none" />
            )}
          </Card>
        </>
      )}

      <Modal
        open={showImport}
        onClose={closeImport}
        title="Import attendance CSV"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeImport} disabled={processing}>{lastReport && csvRows.length === 0 ? 'Done' : 'Cancel'}</Button>
            {showUploadAction && (
              <Button className="action-button-compact" onClick={handleUploadAndProcess} loading={processing}>
                <Upload size={16} /> Upload &amp; Process
              </Button>
            )}
          </>
        }
      >
        {lastReport && csvRows.length === 0 ? (
          <div className="flex flex-col gap-3 text-sm text-[var(--text-secondary)]">
            <p>
              {lastReport.attendanceInserted} attendance records created
              {lastReport.duplicateRowsIgnored > 0 ? ` · ${lastReport.duplicateRowsIgnored} duplicate rows merged` : ''}
              {lastReport.existingKept > 0 ? ` · ${lastReport.existingKept} manual records kept` : ''}
            </p>
            {lastReport.unmatched.length > 0 && (
              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-elevated)]/50 border border-[var(--border)] space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-500">Unmatched names</p>
                {lastReport.unmatched.map((u) => (
                  <p key={u.name}>
                    <span className="font-semibold text-[var(--text-primary)]">{u.name}</span>
                    <span className="text-[var(--text-muted)]"> — {u.reason}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <label
              className={`csv-drop ${dragging ? 'is-over' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); readCsv(event.dataTransfer.files[0]); }}
            >
              <Upload size={22} aria-hidden="true" />
              <span>{csvFileName ? csvFileName : 'Drop the CSV here, or choose a file'}</span>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" disabled={processing} />
            </label>

            {csvRows.length > 0 && (
              <>
                <p className="text-sm text-[var(--text-muted)]">{csvRows.length} participants found</p>
                <Table maxHeight="16rem" className="data-table-compact">
                  <THead>
                    <TR>
                      <TH>Participant</TH>
                      <TH>Attended</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {csvRows.map((row) => (
                      <TR key={row.sno}>
                        <TD className="font-medium text-[var(--text-primary)]">{row.participant_name_raw}</TD>
                        <TD className="cell-secondary">{row.attended_minutes != null ? `${row.attended_minutes} min` : row.attended_duration_raw || '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </>
            )}

            {processing && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Loader2 size={16} className="animate-spin" />
                Processing attendance — matching students and calculating status...
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showManual}
        onClose={() => setShowManual(false)}
        title="Mark attendance"
        description={lecture ? `${formatDate(lecture.lecture_date)}${lecture.tutor ? ` · ${lecture.tutor.name}` : ''}` : undefined}
        size="xl"
      >
        {selectedLecture && selectedBatch && (
          <ManualAttendance
            key={selectedLecture}
            lectureId={selectedLecture}
            batchId={selectedBatch}
            scheduledMinutes={lecture?.scheduled_duration_minutes ?? undefined}
            onSaved={() => { setShowManual(false); void loadRecords(selectedLecture); }}
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
            <Button className="action-button-compact" onClick={handleCreateLecture} disabled={!newLectureDate} loading={creatingLecture}>
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
          <FormField label="Tutor" required>
            <SearchSelect
              options={batchTutors.map((tutor) => ({ value: tutor.id, label: tutor.name }))}
              value={newLectureTutor || defaultTutor || null}
              onChange={setNewLectureTutor}
              placeholder="Select a tutor"
              searchPlaceholder="Search tutors"
              emptyText="No tutors assigned to this batch"
              showSearch={batchTutors.length > 6}
            />
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
