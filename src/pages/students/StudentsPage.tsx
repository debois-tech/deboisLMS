import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
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
        action={<Link to="/students/new"><Button><Plus size={16} />Add Student</Button></Link>}
      />

      {students.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No students yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s) => (
            <Link key={s.id} to={`/students/${s.id}`} className="block group">
              <Card hover padding="md" className="flex h-full min-h-[5rem] items-center gap-4">
                <Avatar name={s.name} size="lg" />
                <h3 className="min-w-0 text-base font-bold text-[var(--text-primary)] break-words">{s.name}</h3>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
