import type { Diagnostic, ParsedPattern } from '../shared/types.ts';

export interface CheckSummary {
  errors: number;
  warnings: number;
  infos: number;
  checkedSteps: number;
  totalSteps: number;
  /** 0-100 health score used by the checker badge. */
  score: number;
  verdict: string;
}

export function summarise(parsed: ParsedPattern): CheckSummary {
  const errors = parsed.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = parsed.diagnostics.filter((d) => d.severity === 'warning').length;
  const infos = parsed.diagnostics.filter((d) => d.severity === 'info' && d.code !== 'math-ok').length;
  const steps = parsed.steps.filter((s) => s.kind === 'row' || s.kind === 'round');
  const checked = steps.filter((s) => s.declaredCount !== undefined && s.computedCount !== undefined).length;

  const penalty = errors * 22 + warnings * 7 + infos * 1.5;
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const verdict =
    steps.length === 0
      ? 'No steps found'
      : errors > 0
        ? `${errors} counting ${errors === 1 ? 'error' : 'errors'} to fix`
        : warnings > 0
          ? 'Counts add up, with notes'
          : checked > 0
            ? 'All stated counts add up'
            : 'Parsed, no stated counts to verify';

  return { errors, warnings, infos, checkedSteps: checked, totalSteps: steps.length, score, verdict };
}

export function diagnosticsByStep(diagnostics: Diagnostic[]): Map<number, Diagnostic[]> {
  const map = new Map<number, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.stepIndex === undefined) continue;
    const list = map.get(diagnostic.stepIndex) ?? [];
    list.push(diagnostic);
    map.set(diagnostic.stepIndex, list);
  }
  return map;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
