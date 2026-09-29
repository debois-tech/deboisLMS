import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Trophy, Zap } from 'lucide-react';
import { QuizBoard, QuizOption, QuizTimer, QuizVerdict } from '@/components/exams/QuizParts';
import { PortalEmpty, PortalPage, PortalSection, PortalStat, PortalStatGrid } from '@/components/portal';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/context/AuthContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useNow } from '@/lib/hooks/useNow';
import { secondsLeft, useClockOffset, useQuizLive } from '@/lib/hooks/useQuizLive';
import { answerQuiz, getQuizResult, getQuizScoreboard, getQuizState, joinQuiz, quizImageUrl } from '@/lib/supabase';
import type { QuizResult, QuizScoreRow, QuizState } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { ordinal, percent, seconds } from '@/lib/utils/quiz';

// One page follows the quiz from the lobby to the result: what it shows is decided by the quiz's state alone.
export default function PortalQuizPage() {
  const { quizId = '' } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState<QuizState | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [board, setBoard] = useState<QuizScoreRow[]>([]);
  const [absent, setAbsent] = useState(false);
  const [offset, syncOffset] = useClockOffset();
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [problem, setProblem] = useState<string | null>(null);
  // Taps are saved one after another, so a slow reply cannot overwrite a later pick.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const fetchedResult = useRef(false);

  const load = useCallback(async () => {
    let next = await getQuizState(quizId);
    if (!next.joined && (next.status === 'lobby' || next.status === 'live')) {
      await joinQuiz(quizId);
      next = await getQuizState(quizId);
    }
    syncOffset(next.server_now);
    setState(next);

    if (next.status === 'ended' && !fetchedResult.current) {
      fetchedResult.current = true;
      try {
        const [mine, ranking] = await Promise.all([getQuizResult(quizId), getQuizScoreboard(quizId)]);
        setResult(mine);
        setBoard(ranking);
      } catch (err) {
        // A dropped connection is not "you were not there": try again on the next load.
        fetchedResult.current = false;
        if (!/did not take part/i.test(errorMessage(err, ''))) throw err;
        fetchedResult.current = true;
        setAbsent(true);
      }
    }
  }, [quizId, syncOffset]);

  const { loading, error, retry } = useInitialLoad(load, true);
  useQuizLive(quizId, () => void load().catch(console.error), { pollMs: state?.status === 'ended' ? 60_000 : 5000 });

  const now = useNow(250) + offset;
  const question = state?.question;
  const closesMs = question ? Date.parse(question.closes_at) : 0;
  const timeUp = Boolean(question) && now >= closesMs;
  const locked = Boolean(state?.closed) || timeUp;

  // The clock ran out before the server said so; ask again until it agrees.
  const overdue = state?.status === 'live' && question && !state.closed && timeUp ? question.id : null;
  useEffect(() => {
    if (!overdue) return;
    const id = window.setTimeout(() => void load().catch(console.error), 400);
    return () => window.clearTimeout(id);
  }, [overdue, state?.server_now, load]);

  const shown = question ? picks[question.id] ?? state?.mine ?? [] : [];

  const choose = (optionId: string) => {
    if (!question || locked) return;
    let next: string[];
    if (question.multi) {
      next = shown.includes(optionId) ? shown.filter((id) => id !== optionId) : [...shown, optionId];
      if (next.length === 0) return;
    } else {
      if (shown.length === 1 && shown[0] === optionId) return;
      next = [optionId];
    }
    const id = question.id;
    setPicks((current) => ({ ...current, [id]: next }));
    setProblem(null);
    chain.current = chain.current
      .then(() => answerQuiz(id, next))
      .catch((err) => {
        setProblem(errorMessage(err, 'Your answer was not saved'));
        setPicks((current) => {
          const copy = { ...current };
          delete copy[id];
          return copy;
        });
        return load().catch(console.error);
      });
  };

  if (loading || error || !state) return <PortalPage title="Quiz" shape="list" loading={loading} error={error} onRetry={retry}>{null}</PortalPage>;

  if (state.status === 'ended') {
    if (absent) return <PortalPage title={state.title} shape="list"><PortalEmpty icon={Zap}>You did not take part in this quiz.</PortalEmpty></PortalPage>;
    if (!result) return <PortalPage title={state.title} shape="list" loading>{null}</PortalPage>;
    return <Result result={result} board={board} />;
  }

  if (state.status === 'lobby' || !question) {
    return (
      <div className="qz-play">
        <div className="qz-wait">
          <span className="qz-pulse" />
          <h1 className="qz-wait-title">{state.status === 'lobby' ? 'You are in' : 'Get ready'}</h1>
          <p className="qz-muted">{state.title}</p>
          <p className="qz-muted">{state.participants} in the room, waiting for your tutor to start</p>
        </div>
      </div>
    );
  }

  const reveal = state.closed ? state.reveal : undefined;
  const mine = state.mine ?? [];
  const span = (Date.parse(question.closes_at) - Date.parse(question.opened_at)) / 1000;
  const standing = reveal ? state.standing : undefined;

  const verdict = mine.length === 0 && !shown.length
    ? 'none'
    : !state.show_answer ? 'neutral' : reveal?.is_correct ? 'correct' : 'wrong';
  const verdictNote = { none: 'You did not answer in time', neutral: 'Your answer is locked in', wrong: 'The right answer is highlighted', correct: undefined }[verdict];

  return (
    <div className="qz-play">
      <div className="qz-play-head">
        <span className="qz-play-count">{state.position + 1} / {state.total}</span>
        {!locked && <QuizTimer left={secondsLeft(question.closes_at, now)} total={span} />}
      </div>

      <h1 className="qz-question">{question.body}</h1>
      {question.image_path && <img className="qz-image" src={quizImageUrl(question.image_path)} alt="" />}
      {question.multi && !locked && <p className="qz-note">Choose every correct answer</p>}

      <div className="qz-opts" role="group" aria-label="Answers">
        {question.options.map((option, index) => {
          const chosen = shown.includes(option.id);
          if (!reveal) {
            return (
              <QuizOption
                key={option.id}
                index={index}
                label={option.label}
                large
                state={chosen ? 'selected' : 'idle'}
                disabled={locked}
                onClick={() => choose(option.id)}
              />
            );
          }
          const count = reveal.counts[option.id] ?? 0;
          const share = percent(count, reveal.answered);
          const key = reveal.correct_ids;
          const right = key?.includes(option.id);
          return (
            <QuizOption
              key={option.id}
              index={index}
              label={option.label}
              large
              state={key ? (right ? 'correct' : chosen ? 'wrong' : 'dim') : chosen ? 'selected' : 'idle'}
              flag={key ? (right ? 'correct' : chosen ? 'wrong' : undefined) : undefined}
              fill={share / 100}
              pct={share}
              count={count}
            />
          );
        })}
      </div>

      {!locked && (
        <p className="qz-note" role="status">
          {problem ?? (shown.length > 0 ? 'Saved. You can change it until time runs out.' : 'Pick an answer before time runs out.')}
        </p>
      )}
      {locked && !reveal && <p className="qz-note" role="status">Time is up. Answers are coming in.</p>}

      {reveal && (
        <>
          <QuizVerdict kind={verdict} points={reveal.points} note={verdictNote} />
          {standing?.top && (
            <div className="qz-panel">
              <div className="qz-panel-head">Leaderboard{standing.rank ? <span>You are {ordinal(standing.rank)}</span> : null}</div>
              <QuizBoard
                rows={[
                  ...standing.top,
                  ...(standing.rank && !standing.top.some((row) => row.me)
                    ? [{ rank: standing.rank, name: user?.full_name ?? 'You', points: standing.points ?? 0, me: true }]
                    : []),
                ]}
              />
            </div>
          )}
          <div className="flex items-center justify-center gap-3 qz-note">
            <span className="qz-pulse" /> Waiting for your tutor to continue
          </div>
        </>
      )}
    </div>
  );
}

function Result({ result, board }: { result: QuizResult; board: QuizScoreRow[] }) {
  return (
    <PortalPage title={result.title} shape="list">
      <PortalStatGrid>
        <PortalStat label="Rank" icon={Trophy} value={ordinal(result.rank)} note={`of ${result.participants}`} tone={result.rank <= 3 ? 'positive' : 'default'} />
        <PortalStat label="Score" icon={Zap} value={result.points.toLocaleString('en-IN')} note={`Class average ${result.avg_points.toLocaleString('en-IN')}`} />
        <PortalStat
          label="Right answers"
          icon={Check}
          value={`${result.correct} of ${result.questions}`}
          note={`Class average ${result.avg_correct}`}
          progress={percent(result.correct, result.questions)}
        />
      </PortalStatGrid>

      <PortalSection title="Leaderboard">
        <div className="qz-panel">
          <QuizBoard rows={board.map((row) => ({ rank: row.rank, name: row.name, points: row.points, me: row.me }))} />
        </div>
      </PortalSection>

      {result.review && result.review.length > 0 && (
        <PortalSection title="Your answers">
          <div className="flex flex-col gap-4">
            {result.review.map((item) => (
              <div key={item.position} className="qz-panel qz-review">
                <div className="qz-review-head">
                  <p className="qz-review-title">{item.position + 1}. {item.body}</p>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {item.mine === null ? (
                      <Badge size="sm">No answer</Badge>
                    ) : item.is_correct ? (
                      <Badge variant="success" size="sm">+{item.points.toLocaleString('en-IN')}</Badge>
                    ) : (
                      <Badge variant="danger" size="sm">Wrong</Badge>
                    )}
                    {item.mine !== null && <Badge size="sm">{seconds(item.elapsed_ms)}</Badge>}
                  </div>
                </div>
                {item.image_path && <img className="qz-image" src={quizImageUrl(item.image_path)} alt="" />}
                <div className="qz-opts is-grid">
                  {item.options.map((option, index) => {
                    const chosen = item.mine?.includes(option.id) ?? false;
                    const share = percent(option.count, item.answered);
                    return (
                      <QuizOption
                        key={option.id}
                        index={index}
                        label={option.label}
                        state={option.correct ? 'correct' : chosen ? 'wrong' : 'idle'}
                        flag={option.correct ? 'correct' : chosen ? 'wrong' : undefined}
                        fill={share / 100}
                        pct={share}
                        count={option.count}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </PortalSection>
      )}
    </PortalPage>
  );
}
