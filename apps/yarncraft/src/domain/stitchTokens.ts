/**
 * Ordered stitch tokens.
 *
 * The stitch-maths engine (`patternChecker.ts`) answers "how many stitches does
 * this row make". It deliberately aggregates, because that is all a count check
 * needs. Two newer consumers need the *order* as well:
 *
 *  - the yarn planner, to know how much yarn each stitch type consumes
 *  - the chart renderer, to draw the row symbol by symbol
 *
 * So this is a second, additive view over the same normalized text. It never
 * answers a count question; `evaluateInstruction` stays the owner of those.
 * Anything it cannot place becomes an `unknown` token with its raw text kept,
 * so a chart can show a gap and say why rather than silently closing up.
 */

import { normalizeInstruction, stripDeclaredCount } from './patternChecker.ts';
import { findStitch } from './stitches.ts';

export type TokenKind = 'stitch' | 'chain-space' | 'turn' | 'join' | 'unknown';

export interface StitchToken {
  kind: TokenKind;
  /** Resolved stitch code, when known. `inc`/`dec` are kept as their own codes. */
  code: string;
  /** Human label for the raw text, for error reporting in the UI. */
  text: string;
  /** True when this token came from inside a repeated group. */
  repeated: boolean;
  /** Which repetition of the group produced it (1-based). 0 when not repeated. */
  repeatIndex: number;
  /** Length of the chain space, for `ch-2 sp`. Undefined otherwise. */
  space?: number;
  /**
   * Stitches this token contributes to the row count.
   *
   * A cell is not a stitch: an increase is one cell that makes two stitches, and
   * a decrease is one cell made from two. Any consumer comparing a chart against
   * the maths engine has to sum this, not count cells.
   */
  made: number;
}

/**
 * Stitches made by one token, by code. Ordinary stitches are 1; increases are 2;
 * shells and clusters are groups of 3; everything else is 1.
 */
export const MADE_PER_TOKEN: Record<string, number> = {
  inc: 2,
  shell: 3,
  cluster: 3,
  dec: 1,
  'ch-sp': 0,
};

function madeFor(code: string): number {
  return MADE_PER_TOKEN[code] ?? 1;
}

export interface TokenSequence {
  tokens: StitchToken[];
  /** Raw text the tokenizer could not place, in reading order. */
  unparsed: string[];
  /**
   * True when expansion hit `MAX_TOKENS` and was cut short. Consumers must
   * refuse to chart or price a truncated sequence rather than present a partial
   * total as complete.
   */
  truncated: boolean;
}

/**
 * A row of "x 4000" would otherwise allocate without bound. 4000 tokens is far
 * beyond any real written row, so hitting the cap means the input is not a row
 * we understand, not that the pattern is large.
 */
export const MAX_TOKENS = 4000;

/** `ch-2 sp`, `2ch sp`, `ch 2 space` all mean a chain space as wide as 2 chains. */
const CHAIN_SPACE = /^(?:ch|chs)[\s-]*(\d)\s*(?:sp|spc|space)s?$|^(\d)[\s-]*ch\s*(?:sp|spc|space)s?$/;

const TURN = /^(?:turn(?:ing)?(?:\s+work)?|turn\b.*)$/;
const JOIN = /^(?:join|sl\s?st\s+to\s+join|join\s+with\s+sl\s?st)$/;

/** `sc2tog`, `2 sc tog`, `dc 3 tog` - a decrease over a named stitch. */
const DECREASE = /^(\d*)\s*([a-z]+)\s*(?:tog|together)$/;

/** A bare multiplier prefix followed by a stitch name: `2 sc`, `3dc`. */
const COUNTED = /^(\d+)\s*([a-z]+(?:\s+[a-z]+)?)$/;

/** A stitch name followed by a stitch count: `sc 2`, `dc3` means "make 3 dc". */
const SUFFIXED = /^([a-z]+(?:\s+[a-z]+)?)\s*(\d+)$/;

/** Abbreviations that are real stitches but are not in the catalogue table. */
const SYNTHETIC: Record<string, string> = {
  inc: 'inc',
  '2 sc in': 'inc',
  dec: 'dec',
  'sc2tog': 'dec',
  'sc 2tog': 'dec',
};

function resolve(word: string): string | null {
  const cleaned = word.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  const synthetic = SYNTHETIC[cleaned];
  if (synthetic !== undefined) return synthetic;
  const st = findStitch(cleaned);
  return st ? st.code : null;
}

function makeToken(code: string, text: string, repeatIndex: number): StitchToken {
  return { kind: 'stitch', code, text, repeated: repeatIndex > 0, repeatIndex, made: madeFor(code) };
}

/**
 * Split a normalized instruction into segments, each with the multiplier that
 * applies to it. Brackets and `x N` are the only grouping syntax we understand;
 * anything else is left in the text and reported.
 *
 * `[sc, ch 1] x 6`  ->  one segment, multiplier 6
 * `sc in next 2 sts` ->  one segment, multiplier 1
 */
interface Segment {
  body: string;
  times: number;
}

function splitSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  // Bracket groups first: [ ... ] x N  |  ( ... ) x N  |  { ... } x N
  const groupRe = /[[({]([^\]})]*)[)\]}]\s*(?:x\s*(\d+)|(\d+)\s*times?)?/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushPlain = (chunk: string) => {
    const parts = chunk.split(/\s*,\s*|\s+and\s+/i);
    for (const part of parts) {
      if (part.trim()) segments.push({ body: part.trim(), times: 1 });
    }
  };

  while ((match = groupRe.exec(text)) !== null) {
    pushPlain(text.slice(lastIndex, match.index));
    const times = Number(match[2] ?? match[3] ?? 1) || 1;
    segments.push({ body: match[1] ?? '', times });
    lastIndex = match.index + match[0].length;
  }
  pushPlain(text.slice(lastIndex));
  return segments;
}

/**
 * Turn one written instruction into ordered tokens.
 *
 * Repetition is expanded, because both consumers need the literal sequence: a
 * chart has to draw 24 cells, not "6 groups of 4". Groups nested more than one
 * level deep are not expanded; the inner text is reported instead.
 */
export function tokenizeInstruction(instruction: string): TokenSequence {
  const tokens: StitchToken[] = [];
  const unparsed: string[] = [];
  let truncated = false;

  const text = normalizeInstruction(stripDeclaredCount(instruction));
  if (!text) return { tokens, unparsed, truncated };

  const segments = splitSegments(text);

  for (const segment of segments) {
    const once: StitchToken[] = [];
    const body = segment.body.trim();
    if (!body) continue;

    const pieces = body.split(/\s*,\s*|\s+and\s+/i).filter((p) => p.trim());
    for (const piece of pieces.length ? pieces : [body]) {
      const raw = piece.trim();
      if (!raw) continue;

      const space = CHAIN_SPACE.exec(raw);
      if (space) {
        once.push({
          kind: 'chain-space',
          code: 'ch-sp',
          text: raw,
          repeated: false,
          repeatIndex: 0,
          space: Number(space[1] ?? space[2] ?? 1),
          made: 0,
        });
        continue;
      }

      if (TURN.test(raw)) {
        once.push({ kind: 'turn', code: 'turn', text: raw, repeated: false, repeatIndex: 0, made: 0 });
        continue;
      }
      if (JOIN.test(raw)) {
        once.push({ kind: 'join', code: 'join', text: raw, repeated: false, repeatIndex: 0, made: 0 });
        continue;
      }

      const dec = DECREASE.exec(raw);
      if (dec) {
        const base = resolve(dec[2] ?? '');
        if (base) {
          // A decrease token carries its base stitch so the chart can draw the
          // right symbol; the count is one stitch made from two.
          once.push({
            kind: 'stitch',
            code: 'dec',
            text: raw,
            repeated: false,
            repeatIndex: 0,
            made: 1,
          });
          continue;
        }
      }

      const counted = COUNTED.exec(raw);
      if (counted) {
        const code = resolve(counted[2] ?? '');
        if (code) {
          const n = Math.min(Number(counted[1] ?? 0), MAX_TOKENS);
          for (let i = 0; i < n; i += 1) {
            once.push(makeToken(code, raw, 0));
          }
          continue;
        }
      }

      const suffixed = SUFFIXED.exec(raw);
      if (suffixed) {
        const code = resolve(suffixed[1] ?? '');
        if (code) {
          const n = Math.min(Number(suffixed[2] ?? 0), MAX_TOKENS);
          for (let i = 0; i < n; i += 1) {
            once.push(makeToken(code, raw, 0));
          }
          continue;
        }
      }

      const single = resolve(raw);
      if (single) {
        once.push(makeToken(single, raw, 0));
        continue;
      }

      // Distributive wording such as "sc in each st across": the stitch is the
      // first word and the rest is placement, which a chart cannot draw without
      // knowing the previous row. Report the placement, keep the stitch.
      const lead = /^([a-z]+)\s+(.+)$/.exec(raw);
      const leadCode = lead ? resolve(lead[1] ?? '') : null;
      if (leadCode) {
        once.push(makeToken(leadCode, raw, 0));
        unparsed.push(lead ? (lead[2] ?? raw) : raw);
        continue;
      }

      once.push({ kind: 'unknown', code: 'unknown', text: raw, repeated: false, repeatIndex: 0, made: 0 });
      unparsed.push(raw);
    }

    const multi = segment.times > 1;
    const times = Math.max(1, segment.times);

    if (segment.times > MAX_TOKENS || tokens.length + once.length * times > MAX_TOKENS) {
      truncated = true;
      break;
    }

    for (let r = 1; r <= times; r += 1) {
      for (const token of once) {
        tokens.push({
          ...token,
          repeated: multi,
          repeatIndex: multi ? r : 0,
        });
      }
    }
  }

  return { tokens, unparsed, truncated };
}

/** Stitches made by a token sequence, the figure the maths engine reports. */
export function madeBy(tokens: StitchToken[], options: { includeChains?: boolean } = {}): number {
  const includeChains = options.includeChains ?? false;
  let total = 0;
  for (const token of tokens) {
    if (!includeChains && (token.code === 'ch' || token.code === 'ch-sp')) continue;
    total += token.made;
  }
  return total;
}

/** Token counts by resolved code, for the yarn planner. */
export function countByCode(tokens: StitchToken[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    if (token.kind !== 'stitch') continue;
    counts[token.code] = (counts[token.code] ?? 0) + 1;
  }
  return counts;
}
