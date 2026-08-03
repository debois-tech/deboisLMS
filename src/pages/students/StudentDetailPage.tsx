import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Layers, CalendarDays, Wallet, Clock, History, KeyRound } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentLoginCard } from '@/components/students/StudentLoginCard';
import { getStudentById, getStudentBatches, getBatchById, getFeesByStudent, getLecturesByBatch, getFeePaymentLogsByStudent } from '@/lib/supabase';
import type { Student, BatchStudentMapping, Batch, StudentFee, Lecture, FeePaymentLog } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils/format';

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [batchMappings, setBatchMappings] = useState<(BatchStudentMapping & { batch?: Batch })[]>([]);
  const [currentFee, setCurrentFee] = useState<StudentFee | null>(null);
  const [nextLecture, setNextLecture] = useState<Lecture | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    Promise.all([getStudentById(studentId), getStudentBatches(studentId), getFeePaymentLogsByStudent(studentId)]).then(
      async ([s, mappings, logs]) => {
        setStudent(s ?? null);
        setPaymentLogs(logs);
        const withBatches = await Promise.all(
          mappings.map(async (m) => {
            const batch = await getBatchById(m.batch_id);
            return { ...m, batch };
          })
        );
        setBatchMappings(withBatches);

        // Multiple active batches are possible; the most recently joined one is treated as "current".
        const activeMappings = withBatches.filter((m) => m.status === 'active');
        const currentMapping = activeMappings.sort(
          (a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
        )[0];

        if (currentMapping) {
          const [fees, lectures] = await Promise.all([
            getFeesByStudent(studentId),
            getLecturesByBatch(currentMapping.batch_id),
          ]);
          setCurrentFee(fees.find((f) => f.batch_id === currentMapping.batch_id) ?? null);

          const today = new Date().toISOString().slice(0, 10);
          const upcoming = lectures
            .filter((l) => l.lecture_date.slice(0, 10) >= today)
            .sort((a, b) => a.lecture_date.localeCompare(b.lecture_date))[0];
          setNextLecture(upcoming ?? null);
        }

        setLoading(false);
      }
    );
  }, [studentId]);

  if (loading) return <Spinner centered />;
  if (!student) return <NotFound label="Student" />;

  const activeMappings = batchMappings.filter((m) => m.status === 'active');
  const currentBatch = activeMappings.sort(
    (a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
  )[0]?.batch;

  const batchNameById = new Map(batchMappings.map((m) => [m.batch_id, m.batch?.name ?? m.batch_id]));

  return (
    <div className="page-section">
      <Link to="/students" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 w-fit">
        <ArrowLeft size={14} /> Back to Students
      </Link>

      <Card padding="lg">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary)]/10 text-xl font-bold text-[var(--primary)]">
            {student.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] break-words">{student.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
              {student.email && <span className="flex min-w-0 items-center gap-2"><Mail size={15} className="shrink-0 text-[var(--primary)]" /> <span className="break-all">{student.email}</span></span>}
              {student.email && student.phone && <span className="text-[var(--border-strong)]">|</span>}
              {student.phone && <span className="flex items-center gap-1"><Phone size={14} className="shrink-0" /> {student.phone}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:ml-auto">
              {student.github_url && (
                <a href={student.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-[var(--radius-md)] bg-[#24292f] text-sm font-semibold text-white transition-colors hover:bg-[#3b434b]" style={{ padding: '1rem 2rem' }}>
                  GitHub
                </a>
              )}
              {student.linkedin_url && (
                <a href={student.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-[var(--radius-md)] bg-[#0a66c2] text-sm font-semibold text-white transition-colors hover:bg-[#0b78df]" style={{ padding: '1rem 2rem' }}>
                  LinkedIn
                </a>
              )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card padding="sm">
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Layers size={13} /> Current Batch</p>
          {currentBatch ? (
            <Link to={`/batches/${currentBatch.id}`} className="mt-3 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)] hover:underline">
              {currentBatch.name}
            </Link>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Not enrolled in any batch</p>
          )}
        </Card>
        <Card padding="sm">
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Wallet size={13} /> Total Payment</p>
          {currentBatch && currentFee ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(currentFee.paid_amount)} <span className="text-sm font-normal text-[var(--text-muted)]">/ {formatCurrency(currentFee.total_fee)}</span></p>
              <p className={`shrink-0 text-xs font-semibold ${currentFee.total_fee - currentFee.paid_amount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {currentFee.total_fee - currentFee.paid_amount > 0 ? `${formatCurrency(currentFee.total_fee - currentFee.paid_amount)} due` : 'Paid in full'}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">—</p>
          )}
        </Card>
        <Card padding="sm">
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Clock size={13} /> Next Lecture</p>
          {currentBatch && nextLecture ? (
            <div className="mt-3">
              <p className="text-lg font-bold text-[var(--text-primary)]">{formatDate(nextLecture.lecture_date)}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {nextLecture.session_type}{nextLecture.meeting_code ? ` • ${nextLecture.meeting_code}` : ''}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">{currentBatch ? 'Caught up with all lectures' : '—'}</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Portal Login"
          action={<KeyRound size={18} className="text-[var(--text-muted)]" />}
        />
        <StudentLoginCard
          studentId={student.id}
          hasEmail={Boolean(student.email)}
          hasLogin={Boolean(student.auth_user_id)}
          onCreated={() => getStudentById(student.id).then((s) => setStudent(s ?? student))}
        />
      </Card>

      <Card>
        <CardHeader title="Batch History" />
        {batchMappings.length === 0 ? (
          <EmptyState icon={<Layers size={32} />} title="Not enrolled in any batches" />
        ) : (
          <div className="batch-list">
            {batchMappings.map((m) => (
              <Link
                key={m.id}
                to={`/batches/${m.batch_id}`}
                className="batch-list-item flex items-center justify-between gap-4 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Layers size={18} className="shrink-0 text-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{m.batch?.name ?? m.batch_id}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]"><CalendarDays size={12} /> Joined {formatDate(m.joined_at)}</p>
                  </div>
                </div>
                <Badge size="lg" variant={m.status === 'active' ? 'success' : 'danger'} dot>{m.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Payment Logs" />
        {paymentLogs.length === 0 ? (
          <EmptyState icon={<History size={32} />} title="No payment logs yet" />
        ) : (
          <Table maxHeight="24rem">
            <THead>
              <TR>
                <TH>Amount</TH>
                <TH>Date</TH>
                <TH>Batch</TH>
                <TH>Method</TH>
                <TH>Notes</TH>
              </TR>
            </THead>
            <TBody>
              {paymentLogs.map((log) => (
                <TR key={log.id}>
                  <TD className="font-semibold text-emerald-400">{formatCurrency(Number(log.amount))}</TD>
                  <TD className="cell-secondary">{log.payment_date}</TD>
                  <TD className="cell-secondary">{batchNameById.get(log.batch_id) ?? log.batch_id}</TD>
                  <TD className="cell-muted capitalize">{(log.payment_method ?? '—').replace('_', ' ')}</TD>
                  <TD className="cell-muted">{log.notes || '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
