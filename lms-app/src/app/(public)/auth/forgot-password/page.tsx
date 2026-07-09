'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { mockResetPassword } from '@/lib/mock/auth';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { showToast('Please enter your email address.', 'error'); return; }
    setLoading(true);
    try {
      await mockResetPassword(email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-8 transition-colors">
          <ArrowLeft size={15} /> Back to sign in
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Check your inbox</h1>
            <p className="text-sm text-[var(--text-muted)]">
              We sent a password reset link to <strong className="text-[var(--text-secondary)]">{email}</strong>
            </p>
            <Button variant="ghost" className="mt-6" onClick={() => setSent(false)}>
              Try a different email
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Forgot your password?</h1>
            <p className="text-sm text-[var(--text-muted)] mb-8">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                  />
                </div>
              </div>
              <Button type="submit" loading={loading} className="w-full">
                Send Reset Link
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
