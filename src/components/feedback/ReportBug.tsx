import { useState } from 'react';
import { Bug, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import { getFeedback, submitFeedback } from '@/lib/supabase';
import type { Feedback, FeedbackKind } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'request', label: 'Something could be better' },
];

// The top-bar bug button for every role: report in a popup, and see what happened to your earlier reports.
export function ReportBug() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState('');
  const [reports, setReports] = useState<Feedback[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const show = () => {
    // The page you are on, ready to correct if the bug was somewhere else.
    setPage(window.location.href);
    setError('');
    setOpen(true);
    getFeedback().then(setReports).catch((err) => setError(errorMessage(err, 'Could not load your reports')));
  };

  const send = async () => {
    setSending(true);
    setError('');
    try {
      const created = await submitFeedback({ kind, message, page });
      setReports((current) => [created, ...current]);
      setMessage('');
      setKind('bug');
    } catch (err) {
      setError(errorMessage(err, 'Could not send your report'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button type="button" className="notif-bell" onClick={show} aria-label="Report bug" title="Report bug">
        <Bug size={18} />
      </button>

      <Modal
        open={open}
        onClose={() => !sending && setOpen(false)}
        title="Report bug"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>Close</Button>
            <Button className="action-button-compact" onClick={() => void send()} loading={sending} disabled={!message.trim()}>
              <Send size={15} /> Send
            </Button>
          </>
        }
      >
        <div className="popup-form-spaced">
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

          <FormField label="What happened?" required>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={2000} disabled={sending} />
          </FormField>

          <FormField label="Page">
            <input value={page} onChange={(event) => setPage(event.target.value)} maxLength={500} disabled={sending} spellCheck={false} />
          </FormField>

          {error && <InlineAlert>{error}</InlineAlert>}

          {reports.length > 0 && (
            <div className="report-list" aria-label="Your reports">
              {reports.map((report) => (
                <div key={report.id} className="report-row">
                  <span className="report-copy">
                    <span className="report-message">{report.message}</span>
                    <span className="report-meta">{report.kind === 'bug' ? 'Bug' : 'Request'} · {formatDate(report.created_at)}</span>
                  </span>
                  <StatusPill kind="feedback" value={report.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
