'use client';

import type { OverlayDoc } from '@/lib/editor-types';

/**
 * Everything the editor needs from the outside world.
 *
 * The editor itself is pure client-side work, so it does not care where a
 * document comes from. `DemoBackend` implements this today, holding
 * everything in the tab and uploading nothing; #9 adds `LocalBackend` on
 * IndexedDB beside it. The interface is the seam that makes that a new file
 * rather than a rewrite — do not collapse it into its one caller.
 */

export interface EditorBackend {
  readonly kind: 'demo' | 'local';
  /** URL pdf.js loads the source document from. */
  readonly pdfUrl: string;
  /** Resolves an image element's asset to a URL the browser can render. */
  assetUrl(assetId: string): string;
  saveOverlay(input: { overlay: OverlayDoc; baseRevision: number }): Promise<{ revision: number }>;
  uploadAsset(input: { file: File; width: number; height: number }): Promise<{ assetId: string }>;
  exportPdf(input: {
    overlay: OverlayDoc;
    title: string;
  }): Promise<{ blob: Blob; skippedAssets: number }>;
  rename(title: string): Promise<{ title: string; revision: number }>;
  /** Shown once in the editor; used by the demo to explain its limits. */
  readonly notice?: string;
}

