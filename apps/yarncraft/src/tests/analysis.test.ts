import { describe, it, expect } from 'vitest';
import { analyzeOffline, extractFeatures, toGrayImage } from '../domain/stitchAnalyzer.ts';
import { htmlToPatternText } from '../server/urlImport.ts';

/** Builds a synthetic fabric: vertical posts spaced every `period` pixels. */
function fabric(width: number, height: number, period: number, contrast: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const column = Math.sin((x / period) * Math.PI * 2);
      const row = Math.sin((y / (period * 0.7)) * Math.PI * 2);
      const value = 128 + column * contrast * 0.6 + row * contrast * 0.4;
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return data;
}

function flat(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4).fill(60);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return data;
}

describe('texture features', () => {
  it('finds the stitch period of a regular fabric', () => {
    const image = toGrayImage(fabric(240, 240, 12, 90), 240, 240);
    const features = extractFeatures(image);
    expect(features.stitchWidthPx).not.toBeNull();
    expect(features.stitchWidthPx!).toBeGreaterThanOrEqual(8);
    expect(features.stitchWidthPx!).toBeLessThanOrEqual(16);
    expect(features.regularity).toBeGreaterThan(0.2);
  });

  it('reports no periodicity for a flat image', () => {
    const image = toGrayImage(flat(120, 120), 120, 120);
    const features = extractFeatures(image);
    expect(features.contrast).toBeLessThan(0.05);
    expect(features.edgeDensity).toBeLessThan(0.02);
  });
});

describe('offline stitch analysis', () => {
  it('returns ranked candidates with bounded confidence', () => {
    const image = toGrayImage(fabric(256, 256, 14, 80), 256, 256);
    const analysis = analyzeOffline(image);
    expect(analysis.guesses.length).toBeGreaterThan(0);
    expect(analysis.guesses.length).toBeLessThanOrEqual(3);
    const confidences = analysis.guesses.map((g) => g.confidence);
    for (const value of confidences) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(confidences[0]).toBeGreaterThanOrEqual(confidences[1] ?? 0);
    expect(analysis.features.length).toBeGreaterThan(3);
    expect(analysis.source).toBe('offline');
  });

  it('stays honest when there is nothing to measure', () => {
    const analysis = analyzeOffline(toGrayImage(flat(64, 64), 64, 64));
    expect(analysis.note.length).toBeGreaterThan(10);
    expect(analysis.guesses[0]!.confidence).toBeLessThan(0.7);
  });
});

describe('web import text extraction', () => {
  it('keeps instructions and drops page furniture', () => {
    const html = `
      <html><head><title>Free Washcloth Pattern</title>
      <style>.ad{color:red}</style></head>
      <body>
        <nav>Home | Shop | Blog</nav>
        <script>tracking()</script>
        <h1>Simple Washcloth</h1>
        <p>Yarn: worsted cotton</p>
        <p>Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)</p>
        <div class="ad">BUY YARN NOW</div>
        <p>Row 2: ch 1, turn, sc in each st across (20)</p>
        <footer>&copy; 2026</footer>
      </body></html>`;
    const { title, text } = htmlToPatternText(html);
    expect(title).toBe('Free Washcloth Pattern');
    expect(text).toContain('Row 1: ch 21');
    expect(text).toContain('Row 2: ch 1');
    expect(text).not.toContain('tracking()');
    expect(text).not.toContain('BUY YARN NOW');
    expect(text).not.toContain('Home | Shop');
  });

  it('decodes entities so instructions survive', () => {
    const { text } = htmlToPatternText('<p>sc in each st &ndash; 20 sts&hellip;</p>');
    expect(text).toContain('20 sts');
    expect(text).toContain('-');
  });
});
