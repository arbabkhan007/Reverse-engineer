import { useMemo, useRef, useState } from 'react';
import type { Rgb } from '../../domain/imageChart.ts';
import { colorCounts, imageToChart, rgbToHex } from '../../domain/imageChart.ts';
import { parsePattern } from '../../domain/patternParser.ts';
import { estimateYarn } from '../../domain/patternGenerator.ts';
import { useStore, uid } from '../store.tsx';
import { navigate } from '../lib/router.ts';
import { Chip, useToast } from '../components/ui.tsx';

interface Loaded {
  pixels: Rgb[];
  width: number;
  height: number;
  name: string;
}

export function ImageChartPage() {
  const { addCustomPattern } = useStore();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [gridWidth, setGridWidth] = useState(24);
  const [maxColors, setMaxColors] = useState(4);
  const [title, setTitle] = useState('My chart');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const gridHeight = useMemo(() => {
    if (!loaded) return 0;
    return Math.max(1, Math.round((gridWidth * loaded.height) / loaded.width));
  }, [loaded, gridWidth]);

  const chart = useMemo(() => {
    if (!loaded) return null;
    try {
      return imageToChart(loaded.pixels, loaded.width, loaded.height, {
        width: gridWidth,
        height: gridHeight,
        maxColors,
        title,
        stitch: 'sc',
      });
    } catch {
      return null;
    }
  }, [loaded, gridWidth, gridHeight, maxColors, title]);

  const yarn = useMemo(() => {
    if (!chart) return null;
    return estimateYarn([{ instruction: 'sc in each st across' }], {
      stitches: chart.indices.length,
    });
  }, [chart]);

  const readFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.show('Please choose an image file');
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        try {
          // Cap the source resolution: the chart never needs more than a few
          // hundred pixels, and reading a 12 MP photo would stall the tab.
          const maxSide = 480;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas unavailable');
          context.drawImage(image, 0, 0, width, height);
          const data = context.getImageData(0, 0, width, height).data;
          const pixels: Rgb[] = [];
          for (let index = 0; index < width * height; index += 1) {
            const alpha = data[index * 4 + 3] ?? 255;
            // Transparent pixels become the page colour so they read as blank.
            if (alpha < 16) {
              pixels.push({ r: 251, g: 246, b: 236 });
              continue;
            }
            pixels.push({
              r: data[index * 4] ?? 0,
              g: data[index * 4 + 1] ?? 0,
              b: data[index * 4 + 2] ?? 0,
            });
          }
          setLoaded({ pixels, width, height, name: file.name });
          setTitle(file.name.replace(/\.[a-z0-9]+$/i, '') || 'My chart');
        } catch (error) {
          toast.show(error instanceof Error ? error.message : 'Could not read that image');
        } finally {
          setBusy(false);
        }
      };
      image.onerror = () => {
        setBusy(false);
        toast.show('That image could not be opened');
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!chart) return;
    const parsed = parsePattern(chart.text, { title, craft: 'crochet' });
    const id = uid();
    addCustomPattern({
      id,
      title: `${title} (chart)`,
      craft: 'crochet',
      rawText: chart.text,
      parsed,
      source: 'canvas',
      createdAt: Date.now(),
    });
    toast.show('Chart saved as a pattern');
    navigate(`/pattern/${id}`);
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Image chart</div>
        <h1>Turn a picture into a chart</h1>
        <p className="lead">
          Upload an image and get a stitch chart with a reduced colour palette and written rows. The
          palette is built from the colours actually in your image, and every written row's numbers add
          up to the chart width.
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>Image</h3>
              {loaded && <span className="meta">{loaded.width} × {loaded.height} px</span>}
            </div>
            {!loaded ? (
              <div
                className={`dropzone ${dragging ? 'drag' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  readFile(event.dataTransfer.files[0]);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
                }}
              >
                <div style={{ fontSize: '2rem' }}>🖼</div>
                <h3 style={{ margin: '10px 0 4px' }}>Drop an image here</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  A logo, a silhouette or a simple illustration works best. Photographs turn into
                  impressionistic charts rather than recognisable pictures.
                </p>
              </div>
            ) : (
              <div className="row">
                <button className="btn sm" onClick={() => inputRef.current?.click()}>Change image</button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setLoaded(null);
                  }}
                >
                  Remove
                </button>
                <span className="spacer" />
                <span className="tiny faint">{loaded.name}</span>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(event) => readFile(event.target.files?.[0])}
              style={{ display: 'none' }}
            />
            {busy && <div className="callout info" style={{ marginTop: 10 }}>Reading the image…</div>}
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Chart</h3>
              {chart && <span className="meta">{gridWidth} × {gridHeight} stitches</span>}
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="gw">Width (stitches)</label>
                <input
                  id="gw"
                  type="number"
                  min={4}
                  max={80}
                  value={gridWidth}
                  onChange={(event) => setGridWidth(Math.max(4, Math.min(80, Number(event.target.value))))}
                />
                <span className="help">Height follows the image's proportions: {gridHeight} rows.</span>
              </div>
              <div className="field">
                <label htmlFor="mc">Colours</label>
                <input
                  id="mc"
                  type="number"
                  min={2}
                  max={12}
                  value={maxColors}
                  onChange={(event) => setMaxColors(Math.max(2, Math.min(12, Number(event.target.value))))}
                />
                <span className="help">Fewer colours means simpler colourwork.</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="ct">Chart name</label>
              <input id="ct" type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            {chart ? (
              <>
                <div style={{ overflow: 'auto', padding: 4 }}>
                  <div
                    className="canvas-grid"
                    style={{
                      gridTemplateColumns: `repeat(${gridWidth}, var(--cell))`,
                      ['--cell' as string]: `${Math.max(10, Math.min(26, Math.floor(420 / gridWidth)))}px`,
                    }}
                  >
                    {chart.indices.map((colorIndex, index) => (
                      <div
                        key={index}
                        className="canvas-cell"
                        style={{ background: rgbToHex(chart.palette[colorIndex] ?? { r: 0, g: 0, b: 0 }) }}
                        title={`Row ${Math.floor(index / gridWidth) + 1}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 12, gap: 8 }}>
                  {chart.legend.map((entry) => (
                    <span key={entry.label} className="row-tight" style={{ gap: 4 }}>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: entry.hex,
                          border: '1px solid var(--line-strong)',
                          display: 'inline-block',
                        }}
                      />
                      <span className="small">{entry.label}</span>
                      <span className="tiny faint mono">{entry.hex}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="small muted">Load an image to see the chart.</p>
            )}
          </div>

          {chart && (
            <div className="card">
              <div className="card-title">
                <h3>Written rows</h3>
                <span className="meta">{chart.rows.length} rows</span>
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                <button
                  className="btn sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(chart.text);
                      toast.show('Chart instructions copied');
                    } catch {
                      toast.show('Clipboard unavailable');
                    }
                  }}
                >
                  Copy all
                </button>
                <button className="btn primary sm" onClick={save}>Save as a pattern</button>
              </div>
              <div className="steps">
                {chart.rows.slice(0, 40).map((row) => (
                  <div className="step" key={row.row}>
                    <div className="tick" aria-hidden="true" />
                    <div>
                      <div className="label">Row {row.row}</div>
                      <div className="instruction">{row.text}</div>
                    </div>
                    <div className="counts">
                      <span className="primary-count">{row.total}</span>
                    </div>
                  </div>
                ))}
              </div>
              {chart.rows.length > 40 && (
                <p className="tiny faint" style={{ marginTop: 10 }}>
                  Showing the first 40 of {chart.rows.length} rows. All rows are included when you copy
                  or save.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="stack">
          {chart && (
            <>
              <div className="card">
                <div className="card-title"><h3>Palette</h3></div>
                <table className="table">
                  <thead>
                    <tr><th>Colour</th><th>Hex</th><th style={{ textAlign: 'right' }}>Stitches</th></tr>
                  </thead>
                  <tbody>
                    {chart.legend.map((entry, index) => {
                      const counts = colorCounts(chart.indices, chart.palette.length);
                      return (
                        <tr key={entry.label}>
                          <td>
                            <span className="row-tight" style={{ gap: 6 }}>
                              <span
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: 3,
                                  background: entry.hex,
                                  border: '1px solid var(--line-strong)',
                                  display: 'inline-block',
                                }}
                              />
                              {entry.label}
                            </span>
                          </td>
                          <td className="mono tiny">{entry.hex}</td>
                          <td className="num">{counts[index] ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-title"><h3>Estimate</h3></div>
                <div className="row" style={{ gap: 14 }}>
                  <div className="stat">
                    <span className="value" style={{ fontSize: '1.3rem' }}>{chart.indices.length}</span>
                    <span className="label">total stitches</span>
                  </div>
                  <div className="stat">
                    <span className="value" style={{ fontSize: '1.3rem' }}>{yarn?.metres ?? 0} m</span>
                    <span className="label">yarn</span>
                  </div>
                </div>
                <div className="callout" style={{ marginTop: 10 }}>
                  Colourwork uses more yarn than the stitch count suggests, because every colour change
                  carries a strand along the back. Add roughly 20% to the figure above.
                </div>
              </div>

              <div className="card">
                <div className="card-title"><h3>Before you start</h3></div>
                <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Graphgan charts are worked in single crochet, which keeps the squares square.</li>
                  <li>Each chart row is a pattern row; there is no turning chain inside a row.</li>
                  <li>Carry the unused colour loosely along the back or the fabric will pucker.</li>
                  <li>The chart is a rectangle; the image's aspect ratio decides the row count.</li>
                  <li>
                    <Chip tone="mustard">not a photo shortcut</Chip> This converts colours, not
                    stitches — it cannot tell you what stitch a photograph shows.
                  </li>
                </ul>
              </div>
            </>
          )}

          {!chart && (
            <div className="card">
              <div className="card-title"><h3>How this works</h3></div>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                <li>The image is area-averaged down to your chosen stitch width.</li>
                <li>A palette is seeded from the most common colours, then refined.</li>
                <li>Every stitch is assigned its nearest palette colour.</li>
                <li>Consecutive same-colour stitches become one run: “4 A, 6 B”.</li>
                <li>Row numbers always add up to the chart width.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
