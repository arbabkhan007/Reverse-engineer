import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState,
  CanvasDesign,
  CustomPatternRecord,
  ParsedPattern,
  Project,
  JournalRecord,
  SavedStitchAnalysis,
  Settings,
  StashYarn,
  YarnPlan,
} from '../shared/types.ts';
import { defaultState, loadState, saveState, todayKey } from './lib/storage.ts';

interface StoreValue {
  state: AppState;
  setSettings: (patch: Partial<Settings>) => void;
  toggleSavedPattern: (id: string) => void;
  touchRecent: (id: string) => void;
  addCustomPattern: (record: CustomPatternRecord) => void;
  removeCustomPattern: (id: string) => void;
  startProject: (input: {
    title: string;
    patternId?: string;
    craft: Project['craft'];
    steps: ParsedPattern['steps'];
    yarn?: string;
    hook?: string;
  }) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  completeStep: (id: string, stepIndex: number, total: number) => void;
  addElapsed: (id: string, seconds: number) => void;
  toggleLesson: (courseId: string, lessonId: string) => void;
  saveCanvas: (design: CanvasDesign) => void;
  deleteCanvas: (id: string) => void;
  saveStitchAnalysis: (analysis: SavedStitchAnalysis) => void;
  deleteStitchAnalysis: (id: string) => void;
  addStashYarn: (yarn: Omit<StashYarn, 'id' | 'addedAt'>) => StashYarn;
  updateStashYarn: (id: string, patch: Partial<StashYarn>) => void;
  deleteStashYarn: (id: string) => void;
  saveYarnPlan: (plan: Omit<YarnPlan, 'id' | 'createdAt'>) => void;
  deleteYarnPlan: (id: string) => void;
  addJournalEntry: (entry: Omit<JournalRecord, 'id'>) => void;
  deleteJournalEntry: (id: string) => void;
  exportData: () => string;
  importData: (json: string) => { ok: boolean; message: string };
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const saveTimer = useRef<number | null>(null);

  // Debounced persistence: counters tick fast during use.
  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveState(state), 250);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [state]);

  const logActivity = useCallback((delta: number) => {
    if (delta <= 0) return;
    setState((current) => {
      const key = todayKey();
      return { ...current, activity: { ...current.activity, [key]: (current.activity[key] ?? 0) + delta } };
    });
  }, []);

  const value = useMemo<StoreValue>(() => {
    return {
      state,
      setSettings: (patch) => setState((c) => ({ ...c, settings: { ...c.settings, ...patch } })),

      toggleSavedPattern: (id) =>
        setState((c) => ({
          ...c,
          savedPatterns: c.savedPatterns.includes(id)
            ? c.savedPatterns.filter((p) => p !== id)
            : [id, ...c.savedPatterns],
        })),

      touchRecent: (id) =>
        setState((c) => ({
          ...c,
          recentPatterns: [id, ...c.recentPatterns.filter((p) => p !== id)].slice(0, 12),
        })),

      addCustomPattern: (record) =>
        setState((c) => ({
          ...c,
          customPatterns: [record, ...c.customPatterns.filter((p) => p.id !== record.id)],
        })),

      removeCustomPattern: (id) =>
        setState((c) => ({ ...c, customPatterns: c.customPatterns.filter((p) => p.id !== id) })),

      startProject: (input) => {
        const now = Date.now();
        const project: Project = {
          id: uid(),
          title: input.title,
          ...(input.patternId ? { patternId: input.patternId } : {}),
          craft: input.craft,
          steps: input.steps,
          counts: { completedSteps: [], stitchCount: 0, repeatCount: 0, manualRow: 0 },
          status: 'wip',
          ...(input.yarn ? { yarn: input.yarn } : {}),
          ...(input.hook ? { hook: input.hook } : {}),
          notes: '',
          createdAt: now,
          updatedAt: now,
          elapsedSeconds: 0,
        };
        setState((c) => ({ ...c, projects: [project, ...c.projects] }));
        return project;
      },

      updateProject: (id, patch) =>
        setState((c) => ({
          ...c,
          projects: c.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
          ),
        })),

      deleteProject: (id) =>
        setState((c) => ({ ...c, projects: c.projects.filter((p) => p.id !== id) })),

      completeStep: (id, stepIndex, total) => {
        setState((c) => ({
          ...c,
          projects: c.projects.map((p) => {
            if (p.id !== id) return p;
            const done = p.counts.completedSteps.includes(stepIndex)
              ? p.counts.completedSteps.filter((s) => s !== stepIndex)
              : [...p.counts.completedSteps, stepIndex];
            const finished = total > 0 && done.length >= total;
            return {
              ...p,
              counts: { ...p.counts, completedSteps: done },
              status: finished ? 'done' : p.status === 'done' ? 'wip' : p.status,
              updatedAt: Date.now(),
            };
          }),
        }));
        logActivity(1);
      },

      addElapsed: (id, seconds) =>
        setState((c) => ({
          ...c,
          projects: c.projects.map((p) =>
            p.id === id ? { ...p, elapsedSeconds: p.elapsedSeconds + seconds, updatedAt: Date.now() } : p,
          ),
        })),

      toggleLesson: (courseId, lessonId) =>
        setState((c) => {
          const existing = c.courseProgress[courseId] ?? { completedLessons: [], enrolledAt: Date.now() };
          const completed = existing.completedLessons.includes(lessonId)
            ? existing.completedLessons.filter((l) => l !== lessonId)
            : [...existing.completedLessons, lessonId];
          return {
            ...c,
            courseProgress: { ...c.courseProgress, [courseId]: { ...existing, completedLessons: completed } },
          };
        }),

      saveCanvas: (design) =>
        setState((c) => ({
          ...c,
          canvases: [design, ...c.canvases.filter((d) => d.id !== design.id)].slice(0, 40),
        })),

      deleteCanvas: (id) =>
        setState((c) => ({ ...c, canvases: c.canvases.filter((d) => d.id !== id) })),

      saveStitchAnalysis: (analysis) =>
        setState((c) => ({
          ...c,
          stitchAnalyses: [analysis, ...c.stitchAnalyses].slice(0, 20),
        })),

      deleteStitchAnalysis: (id) =>
        setState((c) => ({ ...c, stitchAnalyses: c.stitchAnalyses.filter((a) => a.id !== id) })),

      addStashYarn: (yarn) => {
        const record: StashYarn = { ...yarn, id: uid(), addedAt: Date.now() };
        setState((c) => ({ ...c, stash: [record, ...c.stash] }));
        return record;
      },

      updateStashYarn: (id, patch) =>
        setState((c) => ({
          ...c,
          stash: c.stash.map((yarn) => (yarn.id === id ? { ...yarn, ...patch } : yarn)),
        })),

      deleteStashYarn: (id) =>
        setState((c) => ({ ...c, stash: c.stash.filter((yarn) => yarn.id !== id) })),

      saveYarnPlan: (plan) =>
        setState((c) => ({
          ...c,
          yarnPlans: [{ ...plan, id: uid(), createdAt: Date.now() }, ...c.yarnPlans].slice(0, 40),
        })),

      deleteYarnPlan: (id) =>
        setState((c) => ({ ...c, yarnPlans: c.yarnPlans.filter((plan) => plan.id !== id) })),

      addJournalEntry: (entry) =>
        setState((c) => ({
          ...c,
          journal: [{ ...entry, id: uid() }, ...c.journal].slice(0, 2000),
        })),

      deleteJournalEntry: (id) =>
        setState((c) => ({ ...c, journal: c.journal.filter((entry) => entry.id !== id) })),

      exportData: () => JSON.stringify(state, null, 2),

      importData: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<AppState>;
          if (parsed.version !== 1) return { ok: false, message: 'Unsupported backup version.' };
          setState((current) => ({ ...current, ...parsed, version: 1 }));
          return { ok: true, message: 'Backup restored.' };
        } catch {
          return { ok: false, message: 'That file is not valid JSON.' };
        }
      },

      resetAll: () => setState(defaultState()),
    };
  }, [state, logActivity]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}


export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside StoreProvider');
  return context;
}

export { uid };
