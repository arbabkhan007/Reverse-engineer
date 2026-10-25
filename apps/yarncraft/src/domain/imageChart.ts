/**
 * Image -> stitch chart (graphgan / colourwork) conversion.
 *
 * Deterministic palette reduction and run-length row building. No DOM access:
 * the client converts an image to pixels, everything below is pure and tested.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const hex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function distanceSq(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  // Weighted for perceived difference; the eye is least sensitive to blue.
  return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
}

export interface DownsampleOptions {
  /** Target chart width in stitches. */
  width: number;
  /** Target chart height in stitches. */
  height: number;
}

/**
 * Area-averages a source image down to the chart grid. Averaging rather than
 * nearest-neighbour keeps a photo's overall colour instead of picking noise.
 */
export function downsample(
  pixels: Rgb[],
  sourceWidth: number,
  sourceHeight: number,
  options: DownsampleOptions,
): Rgb[] {
  const { width, height } = options;
  const out: Rgb[] = new Array(width * height);
  const xScale = sourceWidth / width;
  const yScale = sourceHeight / height;

  for (let y = 0; y < height; y += 1) {
    const yStart = Math.floor(y * yScale);
    const yEnd = Math.max(yStart + 1, Math.floor((y + 1) * yScale));
    for (let x = 0; x < width; x += 1) {
      const xStart = Math.floor(x * xScale);
      const xEnd = Math.max(xStart + 1, Math.floor((x + 1) * xScale));
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let sy = yStart; sy < Math.min(yEnd, sourceHeight); sy += 1) {
        for (let sx = xStart; sx < Math.min(xEnd, sourceWidth); sx += 1) {
          const pixel = pixels[sy * sourceWidth + sx];
          if (!pixel) continue;
          r += pixel.r;
          g += pixel.g;
          b += pixel.b;
          count += 1;
        }
      }
      const divisor = count > 0 ? count : 1;
      out[y * width + x] = {
        r: Math.round(r / divisor),
        g: Math.round(g / divisor),
        b: Math.round(b / divisor),
      };
    }
  }
  return out;
}

/**
 * Reduces a set of colours to at most `maxColors`.
 *
 * Seeds are the most frequent colours in 5-bit-per-channel buckets, then Lloyd
 * iterations refine them. Seeding from real colours (not random points) keeps
 * the result reproducible and avoids inventing colours the image never had.
 */
export function buildPalette(pixels: Rgb[], maxColors: number, iterations = 6): Rgb[] {
  if (pixels.length === 0) return [];
  const limit = Math.max(1, Math.min(24, Math.floor(maxColors)));

  const buckets = new Map<number, { rgb: Rgb; count: number }>();
  for (const pixel of pixels) {
    const key =
      ((pixel.r >> 3) << 10) | ((pixel.g >> 3) << 5) | (pixel.b >> 3);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.rgb.r += pixel.r;
      existing.rgb.g += pixel.g;
      existing.rgb.b += pixel.b;
    } else {
      buckets.set(key, { rgb: { ...pixel }, count: 1 });
    }
  }

  const seeds = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => ({
      r: entry.rgb.r / entry.count,
      g: entry.rgb.g / entry.count,
      b: entry.rgb.b / entry.count,
    }));

  if (seeds.length <= 1) return seeds.map(roundRgb);

  let centroids = seeds;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const pixel of pixels) {
      let best = 0;
      let bestDistance = Infinity;
      for (let index = 0; index < centroids.length; index += 1) {
        const d = distanceSq(pixel, centroids[index]!);
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      }
      const total = sums[best]!;
      total.r += pixel.r;
      total.g += pixel.g;
      total.b += pixel.b;
      total.n += 1;
    }
    centroids = centroids.map((centroid, index) => {
      const total = sums[index]!;
      if (total.n === 0) return centroid;
      return { r: total.r / total.n, g: total.g / total.n, b: total.b / total.n };
    });
  }

  // Drop duplicates that converge to the same colour.
  const unique: Rgb[] = [];
  for (const centroid of centroids.map(roundRgb)) {
    if (!unique.some((entry) => entry.r === centroid.r && entry.g === centroid.g && entry.b === centroid.b)) {
      unique.push(centroid);
    }
  }
  return unique;
}

function roundRgb(color: Rgb): Rgb {
  return { r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b) };
}

/** Maps every pixel to the index of its nearest palette colour. */
export function mapToPalette(pixels: Rgb[], palette: Rgb[]): number[] {
  return pixels.map((pixel) => {
    let best = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < palette.length; index += 1) {
      const d = distanceSq(pixel, palette[index]!);
      if (d < bestDistance) {
        bestDistance = d;
        best = index;
      }
    }
    return best;
  });
}

export interface ChartBlock {
  /** Index into the palette. */
  color: number;
  /** Consecutive stitches of this colour. */
  run: number;
}

export interface ChartRow {
  row: number;
  blocks: ChartBlock[];
  total: number;
}

export function toChartRows(indices: number[], width: number): ChartRow[] {
  const rows: ChartRow[] = [];
  if (width <= 0) return rows;
  const height = Math.floor(indices.length / width);

  for (let y = 0; y < height; y += 1) {
    const blocks: ChartBlock[] = [];
    for (let x = 0; x < width; x += 1) {
      const color = indices[y * width + x] ?? 0;
      const last = blocks.at(-1);
      if (last && last.color === color) last.run += 1;
      else blocks.push({ color, run: 1 });
    }
    rows.push({ row: y + 1, blocks, total: width });
  }
  return rows;
}

const COLOR_NAMES = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
  'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
];

/** Palette labels are letters so written rows stay readable. */
export function colorLabel(index: number): string {
  return COLOR_NAMES[index] ?? `#${index + 1}`;
}

export interface ChartInstructions {
  legend: Array<{ label: string; hex: string }>;
  rows: Array<{ row: number; text: string; total: number }>;
  text: string;
}

/**
 * Written colourwork rows. Each block states its colour and run length, which
 * is exactly how a chart is worked in single crochet.
 */
export function chartInstructions(
  chartRows: ChartRow[],
  palette: Rgb[],
  meta: { title: string; stitch: string; width: number; height: number },
): ChartInstructions {
  const legend = palette.map((color, index) => ({
    label: colorLabel(index),
    hex: rgbToHex(color),
  }));

  const rows = chartRows.map((row) => {
    const parts = row.blocks.map(
      (block) => `${block.run} ${colorLabel(block.color)}`,
    );
    return { row: row.row, text: parts.join(', '), total: row.total };
  });

  const lines: string[] = [
    meta.title || 'Image chart',
    '',
    `Chart: ${meta.width} x ${meta.height} stitches in ${meta.stitch}`,
    '',
    'COLOURS',
    ...legend.map((entry) => `${entry.label} = ${entry.hex}`),
    '',
    'ABBREVIATIONS',
    'ch = chain',
    'sc = single crochet',
    'FO = fasten off',
    '',
    `Row 1: ch ${meta.width + 1}, sc in 2nd ch from hook and in each ch across`,
    ...rows.map((row) => `Row ${row.row}: ${row.text} (${row.total})`),
    '',
    'Finishing: Fasten off and weave in the ends. Carry the unused colour along the back.',
  ];

  return { legend, rows, text: lines.join('\n') };
}

/** Counts stitches per colour, for a yarn estimate. */
export function colorCounts(indices: number[], paletteLength: number): number[] {
  const counts = new Array<number>(paletteLength).fill(0);
  for (const index of indices) {
    if (index >= 0 && index < counts.length) counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

/** Convenience pipeline used by the page and the tests. */
export function imageToChart(
  pixels: Rgb[],
  sourceWidth: number,
  sourceHeight: number,
  options: { width: number; height: number; maxColors: number; title: string; stitch: string },
): ChartInstructions & { indices: number[]; palette: Rgb[] } {
  const grid = downsample(pixels, sourceWidth, sourceHeight, options);
  const palette = buildPalette(grid, options.maxColors);
  const indices = mapToPalette(grid, palette);
  const rows = toChartRows(indices, options.width);
  const instructions = chartInstructions(rows, palette, {
    title: options.title,
    stitch: options.stitch,
    width: options.width,
    height: options.height,
  });
  return { ...instructions, indices, palette };
}
