import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import { PortalEmpty, PortalPage, usePortalStudentId } from '@/components/portal/PortalPage';
import { AssignmentModal, type StudentAssignment } from '@/components/portal/AssignmentModal';
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

  const renderSection = (label: string, items: StudentAssignment[]) =>
    items.length > 0 && (
      <section>
        <h2 className="assignment-section-label">{label}</h2>
        <div className="assignment-rows">
          {items.map((assignment) => {
            const submitted = assignment.completion?.submitted ?? false;
            return (
              <button
                key={assignment.id}
                type="button"
                onClick={() => setOpen(assignment)}
                aria-label={`${assignment.title} — ${submitted ? 'submitted' : 'pending'}`}
                className={`assignment-row ${submitted ? 'is-submitted' : ''}`}
              >
                <span className="assignment-row-dot" />
                <span className="assignment-row-title">{assignment.title}</span>
                {assignment.assigned_date && (
                  <span className="assignment-row-date">{formatDate(assignment.assigned_date)}</span>
                )}
                <ChevronRight size={15} className="assignment-row-chevron" />
              </button>
            );
          })}
        </div>
      </section>
    );

  return (
    <PortalPage title="Assignments" loading={loading}>
      {assignments.length === 0 ? (
        <PortalEmpty>No assignments yet.</PortalEmpty>
      ) : (
        <div className="assignment-board">
          <SearchBar
            className="assignment-search"
            value={query}
            onChange={setQuery}
            placeholder="Search"
            label="Search assignments"
          />

          {matches === 0 ? (
            <PortalEmpty>Nothing matches “{query.trim()}”.</PortalEmpty>
          ) : (
            <div className="assignment-scroll">
              {renderSection('To do', todo)}
              {renderSection('Submitted', done)}
            </div>
          )}
        </div>
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
