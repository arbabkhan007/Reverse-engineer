import type { AppState, Settings } from '../../shared/types.ts';

export const STORAGE_KEY = 'yarncraft.state.v1';

export const DEFAULT_SETTINGS: Settings = {
  ai: { provider: 'offline', apiKey: '', model: '', baseUrl: '' },
  units: 'metric',
  reduceMotion: false,
  designerName: '',
};

export function defaultState(): AppState {
  return {
    version: 1,
    settings: DEFAULT_SETTINGS,
    projects: [],
    courseProgress: {},
    savedPatterns: [],
    customPatterns: [],
    recentPatterns: [],
    canvases: [],
    stitchAnalyses: [],
    activity: {},
    stash: [],
    yarnPlans: [],
    journal: [],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      version: 1,
      settings: { ...base.settings, ...(parsed.settings ?? {}), ai: { ...base.settings.ai, ...(parsed.settings?.ai ?? {}) } },
      projects: parsed.projects ?? [],
      customPatterns: parsed.customPatterns ?? [],
      canvases: parsed.canvases ?? [],
      stitchAnalyses: parsed.stitchAnalyses ?? [],
      savedPatterns: parsed.savedPatterns ?? [],
      recentPatterns: parsed.recentPatterns ?? [],
      courseProgress: parsed.courseProgress ?? {},
      activity: parsed.activity ?? {},
      stash: parsed.stash ?? [],
      yarnPlans: parsed.yarnPlans ?? [],
      journal: parsed.journal ?? [],
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded: drop the largest, least critical collection and retry once.
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, stitchAnalyses: [], canvases: state.canvases.slice(-5) }),
      );
    } catch {
      // Storage is unavailable; the session keeps working in memory.
    }
  }
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
