/**
 * Bridge to the repository's Python checker.
 *
 * The Python engine (`crochet_checker`) is the authoritative checker for this
 * repository: it owns parsing, validation and measurement semantics. This
 * module only presents its result. When the FastAPI service is not running the
 * bridge reports that plainly and the app falls back to its own local
 * pre-check, which is explicitly not a substitute.
 */

export interface PythonCheckError {
  message: string;
  location?: string;
}

export interface PythonCheckResult {
  status: string;
  score: number;
  errors: PythonCheckError[];
  warnings: PythonCheckError[];
  rounds: number;
  max_stitches: number;
  max_diameter_inches: number;
  total_height_inches: number;
}

export type EngineState =
  | { available: false; reason: string }
  | { available: true; version: string };

/** Probes the Python service on the same origin. */
export async function probePythonEngine(): Promise<EngineState> {
  try {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return { available: false, reason: `The service answered ${response.status}.` };
    }
    const payload = (await response.json()) as Record<string, unknown>;
    return { available: true, version: String(payload.status ?? payload.version ?? 'ready') };
  } catch {
    return {
      available: false,
      reason: 'The FastAPI service is not reachable on this origin.',
    };
  }
}

export async function checkWithPythonEngine(patternText: string): Promise<PythonCheckResult> {
  const response = await fetch('/api/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern_text: patternText }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = `The Python engine returned ${response.status}.`;
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      if (parsed.detail) message = parsed.detail;
    } catch {
      if (detail) message = detail.slice(0, 240);
    }
    throw new Error(message);
  }

  return (await response.json()) as PythonCheckResult;
}

/** Human-readable one line summary of a Python engine report. */
export function describePythonResult(result: PythonCheckResult): string {
  const parts = [`${result.status} · score ${result.score}`];
  if (result.errors.length > 0) parts.push(`${result.errors.length} error(s)`);
  if (result.warnings.length > 0) parts.push(`${result.warnings.length} warning(s)`);
  if (result.rounds > 0) parts.push(`${result.rounds} rounds`);
  if (result.max_stitches > 0) parts.push(`max ${result.max_stitches} sts`);
  return parts.join(' · ');
}
