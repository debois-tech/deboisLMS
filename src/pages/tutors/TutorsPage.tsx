import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { getTutors } from '@/lib/supabase';
import type { Tutor } from '@/lib/types';

export default function TutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTutors().then((data) => {
      setTutors(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner centered />;

  return (
    <div className="page-section">
      <PageHeader
        title="Tutors"
        action={<Link to="/tutors/new"><Button className="action-button"><Plus size={16} />Add Tutor</Button></Link>}
      />

      {tutors.length === 0 ? (
        <EmptyState icon={<GraduationCap size={32} />} title="No tutors yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutors.map((t) => (
            <Link key={t.id} to={`/tutors/${t.id}`} className="block group">
              <Card hover padding="md" className="flex h-full min-h-[5rem] items-center gap-4">
                <Avatar name={t.name} size="lg" />
                <h3 className="min-w-0 text-base font-bold text-[var(--text-primary)] break-words">{t.name}</h3>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
