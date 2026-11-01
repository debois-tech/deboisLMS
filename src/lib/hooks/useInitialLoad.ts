import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/utils/errors';

/** First load including the failure case: queries throw, so a bare .then() renders an empty table. */
export function useInitialLoad(load: () => Promise<void>, generic = false) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const loadRef = useRef(load);

  // Kept in sync from an effect rather than during render, so renders stay side-effect free.
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await loadRef.current();
        if (active) {
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          // generic: student-facing, so never surface table or policy names.
          if (generic) console.error(err);
          setError(generic ? "We couldn't load this page." : errorMessage(err, "We couldn't load this page."));
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [attempt, generic]);

  // Loading is set here so the effect body stays free of synchronous setState.
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { loading, error, retry };
}

/** Keys with a request running. `begin` is a synchronous guard (false when already running); `busy` drives `disabled`. */
export function useInFlight() {
  const live = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const begin = useCallback((key: string) => {
    if (live.current.has(key)) return false;
    live.current.add(key);
    setBusy(new Set(live.current));
    return true;
  }, []);

  const finish = useCallback((key: string) => {
    live.current.delete(key);
    setBusy(new Set(live.current));
  }, []);

  return { busy, begin, finish };
}

/** Refetch with no loading flag, so the table does not blink out. `load` must be stable. */
export function useReloadableSection(load: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      await load();
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "We couldn't load this section."));
    }
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { error, reload };
}
