import { matchNameWithGemini } from './gemini';
import { normalizeName, similarity, tokenSetsEqual } from './normalize';
import type { NameMatch, RosterEntry } from './types';

/** Minimum bigram-Dice score for a confident deterministic fuzzy match. */
const FUZZY_THRESHOLD = 0.82;
/** Minimum confidence for accepting a Gemini-provided match. */
const GEMINI_CONFIDENCE_THRESHOLD = 0.75;

export interface MatchOptions {
  useGemini?: boolean;
}

interface FuzzyCandidate {
  id: string;
  name: string;
}

/**
 * Match a CSV participant name against the batch roster. Tutors match first
 * (they must never be recorded as students), then exact/token/fuzzy student
 * matches, then Gemini. Anything not matched confidently is returned as
 * `unmatched` for manual review.
 */
export async function matchParticipant(
  name: string,
  roster: RosterEntry[],
  tutors: { id: string; name: string }[],
  options: MatchOptions = {},
): Promise<NameMatch> {
  const key = normalizeName(name);

  // 1. Exact tutor match.
  const exactTutor = tutors.find((t) => normalizeName(t.name) === key);
  if (exactTutor) {
    return { kind: 'tutor', tutorId: exactTutor.id, confidence: 'exact', reason: 'Exact tutor name match' };
  }

  // 2. Fuzzy tutor match.
  const fuzzyTutor = bestFuzzy(name, tutors.map((t) => ({ id: t.id, name: t.name })));
  if (fuzzyTutor && fuzzyTutor.score >= FUZZY_THRESHOLD) {
    return {
      kind: 'tutor',
      tutorId: fuzzyTutor.id,
      confidence: 'fuzzy',
      score: fuzzyTutor.score,
      reason: `Fuzzy tutor match (${fuzzyTutor.score.toFixed(2)})`,
    };
  }

  // 3. Exact student match.
  const exact = roster.find((s) => normalizeName(s.name) === key);
  if (exact) {
    return { kind: 'student', studentId: exact.studentId, confidence: 'exact', reason: 'Exact name match' };
  }

  // 4. Token-equivalent student match (handles "Doe, John" vs "John Doe").
  const tokenMatch = roster.find((s) => tokenSetsEqual(s.name, name));
  if (tokenMatch) {
    return {
      kind: 'student',
      studentId: tokenMatch.studentId,
      confidence: 'fuzzy',
      reason: 'Token-equivalent name match',
    };
  }

  // 5. Deterministic fuzzy student match.
  const bestStudent = bestFuzzy(name, roster.map((s) => ({ id: s.studentId, name: s.name })));
  if (bestStudent && bestStudent.score >= FUZZY_THRESHOLD) {
    return {
      kind: 'student',
      studentId: bestStudent.id,
      confidence: 'fuzzy',
      score: bestStudent.score,
      reason: `Fuzzy name match (${bestStudent.score.toFixed(2)})`,
    };
  }

  // 6. Gemini fallback for ambiguous names.
  if (options.useGemini !== false) {
    const ai = await matchNameWithGemini(name, roster.map((s) => s.name));
    if (ai && ai.confidence >= GEMINI_CONFIDENCE_THRESHOLD) {
      const candidate = roster[ai.index];
      return {
        kind: 'student',
        studentId: candidate.studentId,
        confidence: 'ai',
        score: ai.confidence,
        reason: `Gemini match (${ai.confidence.toFixed(2)})`,
      };
    }
  }

  return { kind: 'unmatched', confidence: 'unmatched', reason: 'No confident match found' };
}

/** Highest-similarity candidate, or `null` when there are no candidates. */
function bestFuzzy(name: string, candidates: FuzzyCandidate[]): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const candidate of candidates) {
    const score = similarity(candidate.name, name);
    if (!best || score > best.score) {
      best = { id: candidate.id, score };
    }
  }
  return best;
}
