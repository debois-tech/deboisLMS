import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Download, Eye, EyeOff, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { QuizOption } from '@/components/exams/QuizParts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { SearchBar } from '@/components/ui/SearchBar';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { getQuizAnswers, getQuizScoreboard, quizImageUrl } from '@/lib/supabase';
import type { QuizAnswer, QuizFull, QuizScoreRow } from '@/lib/types';
import { downloadCsv, toCsv, toFileStem } from '@/lib/utils/csvExport';
import { accuracy, percent, seconds } from '@/lib/utils/quiz';

const mean = (values: number[]) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

// The finished quiz for the host: class numbers, how each question went, and every student's run.
export function ExamReport({ quiz, studentBase }: { quiz: QuizFull; studentBase: string }) {
  const [board, setBoard] = useState<QuizScoreRow[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [term, setTerm] = useState('');
  // The id stays while the card fades out, so its content does not vanish mid-exit.
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);

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
  const viewing = board.find((row) => row.student_id === viewId);

  const exportCsv = () => {
    const headers = ['Rank', 'Name', 'Student ID', 'Accuracy %', 'Correct', 'Answered', ...asked.map((_, index) => `Q${index + 1}`)];
    const lines = board.map((row) => [
      row.rank, row.name, row.code, accuracy(row.points, asked.length), row.correct, row.answered,
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
        <StatCard label="Test Takers" value={board.length} />
        <StatCard label="Avg score" value={avgPoints === null ? '-' : Math.round(avgPoints).toLocaleString('en-IN')} />
        <StatCard label="Accuracy" value={`${percent(correctAnswers, answers.length)}%`} />
        <StatCard label="Avg Time" value={seconds(mean(answers.map((answer) => answer.elapsed_ms)))} />
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="rep-students">
        <div className="qz-section-head">
          <h2 id="rep-students" className="qz-section-title">Students</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-64 max-w-full"><SearchBar value={term} onChange={setTerm} placeholder="Search students" size="sm" /></div>
            <Button className="action-button-compact" variant="secondary" size="sm" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
          </div>
        </div>

        <Table maxHeight="none">
          <THead>
            <TR>
              <TH>Rank</TH>
              <TH>Student</TH>
              <TH>Points</TH>
              <TH>Accuracy</TH>
              <TH>Right</TH>
              <TH>Avg answer</TH>
              <TH><span className="sr-only">Details</span></TH>
            </TR>
          </THead>
          <TBody>
            {shown.map((row) => {
              const mine = answers.filter((answer) => answer.student_id === row.student_id);
              return (
                <TR key={row.student_id}>
                  <TD className="tabular-nums font-semibold">{row.rank}</TD>
                  <TD>
                    <Link to={`${studentBase}/${row.student_id}`} className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">{row.name}</Link>
                    {row.code && <span className="qz-inline-note">{row.code}</span>}
                  </TD>
                  <TD className="tabular-nums">{row.points.toLocaleString('en-IN')}</TD>
                  <TD className="tabular-nums">{accuracy(row.points, asked.length)}%</TD>
                  <TD className="tabular-nums">{row.correct} of {asked.length}</TD>
                  <TD className="tabular-nums">{seconds(mean(mine.map((answer) => answer.elapsed_ms)))}</TD>
                  <TD>
                    <button
                      type="button"
                      className="qz-icon-btn"
                      aria-label={`Open ${row.name}'s answers`}
                      onClick={() => { setViewId(row.student_id); setViewOpen(true); }}
                    >
                      <Eye size={16} />
                    </button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="rep-questions">
        <div className="qz-section-head">
          <h2 id="rep-questions" className="qz-section-title">By question</h2>
          <Button className="action-button-compact" size="sm" aria-expanded={questionsOpen} onClick={() => setQuestionsOpen(!questionsOpen)}>
            {questionsOpen ? 'Hide' : 'Show'}
            <ChevronDown size={14} className={clsx('transition-transform duration-200', questionsOpen && 'rotate-180')} />
          </Button>
        </div>
        {questionsOpen && perQuestion.map(({ question, given, accuracy, time }, index) => (
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

      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={viewing?.name ?? ''} size="xl">
        {viewing && (
          <StudentAnswers
            key={viewing.student_id}
            row={viewing}
            asked={asked}
            answers={answers.filter((answer) => answer.student_id === viewing.student_id)}
          />
        )}
      </Modal>
    </div>
  );
}

// One student's run: the summary on top, then every question with their pick set against the right answer.
function StudentAnswers({ row, asked, answers }: { row: QuizScoreRow; asked: QuizFull['quiz_questions']; answers: QuizAnswer[] }) {
  // Questions currently showing the right answer instead of the student's pick; a look only, nothing is saved.
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const flip = (id: string) => setFlipped((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Rank" value={row.rank} />
        <StatCard label="Points" value={row.points.toLocaleString('en-IN')} />
        <StatCard label="Accuracy" value={`${accuracy(row.points, asked.length)}%`} />
        <StatCard label="Right" value={`${row.correct} of ${asked.length}`} />
      </div>

      {asked.map((question, index) => {
        const answer = answers.find((item) => item.question_id === question.id);
        return (
          <div key={question.id} className="qz-panel qz-review">
            <div className="qz-review-head">
              <p className="qz-review-title">{index + 1}. {question.body}</p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {!answer ? (
                  <Badge size="sm">No answer</Badge>
                ) : answer.is_correct ? (
                  <Badge variant="success" size="sm">+{answer.points.toLocaleString('en-IN')}</Badge>
                ) : (
                  <Badge variant="danger" size="sm">0</Badge>
                )}
                {answer && <Badge size="sm">{seconds(answer.elapsed_ms)}</Badge>}
              </div>
            </div>
            {question.image_path && <img className="qz-image" src={quizImageUrl(question.image_path)} alt="" />}
            {answer && (
              <>
                <div className="qz-rule" />
                <div className="qz-opts is-review">
                  {question.quiz_options.map((option, optionIndex) => {
                    const showingRight = flipped.has(question.id);
                    if (!(showingRight ? option.is_correct : answer.option_ids.includes(option.id))) return null;
                    const label = showingRight ? 'Show their answer' : 'Show the right answer';
                    return (
                      <QuizOption
                        key={option.id}
                        index={optionIndex}
                        label={option.label}
                        inlineLetter
                        state={option.is_correct ? 'correct' : 'wrong'}
                        flag={option.is_correct ? 'correct' : 'wrong'}
                        action={!answer.is_correct && (showingRight || !option.is_correct) && (
                          <button type="button" className="qz-icon-btn" title={label} aria-label={label} aria-pressed={showingRight} onClick={() => flip(question.id)}>
                            {showingRight ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        )}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
