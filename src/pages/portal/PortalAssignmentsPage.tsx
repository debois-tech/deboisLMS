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
  PortalStatus,
  PortalTabs,
  type StudentAssignment,
  usePortalStudentId,
} from '@/components/portal';
import { getAssignmentsForStudent, getStudentRepo, submitAssignmentFromPortal } from '@/lib/supabase';
import { assignmentState, formatDueLabel, isDueSoon, type AssignmentState } from '@/lib/utils/deadline';
import { formatDate } from '@/lib/utils/format';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useNow } from '@/lib/hooks/useNow';
import { useToast } from '@/lib/context/ToastContext';

type Filter = 'all' | AssignmentState;

const SECTIONS: { state: AssignmentState; label: string; empty: string }[] = [
  { state: 'todo', label: 'To do', empty: 'Nothing to hand in.' },
  { state: 'done', label: 'Done', empty: 'Nothing handed in yet.' },
  { state: 'missed', label: 'Missed', empty: "You haven't missed anything." },
];

export default function PortalAssignmentsPage() {
  const studentId = usePortalStudentId();
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [repoUrl, setRepoUrl] = useState<string | undefined>();
  const [open, setOpen] = useState<StudentAssignment | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { showToast } = useToast();

  // One clock for the page, so a passing deadline moves the row without a refresh.
  const now = useNow();

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

  /** Typing drops the filter back to All, so a search reaches every section. */
  const handleQuery = (next: string) => {
    setQuery(next);
    if (next.trim()) setFilter('all');
  };

  const { buckets, matches } = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = term
      ? assignments.filter((a) => `${a.title} ${a.description ?? ''}`.toLowerCase().includes(term))
      : assignments;

    const empty: Record<AssignmentState, StudentAssignment[]> = { todo: [], done: [], missed: [] };
    for (const assignment of matched) {
      empty[assignmentState(assignment, now)].push(assignment);
    }

    // To do is a queue: soonest deadline first, undated work last.
    empty.todo.sort((a, b) => {
      if (!a.due_at) return b.due_at ? 1 : 0;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    return { buckets: empty, matches: matched.length };
  }, [assignments, query, now]);

  const renderRow = (assignment: StudentAssignment, state: AssignmentState) => {
    const submittedAt = assignment.completion?.submitted_at;
    const secondary =
      state === 'done'
        ? submittedAt
          ? `Handed in ${formatDate(submittedAt)}`
          : 'Handed in'
        : formatDueLabel(assignment.due_at, now);

    return (
      <PortalRow
        key={assignment.id}
        primary={assignment.title}
        secondary={
          <span className={state === 'todo' && isDueSoon(assignment.due_at, now) ? 'portal-due-soon' : undefined}>
            {secondary}
          </span>
        }
        trailing={state === 'missed' ? <PortalStatus kind="submission" value="missed" /> : undefined}
        state={state}
        muted={state !== 'todo'}
        onClick={() => setOpen(assignment)}
        label={`${assignment.title} — ${state === 'done' ? 'submitted' : state === 'missed' ? 'missed' : 'to hand in'}`}
      />
    );
  };

  const visible = SECTIONS.filter(
    (section) => (filter === 'all' || filter === section.state) && buckets[section.state].length > 0,
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
            onChange={handleQuery}
            placeholder="Search assignments"
            label="Search assignments"
          />
        ) : undefined
      }
    >
      {assignments.length === 0 ? (
        <PortalEmpty icon={FileText}>No assignments yet.</PortalEmpty>
      ) : (
        <>
          <PortalTabs
            label="Filter assignments"
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: 'all', label: 'All', count: matches },
              ...SECTIONS.map((section) => ({
                value: section.state as Filter,
                label: section.label,
                count: buckets[section.state].length,
              })),
            ]}
          />

          {matches === 0 ? (
            <PortalEmpty icon={SearchX}>No matches for “{query.trim()}”.</PortalEmpty>
          ) : visible.length === 0 ? (
            <PortalEmpty icon={FileText}>
              {SECTIONS.find((section) => section.state === filter)?.empty ?? 'Nothing here.'}
            </PortalEmpty>
          ) : (
            visible.map((section) => (
              <PortalSection key={section.state} title={section.label}>
                <PortalList>
                  {buckets[section.state].map((assignment) => renderRow(assignment, section.state))}
                </PortalList>
              </PortalSection>
            ))
          )}
        </>
      )}

      <AssignmentModal
        assignment={open}
        repoUrl={repoUrl}
        now={now}
        onClose={() => setOpen(null)}
        onSubmit={handleSubmit}
      />
    </PortalPage>
  );
}
