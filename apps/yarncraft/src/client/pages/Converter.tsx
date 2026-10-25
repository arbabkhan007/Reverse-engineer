import { useMemo, useState } from 'react';
import { parsePattern } from '../../domain/patternParser.ts';
import { summarise } from '../../domain/checkerSummary.ts';
import { polishPatternText } from '../lib/ai.ts';
import { extractPdfText } from '../lib/pdf.ts';
import { useStore, uid } from '../store.tsx';
import { navigate } from '../lib/router.ts';
import { DiagnosticList, StepRow } from '../components/PatternBits.tsx';
import { Chip, useToast } from '../components/ui.tsx';

type Mode = 'pdf' | 'web' | 'paste';

export function ConverterPage() {
  const { state, addCustomPattern } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('pdf');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ pages: number; pagesWithText: number; emptyPages: number[] } | null>(null);
  const [url, setUrl] = useState('');
  const [useAi, setUseAi] = useState(state.settings.ai.provider !== 'offline');

  const parsed = useMemo(() => (text.trim() ? parsePattern(text) : null), [text]);
  const summary = useMemo(() => (parsed ? summarise(parsed) : null), [parsed]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.show('Please choose a PDF file');
      return;
    }
    setBusy(true);
    setStatus('Reading PDF…');
    try {
      const extraction = await extractPdfText(file, (done, total) => {
        setStatus(`Reading page ${done} of ${total}…`);
      });
      setPdfInfo({
        pages: extraction.pages,
        pagesWithText: extraction.pagesWithText,
        emptyPages: extraction.emptyPages,
      });
      if (!extraction.text.trim()) {
        setStatus(null);
        toast.show('That PDF has no selectable text - it is a scan. The photo stitch tool can help, or paste the text by hand.');
        setText('');
        return;
      }
      let next = extraction.text;
      if (useAi) {
        setStatus('Tidying the extracted text…');
        next = await polishPatternText(next, state.settings.ai);
      }
      setText(next);
      setStatus(null);
    } catch (error) {
      setStatus(null);
      toast.show(error instanceof Error ? error.message : 'Could not read that PDF');
    } finally {
      setBusy(false);
    }
  };

  const handleUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setStatus('Fetching the page…');
    try {
      const response = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = (await response.json()) as { text?: string; title?: string; error?: string; truncated?: boolean };
      if (!response.ok) throw new Error(payload.error ?? `Import failed (${response.status})`);
      let next = payload.text ?? '';
      if (useAi && next) {
        setStatus('Tidying the extracted text…');
        next = await polishPatternText(next, state.settings.ai);
      }
      setText(next);
      setStatus(null);
      if (payload.truncated) toast.show('Page was very long - only the first part was imported');
    } catch (error) {
      setStatus(null);
      toast.show(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!parsed) return;
    const id = uid();
    addCustomPattern({
      id,
      title: parsed.title,
      craft: parsed.craft,
      rawText: text,
      parsed,
      source: mode === 'pdf' ? 'pdf' : mode === 'web' ? 'web' : 'paste',
      ...(mode === 'web' && url ? { sourceRef: url } : {}),
      createdAt: Date.now(),
    });
    toast.show('Pattern saved - opening it now');
    navigate(`/pattern/${id}`);
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Pattern converter</div>
        <h1>Bring any pattern in</h1>
        <p className="lead">
          Turn a PDF, a pattern web page or a pile of pasted text into clean, countable steps. Page
          numbers, footers, adverts and copyright blocks are removed; every stated stitch count is
          checked as it comes in.
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              <div className="segmented">
                {(['pdf', 'web', 'paste'] as const).map((option) => (
                  <button key={option} className={mode === option ? 'active' : ''} onClick={() => setMode(option)}>
                    {option === 'pdf' ? 'PDF file' : option === 'web' ? 'Web link' : 'Paste text'}
                  </button>
                ))}
              </div>
              <span className="spacer" />
              {state.settings.ai.provider !== 'offline' && (
                <label className="check small">
                  <input type="checkbox" checked={useAi} onChange={(event) => setUseAi(event.target.checked)} />
                  Clean up with AI
                </label>
              )}
            </div>

            {mode === 'pdf' && (
              <div>
                <label className="dropzone" style={{ display: 'block' }}>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '1.9rem' }}>📄</div>
                  <h3 style={{ margin: '8px 0 4px' }}>Choose a pattern PDF</h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    Text is read in your browser - the file is never uploaded.
                  </p>
                </label>
                {pdfInfo && (
                  <div className="callout info" style={{ marginTop: 12 }}>
                    {pdfInfo.pages} pages read, {pdfInfo.pagesWithText} with text
                    {pdfInfo.emptyPages.length > 0 && ` · no text on page${pdfInfo.emptyPages.length > 1 ? 's' : ''} ${pdfInfo.emptyPages.join(', ')} (likely a scan)`}
                  </div>
                )}
              </div>
            )}

            {mode === 'web' && (
              <div>
                <div className="field">
                  <label htmlFor="url">Pattern page URL</label>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      id="url"
                      type="url"
                      placeholder="https://example.com/free-pattern"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleUrl();
                      }}
                    />
                    <button className="btn primary" onClick={handleUrl} disabled={busy || !url.trim()}>
                      {busy ? 'Working…' : 'Import'}
                    </button>
                  </div>
                  <span className="help">
                    Public http and https pages only. Private network addresses are refused.
                  </span>
                </div>
              </div>
            )}

            {mode === 'paste' && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="paste">Paste the pattern text</label>
                <textarea
                  id="paste"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  style={{ minHeight: 220 }}
                  placeholder="Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)…"
                />
              </div>
            )}

            {status && <div className="callout info" style={{ marginTop: 12 }}>{status}</div>}
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Imported steps</h3>
              <span className="meta">{parsed ? `${parsed.steps.length} steps` : 'nothing yet'}</span>
            </div>
            {!parsed ? (
              <div className="empty">
                <div className="big">⇄</div>
                <p className="small">Import a PDF, a link or some text to see the converted steps.</p>
              </div>
            ) : (
              <>
                <div className="row" style={{ marginBottom: 12 }}>
                  <Chip tone="terracotta">{parsed.craft}</Chip>
                  <Chip outline>{parsed.title}</Chip>
                  <span className="spacer" />
                  <button className="btn primary sm" onClick={save}>Save pattern</button>
                </div>
                <div className="steps">
                  {parsed.steps.slice(0, 16).map((step) => (
                    <StepRow
                      key={step.index}
                      step={step}
                      problems={parsed.diagnostics.filter((d) => d.stepIndex === step.index && d.severity === 'error')}
                    />
                  ))}
                </div>
                {parsed.steps.length > 16 && (
                  <p className="tiny faint" style={{ marginTop: 10 }}>
                    Showing the first 16 of {parsed.steps.length} steps.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title"><h3>Conversion report</h3></div>
            {!parsed || !summary ? (
              <p className="small muted">Waiting for input.</p>
            ) : (
              <>
                <table className="table">
                  <tbody>
                    <tr><td className="faint">Steps found</td><td className="num">{parsed.steps.length}</td></tr>
                    <tr><td className="faint">Counts verified</td><td className="num">{summary.checkedSteps}</td></tr>
                    <tr><td className="faint">Errors</td><td className="num">{summary.errors}</td></tr>
                    <tr><td className="faint">Warnings</td><td className="num">{summary.warnings}</td></tr>
                    <tr><td className="faint">Lines set aside</td><td className="num">{parsed.unparsedLines.length}</td></tr>
                    <tr><td className="faint">Total stitches</td><td className="num">{parsed.steps.reduce((sum, s) => sum + (s.computedCount ?? 0), 0).toLocaleString()}</td></tr>
                  </tbody>
                </table>
                {parsed.unparsedLines.length > 0 && (
                  <>
                    <div className="divider" />
                    <h4 style={{ marginBottom: 6 }}>Set aside</h4>
                    <p className="tiny faint" style={{ marginBottom: 8 }}>
                      Unlabelled prose, adverts and footers. Kept out of the step list.
                    </p>
                    <ul className="tiny muted" style={{ margin: 0, paddingLeft: 16, maxHeight: 160, overflow: 'auto' }}>
                      {parsed.unparsedLines.slice(0, 12).map((line, index) => (
                        <li key={index} style={{ marginBottom: 3 }}>{line.slice(0, 120)}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>

          {parsed && parsed.diagnostics.length > 0 && (
            <div className="card">
              <div className="card-title"><h3>Check results</h3></div>
              <DiagnosticList diagnostics={parsed.diagnostics} />
            </div>
          )}

          <div className="card">
            <div className="card-title"><h3>Raw extracted text</h3></div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              style={{ minHeight: 180 }}
              placeholder="The extracted text appears here so you can correct anything the converter missed."
            />
            <p className="tiny faint" style={{ marginTop: 8, marginBottom: 0 }}>
              Edit the text here and the steps update as you type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
