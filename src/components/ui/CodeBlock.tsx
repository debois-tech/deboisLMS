import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  label?: string;
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{label}</span>}
      <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] px-4 py-3">
        <span className="flex-1 font-mono text-xl font-bold tracking-[0.25em] text-[var(--primary)] animate-pulse-glow">
          {code}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-overlay)] hover:bg-[var(--primary)] text-[var(--text-secondary)] hover:text-white transition-all duration-200"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
