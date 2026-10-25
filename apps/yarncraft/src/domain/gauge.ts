/**
 * Gauge and sizing maths.
 *
 * Every function is transparent about its inputs: a measurement without a
 * gauge is refused rather than defaulted, and results are rounded to a stitch
 * multiple where the caller asks for one.
 */

export interface Gauge {
  /** Stitches measured in the swatch. */
  stitches: number;
  /** Width of the measured section, in the unit the caller uses. */
  width: number;
  /** Rows measured in the swatch. */
  rows: number;
  /** Height of the measured section. */
  height: number;
  unit: 'cm' | 'in';
}

export type GaugeProblem =
  | { code: 'missing-measurement'; message: string }
  | { code: 'invalid-gauge'; message: string };

export type GaugeResult<T> = { ok: true; value: T } | { ok: false; problem: GaugeProblem };

export function validateGauge(gauge: Gauge): GaugeProblem | null {
  if (gauge.width <= 0 || gauge.height <= 0) {
    return {
      code: 'missing-measurement',
      message: 'The swatch needs a measured width and height. A gauge without a measurement cannot be used.',
    };
  }
  if (gauge.stitches <= 0 || gauge.rows <= 0) {
    return { code: 'invalid-gauge', message: 'Stitch and row counts must be greater than zero.' };
  }
  return null;
}

/** Stitches per unit width. */
export function stitchesPerUnit(gauge: Gauge): number {
  return gauge.stitches / gauge.width;
}

/** Rows per unit height. */
export function rowsPerUnit(gauge: Gauge): number {
  return gauge.rows / gauge.height;
}

export function stitchesForWidth(targetWidth: number, gauge: Gauge): GaugeResult<number> {
  const problem = validateGauge(gauge);
  if (problem) return { ok: false, problem };
  if (targetWidth <= 0) {
    return {
      ok: false,
      problem: { code: 'missing-measurement', message: 'Enter a target width greater than zero.' },
    };
  }
  return { ok: true, value: Math.round(targetWidth * stitchesPerUnit(gauge)) };
}

export function rowsForHeight(targetHeight: number, gauge: Gauge): GaugeResult<number> {
  const problem = validateGauge(gauge);
  if (problem) return { ok: false, problem };
  if (targetHeight <= 0) {
    return {
      ok: false,
      problem: { code: 'missing-measurement', message: 'Enter a target height greater than zero.' },
    };
  }
  return { ok: true, value: Math.round(targetHeight * rowsPerUnit(gauge)) };
}

/** Rounds down to a multiple, which is what a repeat needs to fit cleanly. */
export function roundToMultiple(value: number, multiple: number, mode: 'down' | 'nearest' = 'nearest'): number {
  if (multiple <= 1) return value;
  if (mode === 'down') return Math.floor(value / multiple) * multiple;
  return Math.round(value / multiple) * multiple;
}

/**
 * The flat-circle rule: each round adds as many stitches as round one started
 * with. Returns the per-round plan for a circle of the given diameter.
 */
export function flatCirclePlan(
  targetDiameter: number,
  gauge: Gauge,
  startStitches = 6,
): GaugeResult<Array<{ round: number; stitches: number; instruction: string }>> {
  const problem = validateGauge(gauge);
  if (problem) return { ok: false, problem };
  const target = stitchesForWidth(targetDiameter, gauge);
  if (!target.ok) return target;
  if (startStitches < 4 || startStitches > 16) {
    return {
      ok: false,
      problem: { code: 'invalid-gauge', message: 'A flat circle start is usually between 4 and 16 stitches.' },
    };
  }

  const rounds: Array<{ round: number; stitches: number; instruction: string }> = [];
  let stitches = startStitches;
  let round = 1;
  rounds.push({
    round,
    stitches,
    instruction: `${startStitches} sc in magic ring (${startStitches})`,
  });

  while (stitches < target.value && round < 60) {
    round += 1;
    const plain = round - 2;
    const group = plain > 0 ? `(${plain} sc, inc)` : '(inc)';
    const times = startStitches;
    stitches += startStitches;
    rounds.push({
      round,
      stitches,
      instruction: `${group} x ${times} (${stitches})`,
    });
  }
  return { ok: true, value: rounds };
}

export interface ResizeReport {
  steps: number;
  /** Difference between the resized count and the original, per step. */
  deltas: Array<{ label: string; from: number; to: number }>;
  note: string;
}

/**
 * Rescales a pattern's stated counts from one gauge to another. Only the
 * numbers move: the instructions are untouched, so every row keeps its shape.
 */
export function resizeCounts(
  counts: Array<{ label: string; count: number }>,
  from: Gauge,
  to: Gauge,
): GaugeResult<ResizeReport> {
  const fromProblem = validateGauge(from);
  if (fromProblem) return { ok: false, problem: fromProblem };
  const toProblem = validateGauge(to);
  if (toProblem) return { ok: false, problem: toProblem };

  const ratio = stitchesPerUnit(from) / stitchesPerUnit(to);
  const deltas = counts.map((entry) => ({
    label: entry.label,
    from: entry.count,
    to: Math.max(1, Math.round(entry.count * ratio)),
  }));

  return {
    ok: true,
    value: {
      steps: deltas.length,
      deltas,
      note:
        ratio === 1
          ? 'The two gauges match, so no count changes.'
          : `Counts scale by ${ratio.toFixed(3)}. Rounding can shift a round by one stitch; check the first few rounds against the checker.`,
    },
  };
}

/** Converts a measured length between units, for swatch entry. */
export function convertLength(value: number, from: 'cm' | 'in', to: 'cm' | 'in'): number {
  if (from === to) return value;
  return from === 'cm' ? value / 2.54 : value * 2.54;
}

/** Yarn weight reference used by the substitution helper. */
export interface YarnWeight {
  key: string;
  name: string;
  number: string;
  /** Typical hook range in mm. */
  hook: string;
  /** Typical stitches per 10 cm in single crochet. */
  gauge: string;
}

export const YARN_WEIGHTS: YarnWeight[] = [
  { key: 'lace', name: 'Lace', number: '0', hook: '1.5-2.25 mm', gauge: '32-34 sc' },
  { key: 'sport', name: 'Sport / 4 ply', number: '2', hook: '3.5-4.5 mm', gauge: '23-26 sc' },
  { key: 'dk', name: 'DK / 8 ply', number: '3', hook: '4.0-5.0 mm', gauge: '21-24 sc' },
  { key: 'worsted', name: 'Worsted / 10 ply', number: '4', hook: '5.0-6.5 mm', gauge: '16-20 sc' },
  { key: 'chunky', name: 'Chunky / 12 ply', number: '5', hook: '6.5-9.0 mm', gauge: '12-15 sc' },
  { key: 'super', name: 'Super bulky', number: '6', hook: '9.0-15 mm', gauge: '7-11 sc' },
];

/**
 * Suggests same-weight substitutes. Deliberately refuses to cross weight
 * families: a different weight changes the fabric, not just the yardage.
 */
export function substitutionAdvice(key: string): { weight: YarnWeight | null; advice: string } {
  const weight = YARN_WEIGHTS.find((entry) => entry.key === key) ?? null;
  if (!weight) {
    return { weight: null, advice: 'Choose a yarn weight to see what can be substituted.' };
  }
  return {
    weight,
    advice:
      `Stay within ${weight.name} (category ${weight.number}, hook ${weight.hook}). ` +
      'Match the gauge swatch rather than the label: two yarns in the same category can still ' +
      'differ by a full stitch per 10 cm. Do not substitute across weight families - the stitch ' +
      'counts in the pattern would no longer produce the stated size.',
  };
}
