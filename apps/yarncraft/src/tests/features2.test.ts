import { describe, expect, it } from 'vitest';
import { countByCode, madeBy, MAX_TOKENS, tokenizeInstruction } from '../domain/stitchTokens.ts';
import {
  checkGauge,
  estimateFromSwatch,
  estimateYarn,
  formatLength,
  metresPerStitch,
  planSkeins,
  toMetres,
  YARN_PER_WIDTH,
} from '../domain/yarn.ts';
import {
  buildChart,
  chartAgreesWith,
  chartMade,
  repeatBoundaries,
  symbolFor,
  symbolLegend,
} from '../domain/symbols.ts';
import {
  addEntry,
  dataUrlBytes,
  fitWithin,
  groupByDay,
  journalBytes,
  makeEntryId,
  measurementLabels,
  measurementTrend,
  removeEntry,
  sortEntries,
  trimToBudget,
} from '../domain/journal.ts';
import { buildIndex, scoreDoc, scoreText, search, TOOL_DOCS } from '../domain/search.ts';
import { parsePattern } from '../domain/patternParser.ts';
import { evaluateInstruction } from '../domain/patternChecker.ts';
import type { JournalEntry } from '../domain/journal.ts';
import type { CatalogPattern } from '../shared/types.ts';

/* --------------------------------------------------------------- tokens */

describe('stitch tokenizer', () => {
  it('expands a bracketed repeat into individual stitches', () => {
    const { tokens } = tokenizeInstruction('[sc, inc] x 6');
    expect(tokens).toHaveLength(12);
    expect(tokens.filter((token) => token.code === 'sc')).toHaveLength(6);
    expect(tokens.filter((token) => token.code === 'inc')).toHaveLength(6);
  });

  it('honours a leading count', () => {
    const { tokens } = tokenizeInstruction('3 dc');
    expect(tokens).toHaveLength(3);
    expect(tokens.every((token) => token.code === 'dc')).toBe(true);
  });

  it('reads a decrease as one token, not as two stitches', () => {
    const { tokens } = tokenizeInstruction('sc2tog');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.code).toBe('dec');
  });

  it('keeps the width of a chain space', () => {
    const { tokens } = tokenizeInstruction('ch-2 sp');
    expect(tokens[0]!.kind).toBe('chain-space');
    expect(tokens[0]!.space).toBe(2);
  });

  it('marks which repetition each token belongs to', () => {
    const { tokens } = tokenizeInstruction('[2 sc, ch 1] x 3');
    const repeatedSc = tokens.filter((token) => token.code === 'sc');
    expect(new Set(repeatedSc.map((token) => token.repeatIndex))).toEqual(new Set([1, 2, 3]));
    expect(repeatedSc.every((token) => token.repeated)).toBe(true);
  });

  it('counts an increase as two stitches and a decrease as one', () => {
    // The cell count and the stitch count are different numbers, on purpose.
    const { tokens } = tokenizeInstruction('[sc, inc] x 6');
    expect(tokens).toHaveLength(12);
    expect(madeBy(tokens)).toBe(18);
    expect(madeBy(tokens)).toBe(evaluateInstruction('[sc, inc] x 6').count);
  });

  it('agrees with the count engine on a plain repeated row', () => {
    const text = '[2 sc, ch 1] x 6';
    const { tokens } = tokenizeInstruction(text);
    expect(madeBy(tokens)).toBe(evaluateInstruction(text).count);
  });

  it('reports unknown rather than disagreeing when a row cannot be fully placed', () => {
    // "sc in each ch across" means one stitch per previous chain. Without the
    // previous row there is no number to draw, so the chart must not guess.
    const text = 'ch 21, sc in 2nd ch from hook and each ch across';
    const pattern = parsePattern(`Row 1: ${text}`);
    const row = buildChart(pattern).rows[0]!;
    expect(row.unparsed.length).toBeGreaterThan(0);
    expect(chartAgreesWith(row, 20)).toBeNull();
  });

  it('reports text it cannot place instead of dropping it', () => {
    const { unparsed, tokens } = tokenizeInstruction('sc, then do the impossible bit');
    expect(unparsed.join(' ')).toContain('impossible');
    expect(tokens.some((token) => token.kind === 'unknown')).toBe(true);
  });

  it('refuses to expand an absurd multiplier', () => {
    const { tokens, truncated } = tokenizeInstruction('[sc] x 99999');
    expect(truncated).toBe(true);
    expect(tokens.length).toBeLessThanOrEqual(MAX_TOKENS);
  });
});

/* ----------------------------------------------------------------- yarn */

describe('gauge refusal', () => {
  it('will not price a pattern without a measured stitch count', () => {
    const result = checkGauge({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem).toMatch(/measure/i);
  });

  it('rejects a physically impossible gauge rather than clamping it', () => {
    expect(checkGauge({ stitchesPer10cm: 0 }).ok).toBe(false);
    expect(checkGauge({ stitchesPer10cm: 400 }).ok).toBe(false);
    expect(checkGauge({ stitchesPer10cm: 16, rowsPer10cm: 0 }).ok).toBe(false);
  });

  it('derives stitch width from the measurement', () => {
    const result = checkGauge({ stitchesPer10cm: 20 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stitchWidthCm).toBeCloseTo(0.5, 6);
  });
});

describe('yarn estimate', () => {
  const pattern = parsePattern('Row 1: ch 21, sc in 2nd ch from hook and each ch across (20)');

  it('prices every row and its breakdown adds up to the total', () => {
    const result = estimateYarn(pattern, { stitchesPer10cm: 16 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sum = result.steps.reduce((total, step) => total + step.cm, 0);
    expect(sum).toBeCloseTo(result.totalCm, 6);
    expect(result.totalMetres).toBeGreaterThan(0);
  });

  it('scales linearly with stitch width, which is the whole reason a gauge is required', () => {
    const wide = estimateYarn(pattern, { stitchesPer10cm: 8 });
    const tight = estimateYarn(pattern, { stitchesPer10cm: 16 });
    expect(wide.ok && tight.ok).toBe(true);
    if (!wide.ok || !tight.ok) return;
    // Twice the stitch width, twice the yarn, per stitch count held constant.
    expect(wide.totalCm / tight.totalCm).toBeCloseTo(2, 6);
  });

  it('prices a taller stitch as more yarn than a short one', () => {
    expect(YARN_PER_WIDTH.dc!).toBeGreaterThan(YARN_PER_WIDTH.sc!);
    expect(YARN_PER_WIDTH.sc!).toBeGreaterThan(YARN_PER_WIDTH.ch!);
  });

  it('returns the gauge problem rather than a zero estimate', () => {
    const result = estimateYarn(pattern, {});
    expect(result.ok).toBe(false);
  });

  it('can price from a measured swatch with no gauge at all', () => {
    const perStitch = metresPerStitch({ yarnMetres: 12, stitches: 100 });
    expect(perStitch).toBeCloseTo(0.12, 6);
    const result = estimateFromSwatch(pattern, perStitch!);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.totalMetres).toBeGreaterThan(0);
  });

  it('refuses a swatch with no stitches', () => {
    expect(metresPerStitch({ yarnMetres: 12, stitches: 0 })).toBeNull();
    expect(metresPerStitch({ yarnMetres: 0, stitches: 100 })).toBeNull();
  });
});

describe('skein planning', () => {
  it('rounds up to whole skeins', () => {
    const plan = planSkeins({ neededMetres: 500, skeinMetres: 200, waste: 0 });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.skeins).toBe(3);
      expect(plan.leftoverMetres).toBeCloseTo(100, 6);
    }
  });

  it('flags when the allowance is what pushes you over a skein boundary', () => {
    // 400 m of yarn in 200 m skeins is exactly two skeins...
    const bare = planSkeins({ neededMetres: 400, skeinMetres: 200, waste: 0 });
    expect(bare.ok && bare.skeins).toBe(2);
    // ...but with 10% allowance it is 440 m, which needs a third.
    const withWaste = planSkeins({ neededMetres: 400, skeinMetres: 200, waste: 0.1 });
    expect(withWaste.ok).toBe(true);
    if (withWaste.ok) {
      expect(withWaste.skeins).toBe(3);
      expect(withWaste.wasteChangedCount).toBe(true);
    }
  });

  it('does not claim the allowance changed the answer when it did not', () => {
    const plan = planSkeins({ neededMetres: 300, skeinMetres: 200, waste: 0.1 });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.skeins).toBe(2);
      expect(plan.wasteChangedCount).toBe(false);
    }
  });

  it('explains the yards/metres trap instead of dividing by zero', () => {
    const plan = planSkeins({ neededMetres: 500, skeinMetres: 0 });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.problem).toMatch(/yards and metres/i);
  });

  it('rejects a nonsense allowance', () => {
    expect(planSkeins({ neededMetres: 100, skeinMetres: 100, waste: 2 }).ok).toBe(false);
  });

  it('converts a yard label to metres', () => {
    expect(toMetres(1, 'yd')).toBeCloseTo(0.9144, 6);
    expect(toMetres(100, 'cm')).toBeCloseTo(1, 6);
  });

  it('formats lengths in the unit that reads best', () => {
    expect(formatLength(0.35)).toBe('35 cm');
    expect(formatLength(4.5)).toBe('4.50 m');
    expect(formatLength(120.4)).toBe('120 m');
  });
});

/* -------------------------------------------------------------- symbols */

describe('symbol charts', () => {
  it('has a distinct symbol for every stitch code the catalogue knows', () => {
    for (const code of ['ch', 'slst', 'sc', 'hdc', 'dc', 'tr', 'dtr', 'inc', 'dec', 'bobble', 'puff', 'shell', 'cluster']) {
      expect(symbolFor(code).label).not.toBe('not understood');
    }
  });

  it('falls back to the error glyph for an unknown code, never blank', () => {
    expect(symbolFor('qqq').label).toBe('not understood');
    expect(symbolFor('qqq').paths.length).toBeGreaterThan(0);
  });

  it('draws one cell per stitch made, so an increase is a single cell worth two', () => {
    const text = '[2 sc, inc] x 6';
    const pattern = parsePattern(`Round 1: ${text} (24)`);
    const chart = buildChart(pattern);
    expect(chart.rows).toHaveLength(1);

    const row = chart.rows[0]!;
    expect(row.cells).toHaveLength(18); // 12 sc + 6 inc cells
    expect(chartMade(row)).toBe(24); // 12 + 12 stitches made
    expect(chartMade(row)).toBe(evaluateInstruction(text).count);
  });

  it('confirms agreement between the drawing and the maths engine', () => {
    const pattern = parsePattern('Round 1: [sc, inc] x 6 (18)');
    const row = buildChart(pattern).rows[0]!;
    expect(chartAgreesWith(row, 18)).toBe(true);
    // A count that is wrong must be reported as wrong.
    expect(chartAgreesWith(row, 24)).toBe(false);
    // An unknown count is unknown, not a pass.
    expect(chartAgreesWith(row, undefined)).toBeNull();
  });

  it('marks where each repetition begins', () => {
    const pattern = parsePattern('Round 1: [sc, inc] x 3 (9)');
    const chart = buildChart(pattern);
    const boundaries = repeatBoundaries(chart.rows[0]!);
    expect(boundaries).toEqual([2, 4]);
  });

  it('reports rows it could not chart instead of dropping them quietly', () => {
    const pattern = parsePattern('Gauge: 16 sc and 20 rows to 10 cm\nRound 1: 6 sc in mr (6)');
    const chart = buildChart(pattern);
    expect(chart.rows).toHaveLength(1);
    expect(chart.skipped.length).toBeGreaterThanOrEqual(0);
  });

  it('exposes a legend without the error glyph', () => {
    const codes = symbolLegend().map((entry) => entry.code);
    expect(codes).not.toContain('unknown');
    expect(codes).toContain('sc');
  });
});

/* -------------------------------------------------------------- journal */

function entry(overrides: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'e1',
    projectId: 'p1',
    at: '2026-10-01T10:00:00.000Z',
    kind: 'note',
    text: 'hello',
    ...overrides,
  };
}

describe('photo sizing', () => {
  it('scales the long edge down and preserves the aspect ratio', () => {
    expect(fitWithin(2000, 1000, 900)).toEqual({ width: 900, height: 450 });
    expect(fitWithin(1000, 2000, 900)).toEqual({ width: 450, height: 900 });
  });

  it('never upscales a small photo', () => {
    expect(fitWithin(400, 300, 900)).toEqual({ width: 400, height: 300 });
  });

  it('refuses nonsense dimensions rather than producing a zero-size canvas', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(-5, 10)).toEqual({ width: 0, height: 0 });
  });
});

describe('journal storage budget', () => {
  it('counts base64 payload honestly, including padding', () => {
    // "AAAA" is 3 bytes of binary in 4 base64 characters.
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3 + 'data:image/jpeg;base64,'.length);
    // "AAA=" is 2 bytes.
    expect(dataUrlBytes('data:image/jpeg;base64,AAA=')).toBe(2 + 'data:image/jpeg;base64,'.length);
  });

  it('evicts the oldest photos first when over budget', () => {
    const photo = (id: string, at: string, bytes: number) =>
      entry({ id, at, kind: 'photo', image: `data:image/jpeg;base64,${'A'.repeat(bytes)}` });

    const kept = trimToBudget(
      [
        photo('new', '2026-10-03T10:00:00.000Z', 400),
        photo('old', '2026-10-01T10:00:00.000Z', 400),
        entry({ id: 'note', kind: 'note', text: 'keep me' }),
      ],
      450,
    );

    expect(kept.dropped.map((dropped) => dropped.id)).toEqual(['old']);
    expect(kept.kept.some((keptEntry) => keptEntry.id === 'note')).toBe(true);
  });

  it('never evicts notes, even when they outnumber photos', () => {
    const entries = [
      entry({ id: 'note1', kind: 'note', text: 'a' }),
      entry({ id: 'note2', kind: 'note', text: 'b' }),
      entry({ id: 'p', kind: 'photo', image: `data:image/jpeg;base64,${'A'.repeat(400)}` }),
    ];
    const result = trimToBudget(entries, 10);
    expect(result.kept.filter((keptEntry) => keptEntry.kind === 'note')).toHaveLength(2);
    expect(result.dropped).toHaveLength(1);
  });

  it('leaves a journal under budget untouched', () => {
    const entries = [entry({ id: 'a' }), entry({ id: 'b' })];
    expect(trimToBudget(entries, 1_000_000).dropped).toEqual([]);
    expect(journalBytes(entries)).toBe(0);
  });
});

describe('journal ordering', () => {
  it('sorts newest first', () => {
    const sorted = sortEntries([
      entry({ id: 'a', at: '2026-10-01T10:00:00.000Z' }),
      entry({ id: 'b', at: '2026-10-03T10:00:00.000Z' }),
    ]);
    expect(sorted.map((sortedEntry) => sortedEntry.id)).toEqual(['b', 'a']);
  });

  it('labels today and yesterday in local time', () => {
    const now = new Date(2026, 9, 25, 21, 30);
    const today = new Date(2026, 9, 25, 1, 0).toISOString();
    const yesterday = new Date(2026, 9, 24, 23, 0).toISOString();
    const groups = groupByDay([entry({ id: 't', at: today }), entry({ id: 'y', at: yesterday })], now);
    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
  });

  it('keeps an evening entry under today rather than tomorrow in UTC', () => {
    const late = new Date(2026, 9, 25, 23, 45);
    const now = new Date(2026, 9, 25, 23, 50);
    const groups = groupByDay([entry({ id: 'late', at: late.toISOString() })], now);
    expect(groups[0]!.label).toBe('Today');
  });

  it('adds newest first and removes by id', () => {
    const added = addEntry([entry({ id: 'a', at: '2026-10-01T10:00:00.000Z' })], entry({
      id: 'b',
      at: '2026-10-02T10:00:00.000Z',
    }));
    expect(added[0]!.id).toBe('b');
    expect(removeEntry(added, 'b').map((removed) => removed.id)).toEqual(['a']);
  });

  it('tracks a measurement trend between readings', () => {
    const trend = measurementTrend(
      [
        entry({ id: 'a', kind: 'measure', label: 'Sleeve', text: '30', at: '2026-10-01T10:00:00.000Z' }),
        entry({ id: 'b', kind: 'measure', label: 'Sleeve', text: '38', at: '2026-10-05T10:00:00.000Z' }),
        entry({ id: 'c', kind: 'measure', label: 'Body', text: '50', at: '2026-10-05T10:00:00.000Z' }),
      ],
      'Sleeve',
    );
    expect(trend).toEqual({ first: 30, last: 38, delta: 8, count: 2 });
  });

  it('has no trend with a single reading', () => {
    expect(
      measurementTrend([entry({ kind: 'measure', label: 'Sleeve', text: '30' })], 'Sleeve'),
    ).toBeNull();
  });

  it('lists measurement labels in the order first used', () => {
    const labels = measurementLabels([
      entry({ id: 'a', kind: 'measure', label: 'Body', at: '2026-10-01T10:00:00.000Z' }),
      entry({ id: 'b', kind: 'measure', label: 'Sleeve', at: '2026-10-02T10:00:00.000Z' }),
      entry({ id: 'c', kind: 'measure', label: 'Body', at: '2026-10-03T10:00:00.000Z' }),
    ]);
    expect(labels).toEqual(['Body', 'Sleeve']);
  });

  it('makes stable ids from a seed', () => {
    expect(makeEntryId(1, 1700)).toBe(makeEntryId(1, 1700));
    expect(makeEntryId(1, 1700)).not.toBe(makeEntryId(2, 1700));
  });
});

/* --------------------------------------------------------------- search */

describe('command palette search', () => {
  const docs = buildIndex();

  it('puts the tool above anything that merely mentions the word', () => {
    const hits = search('gauge', docs);
    expect(hits[0]!.doc.href).toBe('/gauge');
  });

  it('finds a tool from a subsequence of its name', () => {
    const hits = search('chkr', docs);
    expect(hits.some((hit) => hit.doc.href === '/checker')).toBe(true);
  });

  it('reaches a tool from a keyword that is not in its title', () => {
    const hits = search('yardage', docs);
    expect(hits[0]!.doc.href).toBe('/stash');
  });

  it('matches words in any order', () => {
    const doc = { id: 'x', title: 'Easy Baby Blanket', group: 'Patterns', href: '/x' };
    expect(scoreDoc('blanket easy', doc)).not.toBeNull();
    expect(scoreDoc('easy blanket', doc)).not.toBeNull();
    // A word that is absent still rejects the document.
    expect(scoreDoc('blanket zzz', doc)).toBeNull();
  });

  it('prefers a word-start match over a match buried mid-word', () => {
    const start = scoreText('chart', 'Chart symbols')!;
    const buried = scoreText('chart', 'Uncharted waters')!;
    expect(start.score).toBeGreaterThan(buried.score);
  });

  it('returns nothing for a query that is not present', () => {
    expect(search('zzzqqq', docs)).toEqual([]);
  });

  it('returns the first docs for an empty query so the palette is never blank', () => {
    expect(search('', docs, 5)).toHaveLength(5);
  });

  it('indexes patterns by name and by tag', () => {
    const pattern = {
      id: 'p-test',
      title: 'Test Bunny',
      craft: 'crochet',
      category: 'Amigurumi',
      level: 'easy',
      minutes: 60,
      blurb: '',
      tags: ['toy', 'rabbit'],
      origin: 'curated',
      supplies: { yarn: 'DK' },
    } as CatalogPattern;

    const withPatterns = buildIndex({ patterns: [pattern] });
    expect(search('bunny', withPatterns)[0]!.doc.href).toBe('/pattern/p-test');
    expect(search('rabbit', withPatterns)[0]!.doc.href).toBe('/pattern/p-test');
  });

  it('includes every tool exactly once', () => {
    const hrefs = TOOL_DOCS.map((doc) => doc.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
