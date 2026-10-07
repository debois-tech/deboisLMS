import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { PortalEmpty, PortalFocus, PortalList, PortalPage, PortalRow, PortalSection } from '@/components/portal';
import { usePortalBatch } from '@/lib/context/PortalBatchContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getOpenQuizzes, getQuizHistory } from '@/lib/supabase';
import type { OpenQuiz } from '@/lib/supabase';
import type { QuizHistoryRow } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';
import { ordinal } from '@/lib/utils/quiz';

const REFRESH_MS = 8000;

// The chosen batch and quizzes for everyone
const forBatch = <T extends { batch_id: string | null }>(items: T[], batchId: string | null) =>
  items.filter((item) => !item.batch_id || item.batch_id === batchId);

export default function PortalQuizzesPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<OpenQuiz[]>([]);
  const [history, setHistory] = useState<QuizHistoryRow[]>([]);
  const { batchId } = usePortalBatch();

  const { loading, error, retry } = useInitialLoad(async () => {
    const [openNow, past] = await Promise.all([getOpenQuizzes(), getQuizHistory()]);
    setOpen(forBatch(openNow, batchId));
    setHistory(forBatch(past, batchId));
  }, true);

  // A quiz opens while this page is showing; no push for the list, so look again now and then.
  useEffect(() => {
    const id = window.setInterval(() => void getOpenQuizzes().then((list) => setOpen(forBatch(list, batchId))).catch(console.error), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [batchId]);

  const [first, ...others] = open;

  return (
    <PortalPage title="Quizzes" shape="list" loading={loading} error={error} onRetry={retry}>
      {first && (
        <PortalFocus
          icon={Zap}
          title={first.status === 'live' ? `${first.title} is live` : `${first.title} is about to start`}
          detail={first.batches?.name ?? 'Open to everyone'}
          action={<Link to={`/portal/quizzes/${first.id}`} className="portal-focus-link">Join</Link>}
        />
      )}

      {others.length > 0 && (
        <PortalSection title="Also open">
          <PortalList>
            {others.map((quiz) => (
              <PortalRow
                key={quiz.id}
                primary={quiz.title}
                secondary={quiz.batches?.name ?? 'Open to everyone'}
                onClick={() => navigate(`/portal/quizzes/${quiz.id}`)}
              />
            ))}
          </PortalList>
        </PortalSection>
      )}

      {history.length > 0 && (
        <PortalSection title="Past quizzes">
          <PortalList>
            {history.map((row) => (
              <PortalRow
                key={row.quiz_id}
                primary={row.title}
                secondary={`${formatDate(row.ended_at)} · ${row.correct} of ${row.questions} right`}
                trailing={<span className="text-sm font-semibold tabular-nums">{ordinal(row.rank)} of {row.participants}</span>}
                onClick={() => navigate(`/portal/quizzes/${row.quiz_id}`)}
              />
            ))}
          </PortalList>
        </PortalSection>
      )}

      {!first && history.length === 0 && <PortalEmpty icon={Zap}>No quizzes yet.</PortalEmpty>}
    </PortalPage>
  );
}
