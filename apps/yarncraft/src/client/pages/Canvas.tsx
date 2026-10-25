import { useMemo, useState } from 'react';
import { CANVAS_SYMBOLS, type CanvasDesign, type CanvasSymbol } from '../../shared/types.ts';
import { generateVerifiedFromCanvas } from '../../domain/patternGenerator.ts';
import { summarise } from '../../domain/checkerSummary.ts';
import { findStitch, CANVAS_STITCHES } from '../../domain/stitches.ts';
import { useStore, uid } from '../store.tsx';
import { navigate } from '../lib/router.ts';
import { StitchSymbol } from '../components/StitchSymbol.tsx';
import { Chip, useToast } from '../components/ui.tsx';

const SYMBOL_LABEL: Record<CanvasSymbol, string> = {
  blank: 'empty',
  sc: 'single',
  hdc: 'half double',
  dc: 'double',
  tr: 'treble',
  ch: 'chain',
  slst: 'slip',
  inc: 'increase',
  dec: 'decrease',
  bobble: 'bobble',
  shell: 'shell',
  puff: 'puff',
};

const PAINTABLE = CANVAS_SYMBOLS;

function emptyDesign(width: number, height: number): CanvasDesign {
  const now = Date.now();
  return {
    id: uid(),
    name: 'Untitled design',
    width,
    height,
    cells: Array<CanvasSymbol>(width * height).fill('blank'),
    colors: Array<string>(width * height).fill('#fbf6ec'),
    palette: ['#fbf6ec', '#c2643c', '#6d8a6a', '#d9a13b', '#4b7f96', '#b5525f'],
    baseStitch: 'sc',
    createdAt: now,
    updatedAt: now,
  };
}

export function CanvasPage() {
  const { state, saveCanvas, deleteCanvas, addCustomPattern } = useStore();
  const toast = useToast();
  const [design, setDesign] = useState<CanvasDesign>(() => state.canvases[0] ?? emptyDesign(12, 10));
  const [tool, setTool] = useState<CanvasSymbol>('sc');
  const [color, setColor] = useState('#c2643c');
  const [cellSize, setCellSize] = useState(30);
  const [painted, setPainted] = useState(false);

  const verified = useMemo(() => generateVerifiedFromCanvas(design), [design]);
  const summary = useMemo(() => summarise(verified.parsed), [verified]);

  const paint = (index: number) => {
    setDesign((current) => {
      const cells = [...current.cells];
      const colors = [...current.colors];
      if (tool === 'blank') {
        cells[index] = 'blank';
        colors[index] = '#fbf6ec';
      } else {
        cells[index] = tool;
        colors[index] = color;
      }
      return { ...current, cells, colors, updatedAt: Date.now() };
    });
  };

  const resize = (width: number, height: number) => {
    setDesign((current) => {
      const cells: CanvasSymbol[] = [];
      const colors: string[] = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const source = y * current.width + x;
          const inBounds = x < current.width && y < current.height;
          cells.push(inBounds ? (current.cells[source] ?? 'blank') : 'blank');
          colors.push(inBounds ? (current.colors[source] ?? '#fbf6ec') : '#fbf6ec');
        }
      }
      return { ...current, width, height, cells, colors, updatedAt: Date.now() };
    });
  };

  const clear = () => {
    setDesign((current) => ({
      ...current,
      cells: current.cells.map((cell) => (cell === 'blank' ? cell : 'blank')) as CanvasSymbol[],
      colors: current.colors.map(() => '#fbf6ec'),
      updatedAt: Date.now(),
    }));
  };

  const fillRow = (row: number) => {
    setDesign((current) => {
      const cells = [...current.cells];
      const colors = [...current.colors];
      for (let x = 0; x < current.width; x += 1) {
        cells[row * current.width + x] = tool === 'blank' ? 'sc' : tool;
        colors[row * current.width + x] = color;
      }
      return { ...current, cells, colors, updatedAt: Date.now() };
    });
  };

  const load = (saved: CanvasDesign) => {
    setDesign(saved);
    toast.show(`Opened ${saved.name}`);
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Pattern canvas</div>
        <h1>Design your own</h1>
        <p className="lead">
          Paint a grid of stitches and the canvas writes the pattern for you - row by row, with counts
          the checker verifies. Save it, start a project from it, or export the instructions.
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>{design.name}</h3>
              <span className="meta">{design.width} × {design.height}</span>
            </div>
            <div className="row" style={{ marginBottom: 12, gap: 8 }}>
              <input
                type="text"
                value={design.name}
                onChange={(event) => setDesign((current) => ({ ...current, name: event.target.value }))}
                aria-label="Design name"
                style={{ maxWidth: 240 }}
              />
              <span className="spacer" />
              <label className="tiny faint">
                Cell
                <input
                  type="range"
                  min={16}
                  max={44}
                  value={cellSize}
                  onChange={(event) => setCellSize(Number(event.target.value))}
                  style={{ verticalAlign: 'middle', marginLeft: 6 }}
                />
              </label>
            </div>

            <div style={{ overflow: 'auto', padding: 4 }}>
              <div
                className="canvas-grid"
                style={{ gridTemplateColumns: `repeat(${design.width}, var(--cell))`, ['--cell' as string]: `${cellSize}px` }}
                onPointerDown={() => setPainted(true)}
                onPointerUp={() => setPainted(false)}
                onPointerLeave={() => setPainted(false)}
              >
                {design.cells.map((cell, index) => (
                  <div
                    key={index}
                    className="canvas-cell"
                    style={{ background: design.colors[index] ?? '#fbf6ec', color: '#3b3128' }}
                    onPointerEnter={() => painted && paint(index)}
                    onPointerDown={() => paint(index)}
                    title={SYMBOL_LABEL[cell]}
                    role="button"
                    tabIndex={-1}
                  >
                    {cell !== 'blank' ? (
                      <StitchSymbol code={cell === 'inc' ? 'inc' : cell === 'dec' ? 'dec' : cell} size={cellSize * 0.8} />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
              Click or drag to paint. Each row with stitches becomes one written row.
            </p>
          </div>

          <div className="card">
            <div className="card-title"><h3>Written instructions</h3></div>
            {verified.generated.rows.length === 0 ? (
              <p className="small muted">Paint some stitches to see the pattern.</p>
            ) : (
              <>
                <div className="row" style={{ marginBottom: 10 }}>
                  <Chip tone={summary.errors > 0 ? 'rose' : 'sage'}>
                    {summary.errors > 0 ? `${summary.errors} count errors` : 'counts verified'}
                  </Chip>
                  <Chip outline>{verified.generated.rows.length} rows</Chip>
                  <span className="spacer" />
                  <button
                    className="btn sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(verified.generated.text);
                        toast.show('Instructions copied');
                      } catch {
                        toast.show('Clipboard unavailable');
                      }
                    }}
                  >
                    Copy
                  </button>
                  <button
                    className="btn primary sm"
                    onClick={() => {
                      saveCanvas(design);
                      toast.show('Design saved');
                    }}
                  >
                    Save design
                  </button>
                </div>
                <div className="steps">
                  {verified.generated.rows.map((row) => (
                    <div className="step" key={row.label}>
                      <div className="tick" aria-hidden="true" />
                      <div>
                        <div className="label">{row.label}</div>
                        <div className="instruction">{row.instruction}</div>
                      </div>
                      <div className="counts">
                        <span className="primary-count">{row.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title"><h3>Stitch palette</h3></div>
            <div className="palette" style={{ marginBottom: 12 }}>
              {PAINTABLE.map((symbol) => (
                <button
                  key={symbol}
                  className={tool === symbol ? 'active' : ''}
                  onClick={() => setTool(symbol)}
                  title={SYMBOL_LABEL[symbol]}
                  aria-label={SYMBOL_LABEL[symbol]}
                >
                  {symbol === 'blank' ? <span style={{ color: 'var(--ink-faint)' }}>✕</span> : <StitchSymbol code={symbol} size={26} />}
                </button>
              ))}
            </div>
            <div className="tiny faint">
              Selected: <strong>{SYMBOL_LABEL[tool]}</strong>
              {tool !== 'blank' && CANVAS_STITCHES.includes(tool) && findStitch(tool) && ` — ${findStitch(tool)!.name}`}
            </div>
            <div className="divider" />
            <h4 style={{ marginBottom: 8 }}>Colour</h4>
            <div className="palette">
              {design.palette.map((swatch) => (
                <button
                  key={swatch}
                  className={color === swatch ? 'active' : ''}
                  onClick={() => setColor(swatch)}
                  style={{ background: swatch }}
                  aria-label={`Colour ${swatch}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                style={{ width: 42, height: 42, padding: 0, border: 'none', borderRadius: 10, background: 'none' }}
                aria-label="Custom colour"
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title"><h3>Grid</h3></div>
            <div className="row" style={{ gap: 10, marginBottom: 12 }}>
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label htmlFor="w">Width</label>
                <input
                  id="w"
                  type="number"
                  min={2}
                  max={40}
                  value={design.width}
                  onChange={(event) => resize(Math.max(2, Math.min(40, Number(event.target.value))), design.height)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label htmlFor="h">Height</label>
                <input
                  id="h"
                  type="number"
                  min={2}
                  max={40}
                  value={design.height}
                  onChange={(event) => resize(design.width, Math.max(2, Math.min(40, Number(event.target.value))))}
                />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm" onClick={clear}>Clear all</button>
              <button className="btn sm" onClick={() => {
                setDesign(emptyDesign(12, 10));
                toast.show('New blank design');
              }}>
                New design
              </button>
            </div>
            <div className="divider" />
            <label className="tiny faint">Fill a row</label>
            <select
              onChange={(event) => {
                if (event.target.value !== '') fillRow(Number(event.target.value));
                event.target.value = '';
              }}
              defaultValue=""
              style={{ marginTop: 5 }}
            >
              <option value="">Choose a row…</option>
              {Array.from({ length: design.height }, (_, index) => (
                <option key={index} value={index}>Row {index + 1}</option>
              ))}
            </select>
          </div>

          <div className="card">
            <div className="card-title"><h3>Send it somewhere</h3></div>
            <div className="stack" style={{ gap: 8 }}>
              <button
                className="btn block"
                disabled={verified.generated.rows.length === 0}
                onClick={() => {
                  saveCanvas(design);
                  navigate('/converter');
                }}
              >
                Open in converter
              </button>
              <button
                className="btn block"
                disabled={verified.generated.rows.length === 0}
                onClick={() => {
                  const id = uid();
                  saveCanvas(design);
                  addCustomPattern({
                    id,
                    title: design.name || 'Canvas design',
                    craft: 'crochet',
                    rawText: verified.generated.text,
                    parsed: verified.parsed,
                    source: 'canvas',
                    createdAt: Date.now(),
                  });
                  toast.show('Saved to your patterns');
                  navigate(`/pattern/${id}`);
                }}
              >
                Save as a pattern
              </button>
            </div>
          </div>

          {state.canvases.length > 0 && (
            <div className="card">
              <div className="card-title">
                <h3>Saved designs</h3>
                <span className="meta">{state.canvases.length}</span>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                {state.canvases.map((saved) => (
                  <div className="row" key={saved.id} style={{ gap: 8 }}>
                    <button className="btn ghost sm" style={{ flex: 1, justifyContent: 'flex-start' }} onClick={() => load(saved)}>
                      {saved.name} <span className="faint tiny">{saved.width}×{saved.height}</span>
                    </button>
                    <button
                      className="btn ghost sm"
                      onClick={() => deleteCanvas(saved.id)}
                      aria-label={`Delete ${saved.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
