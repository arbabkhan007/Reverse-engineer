/**
 * US <-> UK crochet terminology.
 *
 * The same letters mean different stitches in the two dialects, which is the
 * single most common way a correct pattern gets worked wrong. Translation is
 * done in ONE pass with longest-first alternation so a replacement can never be
 * re-translated (sc -> dc -> tr), and so full names are handled before bare
 * abbreviations.
 */

export type Dialect = 'us' | 'uk';

interface TermPair {
  us: string;
  uk: string;
  /** false for non-stitch phrases such as gauge/tension. */
  stitch: boolean;
}

/**
 * Reference pairs. A US single crochet is a UK double crochet: every UK stitch
 * name is one step taller than the US name for the same action, because UK
 * names count the loop on the hook.
 */
export const TERM_PAIRS: TermPair[] = [
  { us: 'slip stitch', uk: 'slip stitch', stitch: true },
  { us: 'sl st', uk: 'sl st', stitch: true },
  { us: 'single crochet', uk: 'double crochet', stitch: true },
  { us: 'half double crochet', uk: 'half treble crochet', stitch: true },
  { us: 'double crochet', uk: 'treble crochet', stitch: true },
  { us: 'treble crochet', uk: 'double treble crochet', stitch: true },
  { us: 'double treble crochet', uk: 'triple treble crochet', stitch: true },
  { us: 'sc', uk: 'dc', stitch: true },
  { us: 'hdc', uk: 'htr', stitch: true },
  { us: 'dc', uk: 'tr', stitch: true },
  { us: 'tr', uk: 'dtr', stitch: true },
  { us: 'dtr', uk: 'trtr', stitch: true },
  { us: 'gauge', uk: 'tension', stitch: false },
  { us: 'yarn over', uk: 'yarn round hook', stitch: false },
  { us: 'yo', uk: 'yrh', stitch: false },
  { us: 'skip', uk: 'miss', stitch: false },
  { us: 'fasten off', uk: 'cast off', stitch: false },
];

function escapeTerm(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Compiled {
  pattern: RegExp;
  map: Map<string, string>;
}

function compile(from: Dialect, to: Dialect): Compiled {
  const map = new Map<string, string>();
  for (const pair of TERM_PAIRS) {
    const source = from === 'us' ? pair.us : pair.uk;
    const target = from === 'us' ? pair.uk : pair.us;
    if (source.toLowerCase() === target.toLowerCase()) continue;
    map.set(source.toLowerCase(), target);
  }
  const alternatives = [...map.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeTerm);
  // Word boundaries where the term starts/ends with a word character, so "tr"
  // does not match inside "treble" and "yo" does not match inside "you".
  const pattern = new RegExp(
    alternatives.map((term) => `(?<![\\w-])${term}(?![\\w-])`).join('|'),
    'gi',
  );
  return { pattern, map };
}

const CACHE = new Map<string, Compiled>();

function compiledFor(from: Dialect, to: Dialect): Compiled {
  const key = `${from}->${to}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const built = compile(from, to);
  CACHE.set(key, built);
  return built;
}

/** Preserves the original capitalisation of a replaced term. */
function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0]?.toUpperCase() && original[0] !== original[0]?.toLowerCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export interface TranslationResult {
  text: string;
  from: Dialect;
  to: Dialect;
  /** Terms that were replaced, with how many times. */
  changes: Array<{ from: string; to: string; count: number }>;
}

export function translateTerminology(
  text: string,
  from: Dialect,
  to: Dialect,
): TranslationResult {
  if (from === to) return { text, from, to, changes: [] };

  const { pattern, map } = compiledFor(from, to);
  const counts = new Map<string, { to: string; count: number }>();

  const translated = text.replace(pattern, (matched) => {
    const replacement = map.get(matched.toLowerCase());
    if (!replacement) return matched;
    const existing = counts.get(matched.toLowerCase());
    if (existing) existing.count += 1;
    else counts.set(matched.toLowerCase(), { to: replacement, count: 1 });
    return matchCase(matched, replacement);
  });

  return {
    text: translated,
    from,
    to,
    changes: [...counts.entries()].map(([key, value]) => ({
      from: key,
      to: value.to,
      count: value.count,
    })),
  };
}

/**
 * Guesses the dialect from explicit markers, then from stitch vocabulary.
 * Returns 'unknown' rather than guessing when the evidence is thin.
 */
export function detectDialect(text: string): Dialect | 'unknown' {
  const lower = text.toLowerCase();
  if (/\(uk\)|uk terms|uk terminology|british terms|uk pattern/.test(lower)) return 'uk';
  if (/\(us\)|us terms|us terminology|american terms|us pattern/.test(lower)) return 'us';

  const ukOnly = (lower.match(/(?<![\w-])(htr|dtr|trtr|yrh)(?![\w-])/g) ?? []).length;
  const usOnly = (lower.match(/(?<![\w-])(hdc|fsc|invdec)(?![\w-])/g) ?? []).length;
  const tension = /tension/.test(lower) ? 1 : 0;
  const gauge = /gauge/.test(lower) ? 1 : 0;

  const ukScore = ukOnly + tension;
  const usScore = usOnly + gauge;
  if (ukScore === 0 && usScore === 0) return 'unknown';
  if (ukScore > usScore) return 'uk';
  if (usScore > ukScore) return 'us';
  return 'unknown';
}

/** A glossary table for display, in the requested dialect order. */
export function glossaryRows(from: Dialect): Array<{ from: string; to: string; note: string }> {
  return TERM_PAIRS.filter((pair) => {
    const source = from === 'us' ? pair.us : pair.uk;
    const target = from === 'us' ? pair.uk : pair.us;
    return source.toLowerCase() !== target.toLowerCase();
  })
    .map((pair) => {
      const source = from === 'us' ? pair.us : pair.uk;
      const target = from === 'us' ? pair.uk : pair.us;
      return {
        from: source,
        to: target,
        note: pair.stitch ? 'stitch' : 'phrase',
      };
    })
    .sort((a, b) => a.note.localeCompare(b.note) || a.from.localeCompare(b.from));
}
