import { useState, useEffect, useRef } from 'react';
import { ClipboardCheck, Upload, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { LectureSelect } from '@/components/ui/LectureSelect';
import { getLecturesByBatch, createLecture } from '@/lib/supabase';
import { getAttendanceByLecture, insertUploadRows, processAttendance, approveAttendance, bulkApproveAttendance } from '@/lib/supabase';
import { getBatches } from '@/lib/supabase';
import type { Batch, Lecture, AttendanceRecord } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';
import { parseCsv } from '@/lib/utils/csvParser';
import type { CsvRow } from '@/lib/utils/csvParser';

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
  const [uploading, setUploading] = useState(false);
  const [showNewLecture, setShowNewLecture] = useState(false);
  const [newLectureDate, setNewLectureDate] = useState('');
  const [newLectureMeeting, setNewLectureMeeting] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    setStatusMessage(null);
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
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setCsvRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!selectedLecture || csvRows.length === 0) return;
    setUploading(true);
    setStatusMessage(null);

    try {
      const lecture = lectures.find((l) => l.id === selectedLecture);
      await insertUploadRows(selectedLecture, lecture?.meeting_code ?? '', csvRows);
      setStatusMessage({ type: 'success', text: `${csvRows.length} rows uploaded successfully` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message ?? 'Upload failed' });
    }
    setUploading(false);
  };

  const handleConvert = async () => {
    if (!selectedLecture || !selectedBatch) return;
    setProcessing(true);
    setStatusMessage(null);

    try {
      const result = await processAttendance(selectedLecture, selectedBatch);
      setRecords(result);
      setCsvRows([]);
      setCsvFileName('');
      if (fileRef.current) fileRef.current.value = '';
      setStatusMessage({ type: 'success', text: `Converted — ${result.length} attendance records created` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message ?? 'Conversion failed' });
    }
    setProcessing(false);
  };

  const handleApprove = async (id: string) => {
    await approveAttendance(id);
    if (selectedLecture) loadRecords(selectedLecture);
  };

  const handleBulkApprove = async () => {
    if (!selectedLecture) return;
    await bulkApproveAttendance(selectedLecture);
    loadRecords(selectedLecture);
  };

  const handleCreateLecture = async () => {
    if (!selectedBatch || !newLectureDate) return;
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
  };

  const hasUploaded = csvRows.length === 0 && selectedLecture && records.length === 0;
  const hasConverted = records.length > 0;
  const showUploadAction = csvRows.length > 0 && selectedLecture && !uploading && !processing;

  return (
    <div className="page-section">
      <PageHeader
        title="Attendance"
      />

      <Card>
        <CardHeader title="1. Select Batch" />
        <BatchSelect batches={batches} value={selectedBatch} onChange={setSelectedBatch} />
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader
            title="2. Select Lecture"
            action={
              <Button size="sm" className="action-button" variant="ghost" onClick={() => setShowNewLecture(true)}>
                + New Lecture
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

              {statusMessage && (
                <div className={`p-3 rounded-[var(--radius-md)] text-sm ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {statusMessage.text}
                </div>
              )}

              {showUploadAction && (
                <div className="flex gap-3">
                  <Button onClick={handleUpload} loading={uploading}>
                    <Upload size={16} /> Upload to Database
                  </Button>
                  <Button onClick={handleConvert} loading={processing} variant="secondary">
                    <Loader2 size={16} /> Convert & Show
                  </Button>
                </div>
              )}

              {(uploading || processing) && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 size={16} className="animate-spin" />
                  {uploading ? 'Uploading CSV data...' : 'Processing attendance — matching students, calculating status...'}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="4. Attendance Records"
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
              <EmptyState icon={<ClipboardCheck size={32} />} title="No attendance records" description="Upload a CSV and click Convert & Show to generate records" />
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)]/50">
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
                          <CheckCircle size={18} />
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> Approved</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={showNewLecture} onClose={() => setShowNewLecture(false)} title="New Lecture">
        <div className="space-y-4">
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Date *</label>
            <input type="date" value={newLectureDate} onChange={(e) => setNewLectureDate(e.target.value)} required />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Meeting Code</label>
            <input value={newLectureMeeting} onChange={(e) => setNewLectureMeeting(e.target.value)} placeholder="e.g. meet-xyz" />
          </div>
          <Button onClick={handleCreateLecture}>Create Lecture</Button>
        </div>
      </Modal>
    </div>
  );
}
