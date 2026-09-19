'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/client/fetcher';
import { LocalStoreError } from '@/lib/client/local-store';
import { storeFailureKey } from './local-backend';
import type { OverlayDoc } from '@/lib/editor-types';
import { useT } from '@/lib/i18n/provider';
import type { EditorBackend } from './backend';

/**
 * Saving: the debounce, the revision the server last agreed to, and the
 * unload warning.
 *
 * There is one piece of state — the overlay the server last accepted, and the
 * revision it answered with. Everything else is derived from it: the document
 * is unsaved exactly when the current overlay is not that object, and every
 * reducer action produces a new one, so that is an identity check.
 *
 * It used to be three: a `dirty` flag in the reducer, plus two refs here. They
 * could disagree — a flag cleared for a save that no longer matched the
 * screen, or a revision bumped without the overlay it belonged to — and the
 * failure looked like "my work stopped saving".
 */

/** Long enough that typing does not fire a save per keystroke. */
const AUTOSAVE_DELAY = 1200;

interface Accepted {
  overlay: OverlayDoc;
  revision: number;
}

export interface AutosaveOptions {
  backend: EditorBackend;
  /** The document as it stands in the editor. */
  overlay: OverlayDoc;
  /** The revision the server reported when this document was loaded. */
  revision: number;
  /** Called when a save fails with something worth showing the member. */
  onError: (message: string) => void;
}

export function useAutosave({ backend, overlay, revision, onError }: AutosaveOptions) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Accepted>({ overlay, revision });

  const dirty = overlay !== accepted.overlay;

  const save = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const snapshot = overlay;
      if (snapshot === accepted.overlay) return;

      setSaving(true);
      try {
        const result = await backend.saveOverlay({
          overlay: snapshot,
          baseRevision: accepted.revision,
        });
        // If the member kept editing while this was in flight, `overlay` has
        // moved on and `dirty` stays true by itself — nothing to reconcile.
        setAccepted({ overlay: snapshot, revision: result.revision });
        setSavedAt(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
      } catch (error) {
        // A silent autosave still speaks up when the member has to do
        // something: a revision conflict, or a browser that is out of room
        // and has quietly stopped keeping their work.
        const mustSee = error instanceof ApiError || error instanceof LocalStoreError;
        if (!options.silent || mustSee) {
          if (error instanceof ApiError) onError(error.message);
          else if (error instanceof LocalStoreError) onError(t(storeFailureKey(error)));
          else onError(t('shell.saveFailed'));
        }
      } finally {
        setSaving(false);
      }
    },
    [accepted.overlay, accepted.revision, backend, onError, overlay, t],
  );

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save({ silent: true }), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [dirty, save]);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (dirty) event.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /**
   * Records that the server accepted `next` outside the normal save path.
   *
   * Export sends the overlay with the request and the server stores it, so by
   * the time it returns the editor is no longer ahead of the server — without
   * this the next autosave would send the same document again and, worse, do
   * it against a revision the server has already moved past.
   */
  const markSaved = useCallback((next: OverlayDoc) => {
    setAccepted((current) => ({ overlay: next, revision: current.revision + 1 }));
  }, []);

  /** The server named the authoritative revision (a rename, say). */
  const setRevision = useCallback((next: number) => {
    setAccepted((current) => ({ ...current, revision: next }));
  }, []);

  return { save, saving, savedAt, dirty, markSaved, setRevision };
}
