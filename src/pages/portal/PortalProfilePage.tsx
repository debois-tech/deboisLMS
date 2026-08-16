import { useState } from 'react';
import { PartyPopper, UserPlus, Wallet } from 'lucide-react';
import {
  PortalAmount,
  PortalEmpty,
  PortalFacts,
  PortalIdentity,
  PortalList,
  PortalPage,
  PortalRow,
  PortalSection,
  PortalStatus,
  usePortalStudentId,
} from '@/components/portal';
import {
  getBatchById,
  getFeePaymentLogsByStudent,
  getMyFeeDues,
  getStudentBatches,
  getStudentById,
} from '@/lib/supabase';
import type { Batch, BatchStudentMapping, FeePaymentLog, Student, StudentFeeDue } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { formatCurrency, formatDate } from '@/lib/utils/format';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  other: 'Payment',
};

/**
 * Everything the portal holds about the student themselves — who they are and
 * what they owe, on one page and read-only. Fees live here rather than on their
 * own screen: a balance is a fact about a person, not a section of the product.
 *
 * Reads `student_fee_dues`, so total_fee never reaches the browser.
 */
export default function PortalProfilePage() {
  const studentId = usePortalStudentId();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<StudentFeeDue[]>([]);
  const [payments, setPayments] = useState<FeePaymentLog[]>([]);
  const [enrollments, setEnrollments] = useState<(BatchStudentMapping & { batch?: Batch })[]>([]);
  const [batchNames, setBatchNames] = useState<Map<string, string>>(new Map());

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;

    const [record, mappings, feeRows, paymentRows] = await Promise.all([
      getStudentById(studentId),
      getStudentBatches(studentId),
      getMyFeeDues(),
      getFeePaymentLogsByStudent(studentId),
    ]);

    // Enrolments already carry their batch, so only a batch named by a fee or a
    // payment and nothing else — a batch since dropped — needs fetching.
    const names = new Map(mappings.map((m) => [m.batch_id, m.batch?.name ?? 'Batch']));
    const unknownIds = [...new Set([...feeRows, ...paymentRows].map((row) => row.batch_id))]
      .filter((id) => !names.has(id));
    const fetched = await Promise.all(unknownIds.map((id) => getBatchById(id)));
    unknownIds.forEach((id, index) => names.set(id, fetched[index]?.name ?? 'Batch'));

    setStudent(record ?? null);
    setEnrollments(mappings);
    setFees(feeRows);
    setPayments(paymentRows);
    setBatchNames(names);
  });

  const outstanding = fees.reduce((sum, fee) => sum + Math.max(0, Number(fee.amount_due)), 0);
  const owing = fees.filter((fee) => Number(fee.amount_due) > 0).length;
  const name = student?.name ?? user?.full_name ?? '';

  const links = [
    { label: 'GitHub', href: student?.github_url },
    { label: 'LinkedIn', href: student?.linkedin_url },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));

  // Multiple active batches are possible; the most recently joined one is "current".
  const current = enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0];

  // Built here rather than inline so the empty case can be told apart from a
  // list that simply has few rows. The batch leads: of everything on this page it
  // is the fact a student is most likely to have come to check.
  const facts = [
    { label: 'Batch', value: current?.batch?.name ?? '' },
    { label: 'Enrolled', value: current ? formatDate(current.joined_at) : '' },
    { label: 'Date of birth', value: student?.date_of_birth ? formatDate(student.date_of_birth) : '' },
    { label: 'Gender', value: student?.gender ?? '' },
    { label: 'College', value: student?.college ?? '' },
    { label: 'Course', value: student?.course ?? '' },
    { label: 'Branch', value: student?.branch ?? '' },
    { label: 'Year', value: student?.current_year ?? '' },
    { label: 'Graduating', value: student?.graduation_year ? String(student.graduation_year) : '' },
  ].filter((fact) => fact.value);

  return (
    <PortalPage title="Your profile" loading={loading} error={error} onRetry={retry} shape="list">
      {!studentId ? (
        <PortalEmpty icon={UserPlus}>Student record not linked.</PortalEmpty>
      ) : (
        <>
          <PortalIdentity
            name={name}
            code={student?.student_code}
            contact={[student?.email, student?.phone].filter(Boolean).join(' · ')}
            links={links}
          />

          <PortalSection title="About you">
            {facts.length === 0 ? (
              <PortalEmpty icon={UserPlus}>Nothing recorded yet.</PortalEmpty>
            ) : (
              <PortalFacts facts={facts} />
            )}
          </PortalSection>

          {/* Only the balance is ever spelled out. What the student was charged,
              and what has been paid against it, stay in the database. Home no
              longer carries this figure, so it gets the weight here. */}
          <PortalSection title="Fees">
            {fees.length === 0 ? (
              <PortalEmpty icon={Wallet}>No fee set yet.</PortalEmpty>
            ) : (
              <PortalList
                head={
                  <PortalAmount
                    value={outstanding > 0 ? `${formatCurrency(outstanding)} to pay` : 'Nothing to pay'}
                    tone={outstanding > 0 ? 'attention' : 'positive'}
                    // Only when the figure needs it. One batch is named by the row
                    // below, and "Nothing to pay" already says everything.
                    note={owing > 1 ? `Across ${owing} batches` : undefined}
                  />
                }
              >
                {fees.map((fee) => {
                  const due = Number(fee.amount_due);
                  return (
                    <PortalRow
                      key={fee.id}
                      primary={batchNames.get(fee.batch_id) ?? 'Batch'}
                      secondary={due > 0 ? `${formatCurrency(due)} pending` : undefined}
                      muted={due <= 0}
                      trailing={<PortalStatus kind="fee" value={due > 0 ? 'due' : 'paid'} />}
                    />
                  );
                })}
              </PortalList>
            )}
          </PortalSection>

          {/* Answers "did my payment land?". The note is what the office wrote on
              the payment — a student reading "Registration fee" knows which one
              this is, where the amount and method alone left them guessing. */}
          <PortalSection title="Your payments">
            {payments.length === 0 ? (
              <PortalEmpty icon={outstanding > 0 ? Wallet : PartyPopper}>No payments recorded yet.</PortalEmpty>
            ) : (
              <PortalList>
                {payments.map((payment) => (
                  <PortalRow
                    key={payment.id}
                    primary={formatCurrency(Number(payment.amount))}
                    secondary={[
                      payment.notes,
                      METHOD_LABELS[payment.payment_method ?? 'other'] ?? 'Payment',
                      batchNames.get(payment.batch_id) ?? 'Batch',
                    ].filter(Boolean).join(' · ')}
                    trailing={<span className="portal-row-meta">{formatDate(payment.payment_date)}</span>}
                  />
                ))}
              </PortalList>
            )}
          </PortalSection>
        </>
      )}
    </PortalPage>
  );
}
