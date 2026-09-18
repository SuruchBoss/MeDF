'use client';

import type { OverlayDoc } from '@/lib/editor-types';
import { withBasePath } from '@/lib/base-path';
import { PLANS } from '@/lib/plans';
import { createBrowserFontLoader } from '@/lib/pdf/fonts-browser';
import { renderOverlayToPdf } from '@/lib/pdf/render';
import type { EditorBackend } from './backend';

/**
 * The try-it-now backend.
 *
 * Everything stays in this browser tab: the PDF is read from the file the
 * visitor picked, images live as blobs, and the export runs the *same*
 * renderer the server uses (`lib/pdf/render.ts`) with a fetching font loader.
 * Nothing is uploaded anywhere, which is both a privacy property worth stating
 * and what makes the static GitHub Pages build possible.
 *
 * It applies the Free plan's limits, so the demo is an honest preview of the
 * free tier rather than an unlimited version.
 */

export class DemoBackend implements EditorBackend {
  readonly kind = 'demo' as const;
  readonly pdfUrl: string;
  readonly notice =
    'โหมดทดลอง: ไฟล์ของคุณอยู่ในเบราว์เซอร์เท่านั้น ไม่ถูกอัปโหลดไปที่ใด · รีเฟรชหน้าแล้วต้องเริ่มใหม่';

  private revision = 1;
  private title: string;
  private readonly assets = new Map<string, { url: string; bytes: Uint8Array; mimeType: string }>();
  private readonly fontLoader = createBrowserFontLoader(withBasePath('/fonts'));

  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array, title: string) {
    this.bytes = bytes;
    this.title = title;
    this.pdfUrl = URL.createObjectURL(
      new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
    );
  }

  assetUrl(assetId: string): string {
    return this.assets.get(assetId)?.url ?? '';
  }

  async saveOverlay(): Promise<{ revision: number }> {
    // Nothing to persist: the overlay already lives in the editor's state.
    this.revision += 1;
    return { revision: this.revision };
  }

  async uploadAsset({ file }: { file: File; width: number; height: number }) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const assetId = `demo_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.assets.set(assetId, {
      url: URL.createObjectURL(file),
      bytes,
      mimeType: file.type,
    });
    return { assetId };
  }

  async exportPdf({ overlay, title }: { overlay: OverlayDoc; title: string }) {
    const result = await renderOverlayToPdf({
      source: this.bytes,
      overlay,
      fontLoader: this.fontLoader,
      loadAsset: async (assetId) => {
        const asset = this.assets.get(assetId);
        return asset ? { bytes: asset.bytes, mimeType: asset.mimeType } : null;
      },
      // The demo is the Free plan, footer included.
      watermark: PLANS.free.limits.watermark,
      title,
    });

    return {
      blob: new Blob([result.bytes as unknown as BlobPart], { type: 'application/pdf' }),
      skippedAssets: result.skipped.length,
    };
  }

  async rename(title: string) {
    this.title = title;
    return { title, revision: this.revision };
  }

  /** Releases the object URLs this backend created. */
  dispose(): void {
    URL.revokeObjectURL(this.pdfUrl);
    for (const asset of this.assets.values()) URL.revokeObjectURL(asset.url);
    this.assets.clear();
  }

  get currentTitle(): string {
    return this.title;
  }
}
