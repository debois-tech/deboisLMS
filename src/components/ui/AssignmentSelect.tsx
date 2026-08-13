import { ClipboardCheck } from 'lucide-react';
import { SearchSelect } from '@/components/ui/SearchSelect';
import type { Assignment } from '@/lib/types';
import { formatDeadline } from '@/lib/utils/deadline';

interface AssignmentSelectProps {
  assignments: Assignment[];
  value: string | null;
  onChange: (assignmentId: string) => void;
}

export function AssignmentSelect({ assignments, value, onChange }: AssignmentSelectProps) {
  return (
    <SearchSelect
      options={assignments.map((assignment) => ({
        value: assignment.id,
        label: assignment.title,
        searchText: `${assignment.title} ${assignment.assigned_date ?? ''} ${assignment.description ?? ''}`,
        icon: <ClipboardCheck size={15} className="shrink-0 text-[var(--primary)]" />,
        meta: assignment.due_at ? `Due ${formatDeadline(assignment.due_at)}` : 'No deadline',
      }))}
      value={value}
      onChange={onChange}
      placeholder="Select an assignment"
      searchPlaceholder="Search assignments"
      emptyText="No assignments found"
      renderOption={(option) => (
        <span className="flex min-w-0 items-center gap-2">
          {option.icon}
          <span className="min-w-0">
            <span className="block truncate">{option.label}</span>
            <span className="block text-xs text-[var(--text-muted)]">{option.meta}</span>
          </span>
        </span>
      )}
    />
  );
}
