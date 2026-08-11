import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';

interface StudentLinkProps {
  studentId: string;
  name: string;
  className?: string;
}

export function StudentLink({ studentId, name, className }: StudentLinkProps) {
  return (
    <Link to={`/students/${studentId}`} className={className ?? 'text-[var(--text-primary)] hover:underline'}>
      {name}
    </Link>
  );
}

/**
 * The student's permanent ID. One component for both sides on purpose: the code a
 * student reads on their portal and the code an admin quotes back must look like
 * the same thing. Copyable, because it gets typed into messages and forms.
 */
export function StudentIdChip({ code, showLabel = true }: { code?: string; showLabel?: boolean }) {
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the code is on screen to read either way.
    }
  };

  return (
    <span className={`student-id${showLabel ? '' : ' is-bare'}`}>
      {showLabel && <span className="student-id-label">Student ID</span>}
      <span className="student-id-value">{code}</span>
      <button
        type="button"
        onClick={copy}
        className="student-id-copy"
        aria-label={copied ? 'Student ID copied' : 'Copy student ID'}
      >
        {copied ? <Check size={14} className="text-[var(--success-text)]" /> : <Copy size={14} />}
      </button>
    </span>
  );
}
