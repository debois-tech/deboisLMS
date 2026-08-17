import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Page state for a list already held in memory. Returns the visible slice and a
 * page index that is always in range — a list that shrinks under the reader, a
 * shorter CSV chosen while sitting on page 4, leaves the page number stranded
 * past the end otherwise, and the table renders empty.
 */
export function usePager<T>(items: T[], pageSize = 10) {
  const [requested, setRequested] = useState(0);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(requested, 0), pageCount - 1);
  const start = page * pageSize;

  return {
    page,
    pageCount,
    pageSize,
    total: items.length,
    slice: items.slice(start, start + pageSize),
    /** 1-based, for the readout. */
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    setPage: setRequested,
    reset: () => setRequested(0),
  };
}

interface PagerProps {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  onChange: (page: number) => void;
}

/**
 * Where in a list you are and how to move. Renders nothing when it all fits.
 *
 * The range carries no total: every surface using this already states one just
 * above — the import summary's student count, the credentials modal's title — and
 * repeating it here only made the reader check whether the two agreed.
 */
export function Pager({ page, pageCount, from, to, onChange }: PagerProps) {
  // A single page needs no controls, and an empty one has nothing to say.
  if (pageCount <= 1) return null;

  return (
    <div className="pager">
      <button
        type="button"
        className="pager-button"
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>

      {/* Announced on change: with the buttons unlabelled, this line is the only
          thing that tells a screen reader the list moved. */}
      <p className="pager-range" aria-live="polite">
        {from}&ndash;{to}
      </p>

      <button
        type="button"
        className="pager-button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount - 1}
        aria-label="Next page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
