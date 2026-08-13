import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/utils/errors';

/** First load including the failure case: queries throw, so a bare .then() renders an empty table. */
export function useInitialLoad(load: () => Promise<void>) {
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
          setError(errorMessage(err, "We couldn't load this page."));
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [attempt]);

  // Loading is set here so the effect body stays free of synchronous setState.
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { loading, error, retry };
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
