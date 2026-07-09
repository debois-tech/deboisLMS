'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hash, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { joinClass } from '@/lib/mock/classes';

export default function JoinClassPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { showToast('Please enter a class code.', 'error'); return; }
    setLoading(true);
    try {
      const cls = await joinClass(code);
      showToast(`Successfully joined "${cls.name}"!`, 'success');
      router.push(`/dashboard/classes/${cls.id}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to join class.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Join a Class</h1>
        <p className="text-sm text-[var(--text-muted)]">Enter the class code provided by your instructor.</p>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[20px] p-8 shadow-[var(--shadow-md)]">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/15 border border-[var(--primary)]/25 flex items-center justify-center mb-4">
            <Hash size={28} className="text-[var(--primary)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Have a class code?</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Class codes look like <code className="bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded text-[var(--primary)] font-mono">DEB-XXXX</code></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Class Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DEB-XXXX"
              maxLength={8}
              className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-center text-xl font-mono font-bold tracking-[0.2em] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors uppercase"
            />
          </div>
          <Button type="submit" loading={loading} className="w-full">
            Join Class <ArrowRight size={16} />
          </Button>
        </form>

        {/* Demo hint */}
        <div className="mt-6 p-3 rounded-[10px] bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-blue-400 text-center">
            <strong>Demo codes:</strong> DEB-4X9K · DEB-7R2M · DEB-9KP3
          </p>
        </div>
      </div>
    </div>
  );
}
