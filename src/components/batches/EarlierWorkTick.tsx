import { useNow } from '@/lib/hooks/useNow';
import type { Batch } from '@/lib/types';

const WEEK_MS = 7 * 86_400_000;

// Only a batch past its first week has earlier work to count or not
export function EarlierWorkTick({ batch, checked, onChange }: { batch?: Batch; checked: boolean; onChange: (checked: boolean) => void }) {
  const now = useNow();
  if (!batch?.start_date || now - new Date(batch.start_date).getTime() < WEEK_MS) return null;

  return (
    <label className={`repo-confirm ${checked ? 'is-checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      Count lectures and assignments from before they joined
    </label>
  );
}
