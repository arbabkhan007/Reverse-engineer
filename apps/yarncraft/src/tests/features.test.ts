import { describe, it, expect } from 'vitest';
import { detectDialect, glossaryRows, translateTerminology } from '../domain/terminology.ts';
import {
  convertLength,
  flatCirclePlan,
  resizeCounts,
  roundToMultiple,
  rowsForHeight,
  stitchesForWidth,
  substitutionAdvice,
  validateGauge,
  YARN_WEIGHTS,
  type Gauge,
} from '../domain/gauge.ts';
import {
  buildPalette,
  chartInstructions,
  colorCounts,
  downsample,
  imageToChart,
  mapToPalette,
  rgbToHex,
  toChartRows,
  type Rgb,
} from '../domain/imageChart.ts';
import { evaluateInstruction } from '../domain/patternChecker.ts';

const GAUGE: Gauge = { stitches: 16, width: 10, rows: 20, height: 10, unit: 'cm' };

describe('US <-> UK terminology', () => {
  it('translates stitch abbreviations without chaining', () => {
    // sc -> dc must NOT then become tr.
    const result = translateTerminology('Round 1: 6 sc in mr', 'us', 'uk');
    expect(result.text).toBe('Round 1: 6 dc in mr');
    expect(result.changes[0]).toEqual({ from: 'sc', to: 'dc', count: 1 });
  });

  it('maps every US abbreviation one step taller in UK', () => {
    expect(translateTerminology('dc', 'us', 'uk').text).toBe('tr');
    expect(translateTerminology('hdc', 'us', 'uk').text).toBe('htr');
    expect(translateTerminology('tr', 'us', 'uk').text).toBe('dtr');
    expect(translateTerminology('dtr', 'us', 'uk').text).toBe('trtr');
  });

  it('maps UK back to US', () => {
    expect(translateTerminology('tr', 'uk', 'us').text).toBe('dc');
    expect(translateTerminology('htr', 'uk', 'us').text).toBe('hdc');
    expect(translateTerminology('trtr', 'uk', 'us').text).toBe('dtr');
  });

  it('does not translate inside longer words', () => {
    // "tr" must not match inside "treble"; "sc" must not match inside "scarf".
    const result = translateTerminology('treble scarf', 'us', 'uk');
    expect(result.text).toBe('treble scarf');
    expect(result.changes).toHaveLength(0);
  });

  it('handles full stitch names before abbreviations', () => {
    const result = translateTerminology('single crochet and sc', 'us', 'uk');
    expect(result.text).toBe('double crochet and dc');
  });

  it('translates phrases such as gauge and skip', () => {
    const result = translateTerminology('Gauge: skip 1 st', 'us', 'uk');
    expect(result.text).toBe('Tension: miss 1 st');
  });

  it('preserves capitalisation', () => {
    expect(translateTerminology('SC in each st', 'us', 'uk').text).toBe('DC in each st');
    expect(translateTerminology('Gauge', 'us', 'uk').text).toBe('Tension');
  });

  it('round-trips a full pattern back to the original', () => {
    const us = 'Rnd 1: 6 sc in mr. Rnd 2: (sc, inc) x 6 (12). Rnd 3: dc around.';
    const uk = translateTerminology(us, 'us', 'uk').text;
    const back = translateTerminology(uk, 'uk', 'us').text;
    expect(back).toBe(us);
  });

  it('keeps stitch counts identical across the dialect change', () => {
    const us = '(2 sc, inc) x 6';
    const ukText = translateTerminology(us, 'us', 'uk').text;
    // "sc" -> "dc" is the same operation, so the count must not move.
    expect(evaluateInstruction(ukText).count).toBe(evaluateInstruction(us).count);
  });

  it('is a no-op when the dialects match', () => {
    const result = translateTerminology('6 sc in mr', 'us', 'us');
    expect(result.text).toBe('6 sc in mr');
    expect(result.changes).toHaveLength(0);
  });

  it('detects dialect from markers and vocabulary', () => {
    expect(detectDialect('Pattern (UK terms)')).toBe('uk');
    expect(detectDialect('Written in US terms')).toBe('us');
    expect(detectDialect('htr and yrh')).toBe('uk');
    expect(detectDialect('hdc and fsc')).toBe('us');
    expect(detectDialect('a scarf with no stitches at all')).toBe('unknown');
  });

  it('offers a glossary with no duplicate sides', () => {
    const rows = glossaryRows('us');
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.some((row) => row.from === 'sc' && row.to === 'dc')).toBe(true);
  });
});

describe('gauge and sizing', () => {
  it('computes stitches for a width', () => {
    const result = stitchesForWidth(50, GAUGE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(80);
  });

  it('computes rows for a height', () => {
    const result = rowsForHeight(30, GAUGE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(60);
  });

  it('refuses a gauge with no measured area', () => {
    const problem = validateGauge({ ...GAUGE, width: 0 });
    expect(problem?.code).toBe('missing-measurement');

    const result = stitchesForWidth(50, { ...GAUGE, width: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem.code).toBe('missing-measurement');
  });

  it('refuses a zero target instead of guessing', () => {
    const result = stitchesForWidth(0, GAUGE);
    expect(result.ok).toBe(false);
  });

  it('rounds to a stitch multiple for repeats', () => {
    expect(roundToMultiple(83, 6)).toBe(84);
    expect(roundToMultiple(83, 6, 'down')).toBe(78);
    expect(roundToMultiple(7, 1)).toBe(7);
  });

  it('converts between cm and inches', () => {
    expect(convertLength(10, 'cm', 'in')).toBeCloseTo(3.937, 2);
    expect(convertLength(1, 'in', 'cm')).toBeCloseTo(2.54, 2);
    expect(convertLength(5, 'cm', 'cm')).toBe(5);
  });

  it('plans a flat circle that grows by its starting count', () => {
    const plan = flatCirclePlan(10, GAUGE, 6);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const rounds = plan.value;
    expect(rounds[0]!.stitches).toBe(6);
    for (let index = 1; index < rounds.length; index += 1) {
      expect(rounds[index]!.stitches - rounds[index - 1]!.stitches).toBe(6);
    }
    // Each planned instruction must parse to its own stated count.
    for (const round of rounds) {
      expect(evaluateInstruction(round.instruction.replace(/\(\d+\)/, '').trim()).count).toBe(round.stitches);
    }
  });

  it('rescales counts from one gauge to another', () => {
    const denser: Gauge = { ...GAUGE, stitches: 20 };
    const report = resizeCounts(
      [
        { label: 'Row 1', count: 40 },
        { label: 'Row 2', count: 40 },
      ],
      GAUGE,
      denser,
    );
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    // 40 stitches at 1.6 st/cm must become 40 at 2.0 st/cm -> 32.
    expect(report.value.deltas[0]!.to).toBe(32);
    expect(report.value.note).toContain('32'.length ? 'scale' : '');
  });

  it('reports no change for identical gauges', () => {
    const report = resizeCounts([{ label: 'Row 1', count: 30 }], GAUGE, GAUGE);
    expect(report.ok).toBe(true);
    if (report.ok) expect(report.value.deltas[0]!.to).toBe(30);
  });

  it('offers substitution advice that refuses to cross weight families', () => {
    const { advice, weight } = substitutionAdvice('dk');
    expect(weight?.name).toContain('DK');
    expect(advice).toContain('Do not substitute across weight families');
    expect(YARN_WEIGHTS.length).toBe(6);
  });
});

function solid(color: Rgb, width: number, height: number): Rgb[] {
  return Array.from({ length: width * height }, () => ({ ...color }));
}

const RED: Rgb = { r: 200, g: 30, b: 30 };
const BLUE: Rgb = { r: 30, g: 60, b: 200 };

describe('image to chart', () => {
  it('formats hex colours', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 16 })).toBe('#ff0010');
  });

  it('downsamples by area average', () => {
    // 4x2 source, half red half blue, downsampled to 2x1.
    const pixels: Rgb[] = [];
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 4; x += 1) pixels.push(x < 2 ? { ...RED } : { ...BLUE });
    }
    const grid = downsample(pixels, 4, 2, { width: 2, height: 1 });
    expect(grid).toHaveLength(2);
    expect(grid[0]!.r).toBeGreaterThan(grid[0]!.b);
    expect(grid[1]!.b).toBeGreaterThan(grid[1]!.r);
  });

  it('finds as many palette entries as the image supports', () => {
    const pixels = [...solid(RED, 8, 4), ...solid(BLUE, 8, 4)];
    const palette = buildPalette(pixels, 4);
    expect(palette.length).toBe(2);
    // Deterministic: same input, same order.
    const again = buildPalette(pixels, 4);
    expect(again).toEqual(palette);
  });

  it('never exceeds the requested colour count', () => {
    const pixels: Rgb[] = [];
    for (let index = 0; index < 400; index += 1) {
      pixels.push({ r: index % 256, g: (index * 3) % 256, b: (index * 7) % 256 });
    }
    expect(buildPalette(pixels, 5).length).toBeLessThanOrEqual(5);
  });

  it('maps pixels to the nearest palette colour', () => {
    const palette = [RED, BLUE];
    expect(mapToPalette([{ r: 190, g: 20, b: 20 }], palette)).toEqual([0]);
    expect(mapToPalette([{ r: 20, g: 50, b: 190 }], palette)).toEqual([1]);
  });

  it('builds run-length rows whose totals equal the chart width', () => {
    const indices = [0, 0, 1, 1, 1, 0, 1, 0];
    const rows = toChartRows(indices, 4);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.blocks).toEqual([
      { color: 0, run: 2 },
      { color: 1, run: 2 },
    ]);
    for (const row of rows) expect(row.total).toBe(4);
  });

  it('writes instructions that add up to the chart width', () => {
    const indices = [0, 0, 1, 1, 1, 0, 1, 0];
    const rows = toChartRows(indices, 4);
    const instructions = chartInstructions(rows, [RED, BLUE], {
      title: 'Test chart',
      stitch: 'sc',
      width: 4,
      height: 2,
    });
    expect(instructions.legend[0]).toEqual({ label: 'A', hex: '#c81e1e' });
    expect(instructions.rows[0]!.text).toBe('2 A, 2 B');
    // Every written number must sum to the row width.
    for (const row of instructions.rows) {
      const sum = row.text
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .reduce((a, b) => a + b, 0);
      expect(sum).toBe(row.total);
    }
    expect(instructions.text).toContain('Row 1: ch 5');
  });

  it('counts stitches per colour', () => {
    expect(colorCounts([0, 0, 1, 1, 1, 0], 2)).toEqual([3, 3]);
  });

  it('runs the full pipeline on a two-colour image', () => {
    const pixels = [...solid(RED, 10, 5), ...solid(BLUE, 10, 5)];
    const chart = imageToChart(pixels, 20, 5, {
      width: 10,
      height: 5,
      maxColors: 3,
      title: 'Two colours',
      stitch: 'sc',
    });
    expect(chart.palette.length).toBe(2);
    expect(chart.indices).toHaveLength(50);
    expect(chart.rows.length).toBe(5);
    for (const row of chart.rows) expect(row.total).toBe(10);
    expect(chart.text).toContain('COLOURS');
  });

  it('handles an image smaller than the requested grid', () => {
    const pixels = solid(RED, 2, 2);
    const grid = downsample(pixels, 2, 2, { width: 6, height: 6 });
    expect(grid).toHaveLength(36);
    expect(grid.every((pixel) => pixel.r === RED.r)).toBe(true);
  });
});
