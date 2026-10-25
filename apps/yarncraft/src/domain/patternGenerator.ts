/**
 * Pattern generator: shapes and canvas designs -> written instructions.
 *
 * Everything emitted here is written in the canonical form that
 * patternChecker can re-read, so a generated pattern is always verifiable.
 */

import type { CanvasDesign, CanvasSymbol, PatternShapeSpec, ParsedPattern } from '../shared/types.ts';
import { parsePattern } from './patternParser.ts';
import { stitchByCode } from './stitches.ts';

interface Row {
  label: string;
  kind: 'row' | 'round';
  instruction: string;
  count: number;
}

function row(label: string, instruction: string, count: number, kind: 'row' | 'round' = 'row'): Row {
  return { label, kind, instruction, count };
}

function repeatGroup(parts: string[], times: number): string {
  return `(${parts.join(', ')}) x ${times}`;
}

/* --------------------------------------------------------------- shapes */

function flatCircle(spec: PatternShapeSpec): Row[] {
  const stitch = spec.stitch || 'dc';
  const perRound = spec.increasePerRound ?? 6;
  const start = spec.start ?? perRound;
  const rows: Row[] = [];
  rows.push(row('Round 1', `${start} ${stitch} in magic ring (${start})`, start, 'round'));
  let count = start;
  for (let r = 2; r <= spec.rows; r += 1) {
    const plain = r - 2;
    const group = [...Array.from({ length: plain }, () => stitch), 'inc'];
    count += perRound;
    rows.push(row(`Round ${r}`, `${repeatGroup(group, perRound)} (${count})`, count, 'round'));
  }
  return rows;
}

function amigurumiSphere(spec: PatternShapeSpec): Row[] {
  const stitch = spec.stitch || 'sc';
  const start = spec.start ?? 6;
  const maxRounds = Math.max(4, spec.rows);
  const increaseRounds = Math.max(2, Math.floor(maxRounds / 3));
  const straightRounds = Math.max(1, Math.floor(maxRounds / 3));
  const rows: Row[] = [];
  let count = start;

  rows.push(row('Round 1', `${start} ${stitch} in magic ring (${start})`, count, 'round'));

  for (let r = 2; r <= increaseRounds + 1; r += 1) {
    const plain = r - 2;
    // Wrap long groups in a nested repeat so lines stay readable.
    const group = [...Array.from({ length: plain }, () => stitch), 'inc'];
    count += start;
    rows.push(row(`Round ${r}`, `${repeatGroup(group, start)} (${count})`, count, 'round'));
  }

  const peak = count;
  for (let i = 0; i < straightRounds; i += 1) {
    const number = increaseRounds + 2 + i;
    rows.push(row(`Round ${number}`, `${stitch} in each st around (${peak})`, peak, 'round'));
  }

  // Decrease back down by the same amount, mirroring the increases.
  let round = increaseRounds + 2 + straightRounds;
  for (let plain = increaseRounds - 1; plain >= 0; plain -= 1) {
    const group = [...Array.from({ length: plain }, () => stitch), 'dec'];
    count -= start;
    if (count <= start) break;
    rows.push(row(`Round ${round}`, `${repeatGroup(group, start)} (${count})`, count, 'round'));
    round += 1;
  }
  rows.push(row(`Round ${round}`, `dec x ${Math.max(1, Math.floor(start / 2))} (${Math.max(1, Math.ceil(start / 2))})`, Math.max(1, Math.ceil(start / 2)), 'round'));
  return rows;
}

function grannySquare(spec: PatternShapeSpec): Row[] {
  const rounds = Math.max(2, spec.rows);
  const rows: Row[] = [];
  // Round 1: four groups of three double crochet worked into the ring.
  rows.push(row('Round 1', 'ch 4 and join with slst to form a ring', 4, 'round'));
  rows.push(
    row('Round 2', '3 dc in ring, ch 2, (3 dc in ring, ch 2) x 3 (12)', 12, 'round'),
  );
  // Every further round adds one group of three double crochet per side.
  for (let r = 3; r <= rounds; r += 1) {
    const groups = 4 * (r - 1);
    const stitches = groups * 3;
    const instruction =
      groups === 1
        ? '3 dc in next ch-2 sp, ch 2 (3)'
        : `3 dc in next ch-2 sp, ch 2, (3 dc in next ch-2 sp, ch 2) x ${groups - 1} (${stitches})`;
    rows.push(row(`Round ${r}`, instruction, stitches, 'round'));
  }
  return rows;
}

function flatPanel(spec: PatternShapeSpec): Row[] {
  const stitch = spec.stitch || 'sc';
  const height = stitchByCode(stitch)?.height ?? 1;
  const width = spec.width ?? 30;
  const chain = width + height;
  const rows: Row[] = [];
  rows.push(
    row(
      'Row 1',
      `ch ${chain}, ${stitch} in ${height + 1}${ordinalSuffix(height + 1)} ch from hook and in each ch across (${width})`,
      width,
    ),
  );
  const turning = Math.max(1, height);
  for (let r = 2; r <= spec.rows; r += 1) {
    rows.push(row(`Row ${r}`, `ch ${turning}, turn, ${stitch} in each st across (${width})`, width));
  }
  return rows;
}

function hatInTheRound(spec: PatternShapeSpec): Row[] {
  const crown = Math.max(3, Math.floor(spec.rows / 2));
  const rows = flatCircle({ ...spec, stitch: spec.stitch || 'dc', rows: crown, increasePerRound: 12, start: 12 });
  const crownCount = rows.at(-1)?.count ?? 12;
  for (let r = crown + 1; r <= spec.rows; r += 1) {
    rows.push(row(`Round ${r}`, `dc in each st around (${crownCount})`, crownCount, 'round'));
  }
  return rows;
}

function chevron(spec: PatternShapeSpec): Row[] {
  const stitch = spec.stitch || 'dc';
  const repeats = spec.start ?? 5;
  // A chevron repeat is width-neutral: 3 stitch, decrease, 3 stitch, increase.
  const perRepeat = 9;
  const total = repeats * perRepeat;
  const turning = Math.max(1, stitchByCode(stitch)?.turningChains ?? 3);
  const group = `3 ${stitch}, dec, 3 ${stitch}, inc`;

  const rows: Row[] = [
    row(
      'Row 1',
      `ch ${total + turning}, ${stitch} in ${turning + 1}${ordinalSuffix(turning + 1)} ch from hook and in each ch across (${total})`,
      total,
    ),
  ];
  for (let r = 2; r <= spec.rows; r += 1) {
    rows.push(row(`Row ${r}`, `ch ${turning}, turn, (${group}) x ${repeats} (${total})`, total));
  }
  return rows;
}

function basket(spec: PatternShapeSpec): Row[] {
  const base = flatCircle({ ...spec, stitch: 'sc', rows: 4, start: 6, increasePerRound: 6 });
  const baseCount = base.at(-1)?.count ?? 24;
  const rows = [...base];
  for (let r = 5; r <= spec.rows; r += 1) {
    rows.push(row(`Round ${r}`, `sc in blo of each st around (${baseCount})`, baseCount, 'round'));
  }
  return rows;
}

function coasterSet(spec: PatternShapeSpec): Row[] {
  const one = flatCircle({ ...spec, stitch: 'sc', rows: 5, start: 6, increasePerRound: 6 });
  const totalStitches = one.reduce((sum, r) => sum + r.count, 0);
  const rows = [
    row('Round 1', '6 sc in magic ring (6)', 6, 'round'),
    ...one.slice(1),
    row('Round 6', 'slst in each st around (30)', 30, 'round'),
    row('Note', `Repeat rounds 1-6 four times to make a set of 4 coasters (${totalStitches * 4} stitches total)`, 0, 'round'),
  ];
  return rows;
}

function tote(spec: PatternShapeSpec): Row[] {
  const width = spec.width ?? 32;
  const body = flatPanel({ ...spec, stitch: 'sc', width, rows: Math.max(6, spec.rows) });
  const rows = [...body];
  const bodyRows = Math.max(6, spec.rows);
  rows.push(row('Finishing', 'Fold the panel in half, right sides together, and slst the side seams', 0));
  rows.push(row('Handle 1', 'ch 40, sc in 2nd ch from hook and in each ch across (39)', 39));
  rows.push(row('Handle 2', 'ch 40, sc in 2nd ch from hook and in each ch across (39)', 39));
  rows.push(row('Finishing', `Attach one handle 6 sts in from each side of the opening on row ${bodyRows}`, 0));
  return rows;
}

function earWarmer(spec: PatternShapeSpec): Row[] {
  const width = spec.width ?? 10;
  const stitch = spec.stitch || 'hdc';
  const height = stitchByCode(stitch)?.height ?? 2;
  const rows: Row[] = [
    row('Row 1', `ch ${width + height}, ${stitch} in ${height + 1}${ordinalSuffix(height + 1)} ch from hook and in each ch across (${width})`, width),
  ];
  for (let r = 2; r <= spec.rows; r += 1) {
    rows.push(row(`Row ${r}`, `ch ${height}, turn, ${stitch} blo in each st across (${width})`, width));
  }
  rows.push(row('Finishing', 'Sew the short ends together to form the band', 0));
  return rows;
}

function bookmark(spec: PatternShapeSpec): Row[] {
  const width = spec.width ?? 6;
  const rows: Row[] = [row('Row 1', `ch ${width + 1}, sc in 2nd ch from hook and in each ch across (${width})`, width)];
  for (let r = 2; r <= spec.rows; r += 1) {
    rows.push(row(`Row ${r}`, `ch 1, turn, ${r % 3 === 0 ? 'dc' : 'sc'} in each st across (${width})`, width));
  }
  rows.push(row('Finishing', 'Add a ch 12 loop at the top and weave in the ends', 0));
  return rows;
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

const SHAPE_BUILDERS: Record<PatternShapeSpec['kind'], (spec: PatternShapeSpec) => Row[]> = {
  'flat-circle': flatCircle,
  'granny-square': grannySquare,
  'amigurumi-sphere': amigurumiSphere,
  'flat-panel': flatPanel,
  'hat-in-the-round': hatInTheRound,
  chevron,
  basket,
  'coaster-set': coasterSet,
  tote,
  'ear-warmer': earWarmer,
  bookmark,
};

export interface GeneratedPatternText {
  title: string;
  text: string;
  rows: Row[];
}

/** Builds written instructions for a shape, then re-parses them for verification. */
export function generateFromShape(
  spec: PatternShapeSpec,
  meta: { title: string; craft?: 'crochet' | 'knitting'; supplies?: string[] },
): GeneratedPatternText {
  const builder = SHAPE_BUILDERS[spec.kind] ?? flatPanel;
  const rows = builder(spec);
  const lines: string[] = [meta.title, ''];
  if (meta.supplies?.length) {
    for (const supply of meta.supplies) lines.push(supply);
    lines.push('');
  }
  lines.push('ABBREVIATIONS');
  const used = new Set(rows.flatMap((r) => r.instruction.match(/[a-z]{2,6}/gi) ?? []));
  for (const code of ['sc', 'hdc', 'dc', 'dec', 'inc', 'ch', 'slst', 'blo']) {
    if (used.has(code) || used.has(code.toUpperCase())) {
      const stitch = stitchByCode(code);
      lines.push(`${code} = ${stitch?.name ?? code}`);
    }
  }
  lines.push('');
  for (const r of rows) {
    if (r.kind === 'round') lines.push(`${r.label}: ${r.instruction}`);
    else lines.push(`${r.label}: ${r.instruction}`);
  }
  return { title: meta.title, text: lines.join('\n'), rows };
}

/* --------------------------------------------------------------- canvas */

const SYMBOL_CODE: Record<CanvasSymbol, string> = {
  blank: '',
  sc: 'sc',
  hdc: 'hdc',
  dc: 'dc',
  tr: 'tr',
  ch: 'ch',
  slst: 'slst',
  inc: 'inc',
  dec: 'dec',
  bobble: 'bobble',
  shell: 'shell',
  puff: 'puff',
};

/** Stitches a canvas symbol contributes to the row count. */
function symbolMade(symbol: CanvasSymbol): number {
  switch (symbol) {
    case 'blank':
      return 0;
    case 'inc':
      return 2;
    case 'shell':
      return 3;
    default:
      return 1;
  }
}

function symbolConsumed(symbol: CanvasSymbol): number {
  if (symbol === 'blank') return 0;
  if (symbol === 'dec') return 2;
  return 1;
}

function describeSymbol(symbol: CanvasSymbol): string {
  const code = SYMBOL_CODE[symbol];
  if (symbol === 'inc') return 'inc';
  if (symbol === 'dec') return 'dec';
  const stitch = stitchByCode(code);
  return stitch ? stitch.name : code;
}

/** Turns a canvas grid into row-by-row written instructions. */
export function generateFromCanvas(design: CanvasDesign): GeneratedPatternText {
  const rows: Row[] = [];
  const { width, height, cells } = design;

  for (let y = 0; y < height; y += 1) {
    const rowCells = cells.slice(y * width, y * width + width);
    if (rowCells.every((c) => c === 'blank')) continue;

    // Run-length groups keep the instructions readable.
    const groups: Array<{ symbol: CanvasSymbol; count: number }> = [];
    for (const cell of rowCells) {
      if (cell === 'blank') continue;
      const last = groups.at(-1);
      if (last && last.symbol === cell) last.count += 1;
      else groups.push({ symbol: cell, count: 1 });
    }

    const parts = groups.map((g) => {
      const code = SYMBOL_CODE[g.symbol];
      if (g.symbol === 'shell') return g.count > 1 ? `shell x ${g.count}` : 'shell';
      if (g.symbol === 'inc' || g.symbol === 'dec') return g.count > 1 ? `${g.symbol} x ${g.count}` : g.symbol;
      return g.count > 1 ? `${g.count} ${code}` : code;
    });

    // Chains never add to a row's stitch count, exactly as in written patterns.
    const chainCells = rowCells.filter((cell) => cell === 'ch').length;
    const stitched = rowCells.reduce(
      (sum, cell) => sum + (cell === 'ch' ? 0 : symbolMade(cell)),
      0,
    );
    const made = stitched > 0 ? stitched : chainCells;
    const consumed = rowCells.reduce((sum, cell) => sum + symbolConsumed(cell), 0);
    const turning = stitchByCode(SYMBOL_CODE[rowCells.find((c) => c !== 'blank') ?? 'sc'])?.turningChains ?? 1;
    const prefix = y === 0 ? `ch ${consumed + turning}` : `ch ${Math.max(1, turning)}, turn`;

    rows.push({
      label: `Row ${y + 1}`,
      kind: 'row',
      instruction: `${prefix}, ${parts.join(', ')} (${made})`,
      count: made,
    });
  }

  // Deliberately no "Grid:" or "Base stitch:" prose: header lines that mention a
  // stitch name are indistinguishable from instructions once parsed back.
  const lines: string[] = [
    design.name || 'Canvas design',
    '',
    'ABBREVIATIONS',
    'sc = single crochet',
    'hdc = half double crochet',
    'dc = double crochet',
    'tr = treble crochet',
    'ch = chain',
    'slst = slip stitch',
    'inc = increase',
    'dec = decrease',
    '',
    ...rows.map((r) => `${r.label}: ${r.instruction}`),
  ];

  return { title: design.name || 'Canvas design', text: lines.join('\n'), rows };
}

/** Generates and verifies in one step; the pattern is checked like any import. */
export function generateVerifiedFromCanvas(design: CanvasDesign): {
  generated: GeneratedPatternText;
  parsed: ParsedPattern;
} {
  const generated = generateFromCanvas(design);
  return { generated, parsed: parsePattern(generated.text, { title: generated.title }) };
}

export function generateVerifiedFromShape(
  spec: PatternShapeSpec,
  meta: { title: string; supplies?: string[] },
): { generated: GeneratedPatternText; parsed: ParsedPattern } {
  const generated = generateFromShape(spec, meta);
  return { generated, parsed: parsePattern(generated.text, { title: generated.title }) };
}

/* ----------------------------------------------------------- yarn maths */

export interface YarnEstimate {
  /** Total stitches across the pattern. */
  stitches: number;
  /** Estimated yarn length in metres and yards. */
  metres: number;
  yards: number;
  /** Suggested skeins for a 200 m / 218 yd skein. */
  skeins: number;
  note: string;
}

const YARN_PER_STITCH_METRES: Record<string, number> = {
  slst: 0.005,
  ch: 0.01,
  sc: 0.04,
  hdc: 0.055,
  dc: 0.075,
  tr: 0.1,
  bobble: 0.16,
  puff: 0.12,
  shell: 0.2,
  default: 0.05,
};

/**
 * Rough yarn estimate. Crochet consumes roughly three times the stitch width in
 * yarn, so the result is a single figure with an explicit caveat rather than
 * false precision.
 */
export function estimateYarn(
  steps: Array<{ instruction: string }>,
  options: { stitches?: number } = {},
): YarnEstimate {
  const defaultPerStitch = YARN_PER_STITCH_METRES.default ?? 0.05;
  let weightSum = 0;
  let sampleCount = 0;

  for (const step of steps) {
    const codes = step.instruction.toLowerCase().match(/\b(sc|hdc|dc|tr|slst|ch|bobble|puff|shell)\b/g) ?? [];
    for (const code of codes) {
      weightSum += YARN_PER_STITCH_METRES[code] ?? defaultPerStitch;
      sampleCount += 1;
    }
  }

  // Average yarn per stitch for the mix of stitches this pattern uses.
  const perStitch = sampleCount > 0 ? weightSum / sampleCount : defaultPerStitch;
  const stitches =
    options.stitches !== undefined && options.stitches > 0
      ? options.stitches
      : Math.max(1, Math.round(weightSum / defaultPerStitch));

  return finishEstimate(stitches, stitches * perStitch);
}

function finishEstimate(stitches: number, metres: number): YarnEstimate {
  const safeMetres = Math.max(1, Math.round(metres));
  return {
    stitches,
    metres: safeMetres,
    yards: Math.round(safeMetres * 1.0936),
    skeins: Math.max(1, Math.ceil(safeMetres / 200)),
    note: 'Estimate assumes worsted-weight yarn and standard tension. Buy one extra skein for dye-lot safety.',
  };
}
