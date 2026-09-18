'use client';

import { type Dispatch, useEffect } from 'react';
import type { AnyElement } from '@/lib/editor-types';
import { type EditorAction, type EditorState } from './store';

/**
 * Keyboard shortcuts for the stage.
 *
 * A single window listener rather than handlers on the stage, because the
 * shortcuts must work wherever focus happens to be — a member who has just
 * clicked a panel button still expects Ctrl+Z to undo.
 */

export interface ShortcutOptions {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  /** The currently selected elements, already resolved from their ids. */
  selection: AnyElement[];
  save: () => void;
  pickImage: () => void;
  openSignaturePad: () => void;
}

/** True while the member is typing somewhere a shortcut would hijack. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  );
}

/** Single letters that just pick a tool. */
const TOOL_KEYS: Record<string, EditorAction> = {
  v: { type: 'tool', tool: 'select' },
  t: { type: 'tool', tool: 'text' },
  r: { type: 'tool', tool: 'rect' },
  o: { type: 'tool', tool: 'ellipse' },
  l: { type: 'tool', tool: 'line' },
  h: { type: 'tool', tool: 'highlight' },
  k: { type: 'tool', tool: 'check' },
};

export function useEditorShortcuts({
  state,
  dispatch,
  selection,
  save,
  pickImage,
  openSignaturePad,
}: ShortcutOptions) {
  const { editingId, zoom } = state;
  const selectionCount = state.selection.length;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target) || editingId) return;

      const meta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (meta) {
        const take = (action: () => void) => {
          event.preventDefault();
          action();
        };
        if (key === 'z') return take(() => dispatch({ type: event.shiftKey ? 'redo' : 'undo' }));
        if (key === 'y') return take(() => dispatch({ type: 'redo' }));
        if (key === 's') return take(save);
        if (key === 'd') return take(() => dispatch({ type: 'duplicate' }));
        if (key === 'a') return take(() => dispatch({ type: 'selectAllOnPage' }));
        if (event.key === '+' || event.key === '=') {
          return take(() => dispatch({ type: 'zoom', zoom: zoom + 0.1 }));
        }
        if (event.key === '-') return take(() => dispatch({ type: 'zoom', zoom: zoom - 0.1 }));
        if (event.key === ']' || event.key === '[') {
          const to = event.key === ']' ? 'front' : 'back';
          return take(() => {
            for (const element of selection) dispatch({ type: 'reorder', id: element.id, to });
          });
        }
        // Every other modifier combination belongs to the browser.
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectionCount === 0) return;
        event.preventDefault();
        dispatch({ type: 'delete' });
        return;
      }

      if (event.key === 'Escape') {
        dispatch({ type: 'select', ids: [] });
        dispatch({ type: 'tool', tool: 'select' });
        return;
      }

      if (event.key.startsWith('Arrow') && selectionCount > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        // One checkpoint, then history-free moves: a held arrow key is one
        // undo step, the same as one drag.
        dispatch({ type: 'checkpoint' });
        for (const element of selection) {
          dispatch({
            type: 'updateOne',
            id: element.id,
            patch: { x: element.x + dx, y: element.y + dy },
            history: false,
          });
        }
        return;
      }

      const tool = TOOL_KEYS[key];
      if (tool) {
        event.preventDefault();
        dispatch(tool);
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        pickImage();
        return;
      }
      if (key === 's') {
        event.preventDefault();
        openSignaturePad();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, editingId, openSignaturePad, pickImage, save, selection, selectionCount, zoom]);
}
