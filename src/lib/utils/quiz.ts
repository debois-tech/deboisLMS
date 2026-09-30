import { parseCsvLine } from './csvParser.ts';
import type { QuizDraft, QuizDraftQuestion, QuizFull } from '@/lib/types';

export const OPTION_LETTERS = 'ABCDEF';
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const TIME_PRESETS = [10, 15, 20, 30, 45, 60, 90, 120];

export function blankQuestion(): QuizDraftQuestion {
  return {
    key: crypto.randomUUID(),
    body: '',
    image_path: null,
    seconds: null,
    options: Array.from({ length: 4 }, () => ({ key: crypto.randomUUID(), label: '', correct: false })),
  };
}

export function newDraft(): QuizDraft {
  return {
    id: crypto.randomUUID(),
    title: '',
    batch_id: null,
    seconds_per_question: 20,
    show_answer: true,
    live_leaderboard: false,
    student_review: true,
    questions: [blankQuestion()],
  };
}

export function quizToDraft(quiz: QuizFull, copy = false): QuizDraft {
  return {
    id: copy ? crypto.randomUUID() : quiz.id,
    title: copy ? `${quiz.title} (copy)` : quiz.title,
    batch_id: quiz.batch_id,
    seconds_per_question: quiz.seconds_per_question,
    show_answer: quiz.show_answer,
    live_leaderboard: quiz.live_leaderboard,
    student_review: quiz.student_review,
    questions: quiz.quiz_questions.map((question) => ({
      key: crypto.randomUUID(),
      body: question.body,
      image_path: question.image_path,
      seconds: question.seconds,
      options: question.quiz_options.map((option) => ({ key: crypto.randomUUID(), label: option.label, correct: option.is_correct })),
    })),
  };
}

// The first thing wrong with a question, in the order a tutor would fix it; null when it can run.
export function questionIssue(question: QuizDraftQuestion): string | null {
  if (!question.body.trim()) return 'Add the question text';
  const filled = question.options.filter((option) => option.label.trim());
  if (filled.length < MIN_OPTIONS) return 'Needs at least two options';
  if (filled.length < question.options.length) return 'Fill or remove the empty option';
  if (!question.options.some((option) => option.correct)) return 'Mark the correct answer';
  return null;
}

export function draftIssues(draft: QuizDraft): { title: boolean; questions: (string | null)[]; count: number } {
  const questions = draft.questions.map(questionIssue);
  const title = !draft.title.trim();
  return { title, questions, count: questions.filter(Boolean).length + (title ? 1 : 0) + (draft.questions.length === 0 ? 1 : 0) };
}

export function answeringSeconds(draft: QuizDraft): number {
  return draft.questions.reduce((sum, question) => sum + (question.seconds ?? draft.seconds_per_question), 0);
}

const CORRECT = /^[A-F](\s*[\s,;&/]\s*[A-F])*$/i;

// Rows of: question, option A..F, correct letters. Comma or tab separated (a paste from Excel is tabs).
// A first row that names its columns is skipped, and its "correct" column, if any, is honoured.
export function parseQuestions(text: string): QuizDraftQuestion[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const split = (line: string) => (line.includes('\t') ? line.split('\t').map((cell) => cell.trim()) : parseCsvLine(line));

  let table = lines.map(split);
  let correctColumn = -1;
  if (/^(q|question)\b/i.test(table[0][0])) {
    correctColumn = table[0].findIndex((cell) => /correct|answer/i.test(cell));
    table = table.slice(1);
  }

  const out: QuizDraftQuestion[] = [];
  for (const cells of table) {
    const body = cells[0]?.trim();
    if (!body) continue;
    let letters = '';
    let end = cells.length;
    if (correctColumn > 0) {
      letters = cells[correctColumn] ?? '';
      end = correctColumn;
    } else {
      const last = cells.length > 2 ? cells[cells.length - 1].trim() : '';
      if (CORRECT.test(last)) {
        letters = last;
        end = cells.length - 1;
      }
    }
    const marked = new Set(letters.toUpperCase().replace(/[^A-F]/g, '').split(''));
    const question = blankQuestion();
    question.body = body;
    question.options = cells
      .slice(1, Math.min(end, 1 + MAX_OPTIONS))
      .map((label, index) => ({ key: crypto.randomUUID(), label: label.trim(), correct: marked.has(OPTION_LETTERS[index]) }))
      .filter((option) => option.label);
    while (question.options.length < MIN_OPTIONS) question.options.push({ key: crypto.randomUUID(), label: '', correct: false });
    out.push(question);
  }
  return out;
}

export function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export function seconds(ms: number | null | undefined): string {
  return ms == null ? '-' : `${(ms / 1000).toFixed(1)}s`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10] ?? 'th'}`;
}
