import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/context/AuthContext';
import { finishIntro, greetingParts, isIntroPending } from '@/lib/utils/loginIntro';

/** Gap between successive letters while typing. */
const TYPE_MS = 54;
/** The greeting is complete; leave a beat before the loading pop takes over. */
const BEAT_MS = 420;
/** Safety valve only: a page that never reports ready must not hold the user hostage. */
const MAX_WAIT_MS = 9000;
/** Time for the page's own entry animation to settle before we measure the header. */
const SETTLE_MS = 160;
const MORPH_MS = 680;
const MORPH_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const TARGET = '[data-intro-target]';
const READY = '[data-intro-ready]';

/**
 * typing  — the greeting writes itself out, one letter at a time.
 * loading — every letter pops in a slow left-to-right ripple, so the wait for the
 *           page reads as part of the intro instead of a frozen screen.
 * landing — the ripple stops and the line travels onto the real header.
 */
type Phase = 'typing' | 'loading' | 'landing';

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function fontSize(el: Element) {
  return parseFloat(getComputedStyle(el).fontSize) || 1;
}

/**
 * The first screen after signing in, for every role. Covers the whole viewport
 * (navbar included) while the home page loads, types the greeting, ripples it
 * while it waits, then morphs that same line onto the real header and gets out of
 * the way. Once per login: the flag is written by the login form.
 *
 * The page contract is small: its header carries `data-intro-target`, and its root
 * carries `data-intro-ready` once the initial load has settled (or failed).
 */
export function LoginIntro() {
  const { user } = useAuth();
  const [prefersReduced] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(isIntroPending);
  const [phase, setPhase] = useState<Phase>(() => (prefersReduced ? 'loading' : 'typing'));
  const [typed, setTyped] = useState(() => (prefersReduced ? Number.MAX_SAFE_INTEGER : 0));
  const lineRef = useRef<HTMLSpanElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  const { lead, name } = greetingParts(new Date().getHours(), user?.full_name);
  const text = name ? `${lead}, ${name}!` : `${lead}!`;
  const nameStart = name ? lead.length + 2 : -1;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    finishIntro();
    setPlaying(false);
  }, []);

  /** No line to land on (reduced motion, timeout): fade the cover and hand the page back. */
  const release = useCallback(() => {
    const ms = prefersReduced ? 180 : 260;
    veilRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ms,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards',
    });
    window.setTimeout(finish, ms + 20);
  }, [finish, prefersReduced]);

  // Keep the page behind still, so the measured header cannot move under the morph.
  useEffect(() => {
    if (!playing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [playing]);

  // One letter per tick. Re-schedules itself, so a reload mid-intro restarts cleanly.
  useEffect(() => {
    if (!playing || phase !== 'typing' || typed >= text.length) return;
    const id = window.setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
    return () => window.clearTimeout(id);
  }, [playing, phase, typed, text.length]);

  // Typing is done: hold a beat so the last letter is clearly finished, then ripple.
  useEffect(() => {
    if (!playing || phase !== 'typing' || typed < text.length) return;
    const id = window.setTimeout(() => setPhase('loading'), BEAT_MS);
    return () => window.clearTimeout(id);
  }, [playing, phase, typed, text.length]);

  // Ripple runs while we wait for the page to say the header is in place and loaded.
  // Watched instead of polled per frame: the page may go quiet for a while before it
  // announces itself, and a stopped frame loop must never strand the intro.
  useEffect(() => {
    if (!playing || phase !== 'loading') return;

    let landed = false;
    let settleId = 0;

    const check = () => {
      if (landed) return;
      const target = document.querySelector<HTMLElement>(TARGET);
      if (!target || !document.querySelector(READY) || target.getBoundingClientRect().width <= 0) return;
      landed = true;
      settleId = window.setTimeout(() => setPhase('landing'), SETTLE_MS);
    };

    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    check();

    const capId = window.setTimeout(release, MAX_WAIT_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(settleId);
      window.clearTimeout(capId);
    };
  }, [playing, phase, release]);

  // Hand the line over to the real header. Runs after commit, so the ripple is already
  // off and the letters are at rest when we measure.
  useEffect(() => {
    if (!playing || phase !== 'landing') return;

    const line = lineRef.current;
    const target = document.querySelector<HTMLElement>(TARGET);
    if (!line || !target || prefersReduced) {
      release();
      return;
    }

    const from = line.getBoundingClientRect();
    const header = target.getBoundingClientRect();

    // The header is a block: its box spans the page. A Range measures the glyphs, which
    // is what the intro line has to land on.
    const range = document.createRange();
    range.selectNodeContents(target);
    const runs = Array.from(range.getClientRects());
    const glyphs = range.getBoundingClientRect();
    const first = runs[0] ?? glyphs;
    // A Range returns one rect per inline run (text, span, text), not per line, so
    // wrapping is decided by whether the runs share a baseline.
    const wrapped = runs.some((run) => Math.abs(run.top - glyphs.top) > 2);

    // One line of header text scales by width; a wrapped header only needs the glyph
    // height, so fall back to the font-size ratio rather than squashing the line.
    const scale = !wrapped && from.width > 0 ? glyphs.width / from.width : fontSize(target) / fontSize(line);
    const dx = first.left - from.left;
    const dy = header.top - from.top;

    line.animate(
      [
        { transform: 'translate3d(0, 0, 0) scale(1)' },
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})` },
      ],
      { duration: MORPH_MS, easing: MORPH_EASE, fill: 'forwards' },
    );

    // Hold the veil until the line has actually landed, then cross-fade the overlay
    // text into the real header underneath. Both glyphs sit in the same place, so the
    // hand-off reads as one object settling, not a swap.
    const fadeId = window.setTimeout(() => {
      const fade = { duration: 200, easing: 'ease-out', fill: 'forwards' as const };
      veilRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], fade);
      line.animate([{ opacity: 1 }, { opacity: 0 }], fade);
    }, MORPH_MS);
    const doneId = window.setTimeout(finish, MORPH_MS + 210);

    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(doneId);
    };
  }, [playing, phase, prefersReduced, release, finish]);

  if (!playing) return null;

  const shown = Math.min(typed, text.length);
  const typing = phase === 'typing';

  return createPortal(
    <div className={`login-intro is-${phase}`} role="status" aria-live="polite" aria-busy={phase !== 'landing'}>
      <div className="login-intro-veil" ref={veilRef} aria-hidden="true" />
      <div className="login-intro-stage">
        <span
          className="login-intro-line"
          ref={lineRef}
          style={{ fontSize: `clamp(0.9rem, ${Math.min(5.4, 160 / text.length).toFixed(2)}vw, 4rem)` }}
          aria-hidden="true"
        >
          {text.split('').map((char, index) => {
            const inName = nameStart >= 0 && index >= nameStart && index < nameStart + name.length;
            return (
              <span
                key={index}
                className={[
                  'login-intro-char',
                  index < shown ? 'is-in' : '',
                  inName ? 'is-name' : '',
                  typing && shown > 0 && index === shown - 1 ? 'is-caret' : '',
                ].join(' ').trim()}
                style={{ '--i': index } as CSSProperties}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
          {typing && shown === 0 && <span className="login-intro-seed" aria-hidden="true" />}
        </span>
        <span className="login-intro-sr">{text}</span>
      </div>
    </div>,
    document.body,
  );
}
