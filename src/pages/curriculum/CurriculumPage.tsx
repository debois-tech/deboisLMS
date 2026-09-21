import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LibraryBig } from 'lucide-react';
import { CurriculumCanvas } from '@/components/curriculum/CurriculumCanvas';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NotFound } from '@/components/ui/NotFound';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useAuth } from '@/lib/context/AuthContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getBatchById, getBatches, getCurriculumOverview } from '@/lib/supabase';
import type { CurriculumOverview } from '@/lib/supabase';
import type { Batch } from '@/lib/types';

/** Admin `/curriculum` and tutor `/tutor/curriculum`: every batch's outline, then one batch's canvas. */
export default function CurriculumPage() {
  const { batchId } = useParams();
  const { isAdmin } = useAuth();
  const role = isAdmin ? 'admin' : 'tutor';
  const base = isAdmin ? '/curriculum' : '/tutor/curriculum';

  return batchId ? <BatchCurriculum batchId={batchId} role={role} base={base} /> : <CurriculumList role={role} base={base} />;
}

function CurriculumList({ role, base }: { role: 'admin' | 'tutor'; base: string }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [overview, setOverview] = useState<CurriculumOverview | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    const [batchRows, summary] = await Promise.all([getBatches(), getCurriculumOverview()]);
    setBatches(batchRows);
    setOverview(summary);
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Curriculum" />
      {batches.length === 0 ? (
        <EmptyState icon={<LibraryBig size={22} />} title="No batches yet" description="A batch's curriculum lives here once the batch exists." />
      ) : (
        <div className="table-block">
          <Table maxHeight="none">
            <THead>
              <TR>
                <TH>Batch</TH>
                <TH>Status</TH>
                <TH>Modules done</TH>
                <TH>Approval</TH>
              </TR>
            </THead>
            <TBody>
              {batches.map((batch) => {
                const progress = overview?.progress.get(batch.id);
                const waiting = overview?.pending.has(batch.id);
                return (
                  <TR key={batch.id}>
                    <TD>
                      <Link to={`${base}/${batch.id}`} className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">
                        {batch.name}
                      </Link>
                    </TD>
                    <TD><StatusPill kind="batch" value={batch.status} /></TD>
                    <TD>{progress ? `${progress.done} of ${progress.total}` : <span className="text-[var(--text-muted)]">No curriculum yet</span>}</TD>
                    <TD>{waiting ? <Badge variant="warning">{role === 'admin' ? 'Needs review' : 'Awaiting approval'}</Badge> : null}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function BatchCurriculum({ batchId, role, base }: { batchId: string; role: 'admin' | 'tutor'; base: string }) {
  const [batch, setBatch] = useState<Batch | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    setBatch((await getBatchById(batchId)) ?? null);
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!batch) return <NotFound label="Batch" />;

  return (
    <div className="page-section">
      <Link to={base} className="mb-4 flex w-fit items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} /> All curricula
      </Link>
      <PageHeader title={batch.name} />
      <CurriculumCanvas batchId={batch.id} batchName={batch.name} role={role} height="calc(100vh - 13rem)" />
    </div>
  );
}
