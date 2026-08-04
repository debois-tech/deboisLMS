import { SearchSelect } from '@/components/ui/SearchSelect';
import type { Batch } from '@/lib/types';

interface BatchSelectProps {
  batches: Batch[];
  value: string | null;
  onChange: (batchId: string) => void;
  /**
   * Choices that are not batches, pinned above the list — e.g. "All students" on
   * the study material page. Their ids are sentinels the caller understands.
   */
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
