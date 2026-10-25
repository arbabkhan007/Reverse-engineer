/**
 * Stitch dictionary.
 *
 * One owner for stitch identity: abbreviation, canonical name, UK equivalent,
 * relative height (used by the maths engine to know how many turning chains a
 * stitch needs) and the shape renderer uses. Consumers must not re-derive
 * these facts from raw pattern text.
 */

export interface StitchDefinition {
  /** Canonical lowercase abbreviation used in written patterns (US terms). */
  code: string;
  name: string;
  /** Alternate spellings found in the wild, including UK terminology. */
  aliases: string[];
  /** 0 for slip stitch, 1 for sc, 2 for hdc... measured in single-crochet units. */
  height: number;
  /** Turning chains this stitch needs at the start of a new row/round. */
  turningChains: number;
  /** Stitches the working loop produces in the fabric (slip stitch is not counted). */
  counted: boolean;
  craft: 'crochet' | 'knitting' | 'both';
  description: string;
  /** How the stitch looks in the fabric - used by the photo analyser explanations. */
  texture: string;
}

export const STITCHES: StitchDefinition[] = [
  {
    code: 'ch',
    name: 'chain',
    aliases: ['ch', 'chs', 'chain', 'chains'],
    height: 1,
    turningChains: 0,
    counted: true,
    craft: 'crochet',
    description: 'Yarn over and pull through the loop on the hook. The foundation of almost everything.',
    texture: 'even vertical loops; a braided cord edge',
  },
  {
    code: 'slst',
    name: 'slip stitch',
    aliases: ['sl st', 'slst', 'sl sts', 'ss', 'slip stitch', 'slip st'],
    height: 0,
    turningChains: 0,
    counted: false,
    craft: 'crochet',
    description: 'Insert hook, yarn over, pull through both the stitch and the loop on the hook. Used to join and to travel without height.',
    texture: 'flat, nearly invisible; a slightly raised seam line',
  },
  {
    code: 'sc',
    name: 'single crochet',
    aliases: ['sc', 'scs', 'single crochet', 'single crochet stitch', 'dc (UK)'],
    height: 1,
    turningChains: 1,
    counted: true,
    craft: 'crochet',
    description: 'Insert hook, yarn over, pull up a loop, yarn over, pull through both loops. The densest basic stitch.',
    texture: 'tight V-shaped chevrons stacked in a dense, even grid',
  },
  {
    code: 'hdc',
    name: 'half double crochet',
    aliases: ['hdc', 'hdcs', 'half double crochet', 'htr (UK)'],
    height: 2,
    turningChains: 2,
    counted: true,
    craft: 'crochet',
    description: 'Yarn over, insert hook, pull up a loop, yarn over, pull through all three loops. Softer and drapier than sc.',
    texture: 'short vertical posts with a slight diagonal lean and soft horizontal ridges',
  },
  {
    code: 'dc',
    name: 'double crochet',
    aliases: ['dc', 'dcs', 'double crochet', 'tr (UK)'],
    height: 3,
    turningChains: 3,
    counted: true,
    craft: 'crochet',
    description: 'Yarn over, insert hook, pull up a loop, yarn over, pull through two loops twice. Tall, quick and drapey.',
    texture: 'tall slim vertical posts with clear gaps and a woven grid of horizontal bars',
  },
  {
    code: 'tr',
    name: 'treble crochet',
    aliases: ['tr', 'trs', 'treble', 'treble crochet', 'dtr (UK)'],
    height: 4,
    turningChains: 4,
    counted: true,
    craft: 'crochet',
    description: 'Two yarn-overs before inserting the hook. Very tall, lacy and open.',
    texture: 'long thin posts with pronounced gaps; an open, airy fabric',
  },
  {
    code: 'dtr',
    name: 'double treble crochet',
    aliases: ['dtr', 'dtrs', 'double treble'],
    height: 5,
    turningChains: 5,
    counted: true,
    craft: 'crochet',
    description: 'Three yarn-overs before inserting the hook. Used in lace and pineapple motifs.',
    texture: 'extremely tall open posts, almost net-like',
  },
  {
    code: 'fsc',
    name: 'foundation single crochet',
    aliases: ['fsc', 'foundation sc'],
    height: 1,
    turningChains: 0,
    counted: true,
    craft: 'crochet',
    description: 'A single crochet worked onto a chain and its own base at the same time, giving a stretchy first row.',
    texture: 'a neat ridged edge with the same density as an sc row',
  },
  {
    code: 'bobble',
    name: 'bobble',
    aliases: ['bobble', 'bo', 'bob'],
    height: 1,
    turningChains: 1,
    counted: true,
    craft: 'crochet',
    description: 'Several partial double crochets worked into one stitch and closed together, forming a raised ball.',
    texture: 'bumpy raised balls in a regular grid on a flat background',
  },
  {
    code: 'puff',
    name: 'puff stitch',
    aliases: ['puff', 'puff stitch'],
    height: 1,
    turningChains: 1,
    counted: true,
    craft: 'crochet',
    description: 'Several half-double-crochet loops pulled up and closed together in one stitch.',
    texture: 'soft rounded pods, less crisp than a bobble',
  },
  {
    code: 'shell',
    name: 'shell',
    aliases: ['shell', 'shell stitch'],
    height: 3,
    turningChains: 3,
    counted: true,
    craft: 'crochet',
    description: 'Multiple double crochets worked into one stitch or space, fanning out like a shell.',
    texture: 'overlapping fan shapes with strong diagonal scallops',
  },
  {
    code: 'cluster',
    name: 'cluster',
    aliases: ['cluster', 'cl', 'clusters'],
    height: 2,
    turningChains: 2,
    counted: true,
    craft: 'crochet',
    description: 'Two or more partially finished stitches joined at the top.',
    texture: 'tight pinched groups with visible pinches at the top',
  },
  {
    code: 'k',
    name: 'knit stitch',
    aliases: ['k', 'knit'],
    height: 1,
    turningChains: 0,
    counted: true,
    craft: 'knitting',
    description: 'The basic knitting stitch: the yarn is pulled through a loop from front to back.',
    texture: 'vertical braided columns of interlocking V shapes',
  },
  {
    code: 'p',
    name: 'purl stitch',
    aliases: ['p', 'purl'],
    height: 1,
    turningChains: 0,
    counted: true,
    craft: 'knitting',
    description: 'The reverse of a knit stitch; the yarn is pulled through from back to front.',
    texture: 'horizontal wavy bumps stacked in rows',
  },
  {
    code: 'yo',
    name: 'yarn over',
    aliases: ['yo', 'yarn over'],
    height: 0,
    turningChains: 0,
    counted: false,
    craft: 'both',
    description: 'Wrap the yarn over the hook or needle to create a new loop.',
    texture: 'not visible in finished fabric',
  },
];

const BY_ALIAS = new Map<string, StitchDefinition>();
for (const stitch of STITCHES) {
  BY_ALIAS.set(stitch.code, stitch);
  for (const alias of stitch.aliases) BY_ALIAS.set(alias, stitch);
}

/** Every alias, longest first, for token matching in raw pattern text. */
export const STITCH_ALIASES_BY_LENGTH: string[] = [...BY_ALIAS.keys()].sort(
  (a, b) => b.length - a.length,
);

export function findStitch(token: string): StitchDefinition | undefined {
  return BY_ALIAS.get(token.trim().toLowerCase());
}

export function stitchByCode(code: string): StitchDefinition | undefined {
  return BY_ALIAS.get(code.trim().toLowerCase());
}

/** Stitches offered in the pattern canvas palette, in a sensible order. */
export const CANVAS_STITCHES = ['sc', 'hdc', 'dc', 'tr', 'ch', 'slst', 'inc', 'dec', 'bobble', 'puff', 'shell'];

/** Turning chains a row of the given stitch needs. */
export function turningChainsFor(code: string): number {
  return stitchByCode(code)?.turningChains ?? 1;
}

export interface AbbreviationEntry {
  abbreviation: string;
  meaning: string;
}

/** Abbreviations that are not stitches but show up in pattern instructions. */
export const PATTERN_ABBREVIATIONS: AbbreviationEntry[] = [
  { abbreviation: 'st', meaning: 'stitch' },
  { abbreviation: 'sts', meaning: 'stitches' },
  { abbreviation: 'sp', meaning: 'space' },
  { abbreviation: 'sps', meaning: 'spaces' },
  { abbreviation: 'sk', meaning: 'skip' },
  { abbreviation: 'tog', meaning: 'together' },
  { abbreviation: 'prev', meaning: 'previous' },
  { abbreviation: 'beg', meaning: 'beginning' },
  { abbreviation: 'rep', meaning: 'repeat' },
  { abbreviation: 'rnd', meaning: 'round' },
  { abbreviation: 'rnds', meaning: 'rounds' },
  { abbreviation: 'flo', meaning: 'front loop only' },
  { abbreviation: 'blo', meaning: 'back loop only' },
  { abbreviation: 'fpsc', meaning: 'front post single crochet' },
  { abbreviation: 'bpsc', meaning: 'back post single crochet' },
  { abbreviation: 'fpdc', meaning: 'front post double crochet' },
  { abbreviation: 'bpdc', meaning: 'back post double crochet' },
  { abbreviation: 'ch-sp', meaning: 'chain space' },
  { abbreviation: 'ea', meaning: 'each' },
  { abbreviation: 'frm', meaning: 'from' },
  { abbreviation: 'FO', meaning: 'fasten off' },
  { abbreviation: 'inc', meaning: 'increase (2 stitches in one)' },
  { abbreviation: 'dec', meaning: 'decrease (2 stitches together)' },
  { abbreviation: 'invdec', meaning: 'invisible decrease' },
  { abbreviation: 'mr', meaning: 'magic ring' },
  { abbreviation: 'MC', meaning: 'main colour' },
  { abbreviation: 'CC', meaning: 'contrast colour' },
];

export const ALL_ABBREVIATIONS: AbbreviationEntry[] = [
  ...STITCHES.filter((s) => s.craft !== 'knitting').map((s) => ({
    abbreviation: s.code,
    meaning: s.name,
  })),
  ...PATTERN_ABBREVIATIONS,
];

const KNOWN_ABBREVIATIONS = new Set(
  ALL_ABBREVIATIONS.map((a) => a.abbreviation.toLowerCase()),
);

export function isKnownAbbreviation(word: string): boolean {
  return KNOWN_ABBREVIATIONS.has(word.trim().toLowerCase());
}

/**
 * UK patterns use the same letters for different stitches. Detect the
 * terminology from explicit markers so counts come out right.
 */
export function detectTerminology(text: string): 'us' | 'uk' | 'unknown' {
  const lower = text.toLowerCase();
  if (/\(uk\)|uk terms|uk terminology|british terms/.test(lower)) return 'uk';
  if (/\(us\)|us terms|us terminology|american terms/.test(lower)) return 'us';
  return 'unknown';
}
