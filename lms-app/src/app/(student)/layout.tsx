'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { StudentSidebar } from '@/components/layout/StudentSidebar';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar onMenuToggle={() => setSidebarOpen(true)} />
      <div className="flex">
        <StudentSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
