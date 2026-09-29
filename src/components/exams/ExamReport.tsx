import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Download, Minus, Users, X } from 'lucide-react';
import { clsx } from 'clsx';
import { QuizOption } from '@/components/exams/QuizParts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getQuizAnswers, getQuizScoreboard, quizImageUrl } from '@/lib/supabase';
import type { QuizAnswer, QuizFull, QuizScoreRow } from '@/lib/types';
import { downloadCsv, toCsv, toFileStem } from '@/lib/utils/csvExport';
import { OPTION_LETTERS, percent, seconds } from '@/lib/utils/quiz';

const mean = (values: number[]) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

// The finished quiz for the host: class numbers, how each question went, and every student's run.
export function ExamReport({ quiz, studentBase }: { quiz: QuizFull; studentBase: string }) {
  const [board, setBoard] = useState<QuizScoreRow[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [term, setTerm] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    const [ranking, given] = await Promise.all([getQuizScoreboard(quiz.id), getQuizAnswers(quiz.id)]);
    setBoard(ranking);
    setAnswers(given);
  });

  const asked = useMemo(() => quiz.quiz_questions.filter((question) => question.opened_at), [quiz]);

  const perQuestion = useMemo(
    () => asked.map((question) => {
      const given = answers.filter((answer) => answer.question_id === question.id);
      return {
        question,
        given,
        accuracy: percent(given.filter((answer) => answer.is_correct).length, given.length),
        time: mean(given.map((answer) => answer.elapsed_ms)),
      };
    }),
    [asked, answers],
  );

  const hardest = useMemo(() => {
    const ranked = perQuestion.filter((item) => item.given.length > 0);
    return ranked.length > 1 ? ranked.reduce((low, item) => (item.accuracy < low.accuracy ? item : low)).question.id : null;
  }, [perQuestion]);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  const correctAnswers = answers.filter((answer) => answer.is_correct).length;
  const avgPoints = mean(board.map((row) => row.points));
  const shown = board.filter((row) => row.name.toLowerCase().includes(term.trim().toLowerCase()));

  const exportCsv = () => {
    const headers = ['Rank', 'Name', 'Student ID', 'Points', 'Correct', 'Answered', ...asked.map((_, index) => `Q${index + 1}`)];
    const lines = board.map((row) => [
      row.rank, row.name, row.code, row.points, row.correct, row.answered,
      ...asked.map((question) => {
        const answer = answers.find((item) => item.student_id === row.student_id && item.question_id === question.id);
        return answer ? (answer.is_correct ? 'Right' : 'Wrong') : 'No answer';
      }),
    ]);
    downloadCsv(`${toFileStem(quiz.title)}-results`, toCsv(headers, lines));
  };

  if (board.length === 0) {
    return <EmptyState icon={<Users size={22} />} title="Nobody took part in this quiz" />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Took part" value={board.length} />
        <StatCard label="Average score" value={avgPoints === null ? '-' : Math.round(avgPoints).toLocaleString('en-IN')} />
        <StatCard label="Accuracy" value={`${percent(correctAnswers, answers.length)}%`} />
        <StatCard label="Average answer" value={seconds(mean(answers.map((answer) => answer.elapsed_ms)))} />
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="rep-questions">
        <h2 id="rep-questions" className="qz-section-title">By question</h2>
        {perQuestion.map(({ question, given, accuracy, time }, index) => (
          <div key={question.id} className="qz-panel qz-review">
            <div className="qz-review-head">
              <p className="qz-review-title">{index + 1}. {question.body}</p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {question.id === hardest && <Badge variant="warning" size="sm">Hardest</Badge>}
                <Badge variant={accuracy >= 70 ? 'success' : accuracy >= 40 ? 'warning' : 'danger'} size="sm">{accuracy}% right</Badge>
                <Badge size="sm">{seconds(time)}</Badge>
              </div>
            </div>
            {question.image_path && <img className="qz-image" src={quizImageUrl(question.image_path)} alt="" />}
            <div className="qz-opts is-grid">
              {question.quiz_options.map((option, optionIndex) => {
                const count = given.filter((answer) => answer.option_ids.includes(option.id)).length;
                const share = percent(count, given.length);
                return (
                  <QuizOption
                    key={option.id}
                    index={optionIndex}
                    label={option.label}
                    state={option.is_correct ? 'correct' : 'idle'}
                    fill={share / 100}
                    pct={share}
                    count={count}
                    flag={option.is_correct ? 'correct' : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="rep-students">
        <div className="qz-section-head">
          <h2 id="rep-students" className="qz-section-title">Students</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar value={term} onChange={setTerm} placeholder="Search students" size="sm" />
            <Button className="action-button-compact" variant="secondary" size="sm" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
          </div>
        </div>

        <Table maxHeight="none">
          <THead>
            <TR>
              <TH>Rank</TH>
              <TH>Student</TH>
              <TH>Points</TH>
              <TH>Right</TH>
              <TH>Avg answer</TH>
              <TH><span className="sr-only">Details</span></TH>
            </TR>
          </THead>
          <TBody>
            {shown.flatMap((row) => {
              const mine = answers.filter((answer) => answer.student_id === row.student_id);
              const isOpen = openId === row.student_id;
              const rows = [
                <TR key={row.student_id}>
                  <TD className="tabular-nums font-semibold">{row.rank}</TD>
                  <TD>
                    <Link to={`${studentBase}/${row.student_id}`} className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">{row.name}</Link>
                    {row.code && <span className="qz-inline-note">{row.code}</span>}
                  </TD>
                  <TD className="tabular-nums">{row.points.toLocaleString('en-IN')}</TD>
                  <TD className="tabular-nums">{row.correct} of {asked.length}</TD>
                  <TD className="tabular-nums">{seconds(mean(mine.map((answer) => answer.elapsed_ms)))}</TD>
                  <TD>
                    <button
                      type="button"
                      className="qz-icon-btn"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} ${row.name}'s answers`}
                      onClick={() => setOpenId(isOpen ? null : row.student_id)}
                    >
                      <ChevronDown size={16} className={clsx('transition-transform duration-200', isOpen && 'rotate-180')} />
                    </button>
                  </TD>
                </TR>,
              ];
              if (isOpen) {
                rows.push(
                  <TR key={`${row.student_id}-detail`}>
                    <TD colSpan={6}>
                      <div className="qz-detail">
                        {asked.map((question, index) => {
                          const answer = mine.find((item) => item.question_id === question.id);
                          const picked = answer?.option_ids
                            .map((id) => OPTION_LETTERS[question.quiz_options.findIndex((option) => option.id === id)])
                            .join(', ');
                          return (
                            <div key={question.id} className="qz-detail-row">
                              <span className={clsx('qz-mark', !answer ? 'is-skip' : answer.is_correct ? 'is-ok' : 'is-no')} aria-hidden="true">
                                {answer ? (answer.is_correct ? <Check size={12} /> : <X size={12} />) : <Minus size={12} />}
                              </span>
                              <span className="min-w-0 truncate">
                                {index + 1}. {question.body}
                                <span className="qz-inline-note">{answer ? `picked ${picked}` : 'no answer'}</span>
                              </span>
                              <span className="tabular-nums text-[var(--text-muted)]">
                                {answer ? `${seconds(answer.elapsed_ms)} · ${answer.points.toLocaleString('en-IN')} pts` : '0 pts'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </TD>
                  </TR>,
                );
              }
              return rows;
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
