import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../../shared/types.ts';
import { formatDuration } from '../../domain/checkerSummary.ts';
import { useStore } from '../store.tsx';
import { navigate, useRoute } from '../lib/router.ts';
import { StepRow } from '../components/PatternBits.tsx';
import { Chip, Modal, useToast } from '../components/ui.tsx';
import { useSpeech } from '../lib/speech.ts';

export function ProjectsPage() {
  const { parts, query } = useRoute();
  const { state } = useStore();
  const toast = useToast();
  const selectedId = parts[1] ?? query.get('project') ?? null;
  const project = selectedId ? state.projects.find((p) => p.id === selectedId) : undefined;

  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRows, setNewRows] = useState(20);

  const { startProject } = useStore();

  if (project) return <ProjectDetail project={project} />;

  const active = state.projects.filter((p) => p.status === 'wip');
  const finished = state.projects.filter((p) => p.status === 'done');
  const frogged = state.projects.filter((p) => p.status === 'frogged');

  const create = () => {
    const title = newTitle.trim() || 'Untitled project';
    const total = Math.max(1, Math.min(500, Math.round(newRows)));
    const steps = Array.from({ length: total }, (_, index) => ({
      index,
      label: `Row ${index + 1}`,
      kind: 'row' as const,
      instruction: `Row ${index + 1} - free-form rows, count as you go`,
      computedCount: undefined as unknown as number,
    }));
    const created = startProject({ title, craft: 'crochet', steps });
    setShowNew(false);
    setNewTitle('');
    setNewRows(20);
    toast.show('Project created');
    navigate(`/projects/${created.id}`);
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Projects</div>
        <h1>What is on your hook?</h1>
        <p className="lead">
          Every project keeps its own row counter, repeat counter and making time. Everything is saved
          to this device the moment you tap, so closing the tab loses nothing.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={() => setShowNew(true)}>New project</button>
          <button className="btn" onClick={() => navigate('/library')}>Start from a pattern</button>
        </div>
      </div>

      {state.projects.length === 0 && (
        <div className="empty">
          <div className="big">🧶</div>
          <h3>No projects yet</h3>
          <p className="small">Start from a pattern in the library, or create a free-form counter.</p>
          <button className="btn primary" onClick={() => setShowNew(true)}>New counter</button>
        </div>
      )}

      {active.length > 0 && (
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section-head"><h2>In progress</h2></div>
          <div className="grid grid-3">
            {active.map((item) => <ProjectCard key={item.id} project={item} />)}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Finished</h2><span className="chip sage">{finished.length}</span></div>
          <div className="grid grid-3">
            {finished.map((item) => <ProjectCard key={item.id} project={item} />)}
          </div>
        </section>
      )}

      {frogged.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Frogged</h2></div>
          <div className="grid grid-3">
            {frogged.map((item) => <ProjectCard key={item.id} project={item} />)}
          </div>
        </section>
      )}

      {showNew && (
        <Modal
          title="New project counter"
          onClose={() => setShowNew(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn primary" onClick={create}>Create</button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="project-title">Project name</label>
            <input
              id="project-title"
              type="text"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="e.g. Grey cardi sleeve"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="project-rows">How many rows do you expect?</label>
            <input
              id="project-rows"
              type="number"
              min={1}
              max={500}
              value={newRows}
              onChange={(event) => setNewRows(Number(event.target.value))}
            />
            <span className="help">You can add more rows later. Free-form projects just count rows.</span>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const total = project.steps.filter((s) => s.kind === 'row' || s.kind === 'round').length;
  const done = project.counts.completedSteps.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <button
      className="card"
      style={{ textAlign: 'left', cursor: 'pointer' }}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="row-tight" style={{ marginBottom: 6 }}>
        <Chip tone={project.status === 'done' ? 'sage' : project.status === 'frogged' ? 'rose' : 'mustard'}>
          {project.status === 'wip' ? 'in progress' : project.status}
        </Chip>
        <span className="spacer" />
        <span className="tiny faint">{formatDuration(project.elapsedSeconds)}</span>
      </div>
      <h4 style={{ margin: '0 0 8px', fontFamily: 'var(--font)' }}>{project.title}</h4>
      <div className="meter"><i style={{ width: `${percent}%` }} /></div>
      <div className="row-tight" style={{ marginTop: 6 }}>
        <span className="tiny faint">{done}/{total} rows</span>
        <span className="spacer" />
        <span className="tiny faint">{percent}%</span>
      </div>
    </button>
  );
}

/**
 * Hands-free reading: reads the current row aloud and lets the maker advance
 * without touching the screen beyond one large target.
 */
function SpeakBar({
  steps,
  currentIndex,
}: {
  steps: Array<{ label: string; text: string }>;
  currentIndex: number;
}) {
  const speech = useSpeech();
  const [index, setIndex] = useState(Math.max(0, currentIndex));

  if (!speech.supported || steps.length === 0) return null;
  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;

  return (
    <div className="speak-bar" style={{ marginBottom: 12 }}>
      <button
        className="btn sm dark"
        onClick={() => speech.speak(`${step.label}. ${step.text}`, index)}
      >
        {speech.speaking ? '⏸ Stop' : '▶ Read row'}
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="label">{step.label}</div>
        <div className="tiny" style={{ color: '#26526a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {step.text}
        </div>
      </div>
      <button
        className="btn ghost sm"
        onClick={() => {
          const next = Math.max(0, index - 1);
          setIndex(next);
          const target = steps[next];
          if (target) speech.speak(`${target.label}. ${target.text}`, next);
        }}
        aria-label="Previous row"
      >
        ‹
      </button>
      <button
        className="btn ghost sm"
        onClick={() => {
          const next = Math.min(steps.length - 1, index + 1);
          setIndex(next);
          const target = steps[next];
          if (target) speech.speak(`${target.label}. ${target.text}`, next);
        }}
        aria-label="Next row"
      >
        ›
      </button>
      <label className="tiny" style={{ color: '#26526a' }}>
        speed
        <input
          type="range"
          min={0.5}
          max={1.4}
          step={0.1}
          value={speech.rate}
          onChange={(event) => speech.setRate(Number(event.target.value))}
          aria-label="Speech rate"
        />
      </label>
    </div>
  );
}

function ProjectDetail({ project }: { project: Project }) {
  const { completeStep, updateProject, deleteProject, addElapsed } = useStore();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<number | null>(null);

  const rows = project.steps.filter((s) => s.kind === 'row' || s.kind === 'round');
  const done = project.counts.completedSteps.length;
  const nextStep = rows.find((step) => !project.counts.completedSteps.includes(step.index));
  const percent = rows.length > 0 ? Math.round((done / rows.length) * 100) : 0;

  // Making-time tracker: one tick per second while running.
  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => addElapsed(project.id, 1), 1000);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [running, addElapsed, project.id]);

  const setCounts = (patch: Partial<Project['counts']>) => {
    updateProject(project.id, { counts: { ...project.counts, ...patch } });
  };

  const markNext = () => {
    if (!nextStep) {
      toast.show('Every row is already ticked');
      return;
    }
    completeStep(project.id, nextStep.index, rows.length);
  };

  const undo = () => {
    const last = [...project.counts.completedSteps].sort((a, b) => b - a)[0];
    if (last === undefined) return;
    completeStep(project.id, last, rows.length);
  };

  const repeatTarget = useMemo(() => nextStep?.repeat ?? null, [nextStep]);

  return (
    <div>
      <button className="btn ghost sm" onClick={() => navigate('/projects')} style={{ marginBottom: 12 }}>
        ← All projects
      </button>

      <div className="page-head">
        <div className="row-tight" style={{ marginBottom: 8 }}>
          <Chip tone={project.status === 'done' ? 'sage' : 'mustard'}>
            {project.status === 'wip' ? 'in progress' : project.status}
          </Chip>
          <Chip outline>{project.craft}</Chip>
          {project.hook && <Chip outline>hook {project.hook}</Chip>}
        </div>
        <h1 style={{ marginBottom: 4 }}>{project.title}</h1>
        <p className="lead">
          {done} of {rows.length} rows complete · {formatDuration(project.elapsedSeconds)} of making time
        </p>
        <div className="meter" style={{ maxWidth: 420, marginTop: 12 }}>
          <i style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>Row counter</h3>
              <span className="meta">{running ? 'timer running' : 'timer paused'}</span>
            </div>
            <div className="counter-display">
              <div className="value">{project.counts.stitchCount}</div>
              <div className="caption">stitches in this row</div>
            </div>
            <div className="counter-pad" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setCounts({ stitchCount: project.counts.stitchCount + 1 })}>
                + 1 stitch
              </button>
              <button className="btn" onClick={() => setCounts({ stitchCount: Math.max(0, project.counts.stitchCount - 1) })}>
                − 1 stitch
              </button>
              <button className="btn" onClick={() => setCounts({ repeatCount: project.counts.repeatCount + 1 })}>
                Repeat + 1
              </button>
              <button className="btn" onClick={() => setCounts({ stitchCount: 0, repeatCount: 0 })}>
                Reset row
              </button>
            </div>

            <div className="divider" />

            <div className="row" style={{ gap: 10 }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={markNext}>
                Complete {nextStep?.label ?? 'all rows'}
              </button>
              <button className="btn" onClick={undo} disabled={done === 0}>Undo</button>
            </div>
            <p className="tiny faint" style={{ marginTop: 8, marginBottom: 0 }}>
              {repeatTarget
                ? `Next row is a ${repeatTarget.times}x repeat of a ${repeatTarget.groupMade}-stitch group.`
                : nextStep
                  ? `${nextStep.label}: ${nextStep.instruction.slice(0, 90)}${nextStep.instruction.length > 90 ? '…' : ''}`
                  : 'All rows are complete - congratulations.'}
            </p>

            <div className="divider" />

            <div className="row" style={{ gap: 10 }}>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.3rem' }}>{project.counts.repeatCount}</span>
                <span className="label">repeats this row</span>
              </div>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.3rem' }}>{formatDuration(project.elapsedSeconds)}</span>
                <span className="label">making time</span>
              </div>
              <span className="spacer" />
              <button className={`btn sm ${running ? 'dark' : ''}`} onClick={() => setRunning((value) => !value)}>
                {running ? '⏸ Pause timer' : '▶ Start timer'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Rows</h3>
              <span className="meta">{done} done</span>
            </div>
            <SpeakBar
              steps={project.steps.map((step) => ({ label: step.label, text: step.instruction }))}
              currentIndex={
                nextStep ? project.steps.findIndex((step) => step.index === nextStep.index) : 0
              }
            />
            <div className="steps">
              {project.steps.slice(0, 60).map((step) => (
                <StepRow
                  key={step.index}
                  step={step}
                  done={project.counts.completedSteps.includes(step.index)}
                  onToggle={() => completeStep(project.id, step.index, rows.length)}
                />
              ))}
            </div>
            {project.steps.length > 60 && (
              <p className="tiny faint" style={{ marginTop: 10 }}>Showing the first 60 rows.</p>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title"><h3>Details</h3></div>
            <div className="field">
              <label htmlFor="p-yarn">Yarn</label>
              <input
                id="p-yarn"
                type="text"
                value={project.yarn ?? ''}
                placeholder="e.g. Stylecraft Special DK, silver"
                onChange={(event) => updateProject(project.id, { yarn: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="p-hook">Hook / needle</label>
              <input
                id="p-hook"
                type="text"
                value={project.hook ?? ''}
                placeholder="e.g. 4.0 mm"
                onChange={(event) => updateProject(project.id, { hook: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="p-status">Status</label>
              <select
                id="p-status"
                value={project.status}
                onChange={(event) => updateProject(project.id, { status: event.target.value as Project['status'] })}
              >
                <option value="wip">In progress</option>
                <option value="done">Finished</option>
                <option value="frogged">Frogged</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="p-notes">Notes</label>
              <textarea
                id="p-notes"
                className="prose"
                value={project.notes}
                placeholder="Hook changes, modifications, where you left the hook…"
                onChange={(event) => updateProject(project.id, { notes: event.target.value })}
                style={{ minHeight: 100 }}
              />
            </div>
          </div>

          {project.patternId && (
            <div className="card">
              <div className="card-title"><h3>Pattern</h3></div>
              <button className="btn block" onClick={() => navigate(`/pattern/${project.patternId}`)}>
                Open the pattern
              </button>
            </div>
          )}

          <div className="card">
            <div className="card-title"><h3>Danger zone</h3></div>
            <button className="btn danger block" onClick={() => setConfirmDelete(true)}>
              Delete this project
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <Modal
          title="Delete this project?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
              <button
                className="btn danger"
                onClick={() => {
                  deleteProject(project.id);
                  navigate('/projects');
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <p className="small">
            The project, its row ticks and its making time will be removed from this device. This cannot
            be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
