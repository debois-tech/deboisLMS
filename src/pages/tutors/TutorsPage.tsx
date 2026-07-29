import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, GraduationCap, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
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

  if (loading) return <Spinner />;

  return (
    <div className="page-section">
      <PageHeader
        title="Tutors"
        action={<Link to="/tutors/new"><Button><Plus size={16} /> Add Tutor</Button></Link>}
      />

      {tutors.length === 0 ? (
        <EmptyState icon={<GraduationCap size={32} />} title="No tutors yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutors.map((t) => (
            <Card key={t.id} padding="sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 shrink-0 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-400">
                  {t.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.name}</h3>
                  <div className="text-xs text-[var(--text-muted)] space-y-0.5 mt-0.5">
                    {t.email && <span className="flex items-center gap-1 truncate"><Mail size={10} /> {t.email}</span>}
                    {t.phone && <span className="flex items-center gap-1"><Phone size={10} /> {t.phone}</span>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
