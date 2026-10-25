import { useRef, useState } from 'react';
import type { StitchAnalysis } from '../../shared/types.ts';
import { analyzeOffline, prepareCanvasImage } from '../../domain/stitchAnalyzer.ts';
import { findStitch } from '../../domain/stitches.ts';
import { analysePhotoWithAi, aiReady } from '../lib/ai.ts';
import { useStore, uid } from '../store.tsx';
import { navigate } from '../lib/router.ts';
import { Chip, useToast } from '../components/ui.tsx';
import { StitchSymbol } from '../components/StitchSymbol.tsx';

export function StitchIdPage() {
  const { state, saveStitchAnalysis, deleteStitchAnalysis } = useStore();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<StitchAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ai = state.settings.ai;
  const hasAi = aiReady(ai);

  const readFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.show('Please choose an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(String(reader.result));
      setAnalysis(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const runOffline = async () => {
    if (!imageUrl) return;
    setBusy(true);
    setError(null);
    try {
      const image = new Image();
      image.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not read that image'));
      });
      const gray = prepareCanvasImage(image, 320);
      setAnalysis(analyzeOffline(gray));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  };

  const runAi = async () => {
    if (!imageUrl) return;
    setBusy(true);
    setError(null);
    try {
      const result = await analysePhotoWithAi({ dataUrl: imageUrl, settings: ai });
      setAnalysis(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The provider call failed');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!analysis || !imageUrl) return;
    saveStitchAnalysis({
      ...analysis,
      id: uid(),
      createdAt: Date.now(),
      thumbnail: imageUrl.length > 400_000 ? imageUrl.slice(0, 400_000) : imageUrl,
    });
    toast.show('Saved to your stitch gallery');
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Identify a stitch</div>
        <h1>What stitch is this?</h1>
        <p className="lead">
          Photograph a swatch, a jumper in a shop, or a blanket you inherited. The analyser measures the
          fabric texture - edge density, edge orientation, row and stitch spacing - and ranks the
          stitches whose construction matches.
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>Photo</h3>
              <span className="meta">get close enough to see single stitches</span>
            </div>

            {imageUrl ? (
              <div className="stack">
                <div className="photo-frame">
                  <img src={imageUrl} alt="The fabric being analysed" />
                </div>
                <div className="row">
                  <button className="btn primary" onClick={runOffline} disabled={busy}>
                    {busy ? 'Analysing…' : 'Analyse texture'}
                  </button>
                  {hasAi && (
                    <button className="btn dark" onClick={runAi} disabled={busy}>
                      Ask {ai.provider}
                    </button>
                  )}
                  <button className="btn ghost" onClick={() => inputRef.current?.click()}>
                    Change photo
                  </button>
                  <span className="spacer" />
                  <button
                    className="btn ghost sm"
                    onClick={() => {
                      setImageUrl(null);
                      setAnalysis(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
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
                <div style={{ fontSize: '2.2rem' }}>📷</div>
                <h3 style={{ margin: '10px 0 4px' }}>Add a photo of the fabric</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  Drop an image here, or tap to choose one. Nothing leaves your device unless you
                  explicitly ask a configured AI provider.
                </p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => readFile(event.target.files?.[0])}
              style={{ display: 'none' }}
            />

            {error && <div className="callout bad" style={{ marginTop: 12 }}>{error}</div>}
            {!hasAi && (
              <div className="callout info" style={{ marginTop: 12 }}>
                Running fully offline. Add a provider key in Settings for a second opinion from a vision
                model.
              </div>
            )}
          </div>

          {analysis && (
            <div className="card">
              <div className="card-title">
                <h3>Candidates</h3>
                <Chip tone={analysis.source === 'ai' ? 'sky' : 'sage'}>
                  {analysis.source === 'ai' ? `via ${analysis.provider}` : 'measured offline'}
                </Chip>
              </div>
              {analysis.guesses.length === 0 ? (
                <p className="small muted">No stitch matched. Try a tighter crop in even light.</p>
              ) : (
                analysis.guesses.map((guess, index) => {
                  const stitch = findStitch(guess.code);
                  return (
                    <div className={`guess ${index === 0 ? 'top' : ''}`} key={guess.code}>
                      <span className="rank">{index + 1}</span>
                      <div style={{ color: 'var(--ink-soft)' }}>
                        <StitchSymbol code={guess.code} size={30} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="name">
                          {guess.name}
                          {stitch && <span className="faint small" style={{ fontWeight: 400 }}> · {stitch.description.slice(0, 60)}…</span>}
                        </div>
                        <div className="why">{guess.reason}</div>
                        <div className="meter" style={{ marginTop: 5 }}>
                          <i style={{ width: `${Math.round(guess.confidence * 100)}%` }} />
                        </div>
                      </div>
                      <div className="tiny faint" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(guess.confidence * 100)}%
                      </div>
                    </div>
                  );
                })
              )}
              <div className="callout" style={{ marginTop: 14 }}>{analysis.note}</div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn" onClick={save}>Save to gallery</button>
                {analysis.guesses[0] && (
                  <button className="btn ghost" onClick={() => navigate('/canvas')}>
                    Make a design with {analysis.guesses[0].name}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          {analysis && (
            <div className="card">
              <div className="card-title"><h3>What was measured</h3></div>
              <table className="table">
                <tbody>
                  {analysis.features.map((feature, index) => (
                    <tr key={index}>
                      <td className="faint">{feature.label}</td>
                      <td className="num">{feature.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
                These are measurements of your photo, not of the yarn. Lighting, washing and hook size all
                shift them, which is why the result is a ranking rather than an answer.
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-title"><h3>Stitch gallery</h3></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {['sc', 'hdc', 'dc', 'tr', 'slst', 'bobble', 'shell', 'k', 'p'].map((code) => {
                const stitch = findStitch(code);
                return (
                  <div key={code} style={{ padding: 10, border: '1px solid var(--line)', borderRadius: 10 }}>
                    <StitchSymbol code={code} size={28} />
                    <div className="small" style={{ fontWeight: 600, marginTop: 4 }}>{stitch?.name}</div>
                    <div className="tiny faint">{stitch?.texture}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {state.stitchAnalyses.length > 0 && (
            <div className="card">
              <div className="card-title">
                <h3>Your gallery</h3>
                <span className="meta">{state.stitchAnalyses.length}</span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {state.stitchAnalyses.map((item) => (
                  <div key={item.id} style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                    <img src={item.thumbnail} alt="" style={{ width: '100%', height: 70, objectFit: 'cover' }} />
                    <div style={{ padding: 6 }}>
                      <div className="tiny" style={{ fontWeight: 600 }}>
                        {item.guesses[0]?.name ?? 'No match'}
                      </div>
                      <div className="row-tight" style={{ justifyContent: 'space-between' }}>
                        <span className="tiny faint">{Math.round((item.guesses[0]?.confidence ?? 0) * 100)}%</span>
                        <button
                          className="btn ghost sm"
                          style={{ padding: '0 4px', fontSize: '0.7rem' }}
                          onClick={() => deleteStitchAnalysis(item.id)}
                          aria-label="Delete analysis"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
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
