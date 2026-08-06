import { CalendarDays } from 'lucide-react';
import { SearchSelect } from '@/components/ui/SearchSelect';
import type { Lecture } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

interface LectureSelectProps {
  lectures: Lecture[];
  value: string | null;
  onChange: (lectureId: string) => void;
}

function lectureLabel(lecture: Lecture) {
  return `${formatDate(lecture.lecture_date)}${lecture.meeting_code ? ` (${lecture.meeting_code})` : ''}`;
}

export function LectureSelect({ lectures, value, onChange }: LectureSelectProps) {
  return (
    <SearchSelect
      options={lectures.map((lecture) => ({
        value: lecture.id,
        label: lectureLabel(lecture),
        icon: <CalendarDays size={15} className="shrink-0 text-[var(--primary)]" />,
      }))}
      value={value}
      onChange={onChange}
      placeholder="Select a lecture"
      searchPlaceholder="Search lectures"
      emptyText="No lectures found"
      renderOption={(option) => (
        <span className="flex min-w-0 items-center gap-2">
          {option.icon}
          <span className="truncate">{option.label}</span>
        </span>
      )}
    />
  );
}
