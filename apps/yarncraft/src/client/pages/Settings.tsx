import { useRef, useState } from 'react';
import type { AIProvider } from '../../shared/types.ts';
import { useStore } from '../store.tsx';
import { Chip, Modal, useToast } from '../components/ui.tsx';

const PROVIDERS: Array<{ value: AIProvider; label: string; help: string; model: string }> = [
  { value: 'offline', label: 'Offline only', help: 'No network calls at all. Texture analysis runs in your browser.', model: '' },
  { value: 'openai', label: 'OpenAI', help: 'Uses the chat completions API with image input.', model: 'gpt-4o-mini' },
  { value: 'anthropic', label: 'Anthropic', help: 'Uses the messages API with base64 image input.', model: 'claude-3-5-sonnet-latest' },
  { value: 'custom', label: 'OpenAI-compatible gateway', help: 'Point at your own base URL, such as a local or self-hosted gateway.', model: 'gpt-4o-mini' },
];

export function SettingsPage() {
  const { state, setSettings, exportData, importData, resetAll } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showKey, setShowKey] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const ai = state.settings.ai;
  const provider = PROVIDERS.find((entry) => entry.value === ai.provider) ?? PROVIDERS[0]!;

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yarncraft-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.show('Backup downloaded');
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const result = importData(text);
    toast.show(result.message);
  };

  const counts = {
    projects: state.projects.length,
    custom: state.customPatterns.length,
    canvases: state.canvases.length,
    analyses: state.stitchAnalyses.length,
    saved: state.savedPatterns.length,
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Settings</div>
        <h1>Your studio, your rules</h1>
        <p className="lead">
          Everything is stored on this device. AI providers are optional and off by default.
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title"><h3>AI provider</h3></div>
            <div className="segmented" style={{ marginBottom: 14 }}>
              {PROVIDERS.map((entry) => (
                <button
                  key={entry.value}
                  className={ai.provider === entry.value ? 'active' : ''}
                  onClick={() =>
                    setSettings({
                      ai: {
                        ...ai,
                        provider: entry.value,
                        model: ai.model || entry.model,
                      },
                    })
                  }
                >
                  {entry.value === 'offline' ? 'Offline' : entry.value === 'custom' ? 'Gateway' : entry.label}
                </button>
              ))}
            </div>
            <p className="small muted">{provider.help}</p>

            {ai.provider !== 'offline' && (
              <>
                <div className="field">
                  <label htmlFor="api-key">API key</label>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      id="api-key"
                      type={showKey ? 'text' : 'password'}
                      value={ai.apiKey}
                      onChange={(event) => setSettings({ ai: { ...ai, apiKey: event.target.value } })}
                      placeholder="sk-…"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button className="btn sm" onClick={() => setShowKey((value) => !value)}>
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <span className="help">
                    Stored only in this browser's local storage and sent directly to the provider. The
                    YarnCraft server never sees it.
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="model">Model</label>
                  <input
                    id="model"
                    type="text"
                    value={ai.model}
                    onChange={(event) => setSettings({ ai: { ...ai, model: event.target.value } })}
                    placeholder={provider.model}
                  />
                </div>
                {ai.provider === 'custom' && (
                  <div className="field">
                    <label htmlFor="base-url">Base URL</label>
                    <input
                      id="base-url"
                      type="url"
                      value={ai.baseUrl}
                      onChange={(event) => setSettings({ ai: { ...ai, baseUrl: event.target.value } })}
                      placeholder="https://your-gateway.example.com/v1"
                    />
                    <span className="help">Must be OpenAI-compatible. The path /chat/completions is appended.</span>
                  </div>
                )}
                <div className="callout">
                  Requests are made from your browser, so the provider must allow browser origins. Some
                  providers block this - if it fails, the offline analyser still works.
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title"><h3>Preferences</h3></div>
            <div className="field">
              <label htmlFor="designer">Your name (used on patterns you export)</label>
              <input
                id="designer"
                type="text"
                value={state.settings.designerName}
                onChange={(event) => setSettings({ designerName: event.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="field">
              <label htmlFor="units">Units</label>
              <select
                id="units"
                value={state.settings.units}
                onChange={(event) => setSettings({ units: event.target.value as 'imperial' | 'metric' })}
              >
                <option value="metric">Metric (cm, m)</option>
                <option value="imperial">Imperial (in, yd)</option>
              </select>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={state.settings.reduceMotion}
                onChange={(event) => setSettings({ reduceMotion: event.target.checked })}
              />
              Reduce motion
            </label>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title"><h3>Your data</h3></div>
            <table className="table">
              <tbody>
                <tr><td className="faint">Projects</td><td className="num">{counts.projects}</td></tr>
                <tr><td className="faint">Imported patterns</td><td className="num">{counts.custom}</td></tr>
                <tr><td className="faint">Saved library patterns</td><td className="num">{counts.saved}</td></tr>
                <tr><td className="faint">Canvas designs</td><td className="num">{counts.canvases}</td></tr>
                <tr><td className="faint">Stitch analyses</td><td className="num">{counts.analyses}</td></tr>
              </tbody>
            </table>
            <div className="divider" />
            <div className="stack" style={{ gap: 8 }}>
              <button className="btn block" onClick={doExport}>Download a backup</button>
              <button className="btn block" onClick={() => fileRef.current?.click()}>Restore from backup</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(event) => doImport(event.target.files?.[0])}
              />
            </div>
            <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
              A backup is a single JSON file containing everything on this device, including your AI key
              if you set one. Keep it private.
            </p>
          </div>

          <div className="card">
            <div className="card-title"><h3>About</h3></div>
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              <Chip tone="terracotta">YarnCraft Studio 1.0</Chip>
              <Chip outline>offline-first</Chip>
            </div>
            <p className="small muted">
              An original crochet and knitting companion: pattern library, stitch-maths checker, PDF and
              web converter, row counter, photo stitch identification and a pattern canvas. Built as a
              standalone module that does not touch the REA toolkit's source.
            </p>
          </div>

          <div className="card">
            <div className="card-title"><h3>Reset</h3></div>
            <p className="small muted">
              Removes every project, import, design and analysis from this device.
            </p>
            <button className="btn danger block" onClick={() => setConfirmReset(true)}>Delete all my data</button>
          </div>
        </div>
      </div>

      {confirmReset && (
        <Modal
          title="Delete everything?"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button
                className="btn danger"
                onClick={() => {
                  resetAll();
                  setConfirmReset(false);
                  toast.show('All local data cleared');
                }}
              >
                Delete everything
              </button>
            </>
          }
        >
          <p className="small">
            This clears projects, imported patterns, saved patterns, canvas designs, stitch analyses and
            course progress. Download a backup first if you might want any of it back.
          </p>
        </Modal>
      )}
    </div>
  );
}
