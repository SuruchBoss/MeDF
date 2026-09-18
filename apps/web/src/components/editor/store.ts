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
 * There is no `dirty` flag here on purpose. Whether the document differs from
 * what the server holds is not something the reducer can know — it never sees
 * a save — so `useAutosave` derives it by comparing the current overlay with
 * the last one the server accepted. Every action produces a new overlay
 * object, so that comparison is an identity check.
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

/**
 * What gets saved, and the history of it.
 *
 * Kept apart from the view below so the difference is a type rather than a
 * convention: everything here is written to the server, nothing there is.
 * It also means a zoom or a selection leaves this object's identity alone, so
 * anything that only reads the document can skip re-rendering.
 */
export interface DocumentState {
  overlay: OverlayDoc;
  past: OverlayDoc[];
  future: OverlayDoc[];
}

/** What the member is looking at. Never saved, never undone. */
export interface ViewState {
  selection: string[];
  activePage: number;
  tool: Tool;
  zoom: number;
  /** Element currently being text-edited. */
  editingId: string | null;
  guides: Guide[];
}

export interface EditorState {
  doc: DocumentState;
  view: ViewState;
}

export type EditorAction =
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
  | { type: 'redo' };

const HISTORY_LIMIT = 80;

export function createInitialState(overlay: OverlayDoc): EditorState {
  return {
    doc: { overlay, past: [], future: [] },
    view: {
      selection: [],
      activePage: 0,
      tool: 'select',
      zoom: 1,
      editingId: null,
      guides: [],
    },
  };
}

/** A document change, leaving the view object's identity alone. */
function withDoc(state: EditorState, doc: Partial<DocumentState>): EditorState {
  return { view: state.view, doc: { ...state.doc, ...doc } };
}

/** A view change, leaving the document object's identity alone. */
function withView(state: EditorState, view: Partial<ViewState>): EditorState {
  return { doc: state.doc, view: { ...state.view, ...view } };
}

function pushHistory(state: EditorState): Pick<DocumentState, 'past' | 'future'> {
  return {
    past: [...state.doc.past, state.doc.overlay].slice(-HISTORY_LIMIT),
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
    case 'checkpoint':
      return withDoc(state, pushHistory(state));

    case 'add': {
      const elements = [...state.doc.overlay.elements, action.element];
      return {
        doc: { ...state.doc, ...pushHistory(state), overlay: { ...state.doc.overlay, elements } },
        view: {
          ...state.view,
          selection: action.select === false ? state.view.selection : [action.element.id],
          tool: 'select',
        },
      };
    }

    case 'update':
    case 'updateOne': {
      const ids = action.type === 'update' ? action.ids : [action.id];
      const history = action.history ?? true;
      return withDoc(state, {
        ...(history ? pushHistory(state) : {}),
        overlay: {
          ...state.doc.overlay,
          elements: patchElements(state.doc.overlay.elements, ids, action.patch),
        },
      });
    }

    case 'delete': {
      const ids = new Set(action.ids ?? state.view.selection);
      if (ids.size === 0) return state;
      const elements = state.doc.overlay.elements.filter(
        (element) => !ids.has(element.id) || element.locked,
      );
      if (elements.length === state.doc.overlay.elements.length) return state;
      return {
        doc: { ...state.doc, ...pushHistory(state), overlay: { ...state.doc.overlay, elements } },
        view: { ...state.view, selection: [], editingId: null },
      };
    }

    case 'duplicate': {
      if (state.view.selection.length === 0) return state;
      const selected = state.doc.overlay.elements.filter((element) =>
        state.view.selection.includes(element.id),
      );
      const copies = selected.map((element) => ({
        ...element,
        id: createElementId(),
        x: element.x + 12,
        y: element.y + 12,
      })) as AnyElement[];
      return {
        doc: {
          ...state.doc,
          ...pushHistory(state),
          overlay: {
            ...state.doc.overlay,
            elements: [...state.doc.overlay.elements, ...copies],
          },
        },
        view: { ...state.view, selection: copies.map((element) => element.id) },
      };
    }

    case 'select': {
      if (action.additive) {
        const next = new Set(state.view.selection);
        for (const id of action.ids) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return withView(state, { selection: [...next], editingId: null });
      }
      return withView(state, { selection: action.ids, editingId: null });
    }

    case 'selectAllOnPage':
      return withView(state, {
        selection: state.doc.overlay.elements
          .filter((element) => element.page === state.view.activePage && !element.locked)
          .map((element) => element.id),
      });

    case 'reorder': {
      const elements = [...state.doc.overlay.elements];
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
      return withDoc(state, {
        ...pushHistory(state),
        overlay: { ...state.doc.overlay, elements },
      });
    }

    case 'tool':
      return withView(state, { tool: action.tool, editingId: null });

    case 'zoom':
      return withView(state, { zoom: Math.min(4, Math.max(0.2, action.zoom)) });

    case 'activePage':
      return withView(state, { activePage: action.page });

    case 'editing':
      return withView(state, { editingId: action.id });

    case 'guides':
      return withView(state, { guides: action.guides });

    case 'pageRotate': {
      const pages = state.doc.overlay.pages.map((page, index) =>
        index === action.index
          ? { ...page, rotation: normalizePageRotation(page.rotation + action.delta) }
          : page,
      );
      return withDoc(state, {
        ...pushHistory(state),
        overlay: { ...state.doc.overlay, pages },
      });
    }

    case 'pageToggleHidden': {
      const pages = state.doc.overlay.pages.map((page, index) =>
        index === action.index ? { ...page, hidden: !page.hidden } : page,
      );
      if (pages.every((page) => page.hidden)) return state; // never hide every page
      return withDoc(state, {
        ...pushHistory(state),
        overlay: { ...state.doc.overlay, pages },
      });
    }

    case 'pageMove': {
      const { index, to } = action;
      if (index === to || to < 0 || to >= state.doc.overlay.pages.length) return state;
      const pages = [...state.doc.overlay.pages];
      const [page] = pages.splice(index, 1);
      pages.splice(to, 0, page);

      // Element page references follow the page they were placed on.
      const remap = new Map<number, number>();
      state.doc.overlay.pages.forEach((original, originalIndex) => {
        remap.set(originalIndex, pages.indexOf(original));
      });
      const elements = state.doc.overlay.elements.map((element) => ({
        ...element,
        page: remap.get(element.page) ?? element.page,
      })) as AnyElement[];

      return {
        doc: {
          ...state.doc,
          ...pushHistory(state),
          overlay: { ...state.doc.overlay, pages, elements },
        },
        view: {
          ...state.view,
          activePage: remap.get(state.view.activePage) ?? state.view.activePage,
        },
      };
    }

    case 'undo': {
      const previous = state.doc.past.at(-1);
      if (!previous) return state;
      return {
        doc: {
          overlay: previous,
          past: state.doc.past.slice(0, -1),
          future: [state.doc.overlay, ...state.doc.future].slice(0, HISTORY_LIMIT),
        },
        // The elements that were selected may not exist in the earlier overlay.
        view: { ...state.view, selection: [], editingId: null },
      };
    }

    case 'redo': {
      const next = state.doc.future[0];
      if (!next) return state;
      return {
        doc: {
          overlay: next,
          past: [...state.doc.past, state.doc.overlay].slice(-HISTORY_LIMIT),
          future: state.doc.future.slice(1),
        },
        view: { ...state.view, selection: [], editingId: null },
      };
    }

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
