import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowUpRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { getBatches } from '@/lib/supabase';
import type { Batch } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBatches().then((data) => {
      setBatches(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner centered />;

  return (
    <div className="page-section">
      <PageHeader
        title="Batches"
        action={<Link to="/batches/new"><Button className="action-button-compact"><Plus size={16} /> New Batch</Button></Link>}
      />

      {batches.length === 0 ? (
        <EmptyState icon={<Layers size={32} />} title="No batches yet" description="Create your first training batch to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <Link key={batch.id} to={`/batches/${batch.id}`} className="block group">
              <Card hover padding="sm">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{batch.name}</h3>
                  <ArrowUpRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  {batch.track && <p className="text-xs text-[var(--text-muted)] truncate">{batch.track}</p>}
                  {batch.start_date && (
                    <span className="text-xs text-[var(--text-muted)] shrink-0">{formatDate(batch.start_date)}</span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
