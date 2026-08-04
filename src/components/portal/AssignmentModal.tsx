import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PortalStatus } from '@/components/portal/PortalStatus';
import type { Assignment, AssignmentCompletion } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { errorMessage } from '@/lib/utils/errors';

export type StudentAssignment = Assignment & { completion?: AssignmentCompletion };

interface AssignmentModalProps {
  /** The open assignment, or null when the dialog is closed. */
  assignment: StudentAssignment | null;
  /** The student's saved repo, prefilled in the submit view. Undefined before their first submission. */
  repoUrl?: string;
  onClose: () => void;
  onSubmit: (repoUrl: string) => Promise<void>;
}

/**
 * Lenient on purpose: rejects only what clearly isn't a GitHub repo, because a
 * false rejection stops a student handing work in.
 */
function validateRepoUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your GitHub repository link.';

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return 'Enter a link starting with https://github.com/';
  }
  if (!/(^|\.)github\.com$/i.test(url.hostname)) {
    return 'Use a GitHub link starting with https://github.com/';
  }
  if (url.pathname.split('/').filter(Boolean).length < 2) {
    return 'Link to the repository, e.g. https://github.com/your-name/your-repo';
  }
  return null;
}

/**
 * Everything about one assignment. The list row carries only a title, a date and
 * a state dot; the detail and the submit form both live here, as two views of the
 * same dialog so submitting never stacks a second modal on top of the first.
 */
export function AssignmentModal({ assignment, repoUrl, onClose, onSubmit }: AssignmentModalProps) {
  const [view, setView] = useState<'info' | 'submit'>('info');
  const [draftRepo, setDraftRepo] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Every open starts on the detail view with a clean form: the saved link is
  // prefilled again and the confirmation is re-ticked per assignment.
  useEffect(() => {
    if (!assignment) return;
    setView('info');
    setDraftRepo(repoUrl ?? '');
    setConfirmed(false);
    setError('');
    setSubmitting(false);
  }, [assignment, repoUrl]);

  const submitted = assignment?.completion?.submitted ?? false;
  const trimmed = draftRepo.trim();
  const isReplacingRepo = Boolean(repoUrl) && trimmed !== repoUrl && trimmed.length > 0;

  const handleSubmit = async () => {
    const problem = validateRepoUrl(draftRepo);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(errorMessage(err, 'Could not submit. Try again.'));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={assignment !== null}
      onClose={submitting ? () => {} : onClose}
      title={assignment?.title ?? ''}
      size="md"
      footer={
        view === 'info' ? (
          <>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {!submitted && (
              <Button className="action-button-compact" onClick={() => setView('submit')}>
                Submit
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setView('info')} disabled={submitting}>Back</Button>
            <Button
              className="action-button-compact"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!confirmed || trimmed.length === 0}
            >
              Submit
            </Button>
          </>
        )
      }
    >
      {view === 'info' ? (
        <div className="assignment-detail">
          <div className="assignment-detail-meta">
            <PortalStatus kind="submission" value={submitted ? 'submitted' : 'pending'} />
            {assignment?.assigned_date && <span>Given {formatDate(assignment.assigned_date)}</span>}
          </div>

          <p className={`assignment-detail-body ${assignment?.description ? '' : 'is-empty'}`}>
            {assignment?.description || 'No details added.'}
          </p>

          {submitted && (
            <dl className="assignment-detail-facts">
              {repoUrl && (
                <div className="assignment-fact">
                  <dt>Your repo</dt>
                  <dd>
                    <a href={repoUrl} target="_blank" rel="noreferrer">
                      {repoUrl}
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                  </dd>
                </div>
              )}
              {assignment?.completion?.submitted_at && (
                <div className="assignment-fact">
                  <dt>Handed in</dt>
                  <dd>{formatDateTime(assignment.completion.submitted_at)}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      ) : (
        <div className="repo-submit-row">
          {error && <InlineAlert>{error}</InlineAlert>}

          <FormField label="GitHub repo link" required>
            <input
              value={draftRepo}
              onChange={(e) => { setDraftRepo(e.target.value); setError(''); }}
              placeholder="https://github.com/your-name/your-repo"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              disabled={submitting}
            />
          </FormField>

          <label className={`repo-confirm ${confirmed ? 'is-checked' : ''}`}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={submitting}
            />
            My work is in this repo
          </label>

          {isReplacingRepo && (
            <p className="repo-notice is-warning">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Updates the link on all submitted assignments.</span>
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
