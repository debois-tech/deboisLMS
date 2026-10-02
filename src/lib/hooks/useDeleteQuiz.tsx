import { useCallback } from 'react';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { deleteQuiz } from '@/lib/supabase';
import type { Quiz } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

/** Asks first, then removes the quiz with its questions, answers and results. Resolves true once it is gone. */
export function useDeleteQuiz() {
  const confirm = useConfirm();
  const { showToast } = useToast();

  return useCallback(async (quiz: Pick<Quiz, 'id' | 'title' | 'status'>) => {
    const running = quiz.status === 'lobby' || quiz.status === 'live';
    const accepted = await confirm({
      title: `Delete "${quiz.title}"?`,
      message: (
        <>
          <span className="block">Removed for everyone</span>
          {quiz.status === 'ended' && <span className="block">Results deleted too</span>}
          {running && <span className="block">Students inside are sent out</span>}
          <span className="block">Cannot be undone</span>
        </>
      ),
      confirmLabel: 'Delete quiz',
      danger: true,
      requireText: running ? 'Confirm' : undefined,
    });
    if (!accepted) return false;

    try {
      await deleteQuiz(quiz.id);
      showToast('Quiz deleted');
      return true;
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete the quiz'), 'error');
      return false;
    }
  }, [confirm, showToast]);
}
