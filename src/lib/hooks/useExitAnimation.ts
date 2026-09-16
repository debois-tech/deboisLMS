import { useEffect, useState } from 'react';

/**
 * Keeps a conditionally-rendered element mounted long enough to play its exit
 * animation instead of vanishing on `open: false`. `durationMs` must match the
 * CSS exit animation's own duration.
 */
export function useExitAnimation(open: boolean, durationMs: number) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // Derived during render (React's own pattern for "adjust state when a prop
  // changes") rather than an effect, so opening never costs an extra render.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }

  // The timer is the external system this effect subscribes to — closing
  // itself is decided above, during render.
  useEffect(() => {
    if (!closing) return;
    const timeout = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, durationMs);
    return () => clearTimeout(timeout);
  }, [closing, durationMs]);

  return { mounted, closing };
}
