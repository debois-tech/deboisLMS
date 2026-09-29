import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import { maybeRow, ok, rows } from './result';
import type {
  Quiz, QuizAnswer, QuizDraft, QuizFull, QuizHistoryRow, QuizResult, QuizScoreRow, QuizState,
} from '@/lib/types';
import { extensionOf } from '@/lib/utils/files';

// Same assets bucket, same tutor storage rule, so the badge helpers are the quiz ones.
export {
  BADGE_ACCEPT as QUIZ_IMAGE_ACCEPT, BADGE_EXTENSIONS as QUIZ_IMAGE_EXTENSIONS, BADGE_MAX_BYTES as QUIZ_IMAGE_MAX_BYTES,
  badgeImageUrl as quizImageUrl,
} from './badges';

export interface QuizListItem extends Quiz {
  batches: { name: string } | null;
  quiz_questions: { count: number }[];
  quiz_participants: { count: number }[];
}

export interface QuizParticipant {
  student_id: string;
  joined_at: string;
  students: { name: string; student_code: string | null } | null;
}

export interface OpenQuiz {
  id: string;
  title: string;
  status: 'lobby' | 'live';
  batches: { name: string } | null;
}

// Embedded to-one joins come back typed as arrays; the shape is what the select asks for.
const typed = <T>(result: unknown) => result as { data: T | null; error: PostgrestError | null };

// Lands where the tutor's storage policy allows: quizzes/<batch id>/, or quizzes/all/ for an admin's everyone-quiz.
export async function uploadQuizImage(batchId: string | null, file: File): Promise<string> {
  const path = `quizzes/${batchId ?? 'all'}/${crypto.randomUUID()}.${extensionOf(file.name) || 'png'}`;
  const upload = await supabase.storage.from('assets').upload(path, file, { contentType: file.type });
  if (upload.error) throw new Error(`Could not upload the image: ${upload.error.message}`);
  return path;
}

export async function getQuizzes(): Promise<QuizListItem[]> {
  return rows<QuizListItem>(
    await supabase
      .from('quizzes')
      .select('*, batches(name), quiz_questions(count), quiz_participants(count)')
      .order('created_at', { ascending: false }),
    'Could not load the quizzes',
  );
}

export async function getQuiz(id: string): Promise<QuizFull | undefined> {
  const quiz = maybeRow<QuizFull>(
    await supabase
      .from('quizzes')
      .select('*, batches(name), quiz_questions(*, quiz_options(*))')
      .eq('id', id)
      .maybeSingle(),
    'Could not load the quiz',
  );
  if (!quiz) return undefined;
  quiz.quiz_questions.sort((a, b) => a.position - b.position);
  for (const question of quiz.quiz_questions) question.quiz_options.sort((a, b) => a.position - b.position);
  return quiz;
}

export async function saveQuiz(draft: QuizDraft): Promise<string> {
  const payload = {
    id: draft.id,
    title: draft.title,
    batch_id: draft.batch_id,
    seconds_per_question: draft.seconds_per_question,
    show_answer: draft.show_answer,
    live_leaderboard: draft.live_leaderboard,
    student_review: draft.student_review,
    questions: draft.questions.map((question) => ({
      body: question.body,
      image_path: question.image_path,
      seconds: question.seconds,
      options: question.options.map((option) => ({ label: option.label, correct: option.correct })),
    })),
  };
  const { data, error } = await supabase.rpc('quiz_save', { p_quiz: payload });
  ok({ error }, 'Could not save the quiz');
  return data as string;
}

export async function deleteQuiz(id: string): Promise<void> {
  ok(await supabase.from('quizzes').delete().eq('id', id), 'Could not delete the quiz');
}

export async function openQuizLobby(id: string): Promise<void> {
  ok(await supabase.rpc('quiz_open_lobby', { p_quiz: id }), 'Could not open the lobby');
}

export async function quizGo(id: string, position: number): Promise<void> {
  ok(await supabase.rpc('quiz_go', { p_quiz: id, p_position: position }), 'Could not move the quiz');
}

export async function closeQuizQuestion(id: string): Promise<void> {
  ok(await supabase.rpc('quiz_close', { p_quiz: id }), 'Could not close the question');
}

export async function extendQuizQuestion(id: string, seconds: number): Promise<void> {
  ok(await supabase.rpc('quiz_extend', { p_quiz: id, p_seconds: seconds }), 'Could not add time');
}

export async function endQuiz(id: string): Promise<void> {
  ok(await supabase.rpc('quiz_end', { p_quiz: id }), 'Could not end the quiz');
}

// Offset to add to Date.now() to get the database's time, measured across the round trip.
export async function getClockOffset(): Promise<number> {
  const sent = Date.now();
  const { data, error } = await supabase.rpc('quiz_clock');
  ok({ error }, 'Could not read the clock');
  return Date.parse(data as string) - (sent + Date.now()) / 2;
}

export async function getQuizParticipants(id: string): Promise<QuizParticipant[]> {
  return rows<QuizParticipant>(
    typed<QuizParticipant[]>(
      await supabase
        .from('quiz_participants')
        .select('student_id, joined_at, students(name, student_code)')
        .eq('quiz_id', id)
        .order('joined_at'),
    ),
    'Could not load who joined',
  );
}

export async function getQuizAnswers(id: string): Promise<QuizAnswer[]> {
  return rows<QuizAnswer>(
    await supabase
      .from('quiz_answers')
      .select('question_id, student_id, option_ids, is_correct, points, elapsed_ms')
      .eq('quiz_id', id),
    'Could not load the answers',
  );
}

export async function getQuizScoreboard(id: string): Promise<QuizScoreRow[]> {
  const { data, error } = await supabase.rpc('quiz_scoreboard', { p_quiz: id });
  ok({ error }, 'Could not load the ranking');
  return (data ?? []) as QuizScoreRow[];
}

// A student's view: what they may join right now, RLS narrows it to their batches plus everyone-quizzes.
export async function getOpenQuizzes(): Promise<OpenQuiz[]> {
  return rows<OpenQuiz>(
    typed<OpenQuiz[]>(
      await supabase
        .from('quizzes')
        .select('id, title, status, batches(name)')
        .in('status', ['lobby', 'live'])
        .order('created_at', { ascending: false }),
    ),
    'Could not load the quizzes',
  );
}

export async function joinQuiz(id: string): Promise<void> {
  ok(await supabase.rpc('quiz_join', { p_quiz: id }), 'Could not join the quiz');
}

export async function answerQuiz(questionId: string, optionIds: string[]): Promise<void> {
  ok(await supabase.rpc('quiz_answer', { p_question: questionId, p_options: optionIds }), 'Could not save your answer');
}

export async function getQuizState(id: string): Promise<QuizState> {
  const { data, error } = await supabase.rpc('quiz_state', { p_quiz: id });
  ok({ error }, 'Could not load the quiz');
  return data as QuizState;
}

export async function getQuizResult(id: string): Promise<QuizResult> {
  const { data, error } = await supabase.rpc('quiz_my_result', { p_quiz: id });
  ok({ error }, 'Could not load your result');
  return data as QuizResult;
}

export async function getQuizHistory(): Promise<QuizHistoryRow[]> {
  return rows<QuizHistoryRow>(await supabase.rpc('quiz_my_history'), 'Could not load your quizzes');
}
