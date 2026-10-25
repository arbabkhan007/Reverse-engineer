/**
 * Command palette search.
 *
 * Every destination in the app, plus every catalog pattern and course lesson,
 * behind one keystroke. The ranking is a pure function so it can be tested:
 * "amigurumi bunny" must find the bunny pattern even though the words are in a
 * different order and separated by other text.
 *
 * Rules that matter for feel:
 *  - a match at the start of a word beats a match inside a word
 *  - consecutive matches beat scattered ones
 *  - a title match beats a keyword match, so typing "gauge" reaches the gauge
 *    tool before a pattern that happens to mention gauge
 */

import type { CatalogPattern } from '../shared/types.ts';

export interface SearchDoc {
  id: string;
  title: string;
  subtitle?: string;
  /** Grouping label in the palette: Tools, Patterns, Learn. */
  group: string;
  href: string;
  /** Extra searchable words that are not displayed. */
  keywords?: string[];
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** Character positions in the title that matched, for highlighting. */
  titlePositions: number[];
}

/** Case- and accent-insensitive fold. Accents matter: "Granny" vs "gränny". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Score one query against one string.
 *
 * Returns null when the query is not a subsequence of the target, otherwise a
 * positive score. Subsequence rather than substring, so "scdc" finds "single
 * crochet, double crochet" - but the bonuses are tuned so a plain substring
 * still wins.
 */
export function scoreText(query: string, target: string): { score: number; positions: number[] } | null {
  const q = fold(query).replace(/\s+/g, '');
  const t = fold(target);
  if (!q) return { score: 0, positions: [] };

  // Fast path: whole-query substring.
  const direct = t.indexOf(q);
  if (direct >= 0) {
    const atWordStart = direct === 0 || /[^a-z0-9]/.test(t[direct - 1] ?? '');
    let score = 100 + q.length * 6;
    if (direct === 0) score += 60;
    else if (atWordStart) score += 35;
    score -= Math.min(direct, 20);
    return { score, positions: range(direct, q.length) };
  }

  // Subsequence walk with bonuses for word starts and adjacency.
  let position = 0;
  let score = 0;
  let previousIndex = -2;
  const positions: number[] = [];

  for (const char of q) {
    let found = -1;
    for (let i = position; i < t.length; i += 1) {
      if (t[i] === char) {
        found = i;
        break;
      }
    }
    if (found < 0) return null;

    score += 3;
    if (found === 0 || /[^a-z0-9]/.test(t[found - 1] ?? '')) score += 8;
    if (found === previousIndex + 1) score += 6;
    positions.push(found);
    previousIndex = found;
    position = found + 1;
  }

  // Long targets dilute a match; nudge shorter titles up.
  score -= Math.min(Math.floor(t.length / 12), 12);
  return { score, positions };
}

function range(start: number, length: number): number[] {
  return Array.from({ length }, (_, index) => start + index);
}

/**
 * Score a document against every word of the query.
 *
 * Words are scored independently and all must match somewhere, which is what
 * makes "blanket easy" find "Easy Baby Blanket". Matching the query as one
 * string would fail there, because the words are not adjacent.
 *
 * The title is worth the most, the subtitle next, keywords least, so a
 * keyword-only match never outranks a name.
 */
export function scoreDoc(query: string, doc: SearchDoc): SearchHit | null {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return null;

  let score = 0;
  const titlePositions: number[] = [];

  for (const term of terms) {
    const title = scoreText(term, doc.title);
    const subtitle = doc.subtitle ? scoreText(term, doc.subtitle) : null;
    const keywords = (doc.keywords ?? [])
      .map((word) => scoreText(term, word))
      .filter((hit): hit is { score: number; positions: number[] } => hit !== null);

    const bestKeyword = keywords.reduce((best, hit) => Math.max(best, hit.score * 0.45), 0);
    const termScore = Math.max(title ? title.score * 1.6 : 0, subtitle ? subtitle.score * 0.7 : 0, bestKeyword);

    // Every word has to land somewhere, or the result is noise.
    if (termScore === 0) return null;

    score += termScore;
    if (title) titlePositions.push(...title.positions);
  }

  return { doc, score, titlePositions: [...new Set(titlePositions)].sort((a, b) => a - b) };
}

export function search(query: string, docs: SearchDoc[], limit = 12): SearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return docs.slice(0, limit).map((doc) => ({ doc, score: 0, titlePositions: [] }));

  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const hit = scoreDoc(trimmed, doc);
    if (hit) hits.push(hit);
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.doc.title.localeCompare(b.doc.title);
  });
  return hits.slice(0, limit);
}

export const TOOL_DOCS: SearchDoc[] = [
  { id: 'tool/library', title: 'Patterns', subtitle: '526 patterns with filters', group: 'Tools', href: '/library', keywords: ['browse', 'catalog'] },
  { id: 'tool/checker', title: 'Stitch maths checker', subtitle: 'Verify every row adds up', group: 'Tools', href: '/checker', keywords: ['count', 'validate', 'error', 'maths'] },
  { id: 'tool/converter', title: 'Converter', subtitle: 'PDF or web page to pattern', group: 'Tools', href: '/converter', keywords: ['import', 'pdf', 'url', 'link'] },
  { id: 'tool/projects', title: 'Projects', subtitle: 'Row counter and progress', group: 'Tools', href: '/projects', keywords: ['counter', 'wip', 'track'] },
  { id: 'tool/journal', title: 'Journal', subtitle: 'Photos, notes and measurements', group: 'Tools', href: '/journal', keywords: ['photo', 'diary', 'measure', 'log'] },
  { id: 'tool/stash', title: 'Yarn stash and planner', subtitle: 'How much yarn, how many skeins', group: 'Tools', href: '/stash', keywords: ['yardage', 'skein', 'estimate', 'shopping'] },
  { id: 'tool/chart', title: 'Image to chart', subtitle: 'Turn a picture into colourwork', group: 'Tools', href: '/chart', keywords: ['photo', 'pixel', 'colourwork', 'tapestry'] },
  { id: 'tool/symbols', title: 'Symbol charts', subtitle: 'Written rows as a chart', group: 'Tools', href: '/symbols', keywords: ['diagram', 'symbol', 'visual'] },
  { id: 'tool/gauge', title: 'Gauge and sizing', subtitle: 'Swatch maths and rescaling', group: 'Tools', href: '/gauge', keywords: ['tension', 'swatch', 'size', 'resize'] },
  { id: 'tool/terminology', title: 'US / UK translator', subtitle: 'Same pattern, other dialect', group: 'Tools', href: '/terminology', keywords: ['terms', 'translation', 'british', 'american'] },
  { id: 'tool/stitch-id', title: 'Stitch ID', subtitle: 'Read texture from a photo', group: 'Tools', href: '/stitch-id', keywords: ['identify', 'texture', 'photo'] },
  { id: 'tool/canvas', title: 'Pattern canvas', subtitle: 'Design your own chart', group: 'Tools', href: '/canvas', keywords: ['design', 'draw', 'create'] },
  { id: 'tool/settings', title: 'Settings', subtitle: 'Units, AI provider, accessibility', group: 'Tools', href: '/settings', keywords: ['preferences', 'api', 'theme'] },
];

export interface IndexSources {
  patterns?: CatalogPattern[];
  courses?: Array<{ id: string; title: string; lessons: Array<{ id?: string; title: string }> }>;
  tools?: SearchDoc[];
}

/**
 * Build the palette index. Patterns contribute their name, category and skill
 * level as keywords, so "easy blanket" works without the words being adjacent.
 */
export function buildIndex(sources: IndexSources = {}): SearchDoc[] {
  const docs: SearchDoc[] = [...(sources.tools ?? TOOL_DOCS)];

  for (const pattern of sources.patterns ?? []) {
    docs.push({
      id: `pattern/${pattern.id}`,
      title: pattern.title,
      subtitle: `${pattern.category} - ${pattern.level}`,
      group: 'Patterns',
      href: `/pattern/${pattern.id}`,
      keywords: [pattern.category, pattern.level, pattern.supplies.yarn ?? '', ...pattern.tags].filter(Boolean),
    });
  }

  for (const course of sources.courses ?? []) {
    for (const lesson of course.lessons) {
      docs.push({
        id: `lesson/${course.id}/${lesson.id ?? lesson.title}`,
        title: lesson.title,
        subtitle: course.title,
        group: 'Learn',
        href: `/courses/${course.id}`,
        keywords: ['lesson', 'tutorial', 'learn', course.title],
      });
    }
  }

  return docs;
}
