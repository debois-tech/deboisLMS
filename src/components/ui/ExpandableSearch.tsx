import { useState, type ComponentProps } from 'react';
import { Search, X } from 'lucide-react';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';

interface ExpandableSearchProps extends ComponentProps<typeof SearchFilterBar> {
  // Fires when the bar collapses back to the icon — clear the search/filter state here.
  onClose?: () => void;
}

// Collapsed: a small icon button. Clicked: it grows into the real search+filter bar.
export function ExpandableSearch({ onClose, ...barProps }: ExpandableSearchProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="expandable-search-trigger"
      >
        <Search size={14} />
      </button>
    );
  }

  return (
    <div className="expandable-search-open">
      <SearchFilterBar {...barProps} />
      <button
        type="button"
        onClick={() => { setOpen(false); onClose?.(); }}
        aria-label="Close search"
        className="expandable-search-close"
      >
        <X size={14} />
      </button>
    </div>
  );
}
