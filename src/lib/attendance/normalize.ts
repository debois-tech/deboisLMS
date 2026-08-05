/** Honorifics that add no identity value and should be stripped before matching. */
const HONORIFICS = /\b(mr|mrs|ms|miss|dr|prof|sir|er|shri|smt)\.?\b/gi;

/** Normalize a name for comparison: unicode folding, honorific stripping, punctuation, whitespace, case. */
export function normalizeName(raw: string): string {
  return (raw ?? '')
    .normalize('NFKC')
    .replace(HONORIFICS, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Split a name into word tokens (normalized). */
export function nameTokens(name: string): string[] {
  return normalizeName(name).split(' ').filter(Boolean);
}

/** True when two names contain exactly the same tokens regardless of order. */
export function tokenSetsEqual(a: string, b: string): boolean {
  const ta = nameTokens(a).sort().join(' ');
  const tb = nameTokens(b).sort().join(' ');
  return ta.length > 0 && ta === tb;
}

/** Character bigrams (no spaces) used by the Dice similarity. */
function bigrams(s: string): Set<string> {
  const compact = s.replace(/\s+/g, '');
  const grams = new Set<string>();
  const padded = ` ${compact} `;
  for (let i = 0; i < padded.length - 1; i += 1) {
    grams.add(padded.slice(i, i + 2));
  }
  return grams;
}

/** Dice coefficient over character bigrams. 1 = identical, 0 = disjoint. */
function diceCoefficient(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;

  const ga = bigrams(na);
  const gb = bigrams(nb);

  let common = 0;
  for (const gram of ga) {
    if (gb.has(gram)) common += 1;
  }
  return (2 * common) / (ga.size + gb.size);
}

/** Jaro-Winkler similarity — catches single-character omissions that bigram Dice under-rates. */
function jaroWinkler(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;

  const matchDistance = Math.floor(Math.max(na.length, nb.length) / 2) - 1;
  const aMatches = new Array<boolean>(na.length).fill(false);
  const bMatches = new Array<boolean>(nb.length).fill(false);

  let matches = 0;
  for (let i = 0; i < na.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, nb.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j] || na[i] !== nb[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < na.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k += 1;
    if (na[i] !== nb[k]) transpositions += 1;
    k += 1;
  }

  const jaro =
    (matches / na.length + matches / nb.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(na.length, nb.length); i += 1) {
    if (na[i] === nb[i]) prefix += 1;
    else break;
  }
  prefix = Math.min(prefix, 4);

  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Combined name similarity = max(bigram Dice, Jaro-Winkler). */
export function similarity(a: string, b: string): number {
  return Math.max(diceCoefficient(a, b), jaroWinkler(a, b));
}

/** Return the value that appears most often (used to pick the best spelling). */
export function mostFrequent(values: string[]): string {
  if (values.length === 0) return '';
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = values[0];
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
