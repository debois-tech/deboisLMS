import { SearchSelect } from '@/components/ui/SearchSelect';
import type { Student } from '@/lib/types';

interface StudentMultiSelectProps {
  students: Student[];
  value: string[];
  onChange: (studentIds: string[]) => void;
}

export function StudentMultiSelect({ students, value, onChange }: StudentMultiSelectProps) {
  return (
    <SearchSelect
      options={students.map((student) => ({
        value: student.id,
        label: student.name,
        searchText: `${student.name} ${student.email ?? ''}`,
        meta: student.email,
      }))}
      value={value[0] ?? null}
      onChange={() => {}}
      selectedValues={value}
      onToggle={(studentId) => onChange(value.includes(studentId) ? value.filter((id) => id !== studentId) : [...value, studentId])}
      triggerLabel={value.length ? `${value.length} student${value.length === 1 ? '' : 's'} selected` : undefined}
      placeholder="Select students"
      searchPlaceholder="Search students"
      emptyText="No students found"
      renderOption={(option) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate">{option.label}{option.meta ? ` (${option.meta})` : ''}</span>
        </span>
      )}
    />
  );
}
