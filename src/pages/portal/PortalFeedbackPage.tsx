import { useState } from 'react';
import { MessageSquare, Send, UserPlus } from 'lucide-react';
import {
  PortalEmpty,
  PortalList,
  PortalPage,
  PortalRow,
  PortalSection,
  PortalStatus,
  usePortalStudentId,
} from '@/components/portal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { getMyFeedback, submitFeedback } from '@/lib/supabase';
import type { Feedback, FeedbackKind } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'request', label: 'Something could be better' },
];

/** Report a bug or ask for a change, and see what happened to it. */
export default function PortalFeedbackPage() {
  const studentId = usePortalStudentId();
  const [reports, setReports] = useState<Feedback[]>([]);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;
    setReports(await getMyFeedback());
  });

  const send = async () => {
    if (!studentId || !message.trim()) return;
    setSending(true);
    setSendError('');
    try {
      const created = await submitFeedback({ studentId, kind, message });
      setReports((prev) => [created, ...prev]);
      setMessage('');
      setKind('bug');
    } catch (err) {
      setSendError(errorMessage(err, 'Could not send your report'));
    } finally {
      setSending(false);
    }
  };

  return (
    <PortalPage title="Feedback" loading={loading} error={error} onRetry={retry} shape="list">
      {!studentId ? (
        <PortalEmpty icon={UserPlus}>Student record not linked.</PortalEmpty>
      ) : (
        <>
          <PortalSection title="Tell us">
            <div className="feedback-form">
              <div className="feedback-kinds">
                {KINDS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setKind(option.value)}
                    className={`feedback-kind${kind === option.value ? ' is-active' : ''}`}
                    aria-pressed={kind === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <FormField label="What happened?">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  disabled={sending}
                />
              </FormField>

              {sendError && <InlineAlert>{sendError}</InlineAlert>}

              <div className="flex justify-end">
                <Button className="action-button-compact" onClick={send} loading={sending} disabled={!message.trim()}>
                  <Send size={15} /> Send
                </Button>
              </div>
            </div>
          </PortalSection>

          {/* Seeing it land is what stops the same thing being reported twice. */}
          <PortalSection title="Your reports">
            {reports.length === 0 ? (
              <PortalEmpty icon={MessageSquare}>Nothing reported yet.</PortalEmpty>
            ) : (
              <PortalList>
                {reports.map((report) => (
                  <PortalRow
                    key={report.id}
                    primary={report.message}
                    secondary={`${report.kind === 'bug' ? 'Bug' : 'Request'} · ${formatDate(report.created_at)}`}
                    muted={report.status === 'resolved'}
                    trailing={<PortalStatus kind="feedback" value={report.status} />}
                  />
                ))}
              </PortalList>
            )}
          </PortalSection>
        </>
      )}
    </PortalPage>
  );
}
