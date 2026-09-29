import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Flag, Play, Plus, Users } from 'lucide-react';
import { QuizBoard, QuizOption, QuizTimer } from '@/components/exams/QuizParts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { StatusPill } from '@/components/ui/StatusPill';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useNow } from '@/lib/hooks/useNow';
import { secondsLeft, useQuizLive } from '@/lib/hooks/useQuizLive';
import {
  closeQuizQuestion, endQuiz, extendQuizQuestion, getClockOffset, getQuiz, getQuizAnswers, getQuizParticipants,
  getQuizScoreboard, quizGo, quizImageUrl,
} from '@/lib/supabase';
import type { QuizParticipant } from '@/lib/supabase';
import type { QuizAnswer, QuizFull, QuizScoreRow } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { percent, seconds } from '@/lib/utils/quiz';

interface ExamHostProps {
  quizId: string;
  onLeave: () => void;
  onEnded: () => void;
}

// The tutor's full-screen console: lobby, then one question at a time. Everything students see follows from here.
export function ExamHost({ quizId, onLeave, onEnded }: ExamHostProps) {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [quiz, setQuiz] = useState<QuizFull | null>(null);
  const [people, setPeople] = useState<QuizParticipant[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [board, setBoard] = useState<QuizScoreRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [next, joined, given, ranking] = await Promise.all([
      getQuiz(quizId), getQuizParticipants(quizId), getQuizAnswers(quizId), getQuizScoreboard(quizId),
    ]);
    if (!next) throw new Error('This quiz no longer exists.');
    setQuiz(next);
    setPeople(joined);
    setAnswers(given);
    setBoard(ranking);
  }, [quizId]);

  const { loading, error, retry } = useInitialLoad(load);
  useQuizLive(quizId, () => void load().catch(console.error), { host: true, pollMs: 4000 });

  useEffect(() => {
    const sync = () => void getClockOffset().then(setOffset).catch(console.error);
    sync();
    const id = window.setInterval(sync, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const now = useNow(250) + offset;

  const questions = quiz?.quiz_questions ?? [];
  const position = quiz?.current_position ?? -1;
  const current = questions[position];
  const lobby = quiz?.status === 'lobby';
  const closesAt = current?.closes_at ? Date.parse(current.closes_at) : 0;
  const answering = quiz?.status === 'live' && quiz.phase === 'answering' && now < closesAt;
  const isLast = position === questions.length - 1;

  // The countdown reaching zero closes the question for everyone; the database already refuses late answers.
  const expired = quiz?.status === 'live' && quiz.phase === 'answering' && closesAt > 0 && now >= closesAt ? current?.id : null;
  useEffect(() => {
    if (expired) void closeQuizQuestion(quizId).then(load).catch(console.error);
  }, [expired, quizId, load]);

  useEffect(() => {
    if (quiz?.status === 'ended') onEnded();
  }, [quiz?.status, onEnded]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      showToast(errorMessage(err, 'That did not work'), 'error');
    } finally {
      setBusy(false);
    }
  }, [load, showToast]);

  const finish = () => run(() => endQuiz(quizId));

  const start = async () => {
    if (people.length === 0) {
      const accepted = await confirm({ title: 'Nobody has joined yet', message: 'Students who join later can still answer the questions that follow.', confirmLabel: 'Start anyway' });
      if (!accepted) return;
    }
    await run(() => quizGo(quizId, 0));
  };

  const endNow = async () => {
    const accepted = await confirm({
      title: 'End the quiz now?',
      message: 'Questions you have not reached are dropped and everyone sees their result.',
      confirmLabel: 'End quiz',
      danger: true,
    });
    if (accepted) await finish();
  };

  // Answering: close it. Closed: forward, or finish after the last question.
  const primary = lobby
    ? { label: 'Start quiz', icon: <Play size={16} />, go: start }
    : answering
      ? { label: 'Close question', icon: null, go: () => run(() => closeQuizQuestion(quizId)) }
      : isLast && position === (quiz?.furthest ?? -1)
        ? { label: 'Finish quiz', icon: <Flag size={16} />, go: finish }
        : { label: 'Next question', icon: <ChevronRight size={16} />, go: () => run(() => quizGo(quizId, position + 1)) };
  const canBack = quiz?.status === 'live' && !answering && position > 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement;
      if (busy || el.closest('input, textarea, [role="dialog"]')) return;
      if (event.key === 'ArrowRight') void primary.go();
      if (event.key === 'ArrowLeft' && canBack) void run(() => quizGo(quizId, position - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading) return createPortal(<div className="qz-stage"><Spinner centered /></div>, document.body);
  if (error || !quiz) return createPortal(<div className="qz-stage"><ErrorState centered message={error ?? 'Could not load the quiz.'} onRetry={retry} /></div>, document.body);

  const here = answers.filter((answer) => current && answer.question_id === current.id);
  const counts = (id: string) => here.filter((answer) => answer.option_ids.includes(id)).length;
  const right = here.filter((answer) => answer.is_correct).length;
  const mean = here.length > 0 ? here.reduce((sum, answer) => sum + answer.elapsed_ms, 0) / here.length : null;
  const total = current?.opened_at && current.closes_at ? (Date.parse(current.closes_at) - Date.parse(current.opened_at)) / 1000 : 0;
  const settings = [
    `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`,
    `${quiz.seconds_per_question}s each`,
    quiz.show_answer ? 'Right answer shown' : 'Percentages only',
    quiz.live_leaderboard ? 'Leaderboard each question' : 'Leaderboard at the end',
  ];

  return createPortal(
    <div className="qz-stage" aria-label="Live quiz controls">
      <header className="qz-stage-head">
        <button type="button" className="qz-icon-btn" onClick={onLeave} aria-label="Leave the console, the quiz keeps running">
          <ArrowLeft size={18} />
        </button>
        <h1 className="qz-stage-title">{quiz.title}</h1>
        <StatusPill kind="quiz" value={quiz.status} />
        <Badge><Users size={12} /> {people.length}</Badge>
        {!lobby && current && <span className="qz-play-count">Question {position + 1} of {questions.length}</span>}
        <Button className="action-button-compact" variant="secondary" size="sm" onClick={() => void endNow()} disabled={busy}>End quiz</Button>
      </header>

      <div className="qz-stage-body">
        {lobby ? (
          <div className="qz-lobby">
            <div>
              <p className="qz-lobby-count" aria-live="polite">{people.length}</p>
              <p className="qz-lobby-caption">{people.length === 1 ? 'student is' : 'students are'} in the room</p>
            </div>
            <div className="qz-chips">{settings.map((label) => <Badge key={label}>{label}</Badge>)}</div>
            {people.length === 0 ? (
              <div className="qz-wait">
                <span className="qz-pulse" />
                <p className="qz-muted">Students find this quiz under Quizzes in their portal.</p>
              </div>
            ) : (
              <div className="qz-lobby-names">
                {people.map((person) => <span key={person.student_id} className="qz-chip">{person.students?.name ?? 'Student'}</span>)}
              </div>
            )}
          </div>
        ) : current ? (
          <div className="qz-stage-grid">
            <div className="qz-stage-main">
              <h2 className="qz-question">{current.body}</h2>
              {current.image_path && <img className="qz-image" src={quizImageUrl(current.image_path)} alt="" />}
              <div className="qz-opts">
                {current.quiz_options.map((option, index) => {
                  const count = counts(option.id);
                  const share = percent(count, here.length);
                  return (
                    <QuizOption
                      key={option.id}
                      index={index}
                      label={option.label}
                      large
                      state={answering ? 'idle' : option.is_correct ? 'correct' : 'dim'}
                      fill={share / 100}
                      pct={share}
                      count={count}
                      flag={option.is_correct ? 'correct' : undefined}
                    />
                  );
                })}
              </div>
            </div>

            <aside className="qz-stage-side">
              <div className="qz-panel">
                <div className="qz-panel-body">
                  {answering ? (
                    <QuizTimer big left={secondsLeft(current.closes_at, now)} total={total} />
                  ) : (
                    <p className="text-lg font-semibold">Question closed</p>
                  )}
                </div>
              </div>

              <div className="qz-panel">
                <div className="qz-panel-head">Answered</div>
                <div className="qz-panel-body">
                  <p className="qz-figure">{here.length}<span className="qz-figure-of"> of {people.length}</span></p>
                  <div className="qz-meter"><span style={{ '--p': people.length ? Math.min(1, here.length / people.length) : 0 } as React.CSSProperties} /></div>
                </div>
              </div>

              {!answering && (
                <div className="qz-panel">
                  <div className="qz-panel-head">Class</div>
                  <div className="qz-panel-body">
                    <p className="qz-figure">{percent(right, here.length)}%<span className="qz-figure-of"> got it right</span></p>
                    <p className="qz-muted">Average answer time {seconds(mean)}</p>
                  </div>
                </div>
              )}

              {!answering && board.length > 0 && (
                <div className="qz-panel">
                  <div className="qz-panel-head">
                    Ranking
                    <Badge size="sm" variant={quiz.live_leaderboard ? 'success' : 'default'}>{quiz.live_leaderboard ? 'Students see this' : 'Only you see this'}</Badge>
                  </div>
                  <QuizBoard rows={board.slice(0, 5).map((row) => ({ rank: row.rank, name: row.name, points: row.points }))} />
                </div>
              )}
            </aside>
          </div>
        ) : (
          <Spinner centered />
        )}
      </div>

      <footer className="qz-stage-foot">
        {lobby ? <span /> : (
          <nav className="qz-nav" aria-label="Questions">
            {questions.map((question, index) => {
              const reachable = index <= quiz.furthest && !answering;
              return (
                <button
                  key={question.id}
                  type="button"
                  className={`qz-dot${index === position ? ' is-current' : index <= quiz.furthest ? ' is-seen' : ''}`}
                  disabled={!reachable || busy}
                  aria-current={index === position}
                  aria-label={`Question ${index + 1}`}
                  onClick={() => void run(() => quizGo(quizId, index))}
                >
                  {index + 1}
                </button>
              );
            })}
          </nav>
        )}
        <div className="qz-stage-actions">
          {canBack && (
            <Button className="action-button-compact" variant="secondary" onClick={() => void run(() => quizGo(quizId, position - 1))} disabled={busy}>
              <ChevronLeft size={16} /> Previous
            </Button>
          )}
          {answering && (
            <Button className="action-button-compact" variant="secondary" onClick={() => void run(() => extendQuizQuestion(quizId, 15))} disabled={busy}>
              <Plus size={16} /> 15s
            </Button>
          )}
          <Button className="action-button-compact" onClick={() => void primary.go()} loading={busy}>
            {primary.label} {primary.icon}
          </Button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
