import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { getStudents } from '@/lib/supabase';
import type { Student } from '@/lib/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudents().then((data) => {
      setStudents(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="page-section">
      <PageHeader
        title="Students"
        action={<Link to="/students/new"><Button><Plus size={16} /> Add Student</Button></Link>}
      />

      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s) => (
            <Link key={s.id} to={`/students/${s.id}`} className="block group">
              <Card hover padding="sm">
                <div className="flex items-center gap-3 mb-3 min-w-0">
                  <Avatar name={s.name} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{s.name}</h3>
                    {s.email && (
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 truncate"><Mail size={10} className="shrink-0" /> <span className="truncate">{s.email}</span></p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {s.github_url && (
                    <a href={s.github_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                       className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center gap-1">
                      GitHub <ExternalLink size={10} />
                    </a>
                  )}
                  {s.linkedin_url && (
                    <a href={s.linkedin_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                       className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center gap-1">
                      LinkedIn <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
