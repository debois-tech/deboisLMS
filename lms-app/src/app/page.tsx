import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, ClipboardList, BarChart3, Shield, Zap, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Deboistech LMS — Learn. Grow. Excel.',
  description: 'The modern Learning Management System for Deboistech — manage classes, materials, assignments and tests all in one place.',
};

const features = [
  { icon: BookOpen,      title: 'Rich Study Materials',   desc: 'Upload documents, post links, or write rich text notes directly in the platform.' },
  { icon: ClipboardList, title: 'Smart Assignments',      desc: 'Create assignments with due dates, file uploads, and inline grading with feedback.' },
  { icon: BarChart3,     title: 'Instant Test Results',   desc: 'MCQ tests are auto-graded on submission. Short answers reviewed by instructors.' },
  { icon: Shield,        title: 'Role-Based Access',      desc: 'Separate admin and student experiences with secure route protection.' },
  { icon: Zap,           title: 'Class Join Codes',       desc: 'Students join classes instantly with a unique DEB-XXXX code. No manual enrolment.' },
  { icon: Users,         title: 'Student Management',     desc: 'View enrolled students, track submissions, and monitor class engagement.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      {/* Nav */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <span className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white text-xs font-black">D</span>
            <span className="gradient-text">Deboistech LMS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link href="/auth/signup" className="text-sm bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white font-semibold px-4 py-2 rounded-[10px] transition-all duration-200 shadow-[0_0_16px_rgba(79,70,229,0.4)]">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--primary)]/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-[var(--accent)]/8 blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--primary)]/15 border border-[var(--primary)]/25 text-[var(--primary)] text-xs font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
            Now in V1 — Free for all Deboistech learners
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight mb-6">
            <span className="text-[var(--text-primary)]">The LMS built</span>
            <br />
            <span className="gradient-text">for Deboistech.</span>
          </h1>

          <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed">
            Create classes, share materials, assign work, and run tests — all in one beautifully designed platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth/signup" className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white font-bold px-7 py-3.5 rounded-[12px] text-base transition-all duration-200 shadow-[0_0_28px_rgba(79,70,229,0.5)] hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] hover:scale-[1.02]">
              Start Learning Free <ArrowRight size={18} />
            </Link>
            <Link href="/auth/login" className="flex items-center gap-2 border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold px-7 py-3.5 rounded-[12px] text-base transition-all duration-200 hover:bg-[var(--bg-elevated)]">
              Sign In
            </Link>
          </div>
        </div>

        {/* Stat pills */}
        <div className="relative z-10 mt-16 flex flex-wrap justify-center gap-4">
          {[
            { label: 'Active Classes',     value: '4+' },
            { label: 'Students Enrolled',  value: '85+' },
            { label: 'Materials Shared',   value: '20+' },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl px-6 py-3 flex flex-col items-center">
              <span className="text-2xl font-black text-[var(--text-primary)]">{s.value}</span>
              <span className="text-xs text-[var(--text-muted)]">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-3">Everything you need to teach and learn</h2>
          <p className="text-[var(--text-secondary)]">All the tools in one cohesive platform — no juggling between apps.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="glass rounded-[20px] p-6 hover:border-[var(--border-strong)] hover:-translate-y-1 transition-all duration-200 group">
                <div className="w-11 h-11 rounded-[12px] bg-[var(--primary)]/15 border border-[var(--primary)]/25 flex items-center justify-center mb-4 group-hover:bg-[var(--primary)]/25 transition-colors">
                  <Icon size={22} className="text-[var(--primary)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] p-10 text-center">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent)]" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-3">Ready to get started?</h2>
            <p className="text-white/80 mb-8">Join your classmates on Deboistech LMS today.</p>
            <Link href="/auth/signup" className="inline-flex items-center gap-2 bg-white text-[var(--primary)] font-bold px-8 py-3.5 rounded-[12px] hover:bg-white/90 transition-all duration-200 shadow-xl">
              Create Free Account <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="w-6 h-6 rounded bg-[var(--primary)] flex items-center justify-center text-white text-[10px] font-black">D</span>
            <span className="text-[var(--text-muted)]">Deboistech LMS</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">© 2026 Deboistech. All rights reserved. · V1.0</p>
        </div>
      </footer>
    </div>
  );
}
