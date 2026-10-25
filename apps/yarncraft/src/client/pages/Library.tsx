import { useMemo, useState } from 'react';
import { buildCatalog, COLLECTIONS } from '../../domain/catalog.ts';
import { CATEGORIES, SKILL_LEVELS, type Category, type SkillLevel } from '../../shared/types.ts';
import { useStore } from '../store.tsx';
import { useRoute } from '../lib/router.ts';
import { PatternCard } from '../components/PatternBits.tsx';
import { Chip } from '../components/ui.tsx';

type SortKey = 'popular' | 'quick' | 'az' | 'level';

const LEVEL_ORDER: Record<SkillLevel, number> = { beginner: 0, easy: 1, intermediate: 2, advanced: 3 };

export function LibraryPage() {
  const { state } = useStore();
  const { query } = useRoute();
  const catalog = useMemo(() => buildCatalog(), []);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>((query.get('category') as Category) ?? 'all');
  const [level, setLevel] = useState<SkillLevel | 'all'>('all');
  const [collection, setCollection] = useState<string>(query.get('collection') ?? 'all');
  const [sort, setSort] = useState<SortKey>('popular');
  const [onlySaved, setOnlySaved] = useState(false);
  const [limit, setLimit] = useState(48);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const items = catalog.filter((pattern) => {
      if (category !== 'all' && pattern.category !== category) return false;
      if (level !== 'all' && pattern.level !== level) return false;
      if (collection !== 'all' && pattern.collection !== collection) return false;
      if (onlySaved && !state.savedPatterns.includes(pattern.id)) return false;
      if (!term) return true;
      return (
        pattern.title.toLowerCase().includes(term) ||
        pattern.blurb.toLowerCase().includes(term) ||
        pattern.tags.some((tag) => tag.includes(term)) ||
        pattern.category.toLowerCase().includes(term)
      );
    });

    const sorted = [...items];
    if (sort === 'quick') sorted.sort((a, b) => a.minutes - b.minutes);
    else if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'level') sorted.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
    else sorted.sort((a, b) => Number(b.tenMinute ?? false) - Number(a.tenMinute ?? false) || a.minutes - b.minutes);
    return sorted;
  }, [catalog, search, category, level, collection, sort, onlySaved, state.savedPatterns]);

  const reset = () => {
    setSearch('');
    setCategory('all');
    setLevel('all');
    setCollection('all');
    setOnlySaved(false);
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Pattern library</div>
        <h1>Find your next project</h1>
        <p className="lead">
          {catalog.length} patterns across {CATEGORIES.length} categories, from ten-minute wins to
          advanced lace. Every generated pattern comes with written instructions that the checker has
          verified against its own stitch maths.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 10 }}>
          <input
            type="text"
            placeholder="Search by name, technique or category…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            aria-label="Search patterns"
          />
          <select value={category} onChange={(event) => setCategory(event.target.value as Category | 'all')} aria-label="Category" style={{ width: 'auto' }}>
            <option value="all">All categories</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select value={level} onChange={(event) => setLevel(event.target.value as SkillLevel | 'all')} aria-label="Skill level" style={{ width: 'auto' }}>
            <option value="all">Any level</option>
            {SKILL_LEVELS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort" style={{ width: 'auto' }}>
            <option value="popular">Quick wins first</option>
            <option value="quick">Shortest first</option>
            <option value="az">A to Z</option>
            <option value="level">Easiest first</option>
          </select>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 6 }}>
          <Chip
            tone={collection === 'all' ? 'terracotta' : 'default'}
            outline={collection !== 'all'}
          >
            <button
              onClick={() => setCollection('all')}
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
            >
              All year
            </button>
          </Chip>
          {COLLECTIONS.map((item) => (
            <Chip key={item.key} tone={collection === item.key ? 'terracotta' : 'default'} outline={collection !== item.key}>
              <button
                onClick={() => setCollection(item.key)}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
              >
                {item.emoji} {item.label}
              </button>
            </Chip>
          ))}
          <span className="spacer" />
          <label className="check small">
            <input type="checkbox" checked={onlySaved} onChange={(event) => setOnlySaved(event.target.checked)} />
            Saved only ({state.savedPatterns.length})
          </label>
          <button className="btn ghost sm" onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <span className="small muted">
          {filtered.length} {filtered.length === 1 ? 'pattern' : 'patterns'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="big">🧶</div>
          <h3>Nothing matches those filters</h3>
          <p className="small">Try a broader search, or reset the filters.</p>
          <button className="btn" onClick={reset}>Reset filters</button>
        </div>
      ) : (
        <>
          <div className="grid grid-3">
            {filtered.slice(0, limit).map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
          {filtered.length > limit && (
            <div className="center" style={{ marginTop: 24 }}>
              <button className="btn lg" onClick={() => setLimit((value) => value + 48)}>
                Show more ({filtered.length - limit} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
