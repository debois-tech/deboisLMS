import { useState } from 'react';
import { AlertTriangle, ExternalLink, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PortalStatus } from '@/components/portal/PortalStatus';
import { AssignmentFiles } from '@/components/assignments/AssignmentFiles';
import type { Assignment, AssignmentCompletion } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { assignmentState, formatDeadline, formatDueLabel } from '@/lib/utils/deadline';
import { errorMessage } from '@/lib/utils/errors';

export type StudentAssignment = Assignment & { completion?: AssignmentCompletion };

interface AssignmentModalProps {
  assignment: StudentAssignment | null;
  repoUrl?: string;
  now: number;
  onClose: () => void;
  onSubmit: (repoUrl: string) => Promise<void>;
}

/**
 * Lenient on what it accepts, strict on what it stores: anything recognisable as a
 * GitHub repo passes, but only the canonical https://github.com/<owner>/<repo> is
 * saved. The database rejects anything else outright — see migration_2026_08_12.sql.
 */
function validateRepoUrl(value: string): { url?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { error: 'Enter your GitHub repository link.' };

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return { error: 'Enter a link starting with https://github.com/' };
  }
  if (!/(^|\.)github\.com$/i.test(url.hostname)) {
    return { error: 'Use a GitHub link starting with https://github.com/' };
  }

  const [owner, repo] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo) {
    return { error: 'Link to the repository, e.g. https://github.com/your-name/your-repo' };
  }
  // Query strings, trailing slashes and www. are dropped: one repo, one stored form.
  const canonical = `https://github.com/${owner}/${repo.replace(/\.git$/i, '')}`;
  if (!/^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(canonical)) {
    return { error: 'That does not look like a repository link.' };
  }
  return { url: canonical };
}

/** Everything about one assignment — detail and submit form as two views of one dialog, so submitting never stacks a modal. */
export function AssignmentModal(props: AssignmentModalProps) {
  return <AssignmentModalBody key={props.assignment?.id ?? 'closed'} {...props} />;
}

function AssignmentModalBody({ assignment, repoUrl, now, onClose, onSubmit }: AssignmentModalProps) {
  const [view, setView] = useState<'info' | 'submit'>('info');
  const [draftRepo, setDraftRepo] = useState(repoUrl ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const state = assignment ? assignmentState(assignment, now) : 'todo';
  const submitted = state === 'done';
  const missed = state === 'missed';
  const trimmed = draftRepo.trim();
  const isReplacingRepo = Boolean(repoUrl) && trimmed !== repoUrl && trimmed.length > 0;

  const handleSubmit = async () => {
    const { url, error: problem } = validateRepoUrl(draftRepo);
    if (problem || !url) {
      setError(problem ?? 'Enter your GitHub repository link.');
      return;
    }
    if (missed) {
      setError('The deadline has passed. Talk to your tutor.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(url);
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
            {!submitted && !missed && (
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
              disabled={!confirmed || trimmed.length === 0 || missed}
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
            <PortalStatus kind="submission" value={submitted ? 'submitted' : missed ? 'missed' : 'pending'} />
            {assignment?.assigned_date && <span>Given {formatDate(assignment.assigned_date)}</span>}
            {!submitted && <span>{formatDueLabel(assignment?.due_at, now)}</span>}
          </div>

          <p className={`assignment-detail-body ${assignment?.description ? '' : 'is-empty'}`}>
            {assignment?.description || 'No details added.'}
          </p>

          {assignment && (
            <AssignmentFiles assignmentId={assignment.id} batchId={assignment.batch_id} readOnly />
          )}

          {missed && (
            <p className="repo-notice is-danger">
              <Lock size={14} className="shrink-0" />
              <span>
                Submissions closed{assignment?.due_at ? ` on ${formatDeadline(assignment.due_at)}` : ''}.
              </span>
            </p>
          )}

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

          {assignment?.due_at && (
            <p className={`repo-notice ${missed ? 'is-danger' : ''}`}>
              <Lock size={14} className="shrink-0" />
              <span>
                {formatDueLabel(assignment.due_at, now)}.{' '}
                {missed ? 'Nothing more can be handed in.' : 'Nothing can be handed in after that.'}
              </span>
            </p>
          )}

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
