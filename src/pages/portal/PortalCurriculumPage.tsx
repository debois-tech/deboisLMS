import { useState } from 'react';
import { LibraryBig } from 'lucide-react';
import { PortalEmpty, PortalPage, usePortalStudentId } from '@/components/portal';
import { CurriculumCanvas } from '@/components/curriculum/CurriculumCanvas';
import { getStudentBatches } from '@/lib/supabase';
import type { Batch } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';

export default function PortalCurriculumPage() {
  const studentId = usePortalStudentId();
  const [batch, setBatch] = useState<Batch | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;
    // Several active batches are possible; the most recently joined is "current", as on Home.
    const current = (await getStudentBatches(studentId))
      .filter((enrollment) => enrollment.status === 'active')
      .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0]?.batch;
    setBatch(current ?? null);
  }, true);

  return (
    <PortalPage title="Your course outline" loading={loading} error={error} onRetry={retry}>
      {batch ? (
        <CurriculumCanvas batchId={batch.id} batchName={batch.name} role="student" height="calc(100vh - 12rem)" />
      ) : (
        <PortalEmpty icon={LibraryBig}>You are not in a batch yet.</PortalEmpty>
      )}
    </PortalPage>
  );
}
