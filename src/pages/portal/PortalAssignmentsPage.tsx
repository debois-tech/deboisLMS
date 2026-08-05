import { useCallback, useMemo, useState } from 'react';
import { FileText, SearchX } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import {
  AssignmentModal,
  PortalEmpty,
  PortalList,
  PortalPage,
  PortalRow,
  PortalSection,
  type StudentAssignment,
  usePortalStudentId,
} from '@/components/portal';
import { getAssignmentsForStudent, getStudentRepo, submitAssignmentFromPortal } from '@/lib/supabase';
import { formatDate } from '@/lib/utils/format';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useToast } from '@/lib/context/ToastContext';

export default function PortalAssignmentsPage() {
  const studentId = usePortalStudentId();
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [repoUrl, setRepoUrl] = useState<string | undefined>();
  const [open, setOpen] = useState<StudentAssignment | null>(null);
  const [query, setQuery] = useState('');
  const { showToast } = useToast();

  // The saved repo loads with the assignments, so the submit view can prefill the link immediately.
  const load = useCallback(async () => {
    if (!studentId) return;
    const [data, repo] = await Promise.all([
      getAssignmentsForStudent(studentId),
      getStudentRepo(studentId),
    ]);
    setAssignments(data);
    setRepoUrl(repo?.repo_url);
  }, [studentId]);

  const { loading, error, retry } = useInitialLoad(load);

  const handleSubmit = async (url: string) => {
    if (!studentId || !open) return;
    await submitAssignmentFromPortal(open.id, studentId, url);
    // Already saved, so a failed refresh must not surface as "Could not submit".
    try {
      await load();
    } catch {
      // The list is stale until the next visit; the work is handed in either way.
    }
    setOpen(null);
    showToast('Assignment submitted');
  };

  // Unsubmitted work first — the list is a to-do list before it is a record.
  const { todo, done, matches } = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = term
      ? assignments.filter((a) => `${a.title} ${a.description ?? ''}`.toLowerCase().includes(term))
      : assignments;
    return {
      todo: matched.filter((a) => !a.completion?.submitted),
      done: matched.filter((a) => a.completion?.submitted),
      matches: matched.length,
    };
  }, [assignments, query]);

  const renderSection = (label: string, items: StudentAssignment[], submitted: boolean) =>
    items.length > 0 && (
      <PortalSection title={label}>
        <PortalList>
          {items.map((assignment) => (
            <PortalRow
              key={assignment.id}
              primary={assignment.title}
              secondary={assignment.assigned_date ? formatDate(assignment.assigned_date) : undefined}
              state={submitted ? 'done' : 'todo'}
              muted={submitted}
              onClick={() => setOpen(assignment)}
              label={`${assignment.title} — ${submitted ? 'submitted' : 'to hand in'}`}
            />
          ))}
        </PortalList>
      </PortalSection>
    );

  return (
    <PortalPage
      title="Your assignments"
      loading={loading}
      error={error}
      onRetry={retry}
      shape="list"
      action={
        assignments.length > 0 ? (
          <SearchBar
            className="portal-search"
            value={query}
            onChange={setQuery}
            placeholder="Search assignments"
            label="Search assignments"
          />
        ) : undefined
      }
    >
      {assignments.length === 0 ? (
        <PortalEmpty icon={FileText}>No assignments yet.</PortalEmpty>
      ) : matches === 0 ? (
        <PortalEmpty icon={SearchX}>No matches for “{query.trim()}”.</PortalEmpty>
      ) : (
        <>
          {renderSection('To do', todo, false)}
          {renderSection('Done', done, true)}
        </>
      )}

      <AssignmentModal
        assignment={open}
        repoUrl={repoUrl}
        onClose={() => setOpen(null)}
        onSubmit={handleSubmit}
      />
    </PortalPage>
  );
}
