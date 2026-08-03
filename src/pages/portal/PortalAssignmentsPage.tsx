import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useToast } from '@/lib/context/ToastContext';

export default function PortalAssignmentsPage() {
  const studentId = usePortalStudentId();
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [repoUrl, setRepoUrl] = useState<string | undefined>();
  const [open, setOpen] = useState<StudentAssignment | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // The saved repo loads with the assignments, so the dialog's submit view can
  // prefill the link immediately instead of showing an empty field first.
  const load = useCallback(async () => {
    if (!studentId) return;
    const [data, repo] = await Promise.all([
      getAssignmentsForStudent(studentId),
      getStudentRepo(studentId),
    ]);
    setAssignments(data);
    setRepoUrl(repo?.repo_url);
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let active = true;
    load().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studentId, load]);

  const handleSubmit = async (url: string) => {
    if (!studentId || !open) return;
    await submitAssignmentFromPortal(open.id, studentId, url);
    await load();
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
      shape="list"
      action={
        assignments.length > 0 ? (
          <SearchBar
            className="assignment-search"
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
        <PortalEmpty icon={SearchX}>Nothing matches “{query.trim()}”.</PortalEmpty>
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
