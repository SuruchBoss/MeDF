'use client';

import type { OverlayDoc } from '@/lib/editor-types';
import { withBasePath } from '@/lib/base-path';
import { PLANS } from '@/lib/plans';
import { createTranslator } from '@/lib/i18n';
import { detectLocaleInBrowser } from '@/lib/i18n/provider';
import { createBrowserFontLoader } from '@/lib/pdf/fonts-browser';
import { renderOverlayToPdf } from '@/lib/pdf/render';
import {
  type StoredAsset,
  LocalStoreError,
  newAssetId,
  putAsset,
  renameDocument,
  saveOverlay,
} from '@/lib/client/local-store';
import type { EditorBackend } from './backend';

/**
 * The editor backed by IndexedDB.
 *
 * Same shape as `DemoBackend`, and the same export path — the difference is
 * only where the bytes rest between visits. Assets are held in memory as
 * object URLs *and* written to the store: the editor needs a URL it can put in
 * an `<img>` this second, and the member needs the image to still be there
 * tomorrow.
 */
export class LocalBackend implements EditorBackend {
  readonly kind = 'local' as const;
  readonly pdfUrl: string;

  private readonly documentId: string;
  private readonly bytes: Uint8Array;
  private readonly assets = new Map<string, { url: string; bytes: Uint8Array; mimeType: string }>();
  private readonly fontLoader = createBrowserFontLoader(withBasePath('/fonts'));
  private title: string;
  private revision: number;

  /**
   * `stored` are the images this document already had, so an image placed
   * yesterday still renders on today's visit.
   */
  constructor(input: {
    documentId: string;
    bytes: Uint8Array;
    title: string;
    revision: number;
    stored: StoredAsset[];
  }) {
    this.documentId = input.documentId;
    this.bytes = input.bytes;
    this.title = input.title;
    this.revision = input.revision;
    this.pdfUrl = URL.createObjectURL(
      new Blob([input.bytes as unknown as BlobPart], { type: 'application/pdf' }),
    );

    for (const asset of input.stored) {
      this.assets.set(asset.assetId, {
        url: URL.createObjectURL(asset.blob),
        // Read lazily on export rather than held twice in memory.
        bytes: new Uint8Array(),
        mimeType: asset.blob.type,
      });
      void this.hydrate(asset);
    }
  }

  /** Pulls an asset's bytes into memory for the exporter, without blocking. */
  private async hydrate(asset: StoredAsset): Promise<void> {
    const entry = this.assets.get(asset.assetId);
    if (!entry) return;
    entry.bytes = new Uint8Array(await asset.blob.arrayBuffer());
  }

  assetUrl(assetId: string): string {
    return this.assets.get(assetId)?.url ?? '';
  }

  async saveOverlay({ overlay }: { overlay: OverlayDoc; baseRevision: number }) {
    const { revision } = await saveOverlay(this.documentId, overlay);
    this.revision = revision;
    return { revision };
  }

  async uploadAsset({ file, width, height }: { file: File; width: number; height: number }) {
    const assetId = newAssetId();
    const bytes = new Uint8Array(await file.arrayBuffer());

    // In memory first so the image appears immediately; if the write fails on
    // quota the editor still shows it, and the save that follows reports it.
    this.assets.set(assetId, {
      url: URL.createObjectURL(file),
      bytes,
      mimeType: file.type,
    });
    await putAsset({ assetId, documentId: this.documentId, blob: file, width, height });
    return { assetId };
  }

  async exportPdf({ overlay, title }: { overlay: OverlayDoc; title: string }) {
    const t = createTranslator(detectLocaleInBrowser());
    const result = await renderOverlayToPdf({
      source: this.bytes,
      overlay,
      fontLoader: this.fontLoader,
      loadAsset: async (assetId) => {
        const asset = this.assets.get(assetId);
        return asset && asset.bytes.byteLength > 0
          ? { bytes: asset.bytes, mimeType: asset.mimeType }
          : null;
      },
      watermark: PLANS.free.limits.watermark,
      watermarkText: t('export.watermark'),
      title,
    });

    return {
      blob: new Blob([result.bytes as unknown as BlobPart], { type: 'application/pdf' }),
      skippedAssets: result.skipped.length,
    };
  }

  async rename(title: string) {
    const { revision } = await renameDocument(this.documentId, title);
    this.title = title;
    this.revision = revision;
    return { title, revision };
  }

  dispose(): void {
    URL.revokeObjectURL(this.pdfUrl);
    for (const asset of this.assets.values()) URL.revokeObjectURL(asset.url);
    this.assets.clear();
  }

  get currentTitle(): string {
    return this.title;
  }

  get currentRevision(): number {
    return this.revision;
  }
}

/** Turns a store failure into the message key the UI should show. */
export function storeFailureKey(error: unknown): 'store.quotaFull' | 'store.unavailable' | 'store.failed' {
  if (!(error instanceof LocalStoreError)) return 'store.failed';
  if (error.reason === 'quota') return 'store.quotaFull';
  if (error.reason === 'unavailable') return 'store.unavailable';
  return 'store.failed';
}
