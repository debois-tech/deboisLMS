import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/utils/errors';

/**
 * The first load of a page's data, with the failure case included — queries throw,
 * so a bare `.then()` would render an empty table instead of an error. `load` runs
 * on mount and on `retry`, read through a ref so an inline closure doesn't re-run
 * the effect on every render.
 */
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

/**
 * A section that loads its own data and refetches after a mutation — no loading
 * flag on purpose, so a refetch after adding a row doesn't blink the table out
 * and back. `load` must be stable (`useCallback`).
 */
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
