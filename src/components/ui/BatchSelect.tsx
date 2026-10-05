import { SearchSelect } from '@/components/ui/SearchSelect';
import { StatusPill } from '@/components/ui/StatusPill';
import type { Batch, BatchStudentMapping } from '@/lib/types';

/** A student's own batches, each tagged with its enrolment status. */
export function EnrolmentSelect({ mappings, value, onChange }: {
  mappings: (BatchStudentMapping & { batch?: Batch })[];
  value: string;
  onChange: (batchId: string) => void;
}) {
  return (
    <SearchSelect
      options={mappings.map((m) => ({
        value: m.batch_id,
        label: m.batch?.name ?? m.batch_id,
        meta: <StatusPill kind="enrollment" value={m.status} />,
      }))}
      value={value}
      onChange={onChange}
      placeholder="Select a batch"
      searchPlaceholder="Search batches"
      emptyText="No batches"
      showSearch={false}
      renderOption={(option) => <><span className="truncate">{option.label}</span>{option.meta}</>}
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
}

export function BatchSelect({
  batches, value, onChange, extraOptions = [], placeholder = 'Select a batch', label = (batch) => batch.name,
}: BatchSelectProps) {
  return (
    <SearchSelect
      options={[
        ...extraOptions.map((option) => ({ value: option.id, label: option.name })),
        ...batches.map((batch) => ({ value: batch.id, label: label(batch) })),
      ]}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Search batches"
      emptyText="No batches found"
    />
  );
}
