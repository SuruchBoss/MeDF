import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnyElement, OverlayDoc, PageState, TextElement } from '../src/lib/editor-types.ts';
import {
  type EditorAction,
  type EditorState,
  createInitialState,
  deltaToBaseSpace,
  editorReducer,
  normalizePageRotation,
  rotatedPageSize,
  toBaseSpace,
} from '../src/components/editor/store.ts';

function page(overrides: Partial<PageState> = {}): PageState {
  return { source: 0, width: 600, height: 800, rotation: 0, hidden: false, ...overrides };
}

function text(id: string, overrides: Partial<TextElement> = {}): TextElement {
  return {
    id,
    type: 'text',
    page: 0,
    x: 10,
    y: 20,
    w: 100,
    h: 40,
    rotation: 0,
    opacity: 1,
    locked: false,
    text: id,
    fontFamily: 'sarabun',
    fontSize: 16,
    bold: false,
    italic: false,
    underline: false,
    color: '#111827',
    align: 'left',
    lineHeight: 1.35,
    background: null,
    padding: 4,
    ...overrides,
  };
}

function overlay(elements: AnyElement[], pages: PageState[] = [page(), page()]): OverlayDoc {
  return { version: 1, pages, elements };
}

function stateWith(
  elements: AnyElement[],
  pages?: PageState[],
  view: Partial<EditorState['view']> = {},
): EditorState {
  const base = createInitialState(overlay(elements, pages));
  return { ...base, view: { ...base.view, ...view } };
}

function byId(state: EditorState, id: string): AnyElement {
  const found = state.doc.overlay.elements.find((element) => element.id === id);
  assert.ok(found, `element ${id} is missing`);
  return found;
}

describe('createInitialState', () => {
  it('starts clean, unselected and without history', () => {
    const state = stateWith([text('a')]);
    assert.deepEqual(state.view.selection, []);
    assert.equal(state.view.editingId, null);
    assert.deepEqual(state.doc.past, []);
    assert.deepEqual(state.doc.future, []);
    assert.equal(state.view.tool, 'select');
    assert.equal(state.view.zoom, 1);
  });
});

describe('add', () => {
  it('appends the element, selects it and returns to the select tool', () => {
    const state = editorReducer(
      stateWith([], undefined, { tool: 'rect' }),
      { type: 'add', element: text('a') },
    );
    assert.deepEqual(state.doc.overlay.elements.map((element) => element.id), ['a']);
    assert.deepEqual(state.view.selection, ['a']);
    assert.equal(state.view.tool, 'select');
    assert.equal(state.doc.past.length, 1, 'adding is one undo step');
  });

  it('leaves the selection alone when asked not to select', () => {
    const before = stateWith([text('a')], undefined, { selection: ['a'] });
    const after = editorReducer(before, { type: 'add', element: text('b'), select: false });
    assert.deepEqual(after.view.selection, ['a']);
  });
});

describe('update / updateOne', () => {
  it('patches only the named elements', () => {
    const before = stateWith([text('a'), text('b')]);
    const after = editorReducer(before, { type: 'updateOne', id: 'a', patch: { x: 99 } });
    assert.equal(byId(after, 'a').x, 99);
    assert.equal(byId(after, 'b').x, 10);
  });

  it('patches several at once', () => {
    const before = stateWith([text('a'), text('b'), text('c')]);
    const after = editorReducer(before, { type: 'update', ids: ['a', 'c'], patch: { y: 7 } });
    assert.equal(byId(after, 'a').y, 7);
    assert.equal(byId(after, 'b').y, 20);
    assert.equal(byId(after, 'c').y, 7);
  });

  it('never changes an element type', () => {
    const before = stateWith([text('a')]);
    const after = editorReducer(before, { type: 'updateOne', id: 'a', patch: { x: 1 } });
    assert.equal(byId(after, 'a').type, 'text');
  });

  it('skips locked elements', () => {
    const before = stateWith([text('a', { locked: true })]);
    const after = editorReducer(before, { type: 'updateOne', id: 'a', patch: { x: 99 } });
    assert.equal(byId(after, 'a').x, 10);
  });

  it('pushes one undo step by default and none with history: false', () => {
    const before = stateWith([text('a')]);
    assert.equal(editorReducer(before, { type: 'updateOne', id: 'a', patch: { x: 1 } }).doc.past.length, 1);
    assert.equal(
      editorReducer(before, { type: 'updateOne', id: 'a', patch: { x: 1 }, history: false }).doc.past.length,
      0,
    );
  });

  it('does not mutate the previous state, so undo keeps a real snapshot', () => {
    const before = stateWith([text('a')]);
    const snapshot = structuredClone(before.doc.overlay);
    editorReducer(before, { type: 'updateOne', id: 'a', patch: { x: 999 } });
    assert.deepEqual(before.doc.overlay, snapshot);
  });
});

describe('delete', () => {
  it('removes the current selection', () => {
    const before = stateWith([text('a'), text('b')], undefined, { selection: ['a'] });
    const after = editorReducer(before, { type: 'delete' });
    assert.deepEqual(after.doc.overlay.elements.map((element) => element.id), ['b']);
    assert.deepEqual(after.view.selection, []);
  });

  it('refuses to delete a locked element', () => {
    const before = stateWith([text('a', { locked: true })], undefined, { selection: ['a'] });
    const after = editorReducer(before, { type: 'delete' });
    assert.equal(after.doc.overlay.elements.length, 1);
  });

  it('is a no-op with nothing selected, leaving history untouched', () => {
    const before = stateWith([text('a')]);
    const after = editorReducer(before, { type: 'delete' });
    assert.equal(after, before, 'the same state object should come back');
  });

  it('is a no-op when only locked elements are selected', () => {
    const before = stateWith([text('a', { locked: true })], undefined, { selection: ['a'] });
    assert.equal(editorReducer(before, { type: 'delete' }).doc.past.length, 0);
  });
});

describe('duplicate', () => {
  it('offsets the copies and selects them', () => {
    const before = stateWith([text('a')], undefined, { selection: ['a'] });
    const after = editorReducer(before, { type: 'duplicate' });
    assert.equal(after.doc.overlay.elements.length, 2);
    const copy = after.doc.overlay.elements[1];
    assert.notEqual(copy.id, 'a', 'a copy needs a fresh id');
    assert.equal(copy.x, 10 + 12);
    assert.equal(copy.y, 20 + 12);
    assert.deepEqual(after.view.selection, [copy.id]);
  });

  it('is a no-op with nothing selected', () => {
    const before = stateWith([text('a')]);
    assert.equal(editorReducer(before, { type: 'duplicate' }), before);
  });
});

describe('select', () => {
  it('replaces the selection by default', () => {
    const before = stateWith([text('a'), text('b')], undefined, { selection: ['a'] });
    assert.deepEqual(editorReducer(before, { type: 'select', ids: ['b'] }).view.selection, ['b']);
  });

  it('toggles in additive mode', () => {
    const before = stateWith([text('a'), text('b')], undefined, { selection: ['a'] });
    const added = editorReducer(before, { type: 'select', ids: ['b'], additive: true });
    assert.deepEqual(added.view.selection, ['a', 'b']);
    const removed = editorReducer(added, { type: 'select', ids: ['a'], additive: true });
    assert.deepEqual(removed.view.selection, ['b']);
  });

  it('leaves text editing whenever the selection changes', () => {
    const before = stateWith([text('a')], undefined, { editingId: 'a' });
    assert.equal(editorReducer(before, { type: 'select', ids: [] }).view.editingId, null);
  });

  it('selectAllOnPage takes the active page only, skipping locked elements', () => {
    const before = stateWith(
      [text('a'), text('b', { page: 1 }), text('c', { locked: true })],
      undefined,
      { activePage: 0 },
    );
    assert.deepEqual(editorReducer(before, { type: 'selectAllOnPage' }).view.selection, ['a']);
  });
});

describe('reorder', () => {
  const ids = (state: EditorState) => state.doc.overlay.elements.map((element) => element.id);
  const three = () => stateWith([text('a'), text('b'), text('c')]);

  it('moves an element to the front and to the back', () => {
    assert.deepEqual(ids(editorReducer(three(), { type: 'reorder', id: 'a', to: 'front' })), ['b', 'c', 'a']);
    assert.deepEqual(ids(editorReducer(three(), { type: 'reorder', id: 'c', to: 'back' })), ['c', 'a', 'b']);
  });

  it('steps one place at a time', () => {
    assert.deepEqual(ids(editorReducer(three(), { type: 'reorder', id: 'a', to: 'forward' })), ['b', 'a', 'c']);
    assert.deepEqual(ids(editorReducer(three(), { type: 'reorder', id: 'c', to: 'backward' })), ['a', 'c', 'b']);
  });

  it('clamps at the ends instead of wrapping', () => {
    assert.deepEqual(ids(editorReducer(three(), { type: 'reorder', id: 'a', to: 'backward' })), ['a', 'b', 'c']);
    assert.deepEqual(ids(editorReducer(three(), { type: 'reorder', id: 'c', to: 'forward' })), ['a', 'b', 'c']);
  });

  it('is a no-op for an unknown id', () => {
    const before = three();
    assert.equal(editorReducer(before, { type: 'reorder', id: 'nope', to: 'front' }), before);
  });
});

describe('zoom', () => {
  it('clamps to the supported range', () => {
    const before = stateWith([]);
    assert.equal(editorReducer(before, { type: 'zoom', zoom: 99 }).view.zoom, 4);
    assert.equal(editorReducer(before, { type: 'zoom', zoom: 0.01 }).view.zoom, 0.2);
    assert.equal(editorReducer(before, { type: 'zoom', zoom: 1.5 }).view.zoom, 1.5);
  });
});

describe('page actions', () => {
  it('rotates a page in quarter turns and wraps at 360', () => {
    let state = stateWith([], [page(), page()]);
    state = editorReducer(state, { type: 'pageRotate', index: 0, delta: 90 });
    assert.equal(state.doc.overlay.pages[0].rotation, 90);
    assert.equal(state.doc.overlay.pages[1].rotation, 0, 'other pages are untouched');
    for (let turn = 0; turn < 3; turn += 1) {
      state = editorReducer(state, { type: 'pageRotate', index: 0, delta: 90 });
    }
    assert.equal(state.doc.overlay.pages[0].rotation, 0);
  });

  it('rotates backwards past zero', () => {
    const state = editorReducer(stateWith([]), { type: 'pageRotate', index: 0, delta: -90 });
    assert.equal(state.doc.overlay.pages[0].rotation, 270);
  });

  it('hides and shows a page', () => {
    const hidden = editorReducer(stateWith([]), { type: 'pageToggleHidden', index: 0 });
    assert.equal(hidden.doc.overlay.pages[0].hidden, true);
    assert.equal(editorReducer(hidden, { type: 'pageToggleHidden', index: 0 }).doc.overlay.pages[0].hidden, false);
  });

  it('refuses to hide the last visible page', () => {
    const one = stateWith([], [page()]);
    assert.equal(editorReducer(one, { type: 'pageToggleHidden', index: 0 }), one);
  });

  it('moves a page and remaps the elements that sit on it', () => {
    const before = stateWith(
      [text('a', { page: 0 }), text('b', { page: 1 })],
      [page(), page(), page()],
      { activePage: 0 },
    );
    const after = editorReducer(before, { type: 'pageMove', index: 0, to: 2 });
    assert.equal(byId(after, 'a').page, 2, 'the element follows its page');
    assert.equal(byId(after, 'b').page, 0, 'the page that shifted up takes its elements with it');
    assert.equal(after.view.activePage, 2, 'the view follows the page the member was on');
  });

  it('is a no-op for an out-of-range or unchanged move', () => {
    const before = stateWith([], [page(), page()]);
    assert.equal(editorReducer(before, { type: 'pageMove', index: 0, to: 0 }), before);
    assert.equal(editorReducer(before, { type: 'pageMove', index: 0, to: 5 }), before);
    assert.equal(editorReducer(before, { type: 'pageMove', index: 0, to: -1 }), before);
  });
});

describe('undo / redo', () => {
  it('restores the previous overlay and offers it back on redo', () => {
    const start = stateWith([text('a')]);
    const moved = editorReducer(start, { type: 'updateOne', id: 'a', patch: { x: 500 } });
    const undone = editorReducer(moved, { type: 'undo' });
    assert.equal(byId(undone, 'a').x, 10);
    assert.equal(byId(editorReducer(undone, { type: 'redo' }), 'a').x, 500);
  });

  it('is a no-op at either end of the history', () => {
    const start = stateWith([text('a')]);
    assert.equal(editorReducer(start, { type: 'undo' }), start);
    assert.equal(editorReducer(start, { type: 'redo' }), start);
  });

  it('treats one gesture as one undo step', () => {
    // A drag: one checkpoint, then many history-free updates.
    let state = editorReducer(stateWith([text('a')]), { type: 'checkpoint' });
    for (let step = 1; step <= 20; step += 1) {
      state = editorReducer(state, { type: 'updateOne', id: 'a', patch: { x: step }, history: false });
    }
    assert.equal(byId(state, 'a').x, 20);
    assert.equal(state.doc.past.length, 1);
    assert.equal(byId(editorReducer(state, { type: 'undo' }), 'a').x, 10);
  });

  it('drops the redo stack once a new edit lands', () => {
    const start = stateWith([text('a')]);
    const moved = editorReducer(start, { type: 'updateOne', id: 'a', patch: { x: 500 } });
    const undone = editorReducer(moved, { type: 'undo' });
    assert.equal(undone.doc.future.length, 1);
    const branched = editorReducer(undone, { type: 'updateOne', id: 'a', patch: { x: 7 } });
    assert.deepEqual(branched.doc.future, [], 'editing after undo abandons the redo branch');
  });

  it('caps the history so a long session cannot grow without bound', () => {
    let state = stateWith([text('a')]);
    for (let step = 0; step < 200; step += 1) {
      state = editorReducer(state, { type: 'updateOne', id: 'a', patch: { x: step } });
    }
    assert.equal(state.doc.past.length, 80);
    assert.equal(byId(state, 'a').x, 199, 'the newest edit survives');
  });

  it('clears the selection, because undone elements may be gone', () => {
    const start = stateWith([text('a')], undefined, { selection: ['a'] });
    const deleted = editorReducer(start, { type: 'delete' });
    const undone = editorReducer(deleted, { type: 'undo' });
    assert.deepEqual(undone.view.selection, []);
    assert.equal(undone.doc.overlay.elements.length, 1);
  });
});

describe('document and view are independent', () => {
  /**
   * The point of the split: a view change must leave the document object
   * alone, and an edit must leave the view object alone. Anything memoised on
   * one half then skips re-rendering when only the other moved.
   */
  const VIEW_ONLY: EditorAction[] = [
    { type: 'zoom', zoom: 2 },
    { type: 'activePage', page: 1 },
    { type: 'tool', tool: 'rect' },
    { type: 'select', ids: ['a'] },
    { type: 'selectAllOnPage' },
    { type: 'editing', id: 'a' },
    { type: 'guides', guides: [{ axis: 'x', at: 10 }] },
  ];

  const DOC_ONLY: EditorAction[] = [
    { type: 'updateOne', id: 'a', patch: { x: 1 } },
    { type: 'checkpoint' },
    { type: 'reorder', id: 'a', to: 'front' },
    { type: 'pageRotate', index: 0, delta: 90 },
    { type: 'pageToggleHidden', index: 1 },
  ];

  it('keeps the document object when only the view changes', () => {
    const start = stateWith([text('a'), text('b')], undefined, { selection: ['a'] });
    for (const action of VIEW_ONLY) {
      assert.equal(
        editorReducer(start, action).doc,
        start.doc,
        `${action.type} replaced the document, so the whole tree would re-render`,
      );
    }
  });

  it('keeps the view object when only the document changes', () => {
    const start = stateWith([text('a'), text('b')], undefined, { selection: ['a'] });
    for (const action of DOC_ONLY) {
      assert.equal(
        editorReducer(start, action).view,
        start.view,
        `${action.type} replaced the view for no reason`,
      );
    }
  });

  it('changes both only where an edit genuinely moves the selection', () => {
    // Adding selects the new element; deleting clears the selection; moving a
    // page follows it. Those are the three that legitimately touch both.
    const withSelection = stateWith([text('a')], undefined, { selection: ['a'] });
    for (const action of [
      { type: 'add', element: text('b') },
      { type: 'delete' },
      { type: 'duplicate' },
    ] as EditorAction[]) {
      const after = editorReducer(withSelection, action);
      assert.notEqual(after.doc, withSelection.doc, `${action.type} should change the document`);
      assert.notEqual(after.view, withSelection.view, `${action.type} should change the view`);
    }
  });
});

describe('overlay identity', () => {
  /**
   * `useAutosave` decides whether the document is unsaved by comparing the
   * overlay it holds with the last one the server accepted. That only works
   * while an edit always produces a new object and a view change never does.
   */
  it('gives every edit a new overlay object', () => {
    const start = stateWith([text('a')]);
    const edits: EditorAction[] = [
      { type: 'updateOne', id: 'a', patch: { x: 1 } },
      { type: 'add', element: text('b') },
      { type: 'reorder', id: 'a', to: 'front' },
      { type: 'pageRotate', index: 0, delta: 90 },
      { type: 'pageToggleHidden', index: 1 },
      { type: 'pageMove', index: 0, to: 1 },
    ];
    for (const action of edits) {
      assert.notEqual(
        editorReducer(start, action).doc.overlay,
        start.doc.overlay,
        `${action.type} reused the overlay object, so a save would be missed`,
      );
    }
  });

  it('keeps the same overlay object for a view-only change', () => {
    const start = stateWith([text('a')], undefined, { selection: ['a'] });
    const viewActions: EditorAction[] = [
      { type: 'zoom', zoom: 2 },
      { type: 'activePage', page: 1 },
      { type: 'tool', tool: 'rect' },
      { type: 'select', ids: ['a'] },
      { type: 'selectAllOnPage' },
      { type: 'editing', id: 'a' },
      { type: 'guides', guides: [] },
      { type: 'checkpoint' },
    ];
    for (const action of viewActions) {
      assert.equal(
        editorReducer(start, action).doc.overlay,
        start.doc.overlay,
        `${action.type} replaced the overlay, so the document would look unsaved`,
      );
    }
  });

  it('restores the identity of an earlier overlay on undo', () => {
    const start = stateWith([text('a')]);
    const moved = editorReducer(start, { type: 'updateOne', id: 'a', patch: { x: 5 } });
    const undone = editorReducer(moved, { type: 'undo' });
    // Undoing back to a saved state must look saved again, not merely equal.
    assert.equal(undone.doc.overlay, start.doc.overlay);
  });
});

describe('normalizePageRotation', () => {
  it('folds any multiple of 90 into 0-270', () => {
    assert.equal(normalizePageRotation(0), 0);
    assert.equal(normalizePageRotation(360), 0);
    assert.equal(normalizePageRotation(-90), 270);
    assert.equal(normalizePageRotation(450), 90);
  });
});

describe('rotatedPageSize', () => {
  it('swaps the axes on a quarter turn', () => {
    assert.deepEqual(rotatedPageSize(page()), { width: 600, height: 800 });
    assert.deepEqual(rotatedPageSize(page({ rotation: 90 })), { width: 800, height: 600 });
    assert.deepEqual(rotatedPageSize(page({ rotation: 180 })), { width: 600, height: 800 });
    assert.deepEqual(rotatedPageSize(page({ rotation: 270 })), { width: 800, height: 600 });
  });
});

describe('toBaseSpace', () => {
  it('is the identity on an unrotated page', () => {
    assert.deepEqual(toBaseSpace(10, 20, page()), { x: 10, y: 20 });
  });

  it('maps every screen corner onto a page corner, for each rotation', () => {
    const corners = new Set(['0,0', '600,0', '0,800', '600,800']);
    for (const rotation of [0, 90, 180, 270] as const) {
      const current = page({ rotation });
      const { width, height } = rotatedPageSize(current);
      for (const [u, v] of [[0, 0], [width, 0], [0, height], [width, height]]) {
        const { x, y } = toBaseSpace(u, v, current);
        assert.ok(corners.has(`${x},${y}`), `rotation ${rotation}: (${u},${v}) -> (${x},${y})`);
      }
    }
  });

  it('sends the screen origin to a different page corner at each rotation', () => {
    const seen = new Set(
      [0, 90, 180, 270].map((rotation) => {
        const { x, y } = toBaseSpace(0, 0, page({ rotation: rotation as 0 | 90 | 180 | 270 }));
        return `${x},${y}`;
      }),
    );
    assert.equal(seen.size, 4, 'each rotation must anchor a different corner');
  });
});

describe('deltaToBaseSpace', () => {
  it('leaves a movement alone on an unrotated page', () => {
    assert.deepEqual(deltaToBaseSpace(5, -3, page()), { dx: 5, dy: -3 });
  });

  it('agrees with toBaseSpace, so dragging tracks the pointer at any rotation', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const current = page({ rotation });
      const from = toBaseSpace(100, 150, current);
      const to = toBaseSpace(100 + 7, 150 - 4, current);
      const delta = deltaToBaseSpace(7, -4, current);
      assert.deepEqual(
        { dx: to.x - from.x, dy: to.y - from.y },
        delta,
        `rotation ${rotation}: drag delta disagrees with point mapping`,
      );
    }
  });

  it('preserves the length of the movement', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const { dx, dy } = deltaToBaseSpace(3, 4, page({ rotation }));
      assert.equal(Math.hypot(dx, dy), 5);
    }
  });
});
