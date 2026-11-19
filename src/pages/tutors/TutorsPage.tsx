import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, GraduationCap, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { SearchBar } from '@/components/ui/SearchBar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { BatchPills } from '@/components/ui/BatchSelect';
import { getTutors, getAllTutorBatches } from '@/lib/supabase';
import type { Tutor, Batch } from '@/lib/types';

export default function TutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [batchesByTutor, setBatchesByTutor] = useState<Map<string, Batch[]>>(new Map());
  const [search, setSearch] = useState('');

  const { loading, error, retry } = useInitialLoad(async () => {
    const [tutorData, mappings] = await Promise.all([getTutors(), getAllTutorBatches()]);
    setTutors(tutorData);
    // Ongoing and upcoming only: the column shows who teaches what now.
    const byTutor = new Map<string, Batch[]>();
    for (const { tutor_id, batch } of mappings) {
      if (!batch || batch.status === 'completed') continue;
      byTutor.set(tutor_id, [...(byTutor.get(tutor_id) ?? []), batch]);
    }
    setBatchesByTutor(byTutor);
  });

  const filteredTutors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tutors;
    // Batch-wise: the names and programme codes shown in the Batches column are searchable too.
    return tutors.filter((t) => {
      const batches = (batchesByTutor.get(t.id) ?? []).map((b) => `${b.name} ${b.program ?? ''}`).join(' ');
      return `${t.name} ${t.phone ?? ''} ${t.email ?? ''} ${batches}`.toLowerCase().includes(term);
    });
  }, [tutors, search, batchesByTutor]);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

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
          <div className="mb-4">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, phone, email or batch"
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
                  <TH align="center">Batches</TH>
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
                    <TD align="center" className="cell-secondary"><BatchPills batches={batchesByTutor.get(t.id) ?? []} /></TD>
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
