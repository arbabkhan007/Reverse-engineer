/**
 * PDF text extraction.
 *
 * Reconstructs lines from positioned text items rather than trusting the order
 * the PDF stores them in, which is what makes most "copied from a PDF" pattern
 * text unusable. No OCR: pages that are scans contain no text and are reported
 * as such instead of silently producing nothing.
 */

export interface PdfExtraction {
  text: string;
  pages: number;
  pagesWithText: number;
  /** 1-based page numbers with no selectable text (likely scans). */
  emptyPages: number[];
}

export async function extractPdfText(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfExtraction> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];
  const emptyPages: number[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = new Map<number, Array<{ x: number; text: string }>>();

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const transform = item.transform as number[];
      // Round the baseline so items on the same visual line group together.
      const y = Math.round((transform[5] ?? 0) / 3) * 3;
      const x = transform[4] ?? 0;
      const list = lines.get(y) ?? [];
      list.push({ x, text: item.str });
      lines.set(y, list);
    }

    const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]);
    const pageText = ordered
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((item) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean)
      .join('\n');

    if (!pageText) emptyPages.push(pageNumber);
    pageTexts.push(pageText);
    page.cleanup();
    onProgress?.(pageNumber, document.numPages);
  }

  await document.destroy();

  return {
    text: pageTexts.join('\n\n'),
    pages: pageTexts.length,
    pagesWithText: pageTexts.length - emptyPages.length,
    emptyPages,
  };
}
