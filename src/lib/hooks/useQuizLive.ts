import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Calls `reload` when the quiz changes (Realtime), on return to the tab, and every few seconds as a safety net.
export function useQuizLive(quizId: string, reload: () => void, { host = false, pollMs = 5000 } = {}) {
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });

  useEffect(() => {
    let timer: number | undefined;
    // Coalesces a burst of answers into one reload.
    const fire = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        reloadRef.current();
      }, 250);
    };

    let channel = supabase.channel(`quiz:${quizId}:${crypto.randomUUID()}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quizzes', filter: `id=eq.${quizId}` },
      fire,
    );
    if (host) {
      for (const table of ['quiz_participants', 'quiz_answers']) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `quiz_id=eq.${quizId}` }, fire);
      }
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') fire();
    });

    const poll = window.setInterval(fire, pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [quizId, host, pollMs]);
}

// Remaining whole and fractional seconds to a deadline; 0 once it has passed.
export function secondsLeft(closesAt: string | null | undefined, now: number): number {
  return closesAt ? Math.max(0, (Date.parse(closesAt) - now) / 1000) : 0;
}

// One state cell for the measured offset, set from whichever fetch reports the server's time.
export function useClockOffset(): [number, (serverNow: string) => void] {
  const [offset, setOffset] = useState(0);
  const sync = useCallback((serverNow: string) => setOffset(Date.parse(serverNow) - Date.now()), []);
  return [offset, sync];
}
