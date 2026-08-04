import { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { BulkLoginResult } from '@/lib/supabase';

/**
 * Every login created by an import, in one list the admin can copy out in a
 * single action — the passwords are derivable later from the phone number, but
 * handing them over right after the import is the moment they are actually
 * needed. Students whose row had no email are listed rather than silently
 * dropped, since that is the one thing the admin has to go back and fix.
 */
export function BulkLoginsModal({ result, onClose }: { result: BulkLoginResult | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const asText = result.created
    .map((row) => `${row.name}\t${row.email}\t${row.password}`)
    .join('\n');

  const copyAll = async () => {
    await navigator.clipboard.writeText(asText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${result.created.length} portal ${result.created.length === 1 ? 'login' : 'logins'} created`}
      size="lg"
      footer={
        <>
          {result.created.length > 0 && (
            <Button variant="secondary" onClick={copyAll}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy all'}
            </Button>
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
                </tr>
              </thead>
              <tbody>
                {result.created.map((row) => (
                  <tr key={row.studentId}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td className="font-mono">{row.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
