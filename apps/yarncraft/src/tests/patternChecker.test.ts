import { describe, it, expect } from 'vitest';
import { evaluateInstruction, extractDeclaredCount } from '../domain/patternChecker.ts';
import { parsePattern } from '../domain/patternParser.ts';
import { AMIGURUMI_BALL, BROKEN_COUNTS, FLAT_WASHCLOTH, MESSY_PDF_TEXT, UK_TERMS } from './fixtures.ts';

describe('evaluateInstruction', () => {
  it('counts a foundation chain-only step', () => {
    expect(evaluateInstruction('ch 31').count).toBe(31);
  });

  it('ignores the turning chain in a sc row', () => {
    expect(evaluateInstruction('ch 1, turn, sc in each st across').count).toBe(1);
  });

  it('multiplies bracket repeats', () => {
    expect(evaluateInstruction('(sc, inc) x 6').count).toBe(18);
    expect(evaluateInstruction('(2 sc, inc) x 6').count).toBe(24);
    expect(evaluateInstruction('(3 sc, dec) x 6').count).toBe(24);
  });

  it('handles repeat wording', () => {
    // dc (1) + "2 dc in next st" (2) = 3 stitches per group, x6 = 18.
    expect(evaluateInstruction('(dc, 2 dc in next st) rep 6 times').count).toBe(18);
    expect(evaluateInstruction('*sc, inc* rep 6 times').count).toBe(18);
  });

  it('counts increases and decreases', () => {
    expect(evaluateInstruction('inc in each st around').count).toBe(2);
    expect(evaluateInstruction('dec x 6').count).toBe(6);
    expect(evaluateInstruction('2 sc in next st').count).toBe(2);
  });

  it('handles decreases written together', () => {
    expect(evaluateInstruction('sc2tog 6 times').count).toBeGreaterThan(0);
    expect(evaluateInstruction('(2 sc, sc2tog) x 3').count).toBe(9);
  });

  it('parses declared counts from several layouts', () => {
    expect(extractDeclaredCount('sc in each st around (30)')).toBe(30);
    expect(extractDeclaredCount('sc in each st around - 30 sts')).toBe(30);
    expect(extractDeclaredCount('sc in each st around [30]')).toBe(30);
    expect(extractDeclaredCount('sc in each st around, 30 stitches total')).toBe(30);
    expect(extractDeclaredCount('inc in each st')).toBeUndefined();
  });
});

describe('parsePattern', () => {
  it('parses an amigurumi pattern with matching counts', () => {
    const pattern = parsePattern(AMIGURUMI_BALL);
    expect(pattern.title).toBe('Amigurumi Buddy Ball');
    expect(pattern.designer).toBe('YarnCraft Studio');
    expect(pattern.craft).toBe('crochet');
    expect(pattern.supplies.hook).toBe('3.5 mm');
    const rounds = pattern.steps.filter((s) => s.kind === 'round');
    expect(rounds).toHaveLength(10);
    expect(rounds[2]!.declaredCount).toBe(18);
    expect(rounds[2]!.computedCount).toBe(18);
    expect(pattern.diagnostics.some((d) => d.code === 'count-mismatch')).toBe(false);
    expect(pattern.diagnostics.some((d) => d.code === 'math-ok')).toBe(true);
  });

  it('flags a wrong stitch count and suggests a fix', () => {
    const pattern = parsePattern(BROKEN_COUNTS);
    const mismatch = pattern.diagnostics.find((d) => d.code === 'count-mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch!.message).toContain('Row 3');
    expect(mismatch!.severity).toBe('error');
  });

  it('handles flat rows with turning chains', () => {
    const pattern = parsePattern(FLAT_WASHCLOTH);
    const rows = pattern.steps.filter((s) => s.kind === 'row');
    expect(rows[0]!.computedCount).toBe(30);
    expect(rows[1]!.computedCount).toBe(30);
  });

  it('recognises rounds and UK repeat wording', () => {
    const pattern = parsePattern(UK_TERMS);
    expect(pattern.steps.every((s) => s.kind === 'round')).toBe(true);
    const last = pattern.steps.at(-1)!;
    expect(last.computedCount).toBe(18);
  });

  it('strips PDF page furniture and copyright lines', () => {
    const pattern = parsePattern(MESSY_PDF_TEXT);
    expect(pattern.title).toBe('Cozy Ear Warmer');
    expect(pattern.unparsedLines.join(' ')).not.toContain('Page 1');
    const rows = pattern.steps.filter((s) => s.kind === 'row');
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(pattern.diagnostics.some((d) => d.code === 'count-mismatch')).toBe(false);
  });

  it('reports unbalanced brackets instead of guessing', () => {
    const pattern = parsePattern('Test\nRow 1: (sc, inc x 6 (18)');
    expect(pattern.diagnostics.some((d) => d.code === 'unbalanced-brackets')).toBe(true);
  });
});
