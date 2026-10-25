import { buildCatalog, weeklyPicks, COLLECTIONS } from '../../domain/catalog.ts';
import { COURSES } from '../../domain/courses.ts';
import { formatMinutes } from '../../domain/checkerSummary.ts';
import { useStore } from '../store.tsx';
import { navigate } from '../lib/router.ts';
import { PatternCard } from '../components/PatternBits.tsx';
import { Chip } from '../components/ui.tsx';
import { YarnBall } from '../components/StitchSymbol.tsx';

const TOOLS = [
  { href: '/checker', icon: '✓', title: 'Pattern Checker', text: 'Paste any pattern and every stated stitch count is verified row by row.' },
  { href: '/converter', icon: '⇄', title: 'PDF & Web Converter', text: 'Turn a PDF or a pattern web page into clean, trackable steps.' },
  { href: '/stitch-id', icon: '◎', title: 'Identify a Stitch', text: 'Photograph a swatch and compare its texture against every stitch.' },
  { href: '/canvas', icon: '▦', title: 'Pattern Canvas', text: 'Draw a grid design and get written instructions from it.' },
  { href: '/projects', icon: '▮', title: 'Row Counter', text: 'Track rows, repeats and time with automatic saving.' },
  { href: '/courses', icon: '★', title: 'Guided Courses', text: 'Five progressive courses from first chain to finished object.' },
];

export function HomePage() {
  const { state } = useStore();
  const catalog = buildCatalog();
  const picks = weeklyPicks();
  const tenMinute = catalog.filter((p) => p.minutes <= 15).slice(0, 4);
  const activeProjects = state.projects.filter((p) => p.status === 'wip').slice(0, 3);
  const totalRows = Object.values(state.activity).reduce((sum, n) => sum + n, 0);

  return (
    <div className="stack" style={{ gap: 0 }}>
      <section className="hero">
        <YarnBall size={280} className="yarn-art" />
        <div className="eyebrow" style={{ color: 'var(--mustard)', letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 700 }}>
          Crochet & knitting companion
        </div>
        <h1>Learn it, check it, make it.</h1>
        <p>
          {catalog.length}+ patterns with instructions you can trust, a row counter that remembers where
          you stopped, a checker that finds the counting mistakes before you do, and five courses that
          take you from your first chain to a finished object.
        </p>
        <div className="row">
          <button className="btn primary lg" onClick={() => navigate('/library')}>
            Browse patterns
          </button>
          <button className="btn lg" onClick={() => navigate('/courses')}>
            Start learning
          </button>
        </div>
        <div className="row" style={{ marginTop: 26, gap: 26 }}>
          <div className="stat">
            <span className="value" style={{ color: 'var(--cream)' }}>{catalog.length}</span>
            <span className="label" style={{ color: 'rgba(251,246,236,0.6)' }}>patterns</span>
          </div>
          <div className="stat">
            <span className="value" style={{ color: 'var(--cream)' }}>{COURSES.length}</span>
            <span className="label" style={{ color: 'rgba(251,246,236,0.6)' }}>courses</span>
          </div>
          <div className="stat">
            <span className="value" style={{ color: 'var(--cream)' }}>{state.projects.length}</span>
            <span className="label" style={{ color: 'rgba(251,246,236,0.6)' }}>your projects</span>
          </div>
        </div>
      </section>

      {activeProjects.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Pick up where you left off</h2>
            <a href="#/projects">All projects →</a>
          </div>
          <div className="grid grid-3">
            {activeProjects.map((project) => {
              const done = project.counts.completedSteps.length;
              const total = project.steps.filter((s) => s.kind === 'row' || s.kind === 'round').length;
              const percent = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <button
                  key={project.id}
                  className="card"
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => navigate(`/projects?project=${project.id}`)}
                >
                  <div className="row-tight" style={{ marginBottom: 6 }}>
                    <Chip tone="sage">{project.craft}</Chip>
                    <span className="spacer" />
                    <span className="tiny faint">{percent}%</span>
                  </div>
                  <h4 style={{ margin: '0 0 8px', fontFamily: 'var(--font)' }}>{project.title}</h4>
                  <div className="meter">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                  <div className="tiny faint" style={{ marginTop: 6 }}>
                    {done} of {total} rows done
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Fresh this week</h2>
          <a href="#/library">See the library →</a>
        </div>
        <div className="grid grid-3">
          {picks.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Ten minutes or less</h2>
          <span className="chip mustard">{tenMinute.length} quick wins</span>
        </div>
        <div className="grid grid-4">
          {tenMinute.map((pattern) => (
            <button
              key={pattern.id}
              className="card"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => navigate(`/pattern/${pattern.id}`)}
            >
              <div className="tiny faint" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {formatMinutes(pattern.minutes)}
              </div>
              <h4 style={{ margin: '4px 0 2px', fontFamily: 'var(--font)' }}>{pattern.title}</h4>
              <div className="tiny faint">{pattern.category}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Every tool in one place</h2>
        </div>
        <div className="grid grid-3">
          {TOOLS.map((tool) => (
            <button
              key={tool.href}
              className="card"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => navigate(tool.href)}
            >
              <div style={{ fontSize: '1.3rem', color: 'var(--terracotta)', marginBottom: 4 }}>{tool.icon}</div>
              <h4 style={{ margin: '0 0 4px', fontFamily: 'var(--font)' }}>{tool.title}</h4>
              <p className="small muted" style={{ margin: 0 }}>{tool.text}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Seasonal collections</h2>
        </div>
        <div className="grid grid-4">
          {COLLECTIONS.map((collection) => {
            const items = catalog.filter((p) => p.collection === collection.key);
            return (
              <button
                key={collection.key}
                className="card"
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => navigate(`/library?collection=${collection.key}`)}
              >
                <div style={{ fontSize: '1.6rem' }}>{collection.emoji}</div>
                <h4 style={{ margin: '6px 0 2px', fontFamily: 'var(--font)' }}>{collection.label}</h4>
                <div className="tiny faint">{items.length} patterns</div>
              </button>
            );
          })}
        </div>
      </section>

      {totalRows > 0 && (
        <section className="section">
          <div className="card">
            <div className="row">
              <div className="stat">
                <span className="value">{totalRows}</span>
                <span className="label">rows completed</span>
              </div>
              <div className="stat">
                <span className="value">{Object.keys(state.activity).length}</span>
                <span className="label">active days</span>
              </div>
              <span className="spacer" />
              <span className="small muted">Every tick is saved to this device.</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
