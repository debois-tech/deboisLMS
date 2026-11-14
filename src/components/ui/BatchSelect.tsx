import { SearchSelect } from '@/components/ui/SearchSelect';
import { useAuth } from '@/lib/context/AuthContext';
import type { Batch, BatchStudentMapping } from '@/lib/types';

/** A student's own batches. */
export function EnrolmentSelect({ mappings, value, onChange }: {
  mappings: (BatchStudentMapping & { batch?: Batch })[];
  value: string;
  onChange: (batchId: string) => void;
}) {
  return (
    <SearchSelect
      options={mappings.map((m) => ({ value: m.batch_id, label: m.batch?.name ?? m.batch_id }))}
      value={value}
      onChange={onChange}
      placeholder="Select a batch"
      searchPlaceholder="Search batches"
      emptyText="No batches"
      showSearch={false}
    />
  );
}

interface BatchSelectProps {
  batches: Batch[];
  value: string | null;
  onChange: (batchId: string) => void;
  /** Non-batch choices pinned above the list; their ids are caller-defined sentinels. */
  extraOptions?: { id: string; name: string }[];
  placeholder?: string;
  /** Override the row text where the name alone cannot tell two batches apart. */
  label?: (batch: Batch) => string;
  className?: string;
}

export function BatchSelect({
  batches, value, onChange, extraOptions = [], placeholder = 'Select a batch', label, className,
}: BatchSelectProps) {
  const { isAdmin } = useAuth();
  // Only admins know about test batches.
  const text = label ?? ((batch: Batch) => (isAdmin && batch.is_test ? `${batch.name} (Test)` : batch.name));
  return (
    <SearchSelect
      options={[
        ...extraOptions.map((option) => ({ value: option.id, label: option.name })),
        ...batches.map((batch) => ({ value: batch.id, label: text(batch) })),
      ]}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Search batches"
      emptyText="No batches found"
      className={className}
    />
  );
}

// 1–3 pills on one line; more split over two lines, longer line first.
export function BatchPills({ batches }: { batches: Batch[] }) {
  if (batches.length === 0) return <>—</>;
  const split = batches.length > 3 ? Math.ceil(batches.length / 2) : batches.length;
  return (
    <div className="batch-pills">
      {[batches.slice(0, split), batches.slice(split)].filter((row) => row.length > 0).map((row, at) => (
        <div key={at} className="batch-pills-row">
          {row.map((batch) => <span key={batch.id} className="batch-pill" title={batch.name}>{batch.program}</span>)}
        </div>
      ))}
    </div>
  );
}

const ALL = 'all';

/** Page-level batch filter, sat beside the search bar. `null` means every batch. */
export function BatchFilter({ batches, value, onChange, extraOptions = [], allLabel = 'All batches' }: {
  batches: Batch[];
  value: string | null;
  onChange: (batchId: string | null) => void;
  extraOptions?: { id: string; name: string }[];
  allLabel?: string;
}) {
  return (
    <BatchSelect
      className="batch-filter"
      batches={batches}
      value={value ?? ALL}
      onChange={(id) => onChange(id === ALL ? null : id)}
      extraOptions={[{ id: ALL, name: allLabel }, ...extraOptions]}
    />
  );
}
