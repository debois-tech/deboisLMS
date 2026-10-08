import { LibraryBig } from 'lucide-react';
import { PortalEmpty, PortalPage } from '@/components/portal';
import { CurriculumCanvas } from '@/components/curriculum/CurriculumCanvas';
import { usePortalBatch } from '@/lib/context/PortalBatchContext';

export default function PortalCurriculumPage() {
  const batch = usePortalBatch().current?.batch;

  return (
    <PortalPage title="Your course outline">
      {batch ? (
        <CurriculumCanvas batchId={batch.id} batchName={batch.name} role="student" height="calc(100vh - 12rem)" />
      ) : (
        <PortalEmpty icon={LibraryBig}>You are not in a batch yet.</PortalEmpty>
      )}
    </PortalPage>
  );
}
