import { useMemo, useState } from 'react';
import {
  convertLength,
  flatCirclePlan,
  resizeCounts,
  roundToMultiple,
  rowsForHeight,
  stitchesForWidth,
  stitchesPerUnit,
  substitutionAdvice,
  YARN_WEIGHTS,
  type Gauge,
} from '../../domain/gauge.ts';
import { parsePattern } from '../../domain/patternParser.ts';
import { navigate } from '../lib/router.ts';
import { Chip, useToast } from '../components/ui.tsx';

export function GaugePage() {
  const toast = useToast();
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const [swatch, setSwatch] = useState({ stitches: 16, width: 10, rows: 20, height: 10 });
  const [target, setTarget] = useState({ width: 50, height: 30 });
  const [repeat, setRepeat] = useState(6);
  const [startStitches, setStartStitches] = useState(6);
  const [resizeText, setResizeText] = useState('');
  const [denserStitches, setDenserStitches] = useState(20);
  const [weightKey, setWeightKey] = useState('worsted');

  const gauge: Gauge = { ...swatch, unit };

  const stitches = useMemo(() => stitchesForWidth(target.width, gauge), [target.width, gauge]);
  const rows = useMemo(() => rowsForHeight(target.height, gauge), [target.height, gauge]);
  const circle = useMemo(
    () => flatCirclePlan(Math.min(target.width, target.height || target.width), gauge, startStitches),
    [target.width, target.height, gauge, startStitches],
  );
  const substitution = substitutionAdvice(weightKey);

  const parsedForResize = useMemo(
    () => (resizeText.trim() ? parsePattern(resizeText) : null),
    [resizeText],
  );

  const resizeReport = useMemo(() => {
    if (!parsedForResize) return null;
    const counts = parsedForResize.steps
      .filter((step) => step.kind === 'row' || step.kind === 'round')
      .filter((step) => (step.declaredCount ?? step.computedCount ?? 0) > 0)
      .map((step) => ({
        label: step.label,
        count: step.declaredCount ?? step.computedCount ?? 0,
      }));
    if (counts.length === 0) return null;
    return resizeCounts(counts, gauge, { ...gauge, stitches: denserStitches });
  }, [parsedForResize, gauge, denserStitches]);

  const perUnit = stitchesPerUnit(gauge);

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Gauge & sizing</div>
        <h1>Make it the size you meant</h1>
        <p className="lead">
          Turn a swatch into stitch and row counts, plan a flat circle, and rescale an existing
          pattern when your tension differs from the designer's. Every result is derived from a
          measurement you supply — nothing is defaulted.
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>Your swatch</h3>
              <div className="segmented">
                {(['cm', 'in'] as const).map((option) => (
                  <button key={option} className={unit === option ? 'active' : ''} onClick={() => setUnit(option)}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>
              Measure a blocked swatch: count stitches across the middle and rows down the middle,
              then enter the measured width and height.
            </p>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="sw-stitches">Stitches counted</label>
                <input
                  id="sw-stitches"
                  type="number"
                  min={1}
                  value={swatch.stitches}
                  onChange={(event) => setSwatch({ ...swatch, stitches: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="sw-width">Measured width ({unit})</label>
                <input
                  id="sw-width"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={swatch.width}
                  onChange={(event) => setSwatch({ ...swatch, width: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="sw-rows">Rows counted</label>
                <input
                  id="sw-rows"
                  type="number"
                  min={1}
                  value={swatch.rows}
                  onChange={(event) => setSwatch({ ...swatch, rows: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="sw-height">Measured height ({unit})</label>
                <input
                  id="sw-height"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={swatch.height}
                  onChange={(event) => setSwatch({ ...swatch, height: Number(event.target.value) })}
                />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Chip tone="sage">{perUnit.toFixed(2)} st / {unit}</Chip>
              <Chip tone="sky">{(swatch.rows / swatch.height).toFixed(2)} rows / {unit}</Chip>
              <span className="spacer" />
              <label className="check tiny">
                <input
                  type="checkbox"
                  checked={unit === 'cm'}
                  onChange={(event) => {
                    const next = event.target.checked ? 'cm' : 'in';
                    setSwatch({
                      stitches: swatch.stitches,
                      width: Number(convertLength(swatch.width, unit, next).toFixed(1)),
                      rows: swatch.rows,
                      height: Number(convertLength(swatch.height, unit, next).toFixed(1)),
                    });
                    setTarget({
                      width: Number(convertLength(target.width, unit, next).toFixed(1)),
                      height: Number(convertLength(target.height, unit, next).toFixed(1)),
                    });
                    setUnit(next);
                  }}
                />
                show in cm
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-title"><h3>Target size</h3></div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="t-width">Width ({unit})</label>
                <input
                  id="t-width"
                  type="number"
                  min={1}
                  value={target.width}
                  onChange={(event) => setTarget({ ...target, width: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="t-height">Height ({unit})</label>
                <input
                  id="t-height"
                  type="number"
                  min={1}
                  value={target.height}
                  onChange={(event) => setTarget({ ...target, height: Number(event.target.value) })}
                />
              </div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.6rem' }}>
                  {stitches.ok ? stitches.value : '—'}
                </span>
                <span className="label">stitches across</span>
              </div>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.6rem' }}>
                  {rows.ok ? rows.value : '—'}
                </span>
                <span className="label">rows tall</span>
              </div>
            </div>
            {!stitches.ok && <div className="callout bad" style={{ marginTop: 10 }}>{stitches.problem.message}</div>}
            {!rows.ok && <div className="callout bad" style={{ marginTop: 10 }}>{rows.problem.message}</div>}

            {stitches.ok && (
              <>
                <div className="divider" />
                <div className="row" style={{ gap: 8 }}>
                  <label className="small faint" htmlFor="repeat">Stitch repeat</label>
                  <input
                    id="repeat"
                    type="number"
                    min={1}
                    max={40}
                    value={repeat}
                    onChange={(event) => setRepeat(Number(event.target.value))}
                    style={{ width: 80 }}
                  />
                  <span className="small muted">
                    → works with{' '}
                    <strong>{roundToMultiple(stitches.value, repeat)}</strong> sts
                    (nearest multiple of {repeat})
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Flat circle plan</h3>
              <span className="meta">starts with {startStitches}</span>
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
              <label className="small faint" htmlFor="start">Round 1 stitches</label>
              <input
                id="start"
                type="number"
                min={4}
                max={16}
                value={startStitches}
                onChange={(event) => setStartStitches(Number(event.target.value))}
                style={{ width: 80 }}
              />
              <span className="small muted">6 for single crochet, 8-12 for taller stitches</span>
            </div>
            {circle.ok ? (
              <>
                <div className="steps">
                  {circle.value.map((round) => (
                    <div className="step" key={round.round}>
                      <div className="tick" aria-hidden="true" />
                      <div>
                        <div className="label">Round {round.round}</div>
                        <div className="instruction">{round.instruction}</div>
                      </div>
                      <div className="counts">
                        <span className="primary-count">{round.stitches}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className="btn sm"
                    onClick={async () => {
                      const text = [
                        'Flat circle',
                        '',
                        ...circle.value.map((round) => `Round ${round.round}: ${round.instruction}`),
                      ].join('\n');
                      try {
                        await navigator.clipboard.writeText(text);
                        toast.show('Circle plan copied');
                      } catch {
                        toast.show('Clipboard unavailable');
                      }
                    }}
                  >
                    Copy plan
                  </button>
                  <button className="btn ghost sm" onClick={() => navigate('/checker')}>
                    Verify in checker
                  </button>
                </div>
              </>
            ) : (
              <div className="callout bad">{circle.problem.message}</div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title"><h3>Rescale an existing pattern</h3></div>
            <p className="small muted" style={{ marginTop: 0 }}>
              Paste a pattern and set the gauge you actually get. Counts are rescaled from your swatch
              above to the new one. Instructions are untouched — only the numbers move.
            </p>
            <div className="field">
              <label htmlFor="resize-text">Pattern text</label>
              <textarea
                id="resize-text"
                value={resizeText}
                onChange={(event) => setResizeText(event.target.value)}
                placeholder="Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)"
                style={{ minHeight: 110 }}
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label htmlFor="denser">Your stitches per {swatch.width} {unit}</label>
              <input
                id="denser"
                type="number"
                min={1}
                value={denserStitches}
                onChange={(event) => setDenserStitches(Number(event.target.value))}
              />
              <span className="help">Compared with the {swatch.stitches} in the swatch above.</span>
            </div>
            {resizeReport ? (
              resizeReport.ok ? (
                <>
                  <div className="callout info">{resizeReport.value.note}</div>
                  <table className="table" style={{ marginTop: 10 }}>
                    <thead>
                      <tr><th>Step</th><th style={{ textAlign: 'right' }}>Stated</th><th style={{ textAlign: 'right' }}>Rescaled</th></tr>
                    </thead>
                    <tbody>
                      {resizeReport.value.deltas.slice(0, 18).map((entry) => (
                        <tr key={entry.label}>
                          <td>{entry.label}</td>
                          <td className="num">{entry.from}</td>
                          <td className="num" style={{ fontWeight: 600 }}>
                            {entry.to}
                            {entry.to !== entry.from && (
                              <span className="tiny faint"> ({entry.to > entry.from ? '+' : ''}{entry.to - entry.from})</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="callout bad">{resizeReport.problem.message}</div>
              )
            ) : (
              <p className="tiny faint">Paste a pattern with stated counts to see the rescale table.</p>
            )}
          </div>

          <div className="card">
            <div className="card-title"><h3>Yarn weight & substitution</h3></div>
            <div className="field">
              <label htmlFor="weight">Pattern's yarn weight</label>
              <select id="weight" value={weightKey} onChange={(event) => setWeightKey(event.target.value)}>
                {YARN_WEIGHTS.map((weight) => (
                  <option key={weight.key} value={weight.key}>
                    {weight.name} (category {weight.number})
                  </option>
                ))}
              </select>
            </div>
            {substitution.weight && (
              <table className="table">
                <tbody>
                  <tr><td className="faint">Category</td><td>{substitution.weight.number}</td></tr>
                  <tr><td className="faint">Hook range</td><td>{substitution.weight.hook}</td></tr>
                  <tr><td className="faint">Typical gauge</td><td>{substitution.weight.gauge} / 10 cm</td></tr>
                </tbody>
              </table>
            )}
            <div className="callout" style={{ marginTop: 10 }}>{substitution.advice}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
