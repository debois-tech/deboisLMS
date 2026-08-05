import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/utils/errors';

/**
 * The first load of a page's data, with the failure case included.
 *
 * Every query throws (`queries/result.ts`), so a page that fetches inside a bare
 * `.then()` spins forever the moment RLS denies the read, the session expires or
 * the network drops — and the one thing the user is never told is that anything
 * went wrong. This holds the three states a load actually has (loading, failed,
 * loaded) so a page can render an error rather than an empty table that claims
 * there are no batches.
 *
 * `load` runs on mount and again on `retry`. It is read through a ref, so a page
 * can pass an inline closure without the effect re-running on every render.
 */
export function useInitialLoad(load: () => Promise<void>) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const loadRef = useRef(load);

  // Kept in sync from an effect rather than assigned during render — a render must
  // stay free of side effects for React to be able to replay it. Declared before
  // the load effect so it has already run by the time that one fires.
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

  // Loading is set here rather than in the effect so the effect body stays free of
  // synchronous setState; on mount it is already true.
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { loading, error, retry };
}

/**
 * A section inside a page that loads its own data and refetches after a mutation —
 * the tabs on the batch detail page.
 *
 * There is no loading flag on purpose: these sections render their table straight
 * away, and a refetch after adding a row should not blink the table out and back.
 * What was missing was the failure case, which used to leave the section showing
 * "No students" when the read had actually been refused.
 *
 * `load` must be stable (`useCallback`) — it is the effect's dependency.
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
