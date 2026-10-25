/**
 * Project journal.
 *
 * Notes, measurements and progress photos, filed against a project. The pure
 * part is ordering, grouping and budget: photos are the one thing in this app
 * big enough to blow the browser's storage quota, so the rules for shrinking and
 * evicting them are explicit and testable rather than buried in a React effect.
 *
 * Photo resizing itself needs a canvas, which lives in the browser. Everything
 * *about* resizing - what size to aim for, which entry to drop first - is here.
 */

export type JournalKind = 'note' | 'photo' | 'measure' | 'milestone';

export interface JournalEntry {
  id: string;
  projectId: string;
  /** ISO timestamp. Stored as a string so it survives JSON round-trips. */
  at: string;
  kind: JournalKind;
  text: string;
  /** Data URL for a photo entry. Downscaled before storage. */
  image?: string;
  /** Photo dimensions after downscaling, for the grid to reserve space. */
  width?: number;
  height?: number;
  /** For `measure` entries: the dimension being recorded. */
  label?: string;
}

export const JOURNAL_LIMIT_PER_PROJECT = 400;

/** Long edge, in pixels. 900 keeps a progress photo legible on a phone. */
export const PHOTO_MAX_EDGE = 900;

/** Rough per-photo budget, in bytes. A 900px JPEG lands well inside this. */
export const PHOTO_BUDGET_BYTES = 260_000;

/** Total photo budget for one project, in bytes. */
export const PROJECT_PHOTO_BUDGET = 8_000_000;

/**
 * Target size for a downscale, preserving aspect ratio and never upscaling.
 * Returns integer dimensions, because a canvas silently floors fractional sizes
 * and a caller comparing them would see phantom drift.
 */
export function fitWithin(width: number, height: number, maxEdge = PHOTO_MAX_EDGE): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Bytes a data URL occupies once stored. Base64 inflates by 4/3, and the
 * `data:image/jpeg;base64,` header is counted too because localStorage stores
 * the whole string.
 */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl.length;
  const payload = dataUrl.length - comma - 1;
  const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
  return (payload * 3) / 4 - padding + comma + 1;
}

export function entriesForProject(entries: JournalEntry[], projectId: string): JournalEntry[] {
  return entries.filter((entry) => entry.projectId === projectId);
}

/** Newest first, ties broken by id so ordering is stable across renders. */
export function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => {
    const diff = Date.parse(b.at) - Date.parse(a.at);
    if (diff !== 0 && !Number.isNaN(diff)) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export interface JournalGroup {
  /** `YYYY-MM-DD` in local time, used as a key. */
  day: string;
  label: string;
  entries: JournalEntry[];
}

function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const dayNumber = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${dayNumber}`;
}

/**
 * Group by calendar day. Uses local time deliberately: a crafter photographing a
 * sleeve at 11pm expects it under today, not tomorrow in UTC.
 */
export function groupByDay(entries: JournalEntry[], now = new Date()): JournalGroup[] {
  const buckets = new Map<string, JournalEntry[]>();
  for (const entry of sortEntries(entries)) {
    const date = new Date(entry.at);
    const key = Number.isNaN(date.getTime()) ? 'unknown' : localDay(date);
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  }

  const today = localDay(now);
  const yesterday = localDay(new Date(now.getTime() - 86_400_000));

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([day, grouped]) => ({
      day,
      label: day === today ? 'Today' : day === yesterday ? 'Yesterday' : day === 'unknown' ? 'Undated' : day,
      entries: grouped,
    }));
}

/** Newest first, so the order survives even if the caller re-sorts by day. */
export function addEntry(entries: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  return sortEntries([...entries, entry]).slice(0, JOURNAL_LIMIT_PER_PROJECT);
}

export function removeEntry(entries: JournalEntry[], id: string): JournalEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

/**
 * Evict oldest photos until the project fits its budget. Notes are never evicted:
 * text is cheap and losing it would be a surprise, whereas photos are the entry
 * kind the user implicitly knows are heavy.
 *
 * Returns what was kept and what was dropped, so the UI can say so rather than
 * letting a photo vanish silently.
 */
export function trimToBudget(
  entries: JournalEntry[],
  budget = PROJECT_PHOTO_BUDGET,
): { kept: JournalEntry[]; dropped: JournalEntry[] } {
  const photos = entries.filter((entry) => entry.kind === 'photo' && entry.image);
  const total = photos.reduce((sum, entry) => sum + (entry.image ? dataUrlBytes(entry.image) : 0), 0);
  if (total <= budget) return { kept: entries, dropped: [] };

  // Oldest first: drop the photo furthest from what the crafter is working on now.
  const byAge = [...photos].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let over = total - budget;
  const drop = new Set<string>();
  for (const photo of byAge) {
    if (over <= 0) break;
    drop.add(photo.id);
    over -= photo.image ? dataUrlBytes(photo.image) : 0;
  }

  return {
    kept: entries.filter((entry) => !drop.has(entry.id)),
    dropped: entries.filter((entry) => drop.has(entry.id)),
  };
}

/** Total bytes the journal holds for one project. */
export function journalBytes(entries: JournalEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.image ? dataUrlBytes(entry.image) : 0), 0);
}

/**
 * Progress between the first and last measurement of the same label, so a sleeve
 * can be tracked without the user mentally diffing two rows.
 */
export function measurementTrend(
  entries: JournalEntry[],
  label: string,
): { first: number; last: number; delta: number; count: number } | null {
  const points = entries
    .filter((entry) => entry.kind === 'measure' && entry.label === label)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((entry) => Number.parseFloat(entry.text))
    .filter((value) => Number.isFinite(value));

  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return { first, last, delta: last - first, count: points.length };
}

/** Distinct measurement labels, in the order first used. */
export function measurementLabels(entries: JournalEntry[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const entry of sortEntries(entries).reverse()) {
    if (entry.kind !== 'measure' || !entry.label) continue;
    if (seen.has(entry.label)) continue;
    seen.add(entry.label);
    labels.push(entry.label);
  }
  return labels;
}

/** A stable id that does not need a crypto API, so tests are deterministic. */
export function makeEntryId(seed: number, now = Date.now()): string {
  return `j${now.toString(36)}-${Math.abs(Math.floor(seed)).toString(36)}`;
}
