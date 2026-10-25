/**
 * Browser-side image intake.
 *
 * Reads a file, downscales it to a sane long edge, and returns a data URL plus
 * the final dimensions. The *policy* (target size, budget) lives in
 * `domain/journal.ts`; this file only performs the work the browser has to do.
 */

import { fitWithin, PHOTO_MAX_EDGE, PHOTO_BUDGET_BYTES, dataUrlBytes } from '../../domain/journal.ts';

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.45];

/**
 * Decode, downscale and re-encode. Quality steps down until the result fits the
 * per-photo budget, so a photo-heavy journal does not silently exceed the
 * storage quota on the first save.
 */
export async function loadImageFile(file: File, maxEdge = PHOTO_MAX_EDGE): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.');
  }

  const bitmap = await createImageBitmap(file);
  const target = fitWithin(bitmap.width, bitmap.height, maxEdge);
  if (target.width === 0 || target.height === 0) {
    bitmap.close();
    throw new Error('That image has no usable dimensions.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This browser would not give us a drawing surface.');
  }

  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();

  let dataUrl = canvas.toDataURL('image/jpeg', QUALITY_STEPS[0]);
  for (const quality of QUALITY_STEPS.slice(1)) {
    if (dataUrlBytes(dataUrl) <= PHOTO_BUDGET_BYTES) break;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return {
    dataUrl,
    width: target.width,
    height: target.height,
    bytes: dataUrlBytes(dataUrl),
  };
}

/** Format a byte count for display. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
