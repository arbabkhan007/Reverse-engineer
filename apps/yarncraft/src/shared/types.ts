/**
 * Shared contracts for YarnCraft Studio.
 *
 * Layer ownership (see README):
 *  - shared/    plain data contracts, no behaviour, imported by every layer
 *  - domain/    pure engines (parsing, checking, generation, canvas maths)
 *  - server/    HTTP boundary: static hosting + optional AI/URL proxying
 *  - client/    React application, persistence, presentation
 */

export type Craft = 'crochet' | 'knitting';

export type SkillLevel = 'beginner' | 'easy' | 'intermediate' | 'advanced';

export const SKILL_LEVELS: SkillLevel[] = ['beginner', 'easy', 'intermediate', 'advanced'];

export const CATEGORIES = [
  'Amigurumi',
  'Home Decor',
  'Wearables',
  'Accessories',
  'Baby',
  'Blankets',
  'Gifts',
  'Bags',
  'Kitchen',
  'Seasonal',
] as const;

export type Category = (typeof CATEGORIES)[number];

/* ------------------------------------------------------------------ patterns */

export type StepKind = 'setup' | 'row' | 'round' | 'note' | 'finishing';

/** One line of a written pattern, after parsing. */
export interface PatternStep {
  /** Stable index within the pattern. */
  index: number;
  /** Display label, e.g. "Row 3" or "Round 12" or "Finishing". */
  label: string;
  kind: StepKind;
  /** The instruction exactly as written by the source. */
  instruction: string;
  /** Count the source claims, parsed from a trailing "(24)" or "= 24 sts". */
  declaredCount?: number;
  /** Count derived by the stitch-maths engine. Undefined when unparseable. */
  computedCount?: number;
  /** Parts of the instruction the engine could not interpret. Never guessed. */
  unparsed?: string[];
  /** Structured repeat, when the step is built from a repeated group. */
  repeat?: { groupMade: number; times: number };
}

export interface PatternSupplies {
  yarn?: string;
  yardage?: string;
  hook?: string;
  notions?: string[];
  gauge?: string;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code:
    | 'count-mismatch'
    | 'count-drift'
    | 'unknown-abbreviation'
    | 'unbalanced-brackets'
    | 'unparseable-fragment'
    | 'missing-turn'
    | 'missing-join'
    | 'over-decrease'
    | 'repeat-mismatch'
    | 'no-foundation'
    | 'empty-step'
    | 'math-ok'
    | 'assumption';
  stepIndex?: number;
  label?: string;
  message: string;
  hint?: string;
  suggestedFix?: string;
}

export interface ParsedPattern {
  title: string;
  craft: Craft;
  designer?: string;
  supplies: PatternSupplies;
  steps: PatternStep[];
  /** Abbreviations the source used, in order of first appearance. */
  abbreviations: string[];
  /** Abbreviations used but not in the dictionary. */
  unknownAbbreviations: string[];
  diagnostics: Diagnostic[];
  /** Lines that did not look like pattern steps at all (notes, prose, ads). */
  unparsedLines: string[];
  /** One-line summary suitable for a list view. */
  summary: string;
}

/* ------------------------------------------------------------------ catalog */

export type ShapeKind =
  | 'flat-circle'
  | 'granny-square'
  | 'amigurumi-sphere'
  | 'flat-panel'
  | 'hat-in-the-round'
  | 'chevron'
  | 'basket'
  | 'coaster-set'
  | 'tote'
  | 'ear-warmer'
  | 'bookmark';

export interface PatternShapeSpec {
  kind: ShapeKind;
  /** Primary stitch code from the stitch dictionary, e.g. "sc", "dc". */
  stitch: string;
  /** Rows or rounds to generate. */
  rows: number;
  /** Width in stitches for flat shapes. */
  width?: number;
  /** Round-1 stitch count for in-the-round shapes. */
  start?: number;
  /** Increases per round for flat circles. */
  increasePerRound?: number;
}

export interface CatalogPattern {
  id: string;
  title: string;
  craft: Craft;
  category: Category;
  level: SkillLevel;
  /** Human-readable estimated making time in minutes. */
  minutes: number;
  blurb: string;
  tags: string[];
  /** Hand-authored patterns carry their own instructions; generated ones build from the shape spec. */
  origin: 'curated' | 'generated';
  shape?: PatternShapeSpec;
  /** Present on curated patterns. */
  text?: string;
  supplies: PatternSupplies;
  /** Seasonal collection key, e.g. "winter". */
  collection?: string;
  tenMinute?: boolean;
}

/* ------------------------------------------------------------------ courses */

export interface LessonStep {
  title: string;
  body: string;
  /** Stitch code that renders as a diagram alongside the step. */
  diagram?: string;
  tip?: string;
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  goal: string;
  steps: LessonStep[];
  practicePatternId?: string;
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  level: SkillLevel;
  minutes: number;
  accent: string;
  lessons: Lesson[];
}

/* ------------------------------------------------------------------ projects */

export interface ProjectCounts {
  /** Rows the maker has ticked off. */
  completedSteps: number[];
  /** Stitches made in the current step (free-form counter). */
  stitchCount: number;
  /** Times the current repeat section has been worked. */
  repeatCount: number;
  /** Manual row number for patterns without structured steps. */
  manualRow: number;
}

export interface Project {
  id: string;
  title: string;
  patternId?: string;
  craft: Craft;
  /** Snapshot of the steps so a deleted/custom pattern still works. */
  steps: PatternStep[];
  counts: ProjectCounts;
  status: 'wip' | 'done' | 'frogged';
  yarn?: string;
  hook?: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  /** Accumulated making time in seconds. */
  elapsedSeconds: number;
}

/* ------------------------------------------------------------------- stash */

/** One yarn the maker owns, or is thinking of buying. */
export interface StashYarn {
  id: string;
  name: string;
  brand?: string;
  /** Yarn weight code from the standard 0-7 scale. */
  weight: string;
  /** Total length of one skein, in metres. Metres so yards/labels compare. */
  skeinMetres: number;
  /** Skeins on hand. */
  skeins: number;
  colour?: string;
  /** Purchase price per skein, in the user's currency. */
  pricePerSkein?: number;
  notes?: string;
  addedAt: number;
}

/** A saved yarn requirement, so a plan can be revisited after buying. */
export interface YarnPlan {
  id: string;
  name: string;
  neededMetres: number;
  skeinMetres: number;
  skeins: number;
  createdAt: number;
}

/* ----------------------------------------------------------------- journal */

export type JournalKind = 'note' | 'photo' | 'measure' | 'milestone';

/**
 * One journal entry. Kept in `shared` rather than imported from the domain so
 * the persisted shape never depends on a domain module's internals.
 */
export interface JournalRecord {
  id: string;
  projectId: string;
  at: string;
  kind: JournalKind;
  text: string;
  image?: string;
  width?: number;
  height?: number;
  label?: string;
}

/* ------------------------------------------------------------------ canvas */

export const CANVAS_SYMBOLS = [
  'blank',
  'sc',
  'hdc',
  'dc',
  'tr',
  'ch',
  'slst',
  'inc',
  'dec',
  'bobble',
  'shell',
  'puff',
] as const;

export type CanvasSymbol = (typeof CANVAS_SYMBOLS)[number];

export interface CanvasDesign {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Row-major grid, height rows of width cells. */
  cells: CanvasSymbol[];
  /** Optional per-cell colours for colourwork (row-major, CSS colours). */
  colors: string[];
  palette: string[];
  baseStitch: string;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ settings */

export type AIProvider = 'offline' | 'openai' | 'anthropic' | 'custom';

export interface AISettings {
  provider: AIProvider;
  /** Kept only in this browser's localStorage; relayed per request, never logged. */
  apiKey: string;
  model: string;
  /** For OpenAI-compatible gateways. */
  baseUrl: string;
}

export interface Settings {
  ai: AISettings;
  units: 'imperial' | 'metric';
  reduceMotion: boolean;
  designerName: string;
}

/* ------------------------------------------------------------------ analysis */

export interface StitchFeature {
  label: string;
  value: string;
}

export interface StitchGuess {
  code: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface StitchAnalysis {
  guesses: StitchGuess[];
  features: StitchFeature[];
  source: 'offline' | 'ai';
  /** Honest description of what the numbers do and do not establish. */
  note: string;
  provider?: string;
}

export interface SavedStitchAnalysis extends StitchAnalysis {
  id: string;
  createdAt: number;
  /** Data-URL thumbnail of the analysed photo. */
  thumbnail: string;
}

/* ------------------------------------------------------------------ storage */

export interface CustomPatternRecord {
  id: string;
  title: string;
  craft: Craft;
  rawText: string;
  parsed: ParsedPattern;
  source: 'paste' | 'pdf' | 'web' | 'canvas';
  sourceRef?: string;
  createdAt: number;
}

export interface CourseProgress {
  completedLessons: string[];
  enrolledAt: number;
}

export interface AppState {
  version: 1;
  settings: Settings;
  projects: Project[];
  courseProgress: Record<string, CourseProgress>;
  savedPatterns: string[];
  customPatterns: CustomPatternRecord[];
  recentPatterns: string[];
  canvases: CanvasDesign[];
  stitchAnalyses: SavedStitchAnalysis[];
  /** ISO date (YYYY-MM-DD) -> rows completed that day. */
  activity: Record<string, number>;
  /** Yarns on hand. */
  stash: StashYarn[];
  /** Saved yarn requirement plans. */
  yarnPlans: YarnPlan[];
  /** Journal entries across all projects. */
  journal: JournalRecord[];
}
