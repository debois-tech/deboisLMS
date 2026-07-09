'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import { mockSignIn } from '@/lib/mock/auth';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { showToast('Please fill in all fields.', 'error'); return; }
    setLoading(true);
    try {
      const user = await mockSignIn(email, password);
      setUser(user);
      showToast(`Welcome back, ${user.full_name}!`, 'success');
      router.push(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch {
      showToast('Invalid credentials. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-gradient-to-br from-[var(--primary-dark)] to-[var(--accent)] p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg">
            <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black">D</span>
            Deboistech LMS
          </Link>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-4">Welcome back to your learning journey.</h2>
          <p className="text-white/70 text-base">Access your classes, materials, and assignments — all in one place.</p>
        </div>
        <div className="relative z-10 text-xs text-white/40">© 2026 Deboistech</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Sign in</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-[var(--primary)] hover:underline font-medium">Create one</Link>
            </p>
          </div>

          {/* Quick-fill hints for demo */}
          <div className="mb-6 p-3 rounded-[10px] bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
            <strong>Demo:</strong> Use any email with &quot;admin&quot; for admin view, or any other email for student view.
          </div>

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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-[var(--primary)] hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full mt-2">
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
