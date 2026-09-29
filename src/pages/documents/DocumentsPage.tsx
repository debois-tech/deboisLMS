import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { BatchDocuments } from '@/components/documents/BatchDocuments';
import { getBatches } from '@/lib/supabase';
import type { Batch } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';

export default function DocumentsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    setBatches(await getBatches());
  });

  const selectedBatch = batches.find((b) => b.id === batchId) ?? null;

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Documents" />

      <Card className="step-card sticky top-[calc(var(--navbar-h)_+_1rem)] z-20">
        <CardHeader title="Select Batch" />
        <BatchSelect batches={batches} value={batchId} onChange={setBatchId} />
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader title={selectedBatch.name} className="mb-5" />
          {/* Remounts on a batch switch, so its own roster fetch and filters reset cleanly. */}
          <BatchDocuments key={selectedBatch.id} batch={selectedBatch} />
        </Card>
      )}
    </div>
  );
}
