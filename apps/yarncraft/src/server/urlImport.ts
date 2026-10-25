/**
 * Web pattern import.
 *
 * Fetching a user-supplied URL server-side is a classic SSRF sink, so this
 * module resolves the host, refuses private/link-local targets, caps redirects,
 * bytes and time, and only accepts text-ish content types.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface ImportResult {
  url: string;
  title: string;
  text: string;
  contentType: string;
  truncated: boolean;
}

export class ImportError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ImportError';
    this.status = status;
  }
}

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const ALLOWED_TYPES = [
  'text/html',
  'text/plain',
  'application/xhtml+xml',
  'text/markdown',
];

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
    return false;
  }
  return true;
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImportError('That is not a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImportError('Only http and https URLs can be imported.');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal')) {
    throw new ImportError('Local network addresses cannot be imported.');
  }
  if (isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new ImportError('Private addresses cannot be imported.');
    return url;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new ImportError(`Could not resolve ${url.hostname}.`, 502);
  }
  if (addresses.length === 0) throw new ImportError(`Could not resolve ${url.hostname}.`, 502);
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new ImportError('That host resolves to a private address and cannot be imported.');
  }
  return url;
}

/** Minimal, dependency-free HTML to text conversion that keeps line structure. */
export function htmlToPatternText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1] ? decodeEntities(titleMatch[1]).trim() : '';

  // Elements whose class or id name a promotional or navigational block.
  const blockPattern =
    /(?:^|[\s"'])(?:ad|ads|advert\w*|adsbygoogle|promo\w*|banner|sidebar|share\w*|related\w*|newsletter|cookie\w*|comment\w*)(?:[\s"']|$)/i;

  // Strip promotional blocks first, while their class/id attributes still exist.
  let body = html.replace(
    /<(div|aside|section|ul|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, _tag: string, attrs: string) => (blockPattern.test(attrs) ? ' ' : match),
  );

  body = body
    .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ');

  body = decodeEntities(body)
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1]?.length !== 0))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, text: body };
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  rsquo: "'",
  lsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: '...',
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

async function fetchOnce(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'YarnCraftStudio/1.0 (pattern importer)',
        Accept: 'text/html,text/plain;q=0.9',
        'Accept-Language': 'en',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ImportError('The site took too long to respond.', 504);
    }
    throw new ImportError('Could not reach that site.', 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function importPatternFromUrl(rawUrl: string): Promise<ImportResult> {
  let url = await assertPublicUrl(rawUrl);
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    response = await fetchOnce(url);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new ImportError('The site sent an invalid redirect.', 502);
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }

  if (!response) throw new ImportError('Could not reach that site.', 502);
  if (!response.ok) {
    throw new ImportError(`The site returned ${response.status}.`, 502);
  }

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new ImportError(
      `That link returns ${contentType || 'an unknown type'}. Try a page URL, or download the PDF and use the PDF tab.`,
      415,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new ImportError('The site returned an empty body.', 502);

  let received = 0;
  let truncated = false;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > MAX_BYTES) {
        truncated = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
    }
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const html = decoder.decode(Buffer.concat(chunks));

  if (contentType === 'text/plain' || contentType === 'text/markdown') {
    return {
      url: url.toString(),
      title: url.pathname.split('/').filter(Boolean).at(-1) ?? url.hostname,
      text: html.trim(),
      contentType,
      truncated,
    };
  }

  const { title, text } = htmlToPatternText(html);
  return { url: url.toString(), title: title || url.hostname, text, contentType, truncated };
}
