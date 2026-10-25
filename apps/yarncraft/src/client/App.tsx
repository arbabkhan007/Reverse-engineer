import { useRoute } from './lib/router.ts';
import { HomePage } from './pages/Home.tsx';
import { LibraryPage } from './pages/Library.tsx';
import { PatternViewPage } from './pages/PatternView.tsx';
import { CheckerPage } from './pages/Checker.tsx';
import { ConverterPage } from './pages/Converter.tsx';
import { ProjectsPage } from './pages/Projects.tsx';
import { StitchIdPage } from './pages/StitchId.tsx';
import { CanvasPage } from './pages/Canvas.tsx';
import { CoursesPage } from './pages/Courses.tsx';
import { SettingsPage } from './pages/Settings.tsx';
import { TerminologyPage } from './pages/Terminology.tsx';
import { GaugePage } from './pages/Gauge.tsx';
import { ImageChartPage } from './pages/ImageChart.tsx';
import { StashPage } from './pages/Stash.tsx';
import { SymbolsPage } from './pages/Symbols.tsx';
import { JournalPage } from './pages/Journal.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';

const NAV = [
  { href: '/library', label: 'Patterns' },
  { href: '/checker', label: 'Checker' },
  { href: '/converter', label: 'Converter' },
  { href: '/projects', label: 'Projects' },
  { href: '/stitch-id', label: 'Stitch ID' },
  { href: '/canvas', label: 'Canvas' },
  { href: '/chart', label: 'Chart' },
  { href: '/symbols', label: 'Symbols' },
  { href: '/stash', label: 'Stash' },
  { href: '/journal', label: 'Journal' },
  { href: '/gauge', label: 'Gauge' },
  { href: '/terminology', label: 'US/UK' },
  { href: '/courses', label: 'Learn' },
];

export function App() {
  const { path, parts } = useRoute();
  const root = parts[0] ?? '';

  let page = <HomePage />;
  if (root === 'library') page = <LibraryPage />;
  else if (root === 'pattern') page = <PatternViewPage />;
  else if (root === 'checker') page = <CheckerPage />;
  else if (root === 'converter') page = <ConverterPage />;
  else if (root === 'projects') page = <ProjectsPage />;
  else if (root === 'stitch-id') page = <StitchIdPage />;
  else if (root === 'canvas') page = <CanvasPage />;
  else if (root === 'chart') page = <ImageChartPage />;
  else if (root === 'symbols') page = <SymbolsPage />;
  else if (root === 'stash') page = <StashPage />;
  else if (root === 'journal') page = <JournalPage />;
  else if (root === 'gauge') page = <GaugePage />;
  else if (root === 'terminology') page = <TerminologyPage />;
  else if (root === 'courses') page = <CoursesPage />;
  else if (root === 'settings') page = <SettingsPage />;

  return (
    <div className="app">
      <a href="#main" className="btn ghost sm" style={{ position: 'absolute', left: -9999 }}>Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#/" className="brand">
            <span className="brand-mark" aria-hidden="true">🧶</span>
            <span>
              YarnCraft
              <small>Studio</small>
            </span>
          </a>
          <nav className="nav" aria-label="Main">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={`#${item.href}`}
                className={path.startsWith(item.href) ? 'active' : ''}
              >
                {item.label}
              </a>
            ))}
            <button
              className="btn ghost sm nav-search"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              aria-label="Search everything (Ctrl or Command K)"
              title="Search everything (Ctrl / Cmd + K)"
            >
              Search <kbd>⌘K</kbd>
            </button>
            <a href="#/settings" className={path.startsWith('/settings') ? 'active' : ''} aria-label="Settings">
              ⚙
            </a>
          </nav>
        </div>
      </header>

      <main className="main" id="main">
        {page}
      </main>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '22px 20px', textAlign: 'center' }}>
        <p className="tiny faint" style={{ margin: 0 }}>
          YarnCraft Studio · an original crochet and knitting companion · all data stays on this device
        </p>
      </footer>
      <CommandPalette />
    </div>
  );
}
