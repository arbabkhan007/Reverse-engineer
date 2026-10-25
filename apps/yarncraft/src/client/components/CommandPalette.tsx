import { useEffect, useMemo, useRef, useState } from 'react';
import { buildIndex, search, type SearchHit } from '../../domain/search.ts';
import { buildCatalog } from '../../domain/catalog.ts';
import { COURSES } from '../../domain/courses.ts';
import { navigate } from '../lib/router.ts';

/**
 * Ctrl/Cmd+K. Built once per open, not per keystroke: the catalog is 526 entries
 * and rebuilding it inside the input handler makes the palette feel laggy.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const docs = useMemo(
    () => buildIndex({ patterns: buildCatalog(), courses: COURSES }),
    [],
  );

  const hits = useMemo(() => search(query, docs, 14), [query, docs]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      // A bare "/" jumps here too, but only when not already typing somewhere.
      if (event.key === '/' && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (hit: SearchHit | undefined) => {
    if (!hit) return;
    setOpen(false);
    navigate(hit.doc.href);
  };

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, hits.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(hits[active]);
    } else if (event.key === 'Tab') {
      // Keep focus inside the dialog; the list is the only control.
      event.preventDefault();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
      <div
        className="modal palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search everything"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools, 526 patterns and lessons…"
          aria-label="Search"
          aria-controls="palette-results"
          aria-activedescendant={hits[active] ? `palette-hit-${active}` : undefined}
        />
        <div className="palette-results" ref={listRef} id="palette-results" role="listbox">
          {hits.length === 0 ? (
            <p className="empty">Nothing matched. Try a shorter word.</p>
          ) : (
            hits.map((hit, index) => (
              <button
                key={hit.doc.id}
                id={`palette-hit-${index}`}
                role="option"
                aria-selected={index === active}
                className={`palette-row ${index === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(hit)}
              >
                <span className="palette-group">{hit.doc.group}</span>
                <span className="palette-title">{hit.doc.title}</span>
                {hit.doc.subtitle ? <span className="palette-sub">{hit.doc.subtitle}</span> : null}
              </button>
            ))
          )}
        </div>
        <footer className="palette-foot tiny faint">
          <span>
            <b>↑↓</b> move · <b>Enter</b> open · <b>Esc</b> close
          </span>
          <span>Ctrl / ⌘ + K anywhere</span>
        </footer>
      </div>
    </div>
  );
}
