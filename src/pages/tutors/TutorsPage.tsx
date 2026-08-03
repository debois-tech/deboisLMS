import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, GraduationCap, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { SearchBar } from '@/components/ui/SearchBar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { getTutors } from '@/lib/supabase';
import type { Tutor } from '@/lib/types';

export default function TutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTutors().then((data) => {
      setTutors(data);
      setLoading(false);
    });
  }, []);

  const filteredTutors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tutors;
    return tutors.filter((t) =>
      `${t.name} ${t.phone ?? ''} ${t.email ?? ''}`.toLowerCase().includes(term),
    );
  }, [tutors, search]);

  if (loading) return <Spinner centered />;

  return (
    <div className="page-section">
      <PageHeader
        title="Tutors"
        action={<Link to="/tutors/new"><Button className="action-button-compact"><Plus size={16} />Add Tutor</Button></Link>}
      />

      {tutors.length === 0 ? (
        <EmptyState icon={<GraduationCap size={32} />} title="No tutors yet" />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, phone, or email"
            />
          </div>

          {filteredTutors.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title="No matching tutors" />
          ) : (
            <Table maxHeight="none">
              <THead>
                <TR>
                  <TH>Tutor</TH>
                  <TH>Email</TH>
                  <TH>Phone</TH>
                </TR>
              </THead>
              <TBody>
                {filteredTutors.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <Link to={`/tutors/${t.id}`} className="flex items-center gap-3 group">
                        <Avatar name={t.name} size="md" />
                        <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)]">{t.name}</span>
                      </Link>
                    </TD>
                    <TD className="cell-secondary">{t.email || '—'}</TD>
                    <TD className="cell-muted">{t.phone || '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
