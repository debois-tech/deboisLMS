import { useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, Mail, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { sendCredentialsEmail } from '@/lib/supabase';
import type { BulkLoginResult, CredentialEmailResult } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils/errors';

/** Every login created by an import in one list the admin can copy out. Skips are listed, not dropped. */
export function BulkLoginsModal({ result, onClose }: { result: BulkLoginResult | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  // Accumulated, not replaced: a row emailed on its own and a row caught by
  // "Email the rest" have to end up in the same place, or the table forgets.
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  if (!result) return null;

  const asText = result.created
    .map((row) => `${row.name}\t${row.email}\t${row.password}`)
    .join('\n');

  const copyAll = async () => {
    await navigator.clipboard.writeText(asText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const apply = (outcome: CredentialEmailResult) => {
    setSent((prev) => new Set([...prev, ...outcome.sent]));
    setFailures((prev) => {
      const next = new Map(prev);
      // A retry that works clears the old reason; leaving it would keep accusing.
      outcome.sent.forEach((id) => next.delete(id));
      outcome.failed.forEach((row) => next.set(row.studentId, row.reason));
      return next;
    });
  };

  const send = async (recipients: { studentId: string; password: string }[], bulk: boolean) => {
    if (recipients.length === 0) return;
    const ids = recipients.map((r) => r.studentId);
    if (bulk) setBulkSending(true);
    setBusy((prev) => new Set([...prev, ...ids]));

    try {
      apply(await sendCredentialsEmail(recipients));
    } catch (err) {
      const reason = errorMessage(err, 'Could not send');
      setFailures((prev) => {
        const next = new Map(prev);
        ids.forEach((id) => next.set(id, reason));
        return next;
      });
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (bulk) setBulkSending(false);
    }
  };

  // The bulk button never re-sends what already went out — a second copy of the
  // same password with nothing on screen admitting it happened twice.
  const remaining = result.created.filter((row) => !sent.has(row.studentId));
  const allSent = result.created.length > 0 && remaining.length === 0;
  const anySent = sent.size > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${result.created.length} portal ${result.created.length === 1 ? 'login' : 'logins'} created`}
      size="lg"
      footer={
        <>
          {result.created.length > 0 && (
            <>
              <Button className="action-button-compact" variant="secondary" onClick={copyAll}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy all'}
              </Button>
              <Button
                className="action-button-compact"
                variant="secondary"
                onClick={() => send(remaining.map((r) => ({ studentId: r.studentId, password: r.password })), true)}
                loading={bulkSending}
                disabled={allSent}
              >
                {allSent ? <Check size={15} /> : <Mail size={15} />}
                {allSent
                  ? 'All emailed'
                  : anySent
                    ? `Email the other ${remaining.length}`
                    : `Email all ${remaining.length}`}
              </Button>
            </>
          )}
          <Button className="action-button-compact" onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {result.created.length > 0 && (
          <div className="import-preview">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Password</th>
                  <th className="bulk-send-col">Send</th>
                </tr>
              </thead>
              <tbody>
                {result.created.map((row) => {
                  const isSent = sent.has(row.studentId);
                  const isBusy = busy.has(row.studentId);
                  const failed = failures.get(row.studentId);

                  return (
                    <tr key={row.studentId}>
                      <td>{row.name}</td>
                      <td>{row.email}</td>
                      <td className="font-mono">{row.password}</td>
                      <td className="bulk-send-col">
                        {isSent ? (
                          <span className="bulk-sent"><Check size={14} aria-hidden="true" />Sent</span>
                        ) : isBusy ? (
                          <span className="bulk-sent is-busy">
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />Sending
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="bulk-send"
                            onClick={() => send([{ studentId: row.studentId, password: row.password }], false)}
                            title={failed}
                            aria-label={`${failed ? 'Retry email' : 'Email'} to ${row.name}`}
                          >
                            {failed ? <RotateCcw size={14} /> : <Mail size={14} />}
                            {failed ? 'Retry' : 'Email'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Reasons live under the table rather than in the cells, so one long
            failure cannot make its row twice the height of every other. */}
        {failures.size > 0 && (
          <div className="bulk-login-failures">
            <p className="bulk-login-failures-head">
              <AlertTriangle size={14} />
              {failures.size} not emailed
            </p>
            <ul>
              {result.created
                .filter((row) => failures.has(row.studentId))
                .map((row) => (
                  <li key={row.studentId}>
                    <span>{row.name}</span>
                    <span className="bulk-login-reason">{failures.get(row.studentId)}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {result.failed.length > 0 && (
          <div className="bulk-login-failures">
            <p className="bulk-login-failures-head">
              <AlertTriangle size={14} />
              {result.failed.length} skipped
            </p>
            <ul>
              {result.failed.map((row) => (
                <li key={row.studentId}>
                  <span>{row.name}</span>
                  <span className="bulk-login-reason">{row.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
