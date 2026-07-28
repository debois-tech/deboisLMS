import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, GraduationCap, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tutors</h1>
          <p className="text-sm text-[var(--text-muted)]">{tutors.length} total</p>
        </div>
        <Link to="/tutors/new">
          <Button><Plus size={16} /> Add Tutor</Button>
        </Link>
      </div>

      {tutors.length === 0 ? (
        <EmptyState icon={<GraduationCap size={32} />} title="No tutors yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutors.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-sm font-bold text-emerald-400">
                  {t.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">{t.name}</h3>
                  <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                    {t.email && <span className="flex items-center gap-1"><Mail size={10} /> {t.email}</span>}
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