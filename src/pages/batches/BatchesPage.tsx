import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowUpRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { getBatches } from '@/lib/supabase';
import type { Batch } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

const statusColors: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  ongoing: 'success',
  upcoming: 'warning',
  completed: 'info',
};

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBatches().then((data) => {
      setBatches(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Batches"
        subtitle="Manage training batches"
        action={<Link to="/batches/new"><Button><Plus size={16} /> New Batch</Button></Link>}
      />

      {batches.length === 0 ? (
        <EmptyState icon={<Layers size={32} />} title="No batches yet" description="Create your first training batch to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <Link key={batch.id} to={`/batches/${batch.id}`} className="block group">
              <Card hover className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                    <Layers size={20} className="text-[var(--primary)]" />
                  </div>
                  <ArrowUpRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">{batch.name}</h3>
                {batch.track && <p className="text-xs text-[var(--text-muted)] mb-3">{batch.track}</p>}
                <div className="flex items-center justify-between">
                  <Badge variant={statusColors[batch.status] ?? 'default'}>{batch.status}</Badge>
                  {batch.start_date && (
                    <span className="text-xs text-[var(--text-muted)]">{formatDate(batch.start_date)}</span>
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