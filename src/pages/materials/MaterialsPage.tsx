import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { BatchMaterials } from '@/components/materials/BatchMaterials';
import { getBatches } from '@/lib/supabase';
import type { Batch } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';

/** Sentinel for the "not tied to a batch" option in the batch picker. */
const ALL_STUDENTS = '__all__';

export default function MaterialsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [audience, setAudience] = useState<string | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    setBatches(await getBatches());
  });

  const selectedBatch = batches.find((batch) => batch.id === audience);
  const isEveryone = audience === ALL_STUDENTS;

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Study Material" />

      <Card className="step-card">
        <CardHeader title="Select Batch" />
        <BatchSelect
          batches={batches}
          value={audience}
          onChange={setAudience}
          placeholder="Select a Batch"
          extraOptions={[{ id: ALL_STUDENTS, name: 'All students' }]}
        />
      </Card>

      {audience && (
        <BatchMaterials
          // Remounts on a batch switch, so no state carries across audiences.
          key={audience}
          batchId={isEveryone ? null : audience}
          batchCode={selectedBatch?.batch_code}
          title={isEveryone ? 'Material for all students' : 'Study material'}
        />
      )}
    </div>
  );
}
