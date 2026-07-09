'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { getStudentClasses } from '@/lib/mock/classes';
import type { Class } from '@/lib/types';

export default function MyClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentClasses().then((c) => { setClasses(c); setLoading(false); });
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Classes</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{classes.length} class{classes.length !== 1 ? 'es' : ''} enrolled</p>
        </div>
        <Link href="/dashboard/join">
          <Button size="sm"><Plus size={15} /> Join Class</Button>
        </Link>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          title="No classes yet"
          description="Join a class using a code from your instructor."
          action={{ label: 'Join a Class', onClick: () => {} }}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Link key={cls.id} href={`/dashboard/classes/${cls.id}`}>
              <Card hover className="h-full">
                <div className="w-10 h-10 rounded-[10px] bg-[var(--primary)]/15 border border-[var(--primary)]/20 flex items-center justify-center mb-4">
                  <BookOpen size={20} className="text-[var(--primary)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1 line-clamp-2">{cls.name}</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4 line-clamp-3">{cls.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cls.subject && <Badge>{cls.subject}</Badge>}
                    {!cls.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{cls.student_count} students</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
