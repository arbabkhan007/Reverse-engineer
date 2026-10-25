/**
 * Pattern parser: raw written pattern text -> ParsedPattern.
 *
 * The same entry point serves pasted text, PDF page text and extracted web
 * text, so every importer inherits identical step semantics and diagnostics.
 */

import type {
  Craft,
  Diagnostic,
  ParsedPattern,
  PatternStep,
  PatternSupplies,
  StepKind,
} from '../shared/types.ts';
import {
  evaluateInstruction,
  extractDeclaredCount,
  normalizeInstruction,
  referencedStitches,
  stripDeclaredCount,
} from './patternChecker.ts';
import { findStitch, isKnownAbbreviation, turningChainsFor } from './stitches.ts';

const STEP_LABEL = /^(?:row|rows|rnd|rnds|round|rounds|r|handle|strap|panel|border|edging|side|base|band|brim|cuff|sleeve|body|hood|pocket)\s*[\s.:-]*(\d+|[a-z]+)?/i;
const STEP_NUMBERED = /^(\d{1,3})[.)]\s+\S/;
const BULLET = /^[•*\-–—+]\s+\S/;
const NOTE_LINE = /^(?:note|notes|tip|tips|hint|important|remember|video|photo|image)\b/i;
const FINISHING_LINE = /^(?:finishing|assembly|assembling|fasten off|sew|stuffing|stuff|edging|border)\b/i;
const SECTION_HEADER = /^(?:abbreviations?|materials?|supplies|yarn|hooks?|gauge|gauge\s*\/\s*tension|tension|notes?|special\s+stitches|copyright|pattern\s+notes|terms\s+of\s+use)\b\s*[:\-]?/i;
const CREDIT_LINE = /(©|copyright|all rights reserved|pattern by|design(?:ed)? by|for personal use|do not (?:sell|share|reproduce)|instagram|facebook|youtube)/i;
const BULLET_STRIP = /^[•*\-–—+]\s+/;

export interface ParseOptions {
  /** Force a craft instead of inferring it. */
  craft?: Craft;
  /** Title to use instead of the first plausible line. */
  title?: string;
}

function looksLikeStep(line: string): boolean {
  return STEP_LABEL.test(line) || STEP_NUMBERED.test(line) || BULLET.test(line);
}

function stripLabel(line: string): { label: string; body: string } {
  const labelMatch = line.match(STEP_LABEL);
  if (labelMatch) {
    const word = labelMatch[1] ? line.slice(0, labelMatch[0].length).trim() : labelMatch[0].trim();
    const wordKind = /rnd|round/i.test(line.slice(0, 4)) ? 'Round' : 'Row';
    const number = labelMatch[1] ?? '';
    const label = number ? `${wordKind} ${number}` : word;
    return { label, body: line.slice(labelMatch[0].length).replace(/^[\s.:-]+/, '').trim() };
  }
  const numbered = line.match(STEP_NUMBERED);
  if (numbered) {
    return { label: `Step ${numbered[1]}`, body: line.slice(numbered[0].length - 1).trim() };
  }
  const bullet = line.match(BULLET_STRIP);
  if (bullet) return { label: '', body: line.slice(bullet[0].length).trim() };
  return { label: '', body: line.trim() };
}

function parseSupplies(text: string): PatternSupplies {
  const supplies: PatternSupplies = {};
  const yarnLine = text.match(/^\s*yarn\s*(?:used)?\s*[:\-]\s*(.+)$/im);
  if (yarnLine?.[1]) supplies.yarn = yarnLine[1].trim();
  const yardage = text.match(/^\s*(?:yardage|yards?|meters?|metres?)\s*[:\-]\s*(.+)$/im);
  if (yardage?.[1]) supplies.yardage = yardage[1].trim();
  const hook = text.match(/^\s*(?:hook|needle)s?(?:\s*size)?\s*[:\-]\s*(.+)$/im);
  if (hook?.[1]) supplies.hook = hook[1].trim();
  const gauge = text.match(/^\s*(?:gauge|tension)\s*[:\-]\s*(.+)$/im);
  if (gauge?.[1]) supplies.gauge = gauge[1].trim();
  return supplies;
}

function inferCraft(text: string, steps: PatternStep[]): Craft {
  const lower = text.toLowerCase();
  const knot = (lower.match(/\b(knit|knits|knitting|purl|needles?|p2tog|k2tog|cast on|stockinette|garter)\b/g) ?? []).length;
  const crochet = (lower.match(/\b(crochet|hook|sc|dc|hdc|amigurumi|granny|yarn over|magic ring)\b/g) ?? []).length;
  if (knot > crochet) return 'knitting';
  if (crochet > knot) return 'crochet';
  const hasKnitting = steps.some((s) => referencedStitches(s.instruction).some((c) => c === 'k' || c === 'p'));
  const hasCrochet = steps.some((s) => findStitch(s.instruction.split(/\s+/)[0] ?? '')?.craft === 'crochet');
  return hasKnitting && !hasCrochet ? 'knitting' : 'crochet';
}

function bracketBalance(text: string): boolean {
  let round = 0;
  let square = 0;
  for (const char of text) {
    if (char === '(') round += 1;
    else if (char === ')') round -= 1;
    else if (char === '[') square += 1;
    else if (char === ']') square -= 1;
    if (round < 0 || square < 0) return false;
  }
  return round === 0 && square === 0;
}

/** Removes page furniture that PDF and web extraction inevitably produce. */
export function stripPageFurniture(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/^page\s+\d+(\s+of\s+\d+)?\s*$/gim, '')
    .replace(/^\s*\d{1,3}\s*$/gm, '')
    .replace(/[ \t]{3,}/g, '  ')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

/** Extracts an abbreviation glossary ("sc = single crochet") when present. */
export function extractGlossary(text: string): Record<string, string> {
  const glossary: Record<string, string> = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([a-z]{1,6}(?:\s?st)?)\s*[=:\-–]\s*([a-z][a-z\s/-]{3,40})\s*$/i);
    if (!match?.[1] || !match[2]) continue;
    const key = match[1].trim().toLowerCase();
    if (!/^(row|rnd|round|gauge|tension|hook|yarn|note|level|size|finished)/.test(key)) {
      glossary[key] = match[2].trim();
    }
  }
  return glossary;
}

export function parsePattern(rawText: string, options: ParseOptions = {}): ParsedPattern {
  const cleaned = stripPageFurniture(rawText);
  const lines = cleaned.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const diagnostics: Diagnostic[] = [];
  const unparsedLines: string[] = [];
  const steps: PatternStep[] = [];

  let title = options.title?.trim() ?? '';
  let designer: string | undefined;
  let inGlossary = false;
  // Held in an object so assignments inside pushStep are visible to the loop.
  const cursor: { current: PatternStep | null } = { current: null };

  /**
   * Adds a step. Counts are resolved in a later pass because distributive
   * wording ("in each st across") depends on the previous row.
   */
  const pushStep = (kind: StepKind, label: string, body: string) => {
    const instruction = body.trim();
    if (!instruction) return;
    const declared = extractDeclaredCount(instruction);
    const step: PatternStep = {
      index: steps.length,
      label: label || (kind === 'round' ? `Round ${steps.length}` : `Row ${steps.length}`),
      kind,
      instruction,
      ...(declared !== undefined ? { declaredCount: declared } : {}),
    };
    steps.push(step);
    cursor.current = step;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    // Title: first substantial non-instruction line.
    if (!title && !looksLikeStep(line) && line.length <= 90 && !NOTE_LINE.test(line) && !CREDIT_LINE.test(line)) {
      title = line.replace(/^pattern\s*(?:name)?\s*[:\-]\s*/i, '').replace(/[|•]+$/, '').trim();
      continue;
    }

    const designerMatch = line.match(/(?:pattern|design(?:ed)?)\s+by\s*[:\-]?\s*(.{2,60})/i);
    if (designerMatch?.[1] && !designer) {
      designer = designerMatch[1].replace(CREDIT_LINE, '').trim();
      continue;
    }

    if (/^abbreviations?\b/i.test(line)) {
      inGlossary = true;
      continue;
    }

    if (inGlossary) {
      const key = line.split(/[=:\-–]/)[0]?.trim() ?? '';
      const glossaryLine = /^[a-z]{1,6}(?:\s?st)?$/i.test(key) || /^(?:ch|sp|ch-sp|flo|blo)$/i.test(key);
      const sectionWord =
        /^(?:note|notes|tip|tips|row|rows|rnd|round|rounds|gauge|tension|hook|hooks|needle|needles|yarn|size|level|finished|special|pattern|materials?|supplies|instructions?|directions?)$/i.test(
          key,
        );
      if (glossaryLine && !sectionWord) continue;
      if (line.length < 32 && !sectionWord && !looksLikeStep(line)) continue;
      inGlossary = false;
    }

    if (SECTION_HEADER.test(line) && !looksLikeStep(line)) {
      continue;
    }

    if (NOTE_LINE.test(line)) {
      pushStep('note', 'Note', line.replace(NOTE_LINE, '').replace(/^[\s:\-]+/, ''));
      continue;
    }

    if (FINISHING_LINE.test(line)) {
      pushStep('finishing', 'Finishing', line);
      continue;
    }

    if (looksLikeStep(line)) {
      const { label, body } = stripLabel(line);
      if (!body) continue;
      const kind: StepKind = /round|rnd/i.test(line.slice(0, 6)) || /rnd/i.test(label) ? 'round' : 'row';
      pushStep(kind, label, body);
      continue;
    }

    if (CREDIT_LINE.test(line) || line.length < 3) {
      if (line.length > 3) unparsedLines.push(line);
      continue;
    }

    // A continuation of the previous step (PDF text often wraps mid-instruction).
    const current = cursor.current;
    if (current && /^[a-z(*[]/.test(line) && !looksLikeStep(line)) {
      const merged = `${current.instruction} ${line}`;
      const declared = extractDeclaredCount(merged);
      current.instruction = merged;
      if (declared !== undefined) current.declaredCount = declared;
      else delete current.declaredCount;
      continue;
    }

    // Loose instruction with no label: treat as a step only if it reads like one.
    const stitchHits = referencedStitches(line).length;
    if (stitchHits > 0 && line.length > 8) {
      pushStep('row', '', line);
      continue;
    }

    unparsedLines.push(line);
  }

  // Foundation chain detection: a leading all-chain step.
  const firstStep = steps.find((s) => s.kind === 'row' || s.kind === 'round');
  const abbreviations = new Set<string>();
  const unknown = new Set<string>();

  for (const step of steps) {
    for (const code of referencedStitches(step.instruction)) abbreviations.add(code);
    const words = normalizeInstruction(step.instruction).split(/[^a-zA-Z]+/).filter(Boolean);
    for (const word of words) {
      const lower = word.toLowerCase();
      if (/^(row|rnd|round|rounds|rows|repeat|times|inc|dec|tog|ch|sp|sts?|sk|in|the|next|each|around|across|to|from|last|first|same|of|only|with|turn|work|evenly|approx|about|total|yarn|over|hook|loop|loops|corner|all|then|and|flo|blo|prev|beg|ea|invdec|mr|mc|cc|fo|frm)$/.test(lower)) continue;
      if (/^\d+$/.test(lower)) continue;
      if (findStitch(lower)) continue;
      if (word.length < 2) continue;
      if (!isKnownAbbreviation(lower) && /^[a-z]{2,5}$/.test(lower) && !/^[aeiou]/.test(lower) && /^[bcdfghjklmnpqrstvwxz]/.test(lower)) {
        unknown.add(lower);
      }
    }
  }

  // ---- resolve counts in order, threading the previous row's count ---------
  const resolved: PatternStep[] = [];
  let workingCount: number | undefined;
  for (const step of steps) {
    const isCountStep = step.kind === 'row' || step.kind === 'round';
    const evaluation = evaluateInstruction(stripDeclaredCount(step.instruction), {
      previousCount: workingCount,
    });
    const next: PatternStep = { ...step, index: resolved.length };
    next.computedCount = evaluation.count;
    if (evaluation.unparsed.length > 0) next.unparsed = evaluation.unparsed;
    else delete next.unparsed;
    if (evaluation.repeat) next.repeat = evaluation.repeat;
    else delete next.repeat;

    if (isCountStep && evaluation.assumed) {
      diagnostics.push({
        severity: 'info',
        code: 'assumption',
        stepIndex: next.index,
        label: next.label,
        message: `${next.label} states no total, so ${evaluation.count} is derived from ${
          workingCount !== undefined ? 'the previous row' : 'the foundation chain'
        }.`,
        hint: 'Add the count in brackets, for example "(30)", so the row can be verified rather than inferred.',
      });
    }

    if (isCountStep && evaluation.count > 0) workingCount = evaluation.count;
    resolved.push(next);
  }

  const finalSteps = resolved;

  // ---- diagnostics -------------------------------------------------------
  const previousCounts: number[] = [];
  let drift = 0;

  for (const step of finalSteps) {
    const isCountStep = step.kind === 'row' || step.kind === 'round';
    if (!isCountStep) continue;

    if (!bracketBalance(step.instruction)) {
      diagnostics.push({
        severity: 'error',
        code: 'unbalanced-brackets',
        stepIndex: step.index,
        label: step.label,
        message: `Brackets in ${step.label} do not balance, so the repeat cannot be evaluated.`,
        hint: 'Every "(" needs a ")" and every "[" needs a "]".',
      });
    }

    if (step.unparsed && step.unparsed.length > 0) {
      diagnostics.push({
        severity: 'warning',
        code: 'unparseable-fragment',
        stepIndex: step.index,
        label: step.label,
        message: `${step.label}: could not interpret ${step.unparsed.map((u) => `"${u}"`).join(', ')}. The count shown excludes it.`,
        hint: 'Rewrite the fragment with a standard abbreviation, for example "2 sc in next st" instead of "work a pair".',
      });
    }

    if (step.declaredCount !== undefined && step.computedCount !== undefined) {
      const diff = step.computedCount - step.declaredCount;
      if (diff !== 0) {
        const isDrift = previousCounts.length > 0 && Math.abs(diff) === Math.abs(drift) && drift !== 0;
        if (isDrift) {
          diagnostics.push({
            severity: 'warning',
            code: 'count-drift',
            stepIndex: step.index,
            label: step.label,
            message: `${step.label} is off by ${diff > 0 ? '+' : ''}${diff} again - the same error as the previous row, which usually means one systematic mistake rather than a new one.`,
            hint: 'Fixing the first mismatched row normally clears every row that follows it.',
          });
        } else {
          diagnostics.push({
            severity: 'error',
            code: 'count-mismatch',
            stepIndex: step.index,
            label: step.label,
            message: `${step.label} says ${step.declaredCount} stitches but the instructions make ${step.computedCount}.`,
            hint:
              diff > 0
                ? `The instruction produces ${diff} too many. Check for an extra increase or a repeat that should run ${Math.abs(diff)} fewer times.`
                : `The instruction produces ${Math.abs(diff)} too few. Check for a missing increase or a repeat that should run ${Math.abs(diff)} more times.`,
            ...(step.computedCount > 0 && step.declaredCount % step.computedCount === 0
              ? { suggestedFix: `Repeat the group ${step.declaredCount / step.computedCount} times.` }
              : {}),
          });
          drift = diff;
        }
      }
    }

    // Turning chain sanity for labelled rows.
    const firstCode = referencedStitches(step.instruction)[0];
    if (firstCode && step.kind === 'row' && step.index > 0) {
      const needs = turningChainsFor(firstCode);
      const chainMatch = step.instruction.match(/^ch\s*(\d)/i);
      if (needs > 0 && chainMatch?.[1] && Number(chainMatch[1]) !== needs && firstCode !== 'ch') {
        diagnostics.push({
          severity: 'info',
          code: 'missing-turn',
          stepIndex: step.index,
          label: step.label,
          message: `${step.label} starts with ch ${chainMatch[1]} but a ${findStitch(firstCode)?.name ?? firstCode} row usually needs ch ${needs}.`,
          hint: 'This is only a convention - the designer may be deliberately using a shorter turning chain.',
        });
      }
    }

    if (step.computedCount !== undefined && step.computedCount > 0) previousCounts.push(step.computedCount);
  }

  // Over-decrease: a step consuming more stitches than the previous step made.
  for (let i = 1; i < finalSteps.length; i += 1) {
    const step = finalSteps[i]!;
    const prev = finalSteps[i - 1]!;
    if (step.kind !== 'round' || prev.kind !== 'round') continue;
    const evaluation = evaluateInstruction(stripDeclaredCount(step.instruction));
    if (evaluation.consumed !== null && prev.computedCount !== undefined) {
      if (evaluation.consumed > prev.computedCount) {
        diagnostics.push({
          severity: 'error',
          code: 'over-decrease',
          stepIndex: step.index,
          label: step.label,
          message: `${step.label} works into ${evaluation.consumed} stitches but ${prev.label} only has ${prev.computedCount}.`,
          hint: 'The round is short of stitches - check the previous round or reduce the decrease count.',
        });
      }
    }
  }

  if (!firstStep && finalSteps.length > 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'no-foundation',
      message: 'No foundation row or magic ring was found. Check that the opening instruction was included.',
    });
  }

  if (unknown.size > 0) {
    diagnostics.push({
      severity: 'info',
      code: 'unknown-abbreviation',
      message: `Unrecognised abbreviations: ${[...unknown].join(', ')}. They were not counted.`,
      hint: 'Add the term to the pattern glossary with "abbr = meaning" so it is translated on import.',
    });
  }

  const labelledCounts = finalSteps.filter(
    (s) => (s.kind === 'row' || s.kind === 'round') && s.declaredCount !== undefined,
  );
  if (labelledCounts.length > 0 && diagnostics.every((d) => d.code !== 'count-mismatch' && d.code !== 'count-drift')) {
    diagnostics.unshift({
      severity: 'info',
      code: 'math-ok',
      message: `All ${labelledCounts.length} stated stitch counts match the instructions.`,
    });
  }

  const totalStitches = finalSteps.reduce((sum, s) => sum + (s.computedCount ?? 0), 0);
  const summary =
    finalSteps.length > 0
      ? `${finalSteps.length} steps · ~${totalStitches.toLocaleString()} stitches total`
      : 'No pattern steps detected';

  return {
    title: title || 'Untitled pattern',
    craft: options.craft ?? inferCraft(cleaned, finalSteps),
    ...(designer ? { designer } : {}),
    supplies: parseSupplies(cleaned),
    steps: finalSteps,
    abbreviations: [...abbreviations],
    unknownAbbreviations: [...unknown],
    diagnostics,
    unparsedLines,
    summary,
  };
}

/** Serialises a ParsedPattern back to clean, re-importable text. */
export function serialisePattern(pattern: ParsedPattern): string {
  const lines: string[] = [];
  lines.push(pattern.title.toUpperCase());
  if (pattern.designer) lines.push(`Pattern by ${pattern.designer}`);
  lines.push('');
  if (pattern.supplies.yarn) lines.push(`Yarn: ${pattern.supplies.yarn}`);
  if (pattern.supplies.hook) lines.push(`Hook: ${pattern.supplies.hook}`);
  if (pattern.supplies.yardage) lines.push(`Yardage: ${pattern.supplies.yardage}`);
  if (pattern.supplies.gauge) lines.push(`Gauge: ${pattern.supplies.gauge}`);
  if (lines.length > 2) lines.push('');
  lines.push('ABBREVIATIONS');
  for (const code of pattern.abbreviations) {
    const stitch = findStitch(code);
    lines.push(`${code} = ${stitch?.name ?? code}`);
  }
  lines.push('');
  for (const step of pattern.steps) {
    const instruction = step.declaredCount !== undefined
      ? `${step.instruction.replace(/\(\s*\d{1,4}\s*(?:sts?|stitches?)?\s*\)\s*$/i, '').trim()} (${step.declaredCount})`
      : step.instruction;
    lines.push(`${step.label}: ${instruction}`);
  }
  return lines.join('\n');
}

/** Converts steps to a row-chart-friendly numbering that skips notes. */
export function countRows(steps: PatternStep[]): number {
  return steps.filter((s) => s.kind === 'row' || s.kind === 'round').length;
}
