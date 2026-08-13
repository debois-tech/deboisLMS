import { SearchSelect } from '@/components/ui/SearchSelect';
import type { Batch } from '@/lib/types';

interface BatchSelectProps {
  batches: Batch[];
  value: string | null;
  onChange: (batchId: string) => void;
  /** Non-batch choices pinned above the list; their ids are caller-defined sentinels. */
  extraOptions?: { id: string; name: string }[];
  placeholder?: string;
}

export function BatchSelect({ batches, value, onChange, extraOptions = [], placeholder = 'Select a batch' }: BatchSelectProps) {
  return (
    <SearchSelect
      options={[
        ...extraOptions.map((option) => ({ value: option.id, label: option.name })),
        ...batches.map((batch) => ({ value: batch.id, label: batch.name })),
      ]}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Search batches"
      emptyText="No batches found"
    />
  );
}
