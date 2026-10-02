import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Radio, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/lib/context/AuthContext';
import { useDeleteQuiz } from '@/lib/hooks/useDeleteQuiz';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getQuizzes } from '@/lib/supabase';
import type { QuizListItem } from '@/lib/supabase';
import type { QuizStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

type Filter = 'all' | 'draft' | 'running' | 'ended';

const RUNNING: QuizStatus[] = ['lobby', 'live'];

// Admin `/exams` and tutor `/tutor/exams`: every quiz, newest first. RLS narrows a tutor to their batches.
export default function ExamsPage() {
  const { isAdmin } = useAuth();
  const base = isAdmin ? '/exams' : '/tutor/exams';

  return (
    <div className="page-section">
      <PageHeader title="Exams" />
      <Tabs
        tabs={[
          { label: 'Live MCQ', value: 'mcq' },
          { label: 'Short test', value: 'short', soon: true },
          { label: 'Long test', value: 'long', soon: true },
        ]}
      >
        {() => <LiveQuizzes base={base} />}
      </Tabs>
    </div>
  );
}

function LiveQuizzes({ base }: { base: string }) {
  const navigate = useNavigate();
  const deleteWithConfirm = useDeleteQuiz();
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const { loading, error, retry } = useInitialLoad(async () => {
    setQuizzes(await getQuizzes());
  });

  const remove = async (quiz: QuizListItem) => {
    if (await deleteWithConfirm(quiz)) setQuizzes((rows) => rows.filter((row) => row.id !== quiz.id));
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  const count = (test: (quiz: QuizListItem) => boolean) => quizzes.filter(test).length;
  const shown = quizzes.filter((quiz) => {
    if (filter === 'draft') return quiz.status === 'draft';
    if (filter === 'running') return RUNNING.includes(quiz.status);
    if (filter === 'ended') return quiz.status === 'ended';
    return true;
  });

  return (
    <div className="table-block">
      <div className="table-toolbar">
        <FilterTabs
          label="Filter quizzes"
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: quizzes.length },
            { value: 'draft', label: 'Drafts', count: count((quiz) => quiz.status === 'draft') },
            { value: 'running', label: 'Live', count: count((quiz) => RUNNING.includes(quiz.status)) },
            { value: 'ended', label: 'Ended', count: count((quiz) => quiz.status === 'ended') },
          ]}
        />
        <Button className="action-button-compact" onClick={() => navigate(`${base}/new`)}>
          <Plus size={16} /> New quiz
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Radio size={22} />}
          title={quizzes.length === 0 ? 'No quizzes yet. Create New One!' : 'Nothing here'}
        />
      ) : (
        <Table maxHeight="none">
          <THead>
            <TR>
              <TH>Quiz</TH>
              <TH>For</TH>
              <TH>Questions</TH>
              <TH>Joined</TH>
              <TH>Status</TH>
              <TH>Created</TH>
              <TH><span className="sr-only">Actions</span></TH>
            </TR>
          </THead>
          <TBody>
            {shown.map((quiz) => (
              <TR key={quiz.id}>
                <TD>
                  <Link to={`${base}/${quiz.id}`} className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">
                    {quiz.title}
                  </Link>
                </TD>
                <TD>{quiz.batches?.name ?? 'Everyone'}</TD>
                <TD className="tabular-nums">{quiz.quiz_questions[0]?.count ?? 0}</TD>
                <TD className="tabular-nums">{quiz.status === 'draft' ? '-' : quiz.quiz_participants[0]?.count ?? 0}</TD>
                <TD><StatusPill kind="quiz" value={quiz.status} /></TD>
                <TD>{formatDate(quiz.created_at)}</TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    {RUNNING.includes(quiz.status) && (
                      <Link to={`${base}/${quiz.id}`} className="qz-link-action">
                        Resume
                      </Link>
                    )}
                    <button type="button" className="qz-icon-btn is-danger" onClick={() => void remove(quiz)} aria-label={`Delete ${quiz.title}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
