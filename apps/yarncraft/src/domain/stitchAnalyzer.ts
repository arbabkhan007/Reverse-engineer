/**
 * Stitch identification from a photo.
 *
 * The offline path is deterministic image analysis: it measures texture
 * features and scores them against stitch profiles. It is an aid to the eye,
 * not an oracle - every result carries the measured features and an explicit
 * confidence so the maker can judge the answer.
 */

import type { StitchAnalysis, StitchFeature, StitchGuess } from '../shared/types.ts';
import { STITCHES } from './stitches.ts';

export interface GrayImage {
  width: number;
  height: number;
  /** Luma, 0-255, row-major. */
  luma: Float32Array;
}

/** Converts RGBA pixel data to luma. */
export function toGrayImage(data: Uint8ClampedArray, width: number, height: number): GrayImage {
  const luma = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { width, height, luma };
}

export interface TextureFeatures {
  /** Mean absolute Sobel gradient, normalised 0-1. */
  edgeDensity: number;
  /** Share of gradient energy that is horizontally oriented (rows of bumps). */
  horizontalEnergy: number;
  /** Share of gradient energy that is vertically oriented (columns of posts). */
  verticalEnergy: number;
  /** Dominant horizontal spacing in pixels (stitch width). */
  stitchWidthPx: number | null;
  /** Dominant vertical spacing in pixels (row height). */
  rowHeightPx: number | null;
  /** Ratio of row height to stitch width - the key discriminator. */
  aspectRatio: number | null;
  /** Standard deviation of luma, normalised 0-1. */
  contrast: number;
  /** Estimated number of visible rows in the crop. */
  estimatedRows: number | null;
  /** How regular the texture is, 0-1. High means machine-clean fabric. */
  regularity: number;
}

function autocorrelationPeak(signal: number[], minLag: number, maxLag: number): { lag: number; strength: number } | null {
  const n = signal.length;
  if (n < minLag * 2) return null;
  const mean = signal.reduce((a, b) => a + b, 0) / n;
  const centred = signal.map((v) => v - mean);
  const variance = centred.reduce((a, b) => a + b * b, 0) / n;
  if (variance < 1e-6) return null;

  let bestLag = -1;
  let bestValue = 0;
  for (let lag = minLag; lag <= Math.min(maxLag, Math.floor(n / 2)); lag += 1) {
    let sum = 0;
    for (let i = 0; i < n - lag; i += 1) sum += centred[i]! * centred[i + lag]!;
    const value = sum / (n - lag) / variance;
    if (value > bestValue) {
      bestValue = value;
      bestLag = lag;
    }
  }
  if (bestLag < 0) return null;
  return { lag: bestLag, strength: Math.max(0, Math.min(1, bestValue)) };
}

export function extractFeatures(image: GrayImage): TextureFeatures {
  const { width, height, luma } = image;
  let gxEnergy = 0;
  let gyEnergy = 0;
  let magnitudeSum = 0;
  let count = 0;

  const columnMeans = new Array<number>(width).fill(0);
  const rowMeans = new Array<number>(height).fill(0);
  const columnCounts = new Array<number>(width).fill(0);
  const rowCounts = new Array<number>(height).fill(0);

  let sum = 0;
  let sumSq = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = (dx: number, dy: number) => luma[(y + dy) * width + (x + dx)] ?? 0;
      // Sobel kernels.
      const gx =
        -at(-1, -1) - 2 * at(-1, 0) - at(-1, 1) + at(1, -1) + 2 * at(1, 0) + at(1, 1);
      const gy =
        -at(-1, -1) - 2 * at(0, -1) - at(1, -1) + at(-1, 1) + 2 * at(0, 1) + at(1, 1);
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      gxEnergy += gx * gx;
      gyEnergy += gy * gy;
      magnitudeSum += magnitude;
      count += 1;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = luma[y * width + x] ?? 0;
      columnMeans[x]! += value;
      columnCounts[x]! += 1;
      rowMeans[y]! += value;
      rowCounts[y]! += 1;
      sum += value;
      sumSq += value * value;
    }
  }

  const mean = sum / (width * height);
  const variance = Math.max(0, sumSq / (width * height) - mean * mean);
  const contrast = Math.min(1, Math.sqrt(variance) / 128);

  const colProfile = columnMeans.map((v, i) => v / Math.max(1, columnCounts[i]!));
  const rowProfile = rowMeans.map((v, i) => v / Math.max(1, rowCounts[i]!));

  const minLag = 3;
  const colPeak = autocorrelationPeak(colProfile, minLag, Math.max(minLag + 1, Math.floor(width / 3)));
  const rowPeak = autocorrelationPeak(rowProfile, minLag, Math.max(minLag + 1, Math.floor(height / 3)));

  const totalEnergy = gxEnergy + gyEnergy;
  const verticalEnergy = totalEnergy > 0 ? gyEnergy / totalEnergy : 0.5;

  return {
    edgeDensity: count > 0 ? Math.min(1, magnitudeSum / count / 255) : 0,
    horizontalEnergy: 1 - verticalEnergy,
    verticalEnergy,
    stitchWidthPx: colPeak?.lag ?? null,
    rowHeightPx: rowPeak?.lag ?? null,
    aspectRatio:
      colPeak && rowPeak && colPeak.lag > 0 ? rowPeak.lag / colPeak.lag : null,
    contrast,
    estimatedRows: rowPeak && rowPeak.lag > 0 ? Math.round(height / rowPeak.lag) : null,
    regularity: Math.max(colPeak?.strength ?? 0, rowPeak?.strength ?? 0),
  };
}

interface Profile {
  code: string;
  /** Expected aspect ratio (row height / stitch width). */
  aspect: number;
  /** Expected edge density. */
  density: number;
  /** Expected share of vertical gradient energy. */
  vertical: number;
  /** Expected contrast. */
  contrast: number;
  reason: string;
}

/**
 * Reference profiles derived from how each stitch is constructed: taller
 * stitches give a taller row and more open fabric; dense stitches give more
 * edge energy; knitted columns give more vertical energy than crochet rows.
 */
const PROFILES: Profile[] = [
  {
    code: 'sc',
    aspect: 0.85,
    density: 0.3,
    vertical: 0.5,
    contrast: 0.3,
    reason: 'very regular, dense and even texture with roughly square cells',
  },
  {
    code: 'hdc',
    aspect: 1.35,
    density: 0.24,
    vertical: 0.56,
    contrast: 0.28,
    reason: 'short posts with soft ridges, cells taller than they are wide',
  },
  {
    code: 'dc',
    aspect: 1.9,
    density: 0.18,
    vertical: 0.62,
    contrast: 0.25,
    reason: 'tall posts with visible gaps and a woven horizontal grid',
  },
  {
    code: 'tr',
    aspect: 2.6,
    density: 0.13,
    vertical: 0.66,
    contrast: 0.22,
    reason: 'long open posts, fabric reads as airy and net-like',
  },
  {
    code: 'slst',
    aspect: 0.4,
    density: 0.12,
    vertical: 0.45,
    contrast: 0.18,
    reason: 'nearly flat fabric with a single faint seam line',
  },
  {
    code: 'bobble',
    aspect: 1.0,
    density: 0.36,
    vertical: 0.45,
    contrast: 0.38,
    reason: 'repeating raised balls on a flat background',
  },
  {
    code: 'shell',
    aspect: 1.5,
    density: 0.26,
    vertical: 0.35,
    contrast: 0.33,
    reason: 'strong diagonal scallops and fan shapes',
  },
  {
    code: 'k',
    aspect: 0.75,
    density: 0.28,
    vertical: 0.7,
    contrast: 0.26,
    reason: 'interlocking V columns typical of knitted stockinette',
  },
  {
    code: 'p',
    aspect: 0.55,
    density: 0.3,
    vertical: 0.32,
    contrast: 0.3,
    reason: 'horizontal wavy bumps stacked in rows, typical of purl fabric',
  },
];

function score(profile: Profile, features: TextureFeatures): number {
  let distance = 0;
  let weight = 0;

  if (features.aspectRatio !== null) {
    distance += Math.abs(Math.log((features.aspectRatio + 0.01) / profile.aspect)) * 1.6;
    weight += 1.6;
  }
  distance += Math.abs(features.edgeDensity - profile.density) * 3.2;
  weight += 3.2;
  distance += Math.abs(features.verticalEnergy - profile.vertical) * 2.6;
  weight += 2.6;
  distance += Math.abs(features.contrast - profile.contrast) * 1.2;
  weight += 1.2;

  const normalised = weight > 0 ? distance / weight : 1;
  return Math.max(0, 1 - normalised);
}

function featureList(features: TextureFeatures): StitchFeature[] {
  const list: StitchFeature[] = [
    { label: 'Edge density', value: features.edgeDensity.toFixed(2) },
    {
      label: 'Vertical vs horizontal edges',
      value: `${Math.round(features.verticalEnergy * 100)}% / ${Math.round(features.horizontalEnergy * 100)}%`,
    },
    { label: 'Contrast', value: features.contrast.toFixed(2) },
    { label: 'Texture regularity', value: features.regularity.toFixed(2) },
  ];
  if (features.stitchWidthPx !== null) {
    list.push({ label: 'Stitch width', value: `${features.stitchWidthPx} px` });
  }
  if (features.rowHeightPx !== null) {
    list.push({ label: 'Row height', value: `${features.rowHeightPx} px` });
  }
  if (features.aspectRatio !== null) {
    list.push({ label: 'Row height / stitch width', value: features.aspectRatio.toFixed(2) });
  }
  if (features.estimatedRows !== null) {
    list.push({ label: 'Visible rows in crop', value: `${features.estimatedRows}` });
  }
  return list;
}

/** Deterministic offline analysis. */
export function analyzeOffline(image: GrayImage): StitchAnalysis {
  const features = extractFeatures(image);
  const scored = PROFILES.map((profile) => {
    const stitch = STITCHES.find((s) => s.code === profile.code);
    return {
      code: profile.code,
      name: stitch?.name ?? profile.code,
      score: score(profile, features),
      reason: profile.reason,
    };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0]!;
  const second = scored[1];
  const spread = top.score - (second?.score ?? 0);

  // Confidence reflects both absolute fit and the margin over the runner-up.
  const confidence = Math.max(
    0.05,
    Math.min(0.92, top.score * 0.62 + Math.min(0.3, spread * 1.5)),
  );

  const guesses: StitchGuess[] = scored.slice(0, 3).map((entry, index) => ({
    code: entry.code,
    name: entry.name,
    confidence:
      index === 0
        ? confidence
        : Math.max(0.03, Math.min(top.score * 0.5, entry.score * 0.55)),
    reason: entry.reason,
  }));

  const caveats: string[] = [];
  if (features.regularity < 0.25) caveats.push('the texture is not strongly periodic');
  if (features.contrast < 0.12) caveats.push('the photo has low contrast');
  if (features.aspectRatio === null) caveats.push('no clear row spacing was found');
  if (top.score < 0.55) caveats.push('no profile fits well');

  return {
    guesses,
    features: featureList(features),
    source: 'offline',
    note:
      caveats.length > 0
        ? `Measured features only - ${caveats.join(', ')}. Treat this as a hint and compare with the stitch gallery.`
        : 'Measured from texture features (edge density, orientation, row/stitch spacing). Use the top two results as candidates, not as certainty.',
  };
}

/**
 * Downscales and crops an image for analysis, keeping the most detailed region.
 * Small crops analyse better: individual stitches need to be visible.
 */
export function prepareCanvasImage(source: HTMLImageElement, targetSize = 320): GrayImage {
  const canvas = document.createElement('canvas');
  const side = Math.min(source.naturalWidth, source.naturalHeight);
  const sx = (source.naturalWidth - side) / 2;
  const sy = (source.naturalHeight - side) / 2;
  canvas.width = targetSize;
  canvas.height = targetSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.drawImage(source, sx, sy, side, side, 0, 0, targetSize, targetSize);
  const data = context.getImageData(0, 0, targetSize, targetSize).data;
  return toGrayImage(data, targetSize, targetSize);
}
