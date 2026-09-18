'use client';

import { type Dispatch, useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/client/fetcher';
import type { OverlayDoc } from '@/lib/editor-types';
import type { EditorBackend } from './backend';
import type { EditorAction } from './store';

/**
 * Saving: the debounce, the revision the server last agreed to, and the
 * unload warning.
 *
 * Kept out of the shell because it has three pieces of hidden state that only
 * make sense together — the last overlay that reached the server, the revision
 * that came back with it, and whether a save is in flight. Split apart, it is
 * easy to clear the dirty flag for a save that no longer matches what is on
 * screen.
 */

/** Long enough that typing does not fire a save per keystroke. */
const AUTOSAVE_DELAY = 1200;

export interface AutosaveOptions {
  backend: EditorBackend;
  state: { overlay: OverlayDoc; dirty: boolean };
  dispatch: Dispatch<EditorAction>;
  revision: number;
  /** Called when a save fails with something worth showing the member. */
  onError: (message: string) => void;
}

export function useAutosave({ backend, state, dispatch, revision, onError }: AutosaveOptions) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const revisionRef = useRef(revision);
  const savedOverlayRef = useRef<OverlayDoc>(state.overlay);

  const save = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const snapshot = state.overlay;
      // Reducer actions always produce a new object, so identity is enough.
      if (snapshot === savedOverlayRef.current) return;

      setSaving(true);
      try {
        const result = await backend.saveOverlay({
          overlay: snapshot,
          baseRevision: revisionRef.current,
        });
        revisionRef.current = result.revision;
        savedOverlayRef.current = snapshot;
        setSavedAt(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
        // Only clear the dirty flag when nothing changed while saving.
        if (snapshot === state.overlay) dispatch({ type: 'saved' });
      } catch (error) {
        // A silent autosave still reports a real API error — a revision
        // conflict or a lost session is something the member must see.
        if (!options.silent || error instanceof ApiError) {
          onError(error instanceof ApiError ? error.message : 'บันทึกไม่สำเร็จ');
        }
      } finally {
        setSaving(false);
      }
    },
    [backend, dispatch, onError, state.overlay],
  );

  useEffect(() => {
    if (!state.dirty) return;
    const timer = window.setTimeout(() => void save({ silent: true }), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [state.dirty, state.overlay, save]);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!state.dirty) return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty]);

  /**
   * Records that the server accepted `overlay` outside the normal save path.
   *
   * Export sends the overlay with the request and the server stores it, so by
   * the time it returns the editor is no longer ahead of the server — without
   * this the next autosave would send the same document again and, worse, do
   * it against a revision the server has already moved past.
   */
  const markSaved = useCallback(
    (overlay: OverlayDoc) => {
      savedOverlayRef.current = overlay;
      revisionRef.current += 1;
      dispatch({ type: 'saved' });
    },
    [dispatch],
  );

  /** The server named the authoritative revision (a rename, say). */
  const setRevision = useCallback((next: number) => {
    revisionRef.current = next;
  }, []);

  return { save, saving, savedAt, markSaved, setRevision };
}
