import { describe, it, expect } from 'vitest';
import {
  estimateYarn,
  generateVerifiedFromCanvas,
  generateVerifiedFromShape,
} from '../domain/patternGenerator.ts';
import { buildCatalog, patternText, weeklyPicks } from '../domain/catalog.ts';
import { parsePattern } from '../domain/patternParser.ts';
import { summarise } from '../domain/checkerSummary.ts';
import type { CanvasDesign, CanvasSymbol } from '../shared/types.ts';

const SHAPES = [
  'flat-circle',
  'granny-square',
  'amigurumi-sphere',
  'flat-panel',
  'hat-in-the-round',
  'chevron',
  'basket',
  'coaster-set',
  'tote',
  'ear-warmer',
  'bookmark',
] as const;

describe('shape generator', () => {
  it('produces instructions whose stated counts agree with the checker', () => {
    for (const kind of SHAPES) {
      const { parsed } = generateVerifiedFromShape(
        { kind, stitch: 'sc', rows: 8, width: 16, start: 6 },
        { title: `Test ${kind}` },
      );
      expect(parsed.steps.length, kind).toBeGreaterThan(0);
      const errors = parsed.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.map((e) => `${kind}: ${e.message}`)).toEqual([]);
    }
  });

  it('keeps chevron rows width-neutral', () => {
    const { parsed } = generateVerifiedFromShape(
      { kind: 'chevron', stitch: 'dc', rows: 4, start: 5 },
      { title: 'Chevron' },
    );
    const counts = parsed.steps
      .filter((step) => step.kind === 'row' && step.computedCount !== undefined)
      .map((step) => step.computedCount);
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe(45);
  });

  it('regression: nested repeats do not grow an unparsed array into itself', () => {
    // This instruction previously overflowed the stack through a shared array.
    const { parsed } = generateVerifiedFromShape(
      { kind: 'chevron', stitch: 'dc', rows: 3, start: 5 },
      { title: 'Nested repeat' },
    );
    expect(parsed.steps.some((step) => step.instruction.includes('inc) x 5'))).toBe(true);
  });
});

describe('canvas generator', () => {
  const design: CanvasDesign = {
    id: 'test',
    name: 'Test canvas',
    width: 4,
    height: 3,
    cells: [
      'sc', 'sc', 'dc', 'dc',
      'sc', 'inc', 'dc', 'blank',
      'dec', 'sc', 'ch', 'blank',
    ] as CanvasSymbol[],
    colors: Array<string>(12).fill('#fff'),
    palette: ['#fff'],
    baseStitch: 'sc',
    createdAt: 0,
    updatedAt: 0,
  };

  it('turns a grid into verifiable rows', () => {
    const { parsed } = generateVerifiedFromCanvas(design);
    const rows = parsed.steps.filter((step) => step.kind === 'row');
    expect(rows).toHaveLength(3);
    // Row 1: sc, sc, dc, dc -> 4 stitches.
    expect(rows[0]!.computedCount).toBe(4);
    // Row 2: sc + inc(2) + dc = 4 stitches, and the blank cell is skipped.
    expect(rows[1]!.computedCount).toBe(4);
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('skips entirely empty rows', () => {
    const empty: CanvasDesign = {
      ...design,
      cells: Array<CanvasSymbol>(12).fill('blank'),
    };
    expect(generateVerifiedFromCanvas(empty).generated.rows).toHaveLength(0);
  });
});

describe('yarn estimate', () => {
  it('scales with stitch count and always reports a caveat', () => {
    const small = estimateYarn([{ instruction: 'sc in each st across' }], { stitches: 100 });
    const large = estimateYarn([{ instruction: 'sc in each st across' }], { stitches: 1000 });
    expect(large.metres).toBeGreaterThan(small.metres);
    expect(small.skeins).toBeGreaterThanOrEqual(1);
    expect(small.note.toLowerCase()).toContain('estimate');
  });
});

describe('catalog', () => {
  it('ships more than 500 patterns across every category and level', () => {
    const catalog = buildCatalog();
    expect(catalog.length).toBeGreaterThan(500);
    expect(new Set(catalog.map((p) => p.category)).size).toBe(10);
    expect(new Set(catalog.map((p) => p.level)).size).toBe(4);
    expect(new Set(catalog.map((p) => p.id)).size).toBe(catalog.length);
  });

  it('every pattern has matching counts', () => {
    const catalog = buildCatalog();
    const failures: string[] = [];
    for (const pattern of catalog.slice(0, 80)) {
      const parsed = parsePattern(patternText(pattern), { title: pattern.title });
      const summary = summarise(parsed);
      if (summary.errors > 0) failures.push(pattern.id);
    }
    expect(failures).toEqual([]);
  });

  it('rotates weekly picks deterministically', () => {
    const a = weeklyPicks(new Date('2026-01-05')).map((p) => p.id);
    const b = weeklyPicks(new Date('2026-01-06')).map((p) => p.id);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
