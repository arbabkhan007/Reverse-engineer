/**
 * Optional AI providers.
 *
 * The app is fully functional offline. When a key is supplied it is held in
 * this browser's localStorage and sent directly to the chosen provider - the
 * YarnCraft server never receives or logs it.
 */

import type { AISettings, StitchAnalysis, StitchGuess } from '../../shared/types.ts';
import { STITCHES } from '../../domain/stitches.ts';

export interface AnalyseImageInput {
  dataUrl: string;
  settings: AISettings;
}

const STITCH_MENU = STITCHES.map((s) => `${s.code} = ${s.name}: ${s.texture}`).join('\n');

const VISION_PROMPT = `You are a crochet and knitting stitch identification assistant.
Look at the fabric in the photo and identify the dominant stitch.
Choose only from this list:
${STITCH_MENU}
Reply with JSON only, no prose, in this shape:
{"guesses":[{"code":"sc","confidence":0.0,"reason":"what you saw"}],"features":[{"label":"name","value":"value"}],"note":"one sentence"}
Give up to 3 guesses ordered by confidence (0-1). If the image does not show fabric, return an empty guesses array and explain in note.`;

const POLISH_PROMPT = `You clean up crochet and knitting pattern text that came from a PDF or web page.
Rules:
- Keep every instruction and every stated stitch count exactly as written. Never invent or change numbers.
- Remove page numbers, headers, footers, adverts, copyright blurbs and navigation text.
- Normalise row labels to "Row N:" and "Round N:" and put each instruction on its own line.
- Keep the abbreviation glossary if present.
- Output plain text only, no commentary, no markdown.`;

interface JsonGuess {
  code?: string;
  confidence?: number;
  reason?: string;
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Provider did not return JSON');
  return JSON.parse(body.slice(start, end + 1));
}

function normaliseAnalysis(payload: unknown, provider: string): StitchAnalysis {
  const record = payload as {
    guesses?: JsonGuess[];
    features?: Array<{ label?: string; value?: string }>;
    note?: string;
  };
  const guesses: StitchGuess[] = (record.guesses ?? [])
    .filter((g): g is JsonGuess & { code: string } => typeof g.code === 'string')
    .slice(0, 3)
    .map((g) => ({
      code: g.code.toLowerCase(),
      name: STITCHES.find((s) => s.code === g.code?.toLowerCase())?.name ?? g.code,
      confidence: Math.max(0, Math.min(1, Number(g.confidence ?? 0.5))),
      reason: g.reason ?? 'Identified by the vision model.',
    }));

  return {
    guesses,
    features: (record.features ?? [])
      .filter((f) => f.label && f.value)
      .map((f) => ({ label: String(f.label), value: String(f.value) })),
    source: 'ai',
    note: record.note ?? 'Analysed by the configured vision model.',
    provider,
  };
}

async function callOpenAiCompatible(
  settings: AISettings,
  messages: unknown[],
  maxTokens = 700,
): Promise<string> {
  const base = settings.baseUrl?.trim() || 'https://api.openai.com/v1';
  const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Provider error ${response.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Provider returned an empty response');
  return content;
}

async function callAnthropic(
  settings: AISettings,
  content: unknown[],
  maxTokens = 700,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model || 'claude-3-5-sonnet-latest',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Provider error ${response.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = json.content?.map((c) => c.text ?? '').join('\n');
  if (!text) throw new Error('Provider returned an empty response');
  return text;
}

function base64FromDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match?.[1] || !match[2]) throw new Error('Image must be a base64 data URL');
  return { mediaType: match[1], data: match[2] };
}

export async function analysePhotoWithAi({ dataUrl, settings }: AnalyseImageInput): Promise<StitchAnalysis> {
  if (settings.provider === 'offline') throw new Error('No AI provider configured');

  if (settings.provider === 'anthropic') {
    const { mediaType, data } = base64FromDataUrl(dataUrl);
    const text = await callAnthropic(settings, [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
      { type: 'text', text: VISION_PROMPT },
    ]);
    return normaliseAnalysis(extractJson(text), 'anthropic');
  }

  const text = await callOpenAiCompatible(settings, [
    {
      role: 'user',
      content: [
        { type: 'text', text: VISION_PROMPT },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ]);
  return normaliseAnalysis(extractJson(text), settings.provider);
}

/** Optional AI clean-up for messy PDF/web extraction. Falls back on failure. */
export async function polishPatternText(rawText: string, settings: AISettings): Promise<string> {
  if (settings.provider === 'offline') return rawText;
  const chunk = rawText.slice(0, 12000);
  try {
    if (settings.provider === 'anthropic') {
      const text = await callAnthropic(
        settings,
        [{ type: 'text', text: `${POLISH_PROMPT}\n\n---\n${chunk}` }],
        2000,
      );
      return text.trim() || rawText;
    }
    const text = await callOpenAiCompatible(
      settings,
      [
        { role: 'system', content: POLISH_PROMPT },
        { role: 'user', content: chunk },
      ],
      2000,
    );
    return text.trim() || rawText;
  } catch {
    // A failed clean-up must never block the import.
    return rawText;
  }
}

export function aiReady(settings: AISettings): boolean {
  if (settings.provider === 'offline') return false;
  return settings.apiKey.trim().length > 0;
}
