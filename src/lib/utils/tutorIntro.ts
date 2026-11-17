/**
 * The tutor opening animation is a once-per-login event: the flag is written on a
 * successful tutor sign-in and removed when the intro hands the page back. A
 * refresh later therefore does not replay it.
 */
export const TUTOR_INTRO_KEY = 'debois:tutor-intro';

export function markTutorIntroPending() {
  try {
    sessionStorage.setItem(TUTOR_INTRO_KEY, '1');
  } catch {
    // Storage blocked: the intro simply doesn't play.
  }
}

export function isTutorIntroPending(): boolean {
  try {
    return sessionStorage.getItem(TUTOR_INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function finishTutorIntro() {
  try {
    sessionStorage.removeItem(TUTOR_INTRO_KEY);
  } catch {
    // Storage blocked.
  }
}

/**
 * One source for the greeting, so the intro and the dashboard header render the
 * same characters in the same order — the morph lands on the real element.
 */
export function tutorGreeting(hour: number, fullName?: string) {
  const lead = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const name = fullName?.trim().split(/\s+/)[0] ?? '';
  return { lead, name };
}

export function tutorGreetingText(hour: number, fullName?: string): string {
  const { lead, name } = tutorGreeting(hour, fullName);
  return name ? `${lead}, ${name}!` : `${lead}!`;
}
