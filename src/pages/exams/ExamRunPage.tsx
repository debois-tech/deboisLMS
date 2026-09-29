import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Pencil, Play, Trash2 } from 'lucide-react';
import { ExamHost } from '@/components/exams/ExamHost';
import { ExamReport } from '@/components/exams/ExamReport';
import { QuizOption } from '@/components/exams/QuizParts';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { NotFound } from '@/components/ui/NotFound';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { StatusPill } from '@/components/ui/StatusPill';
import { useAuth } from '@/lib/context/AuthContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { deleteQuiz, getQuiz, openQuizLobby, quizImageUrl } from '@/lib/supabase';
import type { QuizFull } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { formatDateTime } from '@/lib/utils/format';

// Admin `/exams/:quizId` and tutor `/tutor/exams/:quizId`: a draft's summary, the live console, or the finished report.
export default function ExamRunPage() {
  const { quizId } = useParams();
  const { isAdmin } = useAuth();
  const base = isAdmin ? '/exams' : '/tutor/exams';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [quiz, setQuiz] = useState<QuizFull | null>(null);
  const [opening, setOpening] = useState(false);

  const reload = async () => setQuiz((await getQuiz(quizId!)) ?? null);
  const { loading, error, retry } = useInitialLoad(reload);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!quiz) return <NotFound label="Quiz" />;

  if (quiz.status === 'lobby' || quiz.status === 'live') {
    return <ExamHost quizId={quiz.id} onLeave={() => navigate(base)} onEnded={() => void reload()} />;
  }

  const open = async () => {
    setOpening(true);
    try {
      await openQuizLobby(quiz.id);
      await reload();
    } catch (err) {
      showToast(errorMessage(err, 'Could not open the lobby'), 'error');
    } finally {
      setOpening(false);
    }
  };

  const remove = async () => {
    const accepted = await confirm({
      title: `Delete "${quiz.title}"?`,
      message: quiz.status === 'ended' ? 'Its results are deleted for everyone who took part. This cannot be undone.' : 'This cannot be undone.',
      confirmLabel: 'Delete quiz',
      danger: true,
    });
    if (!accepted) return;
    try {
      await deleteQuiz(quiz.id);
      showToast('Quiz deleted');
      navigate(base);
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete the quiz'), 'error');
    }
  };

  const draft = quiz.status === 'draft';

  return (
    <div className="page-section">
      <Link to={base} className="flex w-fit items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} /> All exams
      </Link>
      <PageHeader
        title={quiz.title}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button className="action-button-compact" variant="ghost" size="sm" onClick={() => void remove()}><Trash2 size={14} /> Delete</Button>
            <Button className="action-button-compact" variant="secondary" size="sm" onClick={() => navigate(`${base}/new?from=${quiz.id}`)}><Copy size={14} /> {draft ? 'Duplicate' : 'Run again'}</Button>
            {draft && <Button className="action-button-compact" variant="secondary" size="sm" onClick={() => navigate(`${base}/${quiz.id}/edit`)}><Pencil size={14} /> Edit</Button>}
            {draft && <Button className="action-button-compact" size="sm" loading={opening} onClick={() => void open()}><Play size={14} /> Open lobby</Button>}
          </div>
        }
      />

      <div className="qz-section">
        <dl className="qz-facts">
          <Fact label="Status"><StatusPill kind="quiz" value={quiz.status} /></Fact>
          <Fact label="Who can join">{quiz.batches?.name ?? 'Everyone'}</Fact>
          <Fact label="Time per question">{quiz.seconds_per_question}s</Fact>
          <Fact label="After each question">{quiz.show_answer ? 'The right answer' : 'Percentages only'}</Fact>
          <Fact label="Leaderboard">{quiz.live_leaderboard ? 'After every question' : 'Only at the end'}</Fact>
          <Fact label="When it is over">{quiz.student_review ? 'Students can review answers' : 'Score and rank only'}</Fact>
          {quiz.ended_at && <Fact label="Ended">{formatDateTime(quiz.ended_at)}</Fact>}
        </dl>
      </div>

      {quiz.status === 'ended' ? (
        <ExamReport quiz={quiz} studentBase={isAdmin ? '/students' : '/tutor/students'} />
      ) : (
        <section className="flex flex-col gap-4" aria-labelledby="run-questions">
          <h2 id="run-questions" className="qz-section-title">Questions ({quiz.quiz_questions.length})</h2>
          {quiz.quiz_questions.length === 0 && <p className="qz-muted">No questions yet.</p>}
          {quiz.quiz_questions.map((question, index) => (
            <div key={question.id} className="qz-panel qz-review">
              <p className="qz-review-title">{index + 1}. {question.body || 'Untitled question'}</p>
              {question.image_path && <img className="qz-image" src={quizImageUrl(question.image_path)} alt="" />}
              <div className="qz-opts is-grid">
                {question.quiz_options.map((option, optionIndex) => (
                  <QuizOption
                    key={option.id}
                    index={optionIndex}
                    label={option.label}
                    state={option.is_correct ? 'correct' : 'idle'}
                    flag={option.is_correct ? 'correct' : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="qz-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
