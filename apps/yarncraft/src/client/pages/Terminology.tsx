import { useMemo, useState } from 'react';
import { detectDialect, glossaryRows, translateTerminology, type Dialect } from '../../domain/terminology.ts';
import { parsePattern } from '../../domain/patternParser.ts';
import { summarise } from '../../domain/checkerSummary.ts';
import { evaluateInstruction } from '../../domain/patternChecker.ts';
import { useStore, uid } from '../store.tsx';
import { navigate } from '../lib/router.ts';
import { Chip, useToast } from '../components/ui.tsx';

const SAMPLE = `Rnd 1: 6 sc in magic ring (6)
Rnd 2: inc in each st around (12)
Rnd 3: (sc, inc) x 6 (18)
Rnd 4: (2 sc, inc) x 6 (24)
Rnd 5: hdc in each st around (24)
Rnd 6: dc in each st around (24)

Gauge: 16 sc and 20 rows = 10 cm`;

export function TerminologyPage() {
  const { addCustomPattern } = useStore();
  const toast = useToast();
  const [text, setText] = useState(SAMPLE);
  const [direction, setDirection] = useState<'auto' | 'us' | 'uk'>('auto');

  const detected = useMemo(() => detectDialect(text), [text]);
  const from: Dialect = direction === 'auto' ? (detected === 'unknown' ? 'us' : detected) : direction;
  const to: Dialect = from === 'us' ? 'uk' : 'us';

  const result = useMemo(() => translateTerminology(text, from, to), [text, from, to]);

  /**
   * The dialect swap must not change a single stitch count. Verified per step
   * so a mis-mapped abbreviation is caught here rather than on the hook.
   */
  const countCheck = useMemo(() => {
    const before = parsePattern(text);
    const after = parsePattern(result.text);
    const mismatches: string[] = [];
    const inRange = before.steps.filter((s) => s.kind === 'row' || s.kind === 'round');
    const outRange = after.steps.filter((s) => s.kind === 'row' || s.kind === 'round');
    if (inRange.length !== outRange.length) {
      mismatches.push(`${inRange.length} steps before, ${outRange.length} after`);
    }
    for (let index = 0; index < Math.min(inRange.length, outRange.length); index += 1) {
      const a = evaluateInstruction(inRange[index]!.instruction).count;
      const b = evaluateInstruction(outRange[index]!.instruction).count;
      if (a !== b) mismatches.push(`${inRange[index]!.label}: ${a} became ${b}`);
    }
    return { mismatches, steps: inRange.length, summary: summarise(after) };
  }, [text, result.text]);

  const save = () => {
    const parsed = parsePattern(result.text, { craft: 'crochet' });
    const id = uid();
    addCustomPattern({
      id,
      title: `${parsed.title === 'Untitled pattern' ? 'Translated pattern' : parsed.title} (${to.toUpperCase()})`,
      craft: parsed.craft,
      rawText: result.text,
      parsed,
      source: 'paste',
      createdAt: Date.now(),
    });
    toast.show(`Saved in ${to.toUpperCase()} terms`);
    navigate(`/pattern/${id}`);
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Terminology</div>
        <h1>US to UK, and back</h1>
        <p className="lead">
          The same letters mean different stitches in the two dialects — a US single crochet is a UK
          double crochet. This translates a whole pattern in one pass, checks that{' '}
          <strong>every stitch count is unchanged</strong>, and refuses to guess when the dialect is
          unclear.
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>Source pattern</h3>
              <Chip tone={detected === 'unknown' ? 'default' : 'sage'}>
                detected: {detected}
              </Chip>
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="segmented">
                {(['auto', 'us', 'uk'] as const).map((option) => (
                  <button
                    key={option}
                    className={direction === option ? 'active' : ''}
                    onClick={() => setDirection(option)}
                  >
                    {option === 'auto' ? 'Detect' : option.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="small muted">
                translating <strong>{from.toUpperCase()}</strong> → <strong>{to.toUpperCase()}</strong>
              </span>
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              style={{ minHeight: 200 }}
              spellCheck={false}
              aria-label="Pattern text to translate"
            />
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Translated ({to.toUpperCase()})</h3>
              <span className="meta">{result.changes.reduce((sum, c) => sum + c.count, 0)} replacements</span>
            </div>
            {detected === 'unknown' && direction === 'auto' && (
              <div className="callout info" style={{ marginBottom: 10 }}>
                No dialect markers found, so this assumes {from.toUpperCase()} terms. Set the source
                dialect above if that is wrong.
              </div>
            )}
            <textarea
              value={result.text}
              readOnly
              style={{ minHeight: 200 }}
              aria-label="Translated pattern"
            />
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn primary sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.text);
                    toast.show('Translated pattern copied');
                  } catch {
                    toast.show('Clipboard unavailable');
                  }
                }}
              >
                Copy
              </button>
              <button className="btn sm" onClick={save}>Save as a pattern</button>
              <button className="btn ghost sm" onClick={() => navigate('/checker')}>
                Open in checker
              </button>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title"><h3>Count safety check</h3></div>
            {countCheck.mismatches.length === 0 ? (
              <div className="callout good">
                All {countCheck.steps} counted steps produce the same stitch counts in{' '}
                {from.toUpperCase()} and {to.toUpperCase()} terms.
              </div>
            ) : (
              <div className="callout bad">
                <strong>{countCheck.mismatches.length} count change(s):</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {countCheck.mismatches.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
              A dialect change renames stitches; it never changes how many are worked. This compares
              the two texts step by step so a wrong mapping shows up immediately.
            </p>
          </div>

          {result.changes.length > 0 && (
            <div className="card">
              <div className="card-title"><h3>Replacements</h3></div>
              <table className="table">
                <thead>
                  <tr><th>From</th><th>To</th><th style={{ textAlign: 'right' }}>Times</th></tr>
                </thead>
                <tbody>
                  {result.changes
                    .sort((a, b) => b.count - a.count)
                    .map((change) => (
                      <tr key={change.from}>
                        <td className="mono">{change.from}</td>
                        <td className="mono">{change.to}</td>
                        <td className="num">{change.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card">
            <div className="card-title">
              <h3>Quick reference</h3>
              <span className="meta">{from.toUpperCase()} → {to.toUpperCase()}</span>
            </div>
            <table className="table">
              <thead>
                <tr><th>{from.toUpperCase()}</th><th>{to.toUpperCase()}</th><th>Kind</th></tr>
              </thead>
              <tbody>
                {glossaryRows(from).map((row) => (
                  <tr key={`${row.from}-${row.to}`}>
                    <td className="mono">{row.from}</td>
                    <td className="mono">{row.to}</td>
                    <td className="faint small">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
              Each UK name is one step taller than the US name for the same action, because UK names
              count the loop on the hook.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
