/**
 * Stitch maths engine.
 *
 * Turns one written instruction into a stitch count. The engine is deliberately
 * conservative: anything it cannot interpret is reported as an unparsed
 * fragment rather than silently counted as zero. Consumers (checker, canvas
 * exporter, project tracker) must use this single owner for stitch maths.
 */

import { findStitch, stitchByCode, type StitchDefinition } from './stitches.ts';

export interface Fragment {
  /** Stitches made by this fragment. */
  made: number;
  /** Previous-row stitches this fragment consumes, when determinable. */
  consumed: number | null;
  /** How many of `made` are chains (not counted in a non-foundation row). */
  chains: number;
  /** Decreases, for over-decrease detection. */
  decreases: number;
  /** Text the engine could not interpret. */
  unparsed: string[];
  /** Multiplier applied to the whole fragment. */
  multiplier: number;
}

export interface Evaluation extends Fragment {
  /** Stitches the row is expected to contain, following crochet convention. */
  count: number;
  /** True when the instruction contains no counted non-chain stitch. */
  foundationOnly: boolean;
  /**
   * True when `count` depends on the previous row (distributive wording such as
   * "sc in each st across") rather than being stated in this step.
   */
  assumed: boolean;
  /** Repeat metadata when the row is built from a repeated group. */
  repeat?: { groupMade: number; times: number };
}

export interface EvaluationContext {
  /** Stitch count of the previous working row/round, when known. */
  previousCount?: number;
}

/**
 * Fresh empty fragment. Deliberately a factory: a shared literal would hand the
 * same `unparsed` array to every caller, and accumulating fragments would then
 * push an array into itself.
 */
function emptyFragment(): Fragment {
  return { made: 0, consumed: null, chains: 0, decreases: 0, unparsed: [], multiplier: 1 };
}

const NORMALIZE_MAP: Array<[RegExp, string]> = [
  [/[×✕✖]/g, 'x'],
  [/[–—]/g, '-'],
  [/[""'']/g, "'"],
  [/\bx\s*(?=\d)/g, 'x '],
  [/\s+/g, ' '],
];

export function normalizeInstruction(input: string): string {
  let out = input;
  for (const [pattern, replacement] of NORMALIZE_MAP) out = out.replace(pattern, replacement);
  return out.trim();
}

/** Splits on separators that sit outside any bracket/parenthesis group. */
function splitTopLevel(text: string, separators: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1);
    if (depth === 0 && separators.test(char)) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

const REPEAT_SUFFIX = [
  // "rep 6 times", "repeat 4 more times", "rep 6x", "x6", "6 times", "(x6)"
  /\b(?:rep(?:eat)?(?:\s+(?:from|the\s+instructions?\s+in))?\s*)?(?:x|into)?\s*(\d+)\s*(?:more\s+)?times?$/,
  /\b(?:rep(?:eat)?\s*)?x\s*(\d+)$/,
  /\bx\s*(\d+)$/,
  /\brep(?:eat)?\s+(\d+)$/,
];

interface RepeatInfo {
  text: string;
  times: number;
}

function extractRepeat(text: string): RepeatInfo {
  let working = text.trim().replace(/[.)\]]+$/, (m) => (m === ')' ? ')' : '')).trim();
  for (const pattern of REPEAT_SUFFIX) {
    const match = working.match(pattern);
    if (match?.[1]) {
      const times = Number.parseInt(match[1], 10);
      if (Number.isFinite(times) && times > 0 && times < 1000) {
        return { text: working.slice(0, match.index).trim(), times };
      }
    }
  }
  return { text: working, times: 1 };
}

/** Detects "* ... *" style repeats and returns the inner text. */
function unwrapStarRepeat(text: string): { inner: string; times: number } | null {
  if (!text.includes('*')) return null;
  const matches = [...text.matchAll(/\*/g)];
  if (matches.length >= 2) {
    const open = matches[0]!.index!;
    const close = matches[matches.length - 1]!.index!;
    if (close > open) {
      return { inner: text.slice(open + 1, close).trim(), times: 0 };
    }
  }
  return null;
}

function isStitchWord(word: string): StitchDefinition | undefined {
  return findStitch(word);
}

interface SimpleParse extends Fragment {
  /** True when the fragment contains a counted non-chain stitch. */
  counted: boolean;
}

/**
 * Parses a bracket-free fragment such as
 *   "2 sc in next st", "inc", "sc 3", "ch 2", "sc2tog", "3 dc in ch-1 sp"
 */
function parseSimple(textRaw: string): SimpleParse {
  const text = normalizeInstruction(textRaw);
  let made = 0;
  let consumed: number | null = null;
  let chains = 0;
  let decreases = 0;
  let counted = false;
  const unparsed: string[] = [];

  // Numbers attached to a stitch form "sc2tog" / "3sc" / "dc2tog"
  const compact = text
    .replace(/([a-z]{1,5})\s*(\d+)\s*(?:tog|together)\b/g, '$1 $2 tog')
    .replace(/(\d+)\s*([a-z]{1,5})\b/g, '$1 $2');

  if (/\btog\b|\btogether\b/.test(compact)) {
    const togMatch = compact.match(/(\w+)\s*(\d+)?\s*(?:tog|together)/);
    const stitch = togMatch ? isStitchWord(togMatch[1]!) : undefined;
    if (stitch) {
      // N partial stitches closed together produce exactly one stitch.
      made += 1;
      decreases += 1;
      counted = true;
      consumed = (consumed ?? 0) + 2;
    } else {
      unparsed.push(textRaw);
    }
    return { made, consumed, chains, decreases, unparsed, multiplier: 1, counted };
  }

  const tokens = compact.split(/[\s]+/).filter(Boolean);
  let pendingCount: number | null = null;
  /** Index in `tokens` of the last stitch word, for postfix counts ("ch 31"). */
  let lastStitchToken = -1;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;

    if (/^\d+$/.test(token)) {
      // A number directly after a stitch is a postfix multiplier: "ch 31", "dc 3".
      if (lastStitchToken >= 0 && lastStitchToken === i - 1 && pendingCount === null) {
        const extra = Number.parseInt(token, 10) - 1;
        if (extra > 0) {
          const previous = tokens[lastStitchToken]!.replace(/[^a-z]/gi, '').toLowerCase();
          const stitch = findStitch(previous);
          made += extra;
          if (stitch?.code === 'ch') chains += extra;
        }
      } else {
        pendingCount = Number.parseInt(token, 10);
      }
      continue;
    }

    const word = token.replace(/[^a-z]/gi, '').toLowerCase();

    if (word === 'inc' || word === 'increase' || word === 'increases') {
      made += 2;
      consumed = (consumed ?? 0) + 1;
      counted = true;
      pendingCount = null;
      continue;
    }

    if (word === 'dec' || word === 'decrease' || word === 'decreases' || word === 'invdec') {
      made += 1;
      decreases += 1;
      consumed = (consumed ?? 0) + 2;
      counted = true;
      pendingCount = null;
      continue;
    }

    if (word === 'sk' || word === 'skip' || word === 'miss') {
      pendingCount = null;
      continue;
    }

    const stitch = isStitchWord(word);
    if (stitch) {
      const times = pendingCount ?? 1;
      made += times;
      if (stitch.code === 'ch') chains += times;
      else if (stitch.counted) counted = true;
      pendingCount = null;
      lastStitchToken = i;
      continue;
    }

    // Words that are part of instructions but carry no stitch.
    if (
      /^(in|into|of|the|next|each|every|every|around|across|to|from|last|first|same|ch|sp|space|spaces|st|sts|stitch|stitches|row|rows|rnd|round|rounds|rep|repeat|times|turn|turning|work|working|yarn|over|hook|loop|loops|only|flo|blo|prev|previous|beginning|beg|corner|end|all|evenly|then|and|approx|approximately|about|total|with|in|2nd|3rd|4th|1st|ch1|ch2|ch3|chs|using|hook,|cast|on|sts\.)$/.test(
        word,
      )
    ) {
      continue;
    }

    // Numbers glued with ordinal suffixes ("2nd", "3rd") were stripped above.
    if (/^(st|nd|rd|th)$/.test(word)) {
      pendingCount = null;
      continue;
    }

    if (word.length > 0) unparsed.push(token);
  }

  return { made, consumed, chains, decreases, unparsed, multiplier: 1, counted };
}

/**
 * Finds the bracket group at the start of `text` by counting depth, so nested
 * and unbalanced text is handled deterministically instead of matching to the
 * last closing bracket in the string.
 */
function leadingBracketGroup(text: string): { inner: string; tail: string } | null {
  const open = text[0];
  if (open !== '(' && open !== '[') return null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') {
      depth -= 1;
      if (depth === 0) {
        return { inner: text.slice(1, index), tail: text.slice(index + 1) };
      }
    }
  }
  return null;
}

/** Recursively evaluates bracket groups like "(sc, inc) x 6" or "[2 dc, ch 1] 4 times". */
function parseGroup(text: string, depth = 0): Fragment & { counted: boolean } {
  if (depth > 8) {
    return { ...emptyFragment(), unparsed: [text], counted: false };
  }
  const normalized = normalizeInstruction(text);
  if (!normalized) return { ...emptyFragment(), counted: false };

  const star = unwrapStarRepeat(normalized);
  if (star) {
    const trailing = extractRepeat(normalized.slice(normalized.lastIndexOf('*') + 1));
    const times = Math.max(trailing.times, 1);
    const inner = parseGroup(star.inner, depth + 1);
    return multiply(inner, times);
  }

  // Bracket groups, possibly repeated.
  const bracket = leadingBracketGroup(normalized);
  if (bracket) {
    const inner = parseGroup(bracket.inner, depth + 1);
    const tail = bracket.tail.trim();
    const repeat = extractRepeat(tail);
    const times = repeat.text.length === 0 ? repeat.times : 1;
    return multiply(inner, times);
  }

  // Mixed content: split top level and sum.
  const parts = splitTopLevel(normalized, /[,;]/);
  const total: Fragment & { counted: boolean } = { ...emptyFragment(), counted: false };
  for (const part of parts) {
    const repeat = extractRepeat(part);
    const inner = parseSegment(repeat.text, depth + 1);
    const scaled = multiply(inner, repeat.times);
    total.made += scaled.made;
    total.chains += scaled.chains;
    total.decreases += scaled.decreases;
    for (const fragmentText of scaled.unparsed) {
      if (total.unparsed.length < 24) total.unparsed.push(fragmentText);
    }
    total.counted = total.counted || scaled.counted;
    if (scaled.consumed !== null) total.consumed = (total.consumed ?? 0) + scaled.consumed;
  }
  return total;
}

function parseSegment(text: string, depth: number): Fragment & { counted: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { ...emptyFragment(), counted: false };

  if (/[([][\s\S]*[)\]]/.test(trimmed)) {
    return parseGroup(trimmed, depth + 1);
  }

  const simple = parseSimple(trimmed);
  if (simple.made > 0 || simple.decreases > 0) return simple;

  // A segment with no stitches may still be a repeat of the previous group,
  // e.g. "rep from * to end" - the caller handles that case.
  return simple;
}

function multiply(fragment: Fragment & { counted: boolean }, times: number): Fragment & { counted: boolean } {
  return {
    made: fragment.made * times,
    consumed: fragment.consumed === null ? null : fragment.consumed * times,
    chains: fragment.chains * times,
    decreases: fragment.decreases * times,
    unparsed: [...fragment.unparsed],
    multiplier: fragment.multiplier * times,
    counted: fragment.counted,
  };
}

/**
 * Phrases that distribute one instruction across the whole previous row, so the
 * resulting count can only be known from the previous row or the foundation.
 */
const DISTRIBUTIVE = [
  /\beach\s+(?:st|sts|stitch|stitches)\b/i,
  /\bevery\s+(?:st|sts|stitch|stitches)\b/i,
  /\beach\s+(?:ch|chain)\b/i,
  /\b(?:all\s+)?the\s+way\s+around\b/i,
  /\baround\b/i,
  /\bacross\b/i,
  /\bto\s+the\s+end\b/i,
];

function isDistributive(instruction: string): boolean {
  return DISTRIBUTIVE.some((pattern) => pattern.test(instruction));
}

/** "ch 31" + "in the 2nd ch from hook" -> 30. */
function foundationCount(instruction: string): number | null {
  const chainTotal = instruction.match(/\bch(?:ain)?\s*(\d{1,4})\b/i);
  if (!chainTotal?.[1]) return null;
  const total = Number.parseInt(chainTotal[1], 10);
  const start = instruction.match(/\b(?:in|from)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*ch\b/i);
  const skip = start?.[1] ? Number.parseInt(start[1], 10) : 1;
  const count = total - Math.max(0, skip - 1);
  return count > 0 ? count : null;
}

/** Evaluates a full step instruction and derives the resulting stitch count. */
export function evaluateInstruction(
  instruction: string,
  context: EvaluationContext = {},
): Evaluation {
  const normalized = normalizeInstruction(instruction);
  const fragment = parseGroup(normalized, 0);

  const countedStitches = fragment.made - fragment.chains;
  const foundationOnly = countedStitches <= 0 && fragment.chains > 0;
  let count = foundationOnly ? fragment.chains : countedStitches;
  let assumed = false;

  const distributive = isDistributive(normalized);
  const chainDistributive = /each\s+(?:ch|chain)\b/i.test(normalized);
  const foundation = chainDistributive ? foundationCount(normalized) : null;

  if (distributive) {
    if (foundation !== null) {
      // "sc in each ch across" is measured from the chain just worked, not the
      // previous row.
      count = foundation;
      assumed = true;
    } else if (context.previousCount !== undefined && context.previousCount > 0) {
      // "sc in each st across" -> one stitch per previous stitch;
      // "2 sc in each st around" -> two per previous stitch.
      const perStitch = countedStitches > 1 ? countedStitches : 1;
      count = perStitch * context.previousCount;
      assumed = countedStitches !== context.previousCount;
    } else if (foundationOnly || countedStitches <= 1) {
      const foundation = foundationCount(normalized);
      if (foundation !== null) {
        count = foundation;
        assumed = true;
      }
    }
  }

  // Surface any repeat structure for the UI ("(sc, inc) x 6").
  const repeatMatch = normalized.match(/[([]([^)\]]*)[)\]]\s*(?:x|×|\*)?\s*(\d+)/);
  const repeat = repeatMatch?.[2]
    ? {
        groupMade: evaluateInstruction(repeatMatch[1]!).count,
        times: Number.parseInt(repeatMatch[2], 10),
      }
    : undefined;

  return {
    ...fragment,
    count: Math.max(0, count),
    foundationOnly,
    assumed,
    ...(repeat && Number.isFinite(repeat.times) && repeat.times > 1 ? { repeat } : {}),
  };
}

/** Parses a declared count from the trailing part of an instruction. */
export function extractDeclaredCount(instruction: string): number | undefined {
  const patterns = [
    /\(\s*(\d{1,4})\s*(?:sts?|stitches?)?\s*\)\s*$/i,
    /\[\s*(\d{1,4})\s*(?:sts?|stitches?)?\s*\]\s*$/i,
    /[-=–—]\s*(\d{1,4})\s*(?:sts?|stitches?)\s*$/i,
    /\b(?:total|count|you\s+should\s+have)\s*(?:of\s*)?(\d{1,4})\b/i,
    /(\d{1,4})\s*(?:sts?|stitches?)\s*(?:total|in\s+total)\b/i,
    /\b(\d{1,4})\s*sts?\s*(?:total)?\s*\.?\s*$/i,
  ];
  for (const pattern of patterns) {
    const match = instruction.match(pattern);
    if (match?.[1]) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

/** Removes a trailing declared count so it is not double counted as stitches. */
export function stripDeclaredCount(instruction: string): string {
  return instruction
    .replace(/\(\s*\d{1,4}\s*(?:sts?|stitches?)?\s*\)\s*$/i, '')
    .replace(/\[\s*\d{1,4}\s*(?:sts?|stitches?)?\s*\]\s*$/i, '')
    .replace(/[-=–—]\s*\d{1,4}\s*(?:sts?|stitches?)\s*$/i, '')
    .trim();
}

/** Stitch codes referenced by an instruction, in order of appearance. */
export function referencedStitches(instruction: string): string[] {
  const found: string[] = [];
  const words = normalizeInstruction(instruction).split(/[^a-z]+/i).filter(Boolean);
  for (const word of words) {
    const stitch = findStitch(word);
    if (stitch && !found.includes(stitch.code)) found.push(stitch.code);
  }
  return found;
}

export function describeStitch(code: string): StitchDefinition | undefined {
  return stitchByCode(code);
}
