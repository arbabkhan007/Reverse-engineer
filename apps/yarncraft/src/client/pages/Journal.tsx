import { useMemo, useRef, useState } from 'react';
import type { JournalRecord } from '../../shared/types.ts';
import {
  dataUrlBytes,
  groupByDay,
  journalBytes,
  measurementLabels,
  measurementTrend,
  PROJECT_PHOTO_BUDGET,
  sortEntries,
  trimToBudget,
} from '../../domain/journal.ts';
import { formatBytes, loadImageFile } from '../lib/images.ts';
import { useStore } from '../store.tsx';
import { useToast } from '../components/ui.tsx';
import { navigate } from '../lib/router.ts';

type ComposerKind = 'note' | 'photo' | 'measure' | 'milestone';

export function JournalPage() {
  const { state, addJournalEntry, deleteJournalEntry } = useStore();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');
  const [kind, setKind] = useState<ComposerKind>('note');
  const [text, setText] = useState('');
  const [label, setLabel] = useState('Length');
  const [pending, setPending] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const entries = useMemo<JournalRecord[]>(
    () => (projectId ? state.journal.filter((entry) => entry.projectId === projectId) : []),
    [state.journal, projectId],
  );

  const groups = useMemo(() => groupByDay(entries), [entries]);
  const bytes = useMemo(() => journalBytes(entries), [entries]);
  const labels = useMemo(() => measurementLabels(entries), [entries]);
  const trends = useMemo(
    () => labels.map((name) => ({ name, trend: measurementTrend(entries, name) })).filter((row) => row.trend),
    [labels, entries],
  );

  const overflow = bytes > PROJECT_PHOTO_BUDGET;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const loaded = await loadImageFile(file);
      setPending({ dataUrl: loaded.dataUrl, width: loaded.width, height: loaded.height });
      toast.show(`Photo ready: ${loaded.width}x${loaded.height}, ${formatBytes(loaded.bytes)}.`);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'That photo could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!projectId) {
      toast.show('Start a project first, then journal against it.');
      return;
    }
    if (kind !== 'photo' && !text.trim()) {
      toast.show('Write something first.');
      return;
    }
    if (kind === 'photo' && !pending) {
      toast.show('Choose a photo first.');
      return;
    }
    if (kind === 'measure' && !Number.isFinite(Number.parseFloat(text))) {
      toast.show('A measurement has to be a number, in cm.');
      return;
    }

    const next: Omit<JournalRecord, 'id'> = {
      projectId,
      at: new Date().toISOString(),
      kind,
      text:
        kind === 'photo'
          ? text.trim() || 'Progress photo'
          : kind === 'measure'
            ? String(Number.parseFloat(text))
            : text.trim(),
      label: kind === 'measure' ? label.trim() || 'Measure' : undefined,
      image: kind === 'photo' ? pending?.dataUrl : undefined,
      width: kind === 'photo' ? pending?.width : undefined,
      height: kind === 'photo' ? pending?.height : undefined,
    };

    /*
     * Work out what has to go *before* saving, so the quota is never hit. The
     * evictions are then really deleted: computing them and only reporting them
     * would leave the app over budget while claiming otherwise.
     */
    const candidate = [...entries, { ...next, id: 'pending' } as JournalRecord];
    const trimmed = trimToBudget(candidate);
    const droppedIds = trimmed.dropped.map((dropped) => dropped.id).filter((id) => id !== 'pending');
    for (const id of droppedIds) deleteJournalEntry(id);

    addJournalEntry(next);
    setText('');
    setPending(null);
    if (fileInput.current) fileInput.current.value = '';

    toast.show(
      droppedIds.length > 0
        ? `Saved. ${droppedIds.length} older photo${droppedIds.length === 1 ? '' : 's'} removed to stay inside the storage budget.`
        : 'Saved.',
    );
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Journal</div>
        <h1>What the project actually looked like</h1>
        <p className="lead">
          Notes, measurements and progress photos, filed against a project and grouped by day. Photos
          are downscaled before they are stored, and the oldest are dropped before the browser's quota
          is reached — the page tells you when that happens rather than losing an entry silently.
        </p>
      </div>

      {state.projects.length === 0 ? (
        <div className="empty">
          No projects yet. <button className="btn ghost sm" onClick={() => navigate('/projects')}>Start one</button>{' '}
          and the journal will have somewhere to file things.
        </div>
      ) : (
        <>
          <section className="card">
            <div className="section-head">
              <h2 className="card-title">New entry</h2>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {state.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="segmented" role="tablist" aria-label="Entry kind">
              {(['note', 'photo', 'measure', 'milestone'] as ComposerKind[]).map((option) => (
                <button
                  key={option}
                  role="tab"
                  aria-selected={kind === option}
                  className={kind === option ? 'active' : ''}
                  onClick={() => setKind(option)}
                >
                  {option === 'measure' ? 'Measurement' : option[0]!.toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>

            {kind === 'measure' ? (
              <div className="grid grid-2">
                <label className="field">
                  <span>What are you measuring?</span>
                  <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Sleeve length" />
                </label>
                <label className="field">
                  <span>Value in cm</span>
                  <input
                    type="number"
                    step="0.5"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="38"
                  />
                </label>
              </div>
            ) : (
              <label className="field">
                <span>{kind === 'photo' ? 'Caption (optional)' : kind === 'milestone' ? 'Milestone' : 'Note'}</span>
                <textarea
                  rows={3}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={
                    kind === 'milestone'
                      ? 'Finished the body, starting the sleeves'
                      : kind === 'photo'
                        ? 'Colour looks right in daylight'
                        : 'The tension loosened after row 12'
                  }
                />
              </label>
            )}

            {kind === 'photo' ? (
              <div className="dropzone">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  onChange={(event) => void pickPhoto(event.target.files?.[0])}
                />
                {busy ? <p className="small">Shrinking the photo…</p> : null}
                {pending ? (
                  <div className="photo-frame">
                    <img src={pending.dataUrl} alt="Pending progress photo" />
                    <p className="tiny faint">
                      {pending.width}x{pending.height} ·{' '}
                      {formatBytes(dataUrlBytes(pending.dataUrl))} once stored
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button className="btn" onClick={save} disabled={busy}>
              Save entry
            </button>
          </section>

          <section className="card">
            <div className="section-head">
              <h2 className="card-title">Timeline</h2>
              <div className="row-tight">
                <span className="chip">{entries.length} entries</span>
                <span className={overflow ? 'chip warn' : 'chip'}>
                  {formatBytes(bytes)} of photos
                </span>
              </div>
            </div>

            {overflow ? (
              <div className="callout warn">
                This project is over its photo budget. The next photo will evict the oldest ones.
              </div>
            ) : null}

            {trends.length ? (
              <div className="grid grid-3">
                {trends.map(({ name, trend }) => (
                  <div className="stat" key={name}>
                    <b>
                      {trend!.last} cm
                    </b>
                    <span>
                      {name} · {trend!.delta >= 0 ? '+' : ''}
                      {trend!.delta} cm over {trend!.count} measurements
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {groups.length === 0 ? (
              <div className="empty">Nothing filed yet.</div>
            ) : (
              groups.map((group) => (
                <div key={group.day} className="journal-group">
                  <h3 className="journal-day">{group.label}</h3>
                  {sortEntries(group.entries).map((entry) => (
                    <article key={entry.id} className={`journal-entry kind-${entry.kind}`}>
                      <div className="journal-meta">
                        <span className="chip">{entry.kind === 'measure' ? 'measurement' : entry.kind}</span>
                        <span className="tiny faint">
                          {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {entry.kind === 'measure' ? (
                        <p>
                          <b>{entry.label}</b>: {entry.text} cm
                        </p>
                      ) : (
                        <p>{entry.text}</p>
                      )}
                      {entry.image ? (
                        <img
                          className="journal-photo"
                          src={entry.image}
                          alt={entry.text || 'Progress photo'}
                          width={entry.width}
                          height={entry.height}
                          loading="lazy"
                        />
                      ) : null}
                      <button
                        className="btn ghost sm"
                        onClick={() => {
                          deleteJournalEntry(entry.id);
                          toast.show('Entry deleted.');
                        }}
                      >
                        Delete
                      </button>
                    </article>
                  ))}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
