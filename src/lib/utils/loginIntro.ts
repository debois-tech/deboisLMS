/**
 * The opening greeting is a once-per-login event for every role: the flag is
 * written on a successful sign-in and removed when the intro hands the page over.
 * A refresh later therefore does not replay it.
 */
export const LOGIN_INTRO_KEY = 'debois:login-intro';

export function markIntroPending() {
  try {
    sessionStorage.setItem(LOGIN_INTRO_KEY, '1');
  } catch {
    // Storage blocked: the intro simply doesn't play.
  }
}

export function isIntroPending(): boolean {
  try {
    return sessionStorage.getItem(LOGIN_INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function finishIntro() {
  try {
    sessionStorage.removeItem(LOGIN_INTRO_KEY);
  } catch {
    // Storage blocked.
  }
}

/**
 * One source for the greeting, so the intro and every dashboard header render the
 * same characters in the same order — the morph lands on the real element.
 */
export function greetingParts(hour: number, fullName?: string) {
  const lead = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const name = fullName?.trim().split(/\s+/)[0] ?? '';
  return { lead, name };
}
