// A thin bar for done out of total, optionally with "done/total" beside it. Shares its look with the curriculum cards.
export function ProgressBar({ done, total, label, count }: { done: number; total: number; label: string; count?: boolean }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="cv-progress">
      <div className="cv-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      {count && <span className="cv-progress-text">{done}/{total}</span>}
    </div>
  );
}
