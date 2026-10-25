import type { CatalogPattern, Diagnostic, PatternStep } from '../../shared/types.ts';
import { navigate } from '../lib/router.ts';
import { formatMinutes } from '../../domain/checkerSummary.ts';
import { StitchSymbol } from './StitchSymbol.tsx';
import { Chip, LevelChip } from './ui.tsx';

const CATEGORY_TONE: Record<string, string> = {
  Amigurumi: '#f6e3d8',
  'Home Decor': '#e5ece2',
  Wearables: '#e0edf2',
  Accessories: '#faeed3',
  Baby: '#f8e2e4',
  Blankets: '#efe6f2',
  Gifts: '#fdf1dc',
  Bags: '#e8ece0',
  Kitchen: '#f7ece1',
  Seasonal: '#e4eee9',
};

const CATEGORY_SYMBOL: Record<string, string> = {
  Amigurumi: 'bobble',
  'Home Decor': 'shell',
  Wearables: 'hdc',
  Accessories: 'dc',
  Baby: 'sc',
  Blankets: 'granny',
  Gifts: 'ch',
  Bags: 'sc',
  Kitchen: 'dc',
  Seasonal: 'puff',
};

export function PatternThumb({ pattern, height }: { pattern: CatalogPattern; height?: number }) {
  const symbol = CATEGORY_SYMBOL[pattern.category] ?? 'sc';
  return (
    <div
      className="thumb"
      style={{ background: CATEGORY_TONE[pattern.category] ?? 'var(--terracotta-soft)', ...(height ? { height } : {}) }}
    >
      <div className="row-tight" style={{ gap: 10, color: '#5b4a38', opacity: 0.9 }}>
        {symbol === 'granny' ? (
          <>
            <StitchSymbol code="dc" size={26} />
            <StitchSymbol code="ch" size={26} />
            <StitchSymbol code="dc" size={26} />
          </>
        ) : (
          <>
            <StitchSymbol code={symbol} size={26} />
            <StitchSymbol code={symbol} size={34} />
            <StitchSymbol code={symbol} size={26} />
          </>
        )}
      </div>
    </div>
  );
}

export function PatternCard({ pattern }: { pattern: CatalogPattern }) {
  return (
    <article className="pattern-card">
      <a href={`#/pattern/${pattern.id}`} style={{ color: 'inherit' }} onClick={() => navigate(`/pattern/${pattern.id}`)}>
        <PatternThumb pattern={pattern} />
      </a>
      <div className="body">
        <div className="row-tight" style={{ gap: 5, flexWrap: 'wrap' }}>
          <LevelChip level={pattern.level} />
          <Chip outline>{pattern.category}</Chip>
          {pattern.tenMinute && <Chip tone="mustard">10 min</Chip>}
        </div>
        <h4>
          <a href={`#/pattern/${pattern.id}`} style={{ color: 'inherit' }}>
            {pattern.title}
          </a>
        </h4>
        <p className="blurb">{pattern.blurb}</p>
        <div className="foot">
          <span>⏱ {formatMinutes(pattern.minutes)}</span>
          <span className="spacer" />
          <span style={{ textTransform: 'capitalize' }}>{pattern.craft}</span>
        </div>
      </div>
    </article>
  );
}

export function DiagnosticList({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) return null;
  return (
    <div>
      {diagnostics.map((diagnostic, index) => (
        <div className={`diag ${diagnostic.severity}`} key={`${diagnostic.code}-${diagnostic.stepIndex ?? 'global'}-${index}`}>
          <div className="diag-head">
            <span>{diagnostic.severity === 'error' ? '⛔' : diagnostic.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>{diagnostic.label ?? (diagnostic.severity === 'error' ? 'Counting error' : 'Note')}</span>
            <span className="diag-code">{diagnostic.code}</span>
          </div>
          <div>{diagnostic.message}</div>
          {diagnostic.hint && <div className="hint">{diagnostic.hint}</div>}
          {diagnostic.suggestedFix && <div className="fix">Suggested fix: {diagnostic.suggestedFix}</div>}
        </div>
      ))}
    </div>
  );
}

export function StepRow({
  step,
  done,
  onToggle,
  problems,
}: {
  step: PatternStep;
  done?: boolean;
  onToggle?: () => void;
  problems?: Diagnostic[];
}) {
  const isCountStep = step.kind === 'row' || step.kind === 'round';
  const mismatch =
    step.declaredCount !== undefined &&
    step.computedCount !== undefined &&
    step.declaredCount !== step.computedCount;
  const classes = ['step'];
  if (done) classes.push('done');
  if (!isCountStep) classes.push('note');
  if (problems && problems.some((p) => p.severity === 'error')) classes.push('problem');

  return (
    <div className={classes.join(' ')} id={`step-${step.index}`}>
      {onToggle ? (
        <button
          className="tick"
          onClick={onToggle}
          aria-label={done ? `Mark ${step.label} not done` : `Mark ${step.label} done`}
          aria-pressed={done}
        >
          ✓
        </button>
      ) : (
        <div className="tick" aria-hidden="true" />
      )}
      <div>
        <div className="label">{step.label}</div>
        <div className="instruction">{step.instruction}</div>
        {mismatch && (
          <div className="tiny" style={{ color: 'var(--rose)', marginTop: 4, fontWeight: 600 }}>
            Stated {step.declaredCount} · instructions make {step.computedCount}
          </div>
        )}
        {problems?.map((problem, index) => (
          <div className="tiny" key={index} style={{ color: problem.severity === 'error' ? 'var(--rose)' : '#8a6216', marginTop: 4 }}>
            {problem.message}
          </div>
        ))}
      </div>
      {isCountStep && step.computedCount !== undefined && (
        <div className="counts">
          <span className={`primary-count ${mismatch ? 'mismatch' : ''}`}>{step.computedCount}</span>
          {step.declaredCount !== undefined && step.declaredCount !== step.computedCount && (
            <span className="declared">stated {step.declaredCount}</span>
          )}
        </div>
      )}
    </div>
  );
}
