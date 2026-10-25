import { useMemo, useState } from 'react';
import { findPattern, patternText } from '../../domain/catalog.ts';
import { parsePattern, serialisePattern } from '../../domain/patternParser.ts';
import { estimateYarn } from '../../domain/patternGenerator.ts';
import { summarise, formatMinutes } from '../../domain/checkerSummary.ts';
import { findStitch } from '../../domain/stitches.ts';
import { useStore } from '../store.tsx';
import { navigate, useRoute } from '../lib/router.ts';
import { DiagnosticList, StepRow } from '../components/PatternBits.tsx';
import { Chip, LevelChip, useToast } from '../components/ui.tsx';
import { StitchSymbol } from '../components/StitchSymbol.tsx';

export function PatternViewPage() {
  const { parts } = useRoute();
  const id = parts[1] ?? '';
  const { state, toggleSavedPattern, touchRecent, startProject } = useStore();
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);

  const custom = state.customPatterns.find((record) => record.id === id);
  const catalog = custom ? undefined : findPattern(id);

  const parsed = useMemo(() => {
    if (custom) return custom.parsed;
    if (!catalog) return null;
    return parsePattern(patternText(catalog), { title: catalog.title });
  }, [catalog, custom]);

  // Record the visit once per mount.
  useMemo(() => {
    if (parsed && (catalog || custom)) touchRecent(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!parsed || (!catalog && !custom)) {
    return (
      <div className="empty">
        <div className="big">🪡</div>
        <h3>Pattern not found</h3>
        <p className="small">It may have been removed from your imports.</p>
        <button className="btn" onClick={() => navigate('/library')}>Back to the library</button>
      </div>
    );
  }

  const summary = summarise(parsed);
  const yarn = estimateYarn(parsed.steps);
  const saved = state.savedPatterns.includes(id);
  const title = catalog?.title ?? custom?.title ?? parsed.title;
  const minutes = catalog?.minutes;
  const stepsToShow = showAll ? parsed.steps : parsed.steps.slice(0, 14);

  const begin = () => {
    const project = startProject({
      title,
      patternId: id,
      craft: parsed.craft,
      steps: parsed.steps,
      ...(parsed.supplies.yarn ? { yarn: parsed.supplies.yarn } : {}),
      ...(parsed.supplies.hook ? { hook: parsed.supplies.hook } : {}),
    });
    toast.show('Project started - your counter is ready');
    navigate(`/projects?project=${project.id}`);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(serialisePattern(parsed));
      toast.show('Clean pattern copied');
    } catch {
      toast.show('Clipboard is not available in this browser');
    }
  };

  return (
    <div>
      <button className="btn ghost sm" onClick={() => navigate(catalog ? '/library' : '/converter')} style={{ marginBottom: 12 }}>
        ← Back
      </button>

      <div className="page-head">
        <div className="row-tight" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          {catalog && <LevelChip level={catalog.level} />}
          {catalog && <Chip outline>{catalog.category}</Chip>}
          <Chip tone="terracotta">{parsed.craft}</Chip>
          {minutes !== undefined && <Chip tone="sky">⏱ {formatMinutes(minutes)}</Chip>}
          {catalog?.tenMinute && <Chip tone="mustard">10 minute make</Chip>}
        </div>
        <h1 style={{ marginBottom: 6 }}>{title}</h1>
        <p className="lead">
          {catalog?.blurb ?? `${parsed.steps.length} steps imported from ${custom?.source === 'pdf' ? 'a PDF' : custom?.source === 'web' ? 'a web page' : custom?.source === 'canvas' ? 'your canvas design' : 'pasted text'}.`}
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={begin}>Start project & row counter</button>
          <button className="btn" onClick={() => toggleSavedPattern(id)}>
            {saved ? '★ Saved' : '☆ Save'}
          </button>
          <button className="btn" onClick={copyText}>Copy clean text</button>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>Instructions</h3>
              <span className="meta">{parsed.steps.length} steps</span>
            </div>
            <div className="steps">
              {stepsToShow.map((step) => (
                <StepRow
                  key={step.index}
                  step={step}
                  problems={parsed.diagnostics.filter((d) => d.stepIndex === step.index && d.severity === 'error')}
                />
              ))}
            </div>
            {parsed.steps.length > stepsToShow.length && (
              <div className="center" style={{ marginTop: 14 }}>
                <button className="btn" onClick={() => setShowAll(true)}>
                  Show all {parsed.steps.length} steps
                </button>
              </div>
            )}
          </div>

          {parsed.diagnostics.length > 0 && (
            <div className="card">
              <div className="card-title">
                <h3>Check results</h3>
                <span className="meta">{summary.verdict}</span>
              </div>
              <DiagnosticList diagnostics={parsed.diagnostics} />
            </div>
          )}

          {parsed.unparsedLines.length > 0 && (
            <div className="card">
              <div className="card-title">
                <h3>Text that was not part of the instructions</h3>
              </div>
              <p className="small muted">
                These lines were kept for reference but not counted as steps.
              </p>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                {parsed.unparsedLines.slice(0, 10).map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title"><h3>Pattern health</h3></div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
              <div className="stat">
                <span className="value" style={{ color: summary.errors > 0 ? 'var(--rose)' : 'var(--sage)' }}>
                  {summary.score}
                </span>
                <span className="label">score / 100</span>
              </div>
              <div className="stat">
                <span className="value">{summary.checkedSteps}/{summary.totalSteps}</span>
                <span className="label">counts verified</span>
              </div>
            </div>
            <div className="meter" style={{ marginTop: 12 }}>
              <i style={{ width: `${summary.score}%` }} />
            </div>
            <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>{summary.verdict}</p>
          </div>

          <div className="card">
            <div className="card-title"><h3>Supplies</h3></div>
            <table className="table">
              <tbody>
                {Object.entries(parsed.supplies)
                  .filter(([, value]) => Boolean(value))
                  .map(([key, value]) => (
                    <tr key={key}>
                      <td className="faint" style={{ textTransform: 'capitalize' }}>{key}</td>
                      <td>{String(value)}</td>
                    </tr>
                  ))}
                {Object.values(parsed.supplies).every((value) => !value) && (
                  <tr><td className="muted small">No supplies listed in this pattern.</td></tr>
                )}
              </tbody>
            </table>
            <div className="divider" />
            <div className="row" style={{ gap: 16 }}>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.2rem' }}>{yarn.metres} m</span>
                <span className="label">estimated yarn</span>
              </div>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.2rem' }}>{yarn.skeins}</span>
                <span className="label">skeins (200 m)</span>
              </div>
            </div>
            <p className="tiny faint" style={{ marginTop: 8, marginBottom: 0 }}>{yarn.note}</p>
          </div>

          <div className="card">
            <div className="card-title"><h3>Abbreviations used</h3></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {parsed.abbreviations.map((code) => {
                const stitch = findStitch(code);
                return (
                  <div className="row-tight" key={code} style={{ gap: 8 }}>
                    <StitchSymbol code={code} size={22} />
                    <div>
                      <div className="small" style={{ fontWeight: 600 }}>{code}</div>
                      <div className="tiny faint">{stitch?.name ?? 'unknown'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
