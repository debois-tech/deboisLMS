'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, BookOpen, Users, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { ConfirmModal } from '@/components/ui/Modal';
import { useToast } from '@/lib/context/ToastContext';
import { getAdminClasses, deleteClass } from '@/lib/mock/classes';
import type { Class } from '@/lib/types';

export default function AdminClassesPage() {
  const { showToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Class | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { getAdminClasses().then((c) => { setClasses(c); setLoading(false); }); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteClass(deleteTarget.id);
    setClasses((c) => c.filter((x) => x.id !== deleteTarget.id));
    showToast(`"${deleteTarget.name}" deleted.`, 'success');
    setDeleteTarget(null);
    setDeleting(false);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Classes</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{classes.length} class{classes.length !== 1 ? 'es' : ''} total</p>
        </div>
        <Link href="/admin/classes/new"><Button size="sm"><Plus size={15} /> New Class</Button></Link>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={<BookOpen size={26} />} title="No classes yet" description="Create your first class to get started." action={{ label: 'Create Class', onClick: () => {} }} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {classes.map((cls) => (
            <Card key={cls.id} className="relative">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-[var(--primary)]/15 border border-[var(--primary)]/20 flex items-center justify-center">
                    <BookOpen size={18} className="text-[var(--primary)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] text-sm">{cls.name}</h3>
                    {cls.subject && <p className="text-xs text-[var(--text-muted)]">{cls.subject}</p>}
                  </div>
                </div>
                {/* Kebab menu */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === cls.id ? null : cls.id)}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen === cls.id && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] py-1 z-10 shadow-[var(--shadow-lg)] animate-fade-in">
                      <Link href={`/admin/classes/${cls.id}/edit`} className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors" onClick={() => setMenuOpen(null)}>
                        <Pencil size={13} /> Edit
                      </Link>
                      <Link href={`/admin/classes/${cls.id}/students`} className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors" onClick={() => setMenuOpen(null)}>
                        <Users size={13} /> Students
                      </Link>
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors" onClick={() => { setDeleteTarget(cls); setMenuOpen(null); }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)] mb-4 line-clamp-2">{cls.description}</p>

              {/* Join code */}
              <CodeBlock code={cls.join_code} label="Join Code" />

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Users size={12} /> {cls.student_count}
                  </span>
                  <Badge variant={cls.is_active ? 'success' : 'danger'} dot>{cls.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <Link href={`/admin/classes/${cls.id}`}>
                  <Button size="sm" variant="secondary">Manage</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This will permanently remove all students, materials, assignments and tests in this class."
        confirmLabel="Delete Class"
      />
    </div>
  );
}
