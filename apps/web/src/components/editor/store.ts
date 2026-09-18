'use client';

import type { Dispatch } from 'react';
import {
  type AnyElement,
  type ElementType,
  type OverlayDoc,
  type PageState,
} from '@/lib/editor-types';

/**
 * Editor state and its reducer.
 *
 * Undo/redo works on whole-overlay snapshots. Continuous gestures (drag,
 * resize, rotate) dispatch a single `checkpoint` on pointer-down and then
 * update with `history: false`, so one gesture is one undo step.
 */

export type Tool = 'select' | ElementType;

/**
 * The fields of one element type that an edit may change — everything except
 * its identity.
 *
 * It is written distributively (`T extends unknown ? … : never`) on purpose:
 * `Omit` over a union keeps only the keys the members share, which would make
 * `fontSize` and friends unassignable. Distributing produces a union of
 * per-type patches instead, so a patch has to match exactly one element type.
 */
export type ElementPatch<T extends AnyElement = AnyElement> = T extends unknown
  ? Partial<Omit<T, 'id' | 'type'>>
  : never;

/**
 * The fields every element type shares — geometry, opacity, lock, page.
 *
 * This one is deliberately *not* distributive: `Omit` over a union keeps only
 * the common keys, which is exactly the right shape for an edit applied to a
 * mixed selection.
 */
export type BaseElementPatch = Partial<Omit<AnyElement, 'id' | 'type'>>;

export interface Guide {
  axis: 'x' | 'y';
  /** Position in base page space (points). */
  at: number;
}

export interface EditorState {
  overlay: OverlayDoc;
  selection: string[];
  activePage: number;
  tool: Tool;
  zoom: number;
  /** Element currently being text-edited. */
  editingId: string | null;
  guides: Guide[];
  past: OverlayDoc[];
  future: OverlayDoc[];
  dirty: boolean;
}

export type EditorAction =
  | { type: 'replace'; overlay: OverlayDoc; resetHistory?: boolean }
  | { type: 'checkpoint' }
  | { type: 'add'; element: AnyElement; select?: boolean }
  | { type: 'update'; ids: string[]; patch: BaseElementPatch; history?: boolean }
  | { type: 'updateOne'; id: string; patch: ElementPatch; history?: boolean }
  | { type: 'delete'; ids?: string[] }
  | { type: 'duplicate' }
  | { type: 'select'; ids: string[]; additive?: boolean }
  | { type: 'selectAllOnPage' }
  | { type: 'reorder'; id: string; to: 'front' | 'back' | 'forward' | 'backward' }
  | { type: 'tool'; tool: Tool }
  | { type: 'zoom'; zoom: number }
  | { type: 'activePage'; page: number }
  | { type: 'editing'; id: string | null }
  | { type: 'guides'; guides: Guide[] }
  | { type: 'pageRotate'; index: number; delta: 90 | -90 }
  | { type: 'pageToggleHidden'; index: number }
  | { type: 'pageMove'; index: number; to: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved' };

const HISTORY_LIMIT = 80;

export function createInitialState(overlay: OverlayDoc): EditorState {
  return {
    overlay,
    selection: [],
    activePage: 0,
    tool: 'select',
    zoom: 1,
    editingId: null,
    guides: [],
    past: [],
    future: [],
    dirty: false,
  };
}

function pushHistory(state: EditorState): Pick<EditorState, 'past' | 'future'> {
  return {
    past: [...state.past, state.overlay].slice(-HISTORY_LIMIT),
    future: [],
  };
}

/**
 * Applies a patch to the selected elements, keeping the discriminated union
 * intact.
 *
 * The cast is the one place where the union is re-formed: `patch` is typed for
 * a single element type, but the reducer works over the whole list. Pinning
 * `type` back keeps the discriminant honest, and `createPatcher` guarantees the
 * patch was checked against *some* element type before it got here.
 */
function patchElements(
  elements: AnyElement[],
  ids: string[],
  patch: ElementPatch | BaseElementPatch,
): AnyElement[] {
  const target = new Set(ids);
  return elements.map((element) =>
    target.has(element.id) && !element.locked
      ? ({ ...element, ...patch, type: element.type } as AnyElement)
      : element,
  );
}

/**
 * Builds an edit function bound to one element and typed to *that* element's
 * fields, so `{ fontSiz: 12 }` or `{ arrowEnd: true }` on a text box is a
 * compile error rather than a silent no-op.
 *
 * Call it inside a branch where the element type is already narrowed.
 */
export function createPatcher<T extends AnyElement>(
  element: T,
  dispatch: Dispatch<EditorAction>,
) {
  return (patch: ElementPatch<T>, history = true) =>
    dispatch({
      type: 'updateOne',
      id: element.id,
      // `ElementPatch<T>` is one member of `ElementPatch`; TypeScript cannot
      // see that while `T` is still generic.
      patch: patch as ElementPatch,
      history,
    });
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'replace':
      return {
        ...state,
        overlay: action.overlay,
        selection: [],
        editingId: null,
        dirty: action.resetHistory ? false : state.dirty,
        past: action.resetHistory ? [] : state.past,
        future: action.resetHistory ? [] : state.future,
      };

    case 'checkpoint':
      return { ...state, ...pushHistory(state) };

    case 'add': {
      const elements = [...state.overlay.elements, action.element];
      return {
        ...state,
        ...pushHistory(state),
        overlay: { ...state.overlay, elements },
        selection: action.select === false ? state.selection : [action.element.id],
        tool: 'select',
        dirty: true,
      };
    }

    case 'update':
    case 'updateOne': {
      const ids = action.type === 'update' ? action.ids : [action.id];
      const history = action.history ?? true;
      return {
        ...state,
        ...(history ? pushHistory(state) : {}),
        overlay: {
          ...state.overlay,
          elements: patchElements(state.overlay.elements, ids, action.patch),
        },
        dirty: true,
      };
    }

    case 'delete': {
      const ids = new Set(action.ids ?? state.selection);
      if (ids.size === 0) return state;
      const elements = state.overlay.elements.filter(
        (element) => !ids.has(element.id) || element.locked,
      );
      if (elements.length === state.overlay.elements.length) return state;
      return {
        ...state,
        ...pushHistory(state),
        overlay: { ...state.overlay, elements },
        selection: [],
        editingId: null,
        dirty: true,
      };
    }

    case 'duplicate': {
      if (state.selection.length === 0) return state;
      const selected = state.overlay.elements.filter((element) =>
        state.selection.includes(element.id),
      );
      const copies = selected.map((element) => ({
        ...element,
        id: createElementId(),
        x: element.x + 12,
        y: element.y + 12,
      })) as AnyElement[];
      return {
        ...state,
        ...pushHistory(state),
        overlay: { ...state.overlay, elements: [...state.overlay.elements, ...copies] },
        selection: copies.map((element) => element.id),
        dirty: true,
      };
    }

    case 'select': {
      if (action.additive) {
        const next = new Set(state.selection);
        for (const id of action.ids) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return { ...state, selection: [...next], editingId: null };
      }
      return { ...state, selection: action.ids, editingId: null };
    }

    case 'selectAllOnPage':
      return {
        ...state,
        selection: state.overlay.elements
          .filter((element) => element.page === state.activePage && !element.locked)
          .map((element) => element.id),
      };

    case 'reorder': {
      const elements = [...state.overlay.elements];
      const index = elements.findIndex((element) => element.id === action.id);
      if (index === -1) return state;
      const [element] = elements.splice(index, 1);
      const target =
        action.to === 'front'
          ? elements.length
          : action.to === 'back'
            ? 0
            : action.to === 'forward'
              ? Math.min(elements.length, index + 1)
              : Math.max(0, index - 1);
      elements.splice(target, 0, element);
      return {
        ...state,
        ...pushHistory(state),
        overlay: { ...state.overlay, elements },
        dirty: true,
      };
    }

    case 'tool':
      return { ...state, tool: action.tool, editingId: null };

    case 'zoom':
      return { ...state, zoom: Math.min(4, Math.max(0.2, action.zoom)) };

    case 'activePage':
      return { ...state, activePage: action.page };

    case 'editing':
      return { ...state, editingId: action.id };

    case 'guides':
      return { ...state, guides: action.guides };

    case 'pageRotate': {
      const pages = state.overlay.pages.map((page, index) =>
        index === action.index
          ? { ...page, rotation: normalizePageRotation(page.rotation + action.delta) }
          : page,
      );
      return {
        ...state,
        ...pushHistory(state),
        overlay: { ...state.overlay, pages },
        dirty: true,
      };
    }

    case 'pageToggleHidden': {
      const pages = state.overlay.pages.map((page, index) =>
        index === action.index ? { ...page, hidden: !page.hidden } : page,
      );
      if (pages.every((page) => page.hidden)) return state; // never hide every page
      return {
        ...state,
        ...pushHistory(state),
        overlay: { ...state.overlay, pages },
        dirty: true,
      };
    }

    case 'pageMove': {
      const { index, to } = action;
      if (index === to || to < 0 || to >= state.overlay.pages.length) return state;
      const pages = [...state.overlay.pages];
      const [page] = pages.splice(index, 1);
      pages.splice(to, 0, page);

      // Element page references follow the page they were placed on.
      const remap = new Map<number, number>();
      state.overlay.pages.forEach((original, originalIndex) => {
        remap.set(originalIndex, pages.indexOf(original));
      });
      const elements = state.overlay.elements.map((element) => ({
        ...element,
        page: remap.get(element.page) ?? element.page,
      })) as AnyElement[];

      return {
        ...state,
        ...pushHistory(state),
        overlay: { ...state.overlay, pages, elements },
        activePage: remap.get(state.activePage) ?? state.activePage,
        dirty: true,
      };
    }

    case 'undo': {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        overlay: previous,
        past: state.past.slice(0, -1),
        future: [state.overlay, ...state.future].slice(0, HISTORY_LIMIT),
        selection: [],
        editingId: null,
        dirty: true,
      };
    }

    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        overlay: next,
        past: [...state.past, state.overlay].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selection: [],
        editingId: null,
        dirty: true,
      };
    }

    case 'saved':
      return { ...state, dirty: false };

    default:
      return state;
  }
}

export function normalizePageRotation(angle: number): 0 | 90 | 180 | 270 {
  return (((angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

export function createElementId(): string {
  // `crypto.randomUUID` is available in every browser the app supports.
  return `el_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
}

/** On-screen size of a page once the member's own rotation is applied. */
export function rotatedPageSize(page: PageState): { width: number; height: number } {
  return page.rotation === 90 || page.rotation === 270
    ? { width: page.height, height: page.width }
    : { width: page.width, height: page.height };
}

/** Screen-space point (relative to the rotated page box) -> base page space. */
export function toBaseSpace(
  u: number,
  v: number,
  page: PageState,
): { x: number; y: number } {
  switch (page.rotation) {
    case 90:
      return { x: v, y: page.height - u };
    case 180:
      return { x: page.width - u, y: page.height - v };
    case 270:
      return { x: page.width - v, y: u };
    default:
      return { x: u, y: v };
  }
}

/** Pointer movement in screen space -> movement in base page space. */
export function deltaToBaseSpace(
  du: number,
  dv: number,
  page: PageState,
): { dx: number; dy: number } {
  switch (page.rotation) {
    case 90:
      return { dx: dv, dy: -du };
    case 180:
      return { dx: -du, dy: -dv };
    case 270:
      return { dx: -dv, dy: du };
    default:
      return { dx: du, dy: dv };
  }
}
