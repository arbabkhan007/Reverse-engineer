/**
 * Written row -> symbol chart.
 *
 * A chart is the same information as a written row, addressed to the eye. The
 * hard part is not drawing symbols, it is deciding where each symbol goes, so
 * that decision lives here, in a pure function, and the React layer only paints.
 *
 * Layout rule: one cell per stitch, in reading order. Repeated groups are
 * expanded by `stitchTokens`, so a chart cell never stands for "x 6" - the
 * reader can count cells. Turning chains and joins are kept as their own cells
 * because they occupy a position in the row, but they are marked so the UI can
 * draw them lighter.
 */

import type { ParsedPattern, PatternStep } from '../shared/types.ts';
import { madeBy, tokenizeInstruction, type StitchToken } from './stitchTokens.ts';

/** A 24x24 box, the coordinate space every symbol below is drawn in. */
export const CELL = 24;

export interface SymbolShape {
  /** Stroked paths in the 24x24 box. */
  paths: string[];
  /** Filled shapes, drawn after the strokes. */
  fills?: string[];
  /** Dot centres, drawn as small filled circles. */
  dots?: Array<{ cx: number; cy: number; r: number }>;
  /** Shown in the chart legend. */
  label: string;
  /** True for tokens that are not counted stitches. */
  quiet?: boolean;
}

/**
 * Standard internationally used crochet chart symbols:
 * x for sc, T for hdc, T with a slash per extra height, a dot for slip stitch,
 * an oval for chain. A decrease is drawn as two strokes converging into one
 * cell; a decrease at a cell boundary would misrepresent which stitches merged.
 */
/** Drawn for any token we could not place. Never silently blank. */
const UNKNOWN: SymbolShape = {
  paths: ['M4 4h16v16H4z', 'M10 9a2 2 0 1 1 2 2v1', 'M12 16v.5'],
  label: 'not understood',
};

const SYMBOLS: Record<string, SymbolShape> = {
  ch: { paths: ['M6 12a6 4 0 1 0 12 0a6 4 0 1 0 -12 0'], label: 'chain' },
  slst: { paths: [], dots: [{ cx: 12, cy: 12, r: 2.6 }], label: 'slip stitch' },
  sc: { paths: ['M5 5l14 14', 'M19 5l-14 14'], label: 'single crochet' },
  hdc: { paths: ['M12 4v16', 'M4 8h16'], label: 'half double crochet' },
  dc: { paths: ['M12 4v16', 'M4 8h16', 'M7 15l10-6'], label: 'double crochet' },
  tr: { paths: ['M12 4v16', 'M4 8h16', 'M6 16l10-6', 'M10 18l10-6'], label: 'treble crochet' },
  dtr: {
    paths: ['M12 4v16', 'M4 8h16', 'M5 15l10-6', 'M9 17l10-6', 'M13 19l9-5'],
    label: 'double treble',
  },
  fsc: { paths: ['M5 5l14 14', 'M19 5l-14 14', 'M3 3v6'], label: 'foundation single crochet' },
  inc: { paths: ['M4 16l6-12', 'M10 4l6 12', 'M4 8l12 0'], label: 'increase' },
  dec: { paths: ['M4 4l8 14', 'M20 4l-8 14', 'M8 20h8'], label: 'decrease' },
  bobble: { paths: [], fills: ['M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0 -16'], label: 'bobble' },
  puff: {
    paths: [],
    fills: ['M12 5a7 7 0 0 1 0 14a7 7 0 0 1 0 -14'],
    dots: [
      { cx: 9, cy: 10, r: 1.4 },
      { cx: 15, cy: 10, r: 1.4 },
      { cx: 12, cy: 15, r: 1.4 },
    ],
    label: 'puff stitch',
  },
  shell: {
    paths: ['M6 6v14', 'M6 6c4 7 8 7 12 0', 'M12 6v14', 'M18 6v14'],
    label: 'shell',
  },
  cluster: {
    paths: ['M6 6v10', 'M12 6v10', 'M18 6v10', 'M4 18c4 4 12 4 16 0'],
    label: 'cluster',
  },
  'ch-sp': { paths: ['M5 12a7 4 0 1 0 14 0a7 4 0 1 0 -14 0'], label: 'chain space', quiet: true },
  turn: { paths: ['M4 16h10a5 5 0 0 0 0-10H9', 'M11 3l-3 3 3 3'], label: 'turn', quiet: true },
  join: { paths: ['M6 12a6 6 0 1 0 6 6', 'M12 6a6 6 0 0 1 6 6'], label: 'join', quiet: true },
  unknown: UNKNOWN,
};

export function symbolFor(code: string): SymbolShape {
  return SYMBOLS[code] ?? UNKNOWN;
}

/** Every symbol that can appear, for a legend. Excludes the error glyph. */
export function symbolLegend(): Array<{ code: string; label: string; quiet: boolean }> {
  return Object.entries(SYMBOLS)
    .filter(([code]) => code !== 'unknown')
    .map(([code, shape]) => ({ code, label: shape.label, quiet: shape.quiet === true }));
}

export interface ChartCell {
  token: StitchToken;
  column: number;
}

export interface ChartRow {
  index: number;
  label: string;
  cells: ChartCell[];
  /** Fragments of this row the tokenizer could not place. */
  unparsed: string[];
  /** True when this row was cut short; the chart is not a complete view. */
  truncated: boolean;
}

export interface Chart {
  rows: ChartRow[];
  /** Widest row, so every row can be padded to a common width. */
  width: number;
  /** Steps that produced no cells at all (notes, prose finishing). */
  skipped: string[];
  /** True when any row was truncated. */
  truncated: boolean;
}

export interface ChartOptions {
  /** Stop after this many rows. Defaults to 80, enough for any real chart. */
  maxRows?: number;
}

export const DEFAULT_MAX_ROWS = 80;

/**
 * Build the chart. Rows are ordered as written; note steps are skipped because
 * they have no stitches to place, but they are reported in `skipped` so a caller
 * can say "3 notes were not charted" instead of quietly dropping them.
 */
export function buildChart(pattern: ParsedPattern, options: ChartOptions = {}): Chart {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const rows: ChartRow[] = [];
  const skipped: string[] = [];
  let width = 0;
  let truncated = false;

  for (const step of pattern.steps) {
    if (rows.length >= maxRows) break;
    const row = chartRow(step);
    if (!row) {
      skipped.push(step.label);
      continue;
    }
    if (row.cells.length === 0) {
      skipped.push(step.label);
      continue;
    }
    if (row.truncated) truncated = true;
    width = Math.max(width, row.cells.length);
    rows.push(row);
  }

  return { rows, width, skipped, truncated };
}

function chartRow(step: PatternStep): ChartRow | null {
  if (step.kind === 'note') return null;
  const { tokens, unparsed, truncated } = tokenizeInstruction(step.instruction);
  if (!tokens.length) return null;
  return {
    index: step.index,
    label: step.label,
    cells: tokens.map((token, column) => ({ token, column })),
    unparsed,
    truncated,
  };
}

/**
 * Where a repeated group starts a new repetition. The renderer draws a hairline
 * at these columns so a reader can see the repeat without counting, which is the
 * whole reason someone reaches for a chart.
 */
export function repeatBoundaries(row: ChartRow): number[] {
  const boundaries: number[] = [];
  let previous = 0;
  for (const cell of row.cells) {
    if (cell.token.repeatIndex !== previous) {
      if (cell.column > 0) boundaries.push(cell.column);
      previous = cell.token.repeatIndex;
    }
  }
  return boundaries;
}

/**
 * The chart's claim: the stitches the drawn symbols *make* equal the count the
 * maths engine computed for that row.
 *
 * Not the number of cells. An increase is one cell that makes two stitches, so
 * counting cells would report a disagreement on every increase round. Foundation
 * rows are the exception: there the chains are the count, so both readings are
 * tried before declaring a mismatch.
 */
export function chartAgreesWith(row: ChartRow, computedCount: number | undefined): boolean | null {
  if (computedCount === undefined) return null;
  /*
   * A row with distributive wording ("sc in each st across") draws one symbol
   * standing for an unknown number of stitches. The drawing cannot agree or
   * disagree with a count it does not represent, so it reports unknown rather
   * than raising a false alarm on every such row.
   */
  if (row.unparsed.length > 0) return null;
  const tokens = row.cells.map((cell) => cell.token);
  return madeBy(tokens) === computedCount || madeBy(tokens, { includeChains: true }) === computedCount;
}

/** Stitches the drawn symbols make, for display next to the computed count. */
export function chartMade(row: ChartRow): number {
  return madeBy(row.cells.map((cell) => cell.token));
}
