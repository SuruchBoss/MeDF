'use client';

import type { OverlayDoc } from '@/lib/editor-types';
import { ApiError, apiFetch, uploadWithProgress } from '@/lib/client/fetcher';

/**
 * Everything the editor needs from the outside world.
 *
 * The editor itself is pure client-side work, so it does not care whether a
 * document lives on the server or only in this browser tab. Two adapters
 * implement this: `createServerBackend` (the product) and `DemoBackend` (the
 * static build published on GitHub Pages, which never uploads anything).
 */

export interface EditorBackend {
  readonly kind: 'server' | 'demo';
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

interface DocumentResponse {
  document: { revision: number; title: string };
}

/** Talks to the MeDF API. */
export function createServerBackend(documentId: string): EditorBackend {
  return {
    kind: 'server',
    pdfUrl: `/api/documents/${documentId}/file`,

    assetUrl(assetId) {
      return `/api/assets/${assetId}`;
    },

    async saveOverlay({ overlay, baseRevision }) {
      const result = await apiFetch<DocumentResponse>(`/api/documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ overlay, baseRevision }),
      });
      return { revision: result.document.revision };
    },

    async uploadAsset({ file, width, height }) {
      const form = new FormData();
      form.append('file', file);
      form.append('width', String(width));
      form.append('height', String(height));
      const result = await uploadWithProgress<{ asset: { id: string } }>({
        url: `/api/documents/${documentId}/assets`,
        form,
      });
      return { assetId: result.asset.id };
    },

    async exportPdf({ overlay, title }) {
      const response = await fetch(`/api/documents/${documentId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overlay, save: true, fileName: title }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new ApiError(
          payload?.error ?? `Export ไม่สำเร็จ (${response.status})`,
          response.status,
        );
      }
      return {
        blob: await response.blob(),
        skippedAssets: Number(response.headers.get('X-Medf-Skipped-Assets') ?? '0'),
      };
    },

    async rename(title) {
      const result = await apiFetch<DocumentResponse>(`/api/documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      return { title: result.document.title, revision: result.document.revision };
    },
  };
}
