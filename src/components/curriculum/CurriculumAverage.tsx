import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';

// The dashboards' one number for how far the running batches are through their courses.
export function CurriculumAverage({ average, outOf }: { average: { percent: number; batches: number } | null; outOf: number }) {
  if (!average) return null;
  return (
    <Card>
      <CardHeader title="Course progress" />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">{average.percent}%</p>
        <div className="min-w-[10rem] flex-1">
          <ProgressBar done={average.percent} total={100} label="Average course progress" />
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {average.batches} of {outOf} active {outOf === 1 ? 'batch has' : 'batches have'} a curriculum
        </p>
      </div>
    </Card>
  );
}
