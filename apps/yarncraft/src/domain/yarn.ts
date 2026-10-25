/**
 * Yarn planning.
 *
 * Two questions, both answered from measurements the user supplies rather than
 * from a table we invented:
 *
 *  - "how much yarn is this pattern going to take?"
 *  - "how many skeins do I need, and what is left over?"
 *
 * The first question needs a gauge, because yarn per stitch is proportional to
 * stitch size. Without a gauge this module refuses and says what is missing; it
 * never substitutes a default tension, which is the single most common way a
 * yarn estimate goes wrong by 40%.
 *
 * The consumption factors below are relative, not absolute: they are multiples
 * of the width of one stitch, derived from stitch geometry (a taller stitch
 * travels further per stitch). `sc` is the baseline at 2.6. These are a model,
 * so the UI labels every result as an estimate and the measured-swatch path is
 * offered as the authoritative alternative.
 */

import type { ParsedPattern, PatternStep } from '../shared/types.ts';
import { countByCode, tokenizeInstruction } from './stitchTokens.ts';
import { stitchByCode } from './stitches.ts';

/**
 * Yarn consumed by one stitch, as a multiple of that stitch's own width.
 *
 * Geometry: a stitch leaves the hook, crosses its own width, and comes back
 * plus the height it gains. Chain and slip stitch barely travel; bobbles and
 * shells draw from several loops at once and so cost more than their height
 * suggests.
 */
export const YARN_PER_WIDTH: Record<string, number> = {
  ch: 1.6,
  slst: 0.9,
  sc: 2.6,
  hdc: 3.4,
  dc: 4.6,
  tr: 5.8,
  dtr: 7.0,
  fsc: 2.6,
  inc: 2.9,
  dec: 2.4,
  bobble: 9.5,
  puff: 8.0,
  shell: 12.0,
  cluster: 6.5,
  'ch-sp': 1.6,
};

/** Used when a step references a stitch we have no factor for. */
export const FALLBACK_FACTOR = 2.6;

export interface GaugeInput {
  /** Stitches measured over 10 cm. */
  stitchesPer10cm?: number;
  /** Rows measured over 10 cm. */
  rowsPer10cm?: number;
}

export interface GaugeProblem {
  ok: false;
  problem: string;
}

export interface GaugeOk {
  ok: true;
  /** Average width of one stitch, in cm. */
  stitchWidthCm: number;
  /** Average height of one row, in cm. */
  rowHeightCm?: number;
}

export type GaugeCheck = GaugeOk | GaugeProblem;

/**
 * Validate a measured gauge. Both numbers are optional, but at least a stitch
 * count is required to price a pattern, and a nonsense value is refused rather
 * than clamped.
 */
export function checkGauge(gauge: GaugeInput): GaugeCheck {
  const { stitchesPer10cm, rowsPer10cm } = gauge;
  if (!stitchesPer10cm || Number.isNaN(stitchesPer10cm)) {
    return {
      ok: false,
      problem: 'Measure your swatch: how many stitches fit in 10 cm? Without that a yarn estimate is a guess.',
    };
  }
  if (stitchesPer10cm <= 0) {
    return { ok: false, problem: 'Stitches per 10 cm must be greater than zero.' };
  }
  if (stitchesPer10cm > 200) {
    return { ok: false, problem: 'More than 200 stitches in 10 cm is not a real gauge. Check the measurement.' };
  }
  if (rowsPer10cm !== undefined && (Number.isNaN(rowsPer10cm) || rowsPer10cm <= 0 || rowsPer10cm > 200)) {
    return { ok: false, problem: 'Rows per 10 cm must be between 1 and 200.' };
  }
  return {
    ok: true,
    stitchWidthCm: 10 / stitchesPer10cm,
    rowHeightCm: rowsPer10cm ? 10 / rowsPer10cm : undefined,
  };
}

export interface StepCost {
  index: number;
  label: string;
  /** Length of yarn used by this step, in cm. */
  cm: number;
  stitches: number;
  /** Stitch codes with no factor, so the user knows the total is a floor. */
  unknownCodes: string[];
}

export interface YarnEstimate {
  ok: true;
  totalCm: number;
  totalMetres: number;
  totalYards: number;
  steps: StepCost[];
  /** Stitch codes that were priced with the fallback factor. */
  fallbackCodes: string[];
  /** True when a step could not be tokenized and the total excludes it. */
  incomplete: boolean;
}

export interface YarnProblem {
  ok: false;
  problem: string;
}

export type YarnResult = YarnEstimate | YarnProblem;

/**
 * Price every step of a parsed pattern.
 *
 * Chain counts are included: chains consume yarn. Turning chains are part of
 * the instruction text and are counted by the tokenizer as `ch` tokens, which is
 * what we want for a yarn total even though a count check ignores them.
 */
export function estimateYarn(pattern: ParsedPattern, gauge: GaugeInput): YarnResult {
  const check = checkGauge(gauge);
  if (!check.ok) return check;

  const width = check.stitchWidthCm;
  const steps: StepCost[] = [];
  const fallbackCodes = new Set<string>();
  let incomplete = false;

  for (const step of pattern.steps) {
    const cost = priceStep(step, width);
    if (cost === null) {
      incomplete = true;
      continue;
    }
    for (const code of cost.unknownCodes) fallbackCodes.add(code);
    steps.push(cost);
  }

  const totalCm = steps.reduce((sum, step) => sum + step.cm, 0);
  return {
    ok: true,
    totalCm,
    totalMetres: totalCm / 100,
    totalYards: totalCm / 91.44,
    steps,
    fallbackCodes: [...fallbackCodes].sort(),
    incomplete,
  };
}

/**
 * Price one step. Returns null for steps that carry no yarn (notes, finishing
 * prose) so they do not appear as zero-cost rows in the breakdown.
 */
function priceStep(step: PatternStep, widthCm: number): StepCost | null {
  if (step.kind === 'note') return null;
  const { tokens } = tokenizeInstruction(step.instruction);
  if (tokens.length === 0) return null;

  const counts = countByCode(tokens);
  let cm = 0;
  const unknownCodes: string[] = [];
  let stitches = 0;

  for (const [code, count] of Object.entries(counts)) {
    let factor = YARN_PER_WIDTH[code];
    if (factor === undefined) {
      factor = FALLBACK_FACTOR;
      if (!stitchByCode(code) || YARN_PER_WIDTH[code] === undefined) unknownCodes.push(code);
    }
    cm += count * factor * widthCm;
    stitches += count;
  }

  // Chain spaces are not stitch tokens but they hold a chain's worth of yarn.
  const spaces = tokens.filter((t) => t.kind === 'chain-space');
  for (const space of spaces) {
    cm += (space.space ?? 1) * (YARN_PER_WIDTH.ch ?? 1.6) * widthCm;
  }

  return { index: step.index, label: step.label, cm, stitches, unknownCodes };
}

/* ------------------------------------------------------------------- skeins */

export interface SkeinPlanInput {
  /** Yarn needed, in metres. */
  neededMetres: number;
  /** Length of one skein, in metres. */
  skeinMetres: number;
  /** Extra allowance for joins, tension changes and swatching, as a fraction. */
  waste?: number;
  /** Price of one skein, in the user's currency. Optional. */
  pricePerSkein?: number;
}

export interface SkeinPlan {
  ok: true;
  /**
   * True when the allowance pushed the requirement over a whole skein boundary,
   * which is the difference between "buy 3" and "buy 4".
   */
  wasteChangedCount: boolean;
  wasteFraction: number;
  neededMetres: number;
  withWasteMetres: number;
  skeins: number;
  purchasedMetres: number;
  leftoverMetres: number;
  leftoverFraction: number;
  cost?: number;
}

export interface SkeinProblem {
  ok: false;
  problem: string;
}

export type SkeinResult = SkeinPlan | SkeinProblem;

/** Default allowance. 10% covers a swatch plus joins without hiding real shortfalls. */
export const DEFAULT_WASTE = 0.1;

export function planSkeins(input: SkeinPlanInput): SkeinResult {
  const { neededMetres, skeinMetres, pricePerSkein } = input;
  const waste = input.waste ?? DEFAULT_WASTE;

  if (!Number.isFinite(neededMetres) || neededMetres <= 0) {
    return { ok: false, problem: 'Yarn requirement must be greater than zero.' };
  }
  if (!Number.isFinite(skeinMetres) || skeinMetres <= 0) {
    return {
      ok: false,
      problem: 'Skein length must be greater than zero. Check the label: yards and metres are not the same number.',
    };
  }
  if (waste < 0 || waste > 1) {
    return { ok: false, problem: 'Allowance must be between 0% and 100%.' };
  }

  const withWaste = neededMetres * (1 + waste);
  const rawSkeins = withWaste / skeinMetres;
  const skeins = Math.ceil(rawSkeins - 1e-9);
  const purchased = skeins * skeinMetres;
  const leftover = purchased - withWaste;
  const bareSkeins = Math.ceil(neededMetres / skeinMetres - 1e-9);

  return {
    ok: true,
    wasteChangedCount: skeins > bareSkeins,
    wasteFraction: waste,
    neededMetres,
    withWasteMetres: withWaste,
    skeins,
    purchasedMetres: purchased,
    leftoverMetres: leftover,
    leftoverFraction: purchased > 0 ? leftover / purchased : 0,
    cost: pricePerSkein !== undefined ? pricePerSkein * skeins : undefined,
  };
}

/* -------------------------------------------------------------------- units */

export const CM_PER_INCH = 2.54;
export const CM_PER_YARD = 91.44;
export const CM_PER_METRE = 100;

/** Yarn labels mix yards and metres; every comparison here is in metres. */
export function toMetres(value: number, unit: 'm' | 'yd' | 'ft' | 'cm'): number {
  switch (unit) {
    case 'yd':
      return (value * CM_PER_YARD) / CM_PER_METRE;
    case 'ft':
      return (value * 12 * CM_PER_INCH) / CM_PER_METRE;
    case 'cm':
      return value / CM_PER_METRE;
    default:
      return value;
  }
}

export function formatLength(metres: number): string {
  if (!Number.isFinite(metres)) return '-';
  if (metres < 1) return `${Math.round(metres * 100)} cm`;
  if (metres < 10) return `${metres.toFixed(2)} m`;
  return `${Math.round(metres)} m`;
}

/* -------------------------------------------------------- measured swatch */

export interface SwatchMeasurement {
  /** Yarn used by the swatch, in metres. */
  yarnMetres: number;
  /** Stitches in the swatch. */
  stitches: number;
  /** Rows in the swatch, for a per-row figure. */
  rows?: number;
}

/**
 * The authoritative path: you crocheted a swatch, you know exactly how much yarn
 * it ate, so scale by stitch count. No model, no factors. Returns null when the
 * measurement is not usable.
 */
export function metresPerStitch(sample: SwatchMeasurement): number | null {
  if (!Number.isFinite(sample.yarnMetres) || sample.yarnMetres <= 0) return null;
  if (!Number.isFinite(sample.stitches) || sample.stitches <= 0) return null;
  return sample.yarnMetres / sample.stitches;
}

export function estimateFromSwatch(
  pattern: ParsedPattern,
  metresPerStitchValue: number,
): YarnResult {
  if (!Number.isFinite(metresPerStitchValue) || metresPerStitchValue <= 0) {
    return { ok: false, problem: 'Measure how much yarn one stitch uses, or use the gauge model instead.' };
  }
  const steps: StepCost[] = [];
  let totalCm = 0;
  let incomplete = false;

  for (const step of pattern.steps) {
    if (step.kind === 'note') continue;
    const { tokens } = tokenizeInstruction(step.instruction);
    if (!tokens.length) continue;
    const stitches = tokens.filter((t) => t.kind === 'stitch' || t.kind === 'chain-space').length;
    const cm = stitches * metresPerStitchValue * 100;
    totalCm += cm;
    steps.push({ index: step.index, label: step.label, cm, stitches, unknownCodes: [] });
  }

  return {
    ok: true,
    totalCm,
    totalMetres: totalCm / 100,
    totalYards: totalCm / CM_PER_YARD,
    steps,
    fallbackCodes: [],
    incomplete,
  };
}
