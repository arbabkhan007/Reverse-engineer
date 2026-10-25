import { useMemo, useState } from 'react';
import { parsePattern } from '../../domain/patternParser.ts';
import {
  buildChart,
  CELL,
  chartAgreesWith,
  chartMade,
  repeatBoundaries,
  symbolFor,
  symbolLegend,
  type ChartRow,
} from '../../domain/symbols.ts';
import { navigate } from '../lib/router.ts';

const SAMPLE = [
  'Round 1: 6 sc in magic ring (6)',
  'Round 2: inc in each st around (12)',
  'Round 3: [sc, inc] x 6 (18)',
  'Round 4: [2 sc, inc] x 6 (24)',
  'Round 5: sc in each st around (24)',
].join('\n');

/** One cell, drawn from the shape table in the domain. */
function Cell({ code, quiet }: { code: string; quiet?: boolean }) {
  const shape = symbolFor(code);
  return (
    <svg width={CELL} height={CELL} viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={quiet ? 0.45 : 1}
      >
        {shape.paths.map((path, index) => (
          <path key={index} d={path} />
        ))}
      </g>
      {shape.fills?.map((path, index) => (
        <path key={`f${index}`} d={path} fill="currentColor" opacity={quiet ? 0.3 : 0.85} />
      ))}
      {shape.dots?.map((dot, index) => (
        <circle key={`d${index}`} cx={dot.cx} cy={dot.cy} r={dot.r} fill="currentColor" opacity={quiet ? 0.4 : 1} />
      ))}
    </svg>
  );
}

function RowStrip({ row, width, expectedCount }: { row: ChartRow; width: number; expectedCount?: number }) {
  const boundaries = repeatBoundaries(row);
  // Compare against the documented count when the writer gave one, otherwise the
  // computed count the engine derived. Both live on the parsed step.
  const agrees = chartAgreesWith(row, expectedCount);

  return (
    <div className="chart-row">
      <div className="chart-row-label">
        <b>{row.label}</b>
        <span className="faint tiny">
          {row.cells.length} cells · {chartMade(row)} sts
        </span>
      </div>
      <svg
        className="symbol-row"
        width={width * CELL + 8}
        height={CELL + 8}
        viewBox={`0 0 ${width * CELL + 8} ${CELL + 8}`}
        role="img"
        aria-label={`${row.label}: ${row.cells.map((cell) => symbolFor(cell.token.code).label).join(', ')}`}
      >
        {boundaries.map((column) => (
          <line
            key={column}
            x1={column * CELL + 4}
            y1={2}
            x2={column * CELL + 4}
            y2={CELL + 6}
            stroke="currentColor"
            strokeWidth={0.5}
            opacity={0.18}
            strokeDasharray="2 3"
          />
        ))}
        {row.cells.map((cell) => (
          <g key={cell.column} transform={`translate(${cell.column * CELL + 4}, 4)`}>
            <Cell code={cell.token.code} quiet={symbolFor(cell.token.code).quiet} />
          </g>
        ))}
      </svg>
      <div className="chart-row-note">
        {agrees === null ? (
          row.unparsed.length ? (
            <span className="chip">partly placed</span>
          ) : null
        ) : agrees ? (
          <span className="chip ok">matches the count</span>
        ) : (
          <span className="chip warn">chart and count disagree</span>
        )}
        {row.unparsed.length ? <span className="tiny faint"> not placed: {row.unparsed.join(', ')}</span> : null}
      </div>
    </div>
  );
}

export function SymbolsPage() {
  const [text, setText] = useState(SAMPLE);
  const [showQuiet, setShowQuiet] = useState(true);

  const parsed = useMemo(() => (text.trim() ? parsePattern(text) : null), [text]);
  const chart = useMemo(() => (parsed ? buildChart(parsed) : null), [parsed]);

  // Turning chains and joins occupy a position but are not counted stitches;
  // hiding them is a reading preference, so the cells are filtered and the
  // columns renumbered rather than leaving gaps.
  const rows = useMemo(() => {
    const source = chart?.rows ?? [];
    if (showQuiet) return source;
    return source.map((row) => ({
      ...row,
      cells: row.cells
        .filter((cell) => !symbolFor(cell.token.code).quiet)
        .map((cell, column) => ({ ...cell, column })),
    }));
  }, [chart, showQuiet]);

  const chartWidth = useMemo(
    () => rows.reduce((widest, row) => Math.max(widest, row.cells.length), 0),
    [rows],
  );

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Symbol charts</div>
        <h1>See the row, not just the words</h1>
        <p className="lead">
          Paste written rows and get the standard chart symbols, one cell per stitch, with repeat
          boundaries marked. This is a drawing of the maths the checker already did — if the number of
          cells and the computed count ever disagree, the page says so instead of drawing a pretty lie.
        </p>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <h2 className="card-title">Written rows</h2>
          <label className="field">
            <span>One row or round per line</span>
            <textarea
              rows={14}
              className="mono"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Round 1: 6 sc in magic ring (6)"
            />
          </label>
          <div className="row">
            <label className="row-tight">
              <input type="checkbox" checked={showQuiet} onChange={(event) => setShowQuiet(event.target.checked)} />
              <span className="small">Show turning chains and joins</span>
            </label>
            <button className="btn ghost sm" onClick={() => setText(SAMPLE)}>
              Reset sample
            </button>
            <button className="btn ghost sm" onClick={() => navigate('/checker')}>
              Check counts
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Legend</h2>
          <div className="chart-legend">
            {symbolLegend().map((entry) => (
              <div key={entry.code} className="legend-item">
                <Cell code={entry.code} quiet={entry.quiet} />
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
          <p className="tiny faint">
            Symbols follow the international chart convention: × for single crochet, T with one slash
            per extra height, a dot for slip stitch. A decrease is drawn as two strokes converging so
            you can see which stitches merged.
          </p>
        </section>
      </div>

      {chart && rows.length ? (
        <section className="card">
          <div className="section-head">
            <h2 className="card-title">Chart</h2>
            <div className="row-tight">
              <span className="chip">{rows.length} rows</span>
              <span className="chip">{chartWidth} cells wide</span>
              {chart.truncated ? <span className="chip warn">truncated</span> : null}
            </div>
          </div>

          <div className="symbol-chart">
            {rows.map((row) => (
              <RowStrip
                key={row.index}
                row={row}
                width={chartWidth}
                expectedCount={
                  parsed?.steps.find((step) => step.index === row.index)?.declaredCount ??
                  parsed?.steps.find((step) => step.index === row.index)?.computedCount
                }
              />
            ))}
          </div>

          {chart.skipped.length ? (
            <p className="tiny faint">
              Not charted (no stitches to place): {chart.skipped.join(', ')}.
            </p>
          ) : null}
          {chart.truncated ? (
            <div className="callout warn">
              A row expanded past the cell limit, so this chart is incomplete. That usually means a
              multiplier in the text is not what you meant — check the row.
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={() => window.print()}>
              Print the chart
            </button>
          </div>
        </section>
      ) : (
        <div className="empty">Paste rows on the left to see them charted.</div>
      )}
    </div>
  );
}
