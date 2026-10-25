import { useEffect, useMemo, useState } from 'react';
import { parsePattern, serialisePattern } from '../../domain/patternParser.ts';
import { summarise } from '../../domain/checkerSummary.ts';
import { estimateYarn } from '../../domain/patternGenerator.ts';
import { ALL_ABBREVIATIONS } from '../../domain/stitches.ts';
import { AMIGURUMI_BALL, BROKEN_COUNTS, FLAT_WASHCLOTH, MESSY_PDF_TEXT } from '../../tests/fixtures.ts';
import { useStore, uid } from '../store.tsx';
import { navigate } from '../lib/router.ts';
import { DiagnosticList, StepRow } from '../components/PatternBits.tsx';
import { Chip, useToast } from '../components/ui.tsx';
import {
  checkWithPythonEngine,
  describePythonResult,
  probePythonEngine,
  type EngineState,
  type PythonCheckResult,
} from '../lib/pyEngine.ts';

const SAMPLES: Array<{ label: string; text: string; note: string }> = [
  { label: 'Clean amigurumi', text: AMIGURUMI_BALL, note: 'All counts correct' },
  { label: 'Broken counts', text: BROKEN_COUNTS, note: 'Two rows wrong on purpose' },
  { label: 'Flat washcloth', text: FLAT_WASHCLOTH, note: 'Turning chains and repeats' },
  { label: 'Messy PDF text', text: MESSY_PDF_TEXT, note: 'Page numbers and copyright' },
];

export function CheckerPage() {
  const { addCustomPattern } = useStore();
  const toast = useToast();
  const [text, setText] = useState(AMIGURUMI_BALL);
  const [craft, setCraft] = useState<'auto' | 'crochet' | 'knitting'>('auto');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [engine, setEngine] = useState<EngineState | null>(null);
  const [pyResult, setPyResult] = useState<PythonCheckResult | null>(null);
  const [pyBusy, setPyBusy] = useState(false);
  const [pyError, setPyError] = useState<string | null>(null);

  useEffect(() => {
    void probePythonEngine().then(setEngine);
  }, []);

  const parsed = useMemo(
    () => parsePattern(text, craft === 'auto' ? {} : { craft }),
    [text, craft],
  );
  const summary = useMemo(() => summarise(parsed), [parsed]);
  const yarn = useMemo(() => estimateYarn(parsed.steps), [parsed.steps]);

  const visibleSteps = onlyProblems
    ? parsed.steps.filter((step) =>
        parsed.diagnostics.some((d) => d.stepIndex === step.index && d.severity !== 'info'),
      )
    : parsed.steps;

  const saveAsPattern = () => {
    addCustomPattern({
      id: uid(),
      title: parsed.title,
      craft: parsed.craft,
      rawText: text,
      parsed,
      source: 'paste',
      createdAt: Date.now(),
    });
    toast.show('Saved to your patterns');
  };

  const runPythonCheck = async () => {
    setPyBusy(true);
    setPyError(null);
    try {
      setPyResult(await checkWithPythonEngine(text));
    } catch (error) {
      setPyResult(null);
      setPyError(error instanceof Error ? error.message : 'The Python engine failed');
    } finally {
      setPyBusy(false);
    }
  };

  const copyClean = async () => {
    try {
      await navigator.clipboard.writeText(serialisePattern(parsed));
      toast.show('Clean pattern copied');
    } catch {
      toast.show('Clipboard unavailable');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Pattern checker</div>
        <h1>Find the counting mistakes</h1>
        <p className="lead">
          Paste a written pattern and every stated stitch count is checked against what the
          instructions actually produce. Errors point at the exact row and suggest a fix; anything the
          checker cannot interpret is reported instead of guessed.
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>Pattern text</h3>
              <span className="meta">{text.length.toLocaleString()} characters</span>
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              style={{ minHeight: 230 }}
              aria-label="Pattern text"
              spellCheck={false}
            />
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <div className="segmented">
                {(['auto', 'crochet', 'knitting'] as const).map((option) => (
                  <button
                    key={option}
                    className={craft === option ? 'active' : ''}
                    onClick={() => setCraft(option)}
                  >
                    {option === 'auto' ? 'Detect craft' : option}
                  </button>
                ))}
              </div>
              <span className="spacer" />
              <button className="btn sm" onClick={() => setText('')}>Clear</button>
              <button className="btn sm" onClick={saveAsPattern} disabled={parsed.steps.length === 0}>
                Save to my patterns
              </button>
              <button className="btn dark sm" onClick={copyClean} disabled={parsed.steps.length === 0}>
                Copy clean
              </button>
            </div>
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              <span className="tiny faint" style={{ marginRight: 4 }}>Load a sample:</span>
              {SAMPLES.map((sample) => (
                <button
                  key={sample.label}
                  className="btn ghost sm"
                  title={sample.note}
                  onClick={() => setText(sample.text)}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Steps</h3>
              <span className="meta">{visibleSteps.length} shown</span>
            </div>
            <label className="check small" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={onlyProblems}
                onChange={(event) => setOnlyProblems(event.target.checked)}
              />
              Only show rows with problems
            </label>
            {visibleSteps.length === 0 ? (
              <div className="empty">
                <div className="big">📝</div>
                <p className="small">No steps parsed yet. Paste a pattern above.</p>
              </div>
            ) : (
              <div className="steps">
                {visibleSteps.map((step) => (
                  <StepRow
                    key={step.index}
                    step={step}
                    problems={parsed.diagnostics.filter(
                      (d) => d.stepIndex === step.index && d.severity !== 'info',
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>Python engine</h3>
              {engine?.available ? <Chip tone="sage">connected</Chip> : <Chip outline>offline</Chip>}
            </div>
            <p className="tiny muted" style={{ marginTop: 0 }}>
              The repository's <span className="mono">crochet_checker</span> engine is authoritative for
              parsing, validation and measurement. The report below comes from that engine; the score at
              the top of this page is only the browser's local pre-check.
            </p>
            {engine && !engine.available && (
              <div className="callout info">
                {engine.reason} Start it with{' '}
                <span className="mono small">uvicorn crochet_checker.web.app:app --port 8000</span>{' '}
                and open this studio from that server at <span className="mono small">/studio</span>.
              </div>
            )}
            <button
              className="btn primary block"
              style={{ marginTop: 10 }}
              onClick={runPythonCheck}
              disabled={pyBusy || !engine?.available || text.trim().length === 0}
            >
              {pyBusy ? 'Running the Python engine…' : 'Verify with the Python engine'}
            </button>
            {pyError && <div className="callout bad" style={{ marginTop: 12 }}>{pyError}</div>}
            {pyResult && (
              <div style={{ marginTop: 12 }}>
                <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
                  <span
                    className="chip"
                    style={{
                      background: pyResult.status === 'PASS' ? 'var(--sage-soft)' : 'var(--rose-soft)',
                      color: pyResult.status === 'PASS' ? '#38512f' : '#7d2d3a',
                      fontWeight: 700,
                    }}
                  >
                    {pyResult.status}
                  </span>
                  <span className="small muted">{describePythonResult(pyResult)}</span>
                </div>
                <table className="table" style={{ marginTop: 8 }}>
                  <tbody>
                    <tr><td className="faint">Score</td><td className="num">{pyResult.score}</td></tr>
                    <tr><td className="faint">Rounds</td><td className="num">{pyResult.rounds}</td></tr>
                    <tr><td className="faint">Max stitches</td><td className="num">{pyResult.max_stitches}</td></tr>
                    <tr><td className="faint">Max diameter</td><td className="num">{pyResult.max_diameter_inches} in</td></tr>
                    <tr><td className="faint">Total height</td><td className="num">{pyResult.total_height_inches} in</td></tr>
                  </tbody>
                </table>
                {pyResult.errors.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 10, marginBottom: 4 }}>Errors</h4>
                    {pyResult.errors.map((error, index) => (
                      <div className="diag error" key={index}>
                        <div>{error.message}</div>
                        {error.location && <div className="hint">{error.location}</div>}
                      </div>
                    ))}
                  </>
                )}
                {pyResult.warnings.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 10, marginBottom: 4 }}>Warnings</h4>
                    {pyResult.warnings.map((warning, index) => (
                      <div className="diag warning" key={index}>
                        <div>{warning.message}</div>
                        {warning.location && <div className="hint">{warning.location}</div>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Local pre-check</h3>
              <span className="meta">browser only</span>
            </div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
              <div className="stat">
                <span className="value" style={{ color: summary.errors > 0 ? 'var(--rose)' : 'var(--sage)' }}>
                  {summary.score}
                </span>
                <span className="label">health score</span>
              </div>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.25rem' }}>{summary.errors}</span>
                <span className="label">errors</span>
              </div>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.25rem' }}>{summary.warnings}</span>
                <span className="label">warnings</span>
              </div>
            </div>
            <div className="meter" style={{ marginTop: 12 }}>
              <i style={{ width: `${summary.score}%` }} />
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>{summary.verdict}</p>
            <div className="divider" />
            <table className="table">
              <tbody>
                <tr><td className="faint">Title</td><td>{parsed.title}</td></tr>
                <tr><td className="faint">Craft</td><td style={{ textTransform: 'capitalize' }}>{parsed.craft}</td></tr>
                <tr><td className="faint">Rows / rounds</td><td>{summary.totalSteps}</td></tr>
                <tr><td className="faint">Counts verified</td><td>{summary.checkedSteps}</td></tr>
                <tr><td className="faint">Total stitches</td><td>{parsed.steps.reduce((sum, s) => sum + (s.computedCount ?? 0), 0).toLocaleString()}</td></tr>
                <tr><td className="faint">Yarn estimate</td><td>{yarn.metres} m · {yarn.skeins} skein{yarn.skeins === 1 ? '' : 's'}</td></tr>
              </tbody>
            </table>
            <button className="btn block" style={{ marginTop: 12 }} onClick={() => navigate(`/pattern/${parsed.title}`)}>
              View full pattern
            </button>
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Diagnostics</h3>
              <span className="meta">{parsed.diagnostics.length}</span>
            </div>
            {parsed.diagnostics.length === 0 ? (
              <p className="small muted">Nothing to report yet.</p>
            ) : (
              <DiagnosticList diagnostics={parsed.diagnostics} />
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Abbreviations</h3>
              <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setShowGlossary((v) => !v)}>
                {showGlossary ? 'Hide full list' : 'Full glossary'}
              </button>
            </div>
            <div className="row" style={{ gap: 5 }}>
              {parsed.abbreviations.length === 0 && <span className="small muted">None detected.</span>}
              {parsed.abbreviations.map((code) => (
                <span className="chip" key={code}>{code}</span>
              ))}
            </div>
            {parsed.unknownAbbreviations.length > 0 && (
              <div className="callout" style={{ marginTop: 12 }}>
                Not in the dictionary, so not counted: {parsed.unknownAbbreviations.join(', ')}
              </div>
            )}
            {showGlossary && (
              <table className="table" style={{ marginTop: 12 }}>
                <tbody>
                  {ALL_ABBREVIATIONS.slice(0, 60).map((entry) => (
                    <tr key={entry.abbreviation}>
                      <td className="mono" style={{ width: 70 }}>{entry.abbreviation}</td>
                      <td className="muted">{entry.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
