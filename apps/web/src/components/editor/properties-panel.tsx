'use client';

import { type Dispatch, useRef } from 'react';
import { Icon } from '@/components/icons';
import { useFocusTrap } from '@/lib/client/use-focus-trap';
import { type AnyElement, type PageState, elementLabel } from '@/lib/editor-types';
import type { MessageKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/provider';
import { NumberField, Row, Section, SliderField, ToggleButton } from './controls';
import { ElementProperties } from './element-properties';
import type { BaseElementPatch, EditorAction } from './store';
import { PROPERTIES_PANEL_ID } from './toolbar';

/**
 * Right-hand inspector: geometry, per-type styling, stacking order and the
 * layer list. Every edit goes through the reducer, so it is all undoable.
 */

interface PropertiesPanelProps {
  selection: AnyElement[];
  pageElements: AnyElement[];
  page: PageState | undefined;
  pageIndex: number;
  dispatch: Dispatch<EditorAction>;
  /**
   * True while the window is narrow enough that this is a drawer over the
   * page rather than a column beside it. `open` only means anything then.
   */
  drawer: boolean;
  open: boolean;
  onClose: () => void;
}

export function PropertiesPanel({
  selection,
  pageElements,
  page,
  pageIndex,
  dispatch,
  drawer,
  open,
  onClose,
}: PropertiesPanelProps) {
  const t = useT();
  const panel = useRef<HTMLElement>(null);

  // A drawer that traps focus is a modal in everything but name, so it says so
  // and behaves like one: Escape closes it and Tab cannot walk out behind it.
  const modal = drawer && open;
  useFocusTrap(panel, modal, onClose);
  const single = selection.length === 1 ? selection[0] : null;
  const ids = selection.map((element) => element.id);

  function patch(changes: BaseElementPatch, history = true) {
    dispatch({ type: 'update', ids, patch: changes, history });
  }

  function alignToPage(mode: 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom') {
    if (!page) return;
    dispatch({ type: 'checkpoint' });
    for (const element of selection) {
      const changes: BaseElementPatch = {};
      if (mode === 'left') changes.x = 0;
      if (mode === 'centre') changes.x = Math.round((page.width - element.w) / 2);
      if (mode === 'right') changes.x = Math.round(page.width - element.w);
      if (mode === 'top') changes.y = 0;
      if (mode === 'middle') changes.y = Math.round((page.height - element.h) / 2);
      if (mode === 'bottom') changes.y = Math.round(page.height - element.h);
      dispatch({ type: 'updateOne', id: element.id, patch: changes, history: false });
    }
  }

  return (
    <aside
      /**
       * A column beside the page on a wide screen, a drawer over it on a
       * narrow one. `fixed` is what makes the difference: it takes the panel
       * out of the row, so the page stage gets the whole width instead of the
       * 100px that was left after a 288px panel on a phone.
       */
      className={`flex w-72 shrink-0 flex-col overflow-y-auto border-l border-ink-200 bg-white transition-transform max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:w-[min(20rem,88vw)] max-lg:shadow-2xl ${
        open ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'
      }`}
      ref={panel}
      id={PROPERTIES_PANEL_ID}
      // A drawer that has slid off the edge is still in the tab order and
      // still read aloud unless it is said to be inert.
      inert={(drawer && !open) || undefined}
      role={modal ? 'dialog' : undefined}
      aria-modal={modal || undefined}
      aria-label={modal ? t('props.drawerTitle') : undefined}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-3 py-2 lg:hidden">
        <p className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">
          {t('props.drawerTitle')}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost btn-sm"
          aria-label={t('common.close')}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      {selection.length === 0 ? (
        <Section title={t('props.pageTitle')}>
          <p className="text-sm text-ink-600">
            {page
              ? t('props.pageSize', {
                  number: pageIndex + 1,
                  width: Math.round(page.width),
                  height: Math.round(page.height),
                })
              : t('props.pageNumber', { number: pageIndex + 1 })}
          </p>
          <p className="text-xs leading-relaxed text-ink-500">{t('props.placeHint')}</p>
          <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500 max-lg:hidden">
            <p className="font-semibold text-ink-700">{t('props.shortcutsTitle')}</p>
            <ul className="mt-1.5 space-y-1">
              {(
                [
                  'props.shortcut.undo',
                  'props.shortcut.duplicate',
                  'props.shortcut.save',
                  'props.shortcut.arrows',
                  'props.shortcut.delete',
                  'props.shortcut.alt',
                ] as MessageKey[]
              ).map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
        </Section>
      ) : (
        <>
          <Section
            title={
              single
                ? elementLabel(single, t)
                : t('props.selectedCount', { count: selection.length })
            }
          >
            <Row>
              <NumberField
                label="X"
                value={selection[0].x}
                onChange={(value) => patch({ x: value })}
                suffix="pt"
              />
              <NumberField
                label="Y"
                value={selection[0].y}
                onChange={(value) => patch({ y: value })}
                suffix="pt"
              />
            </Row>
            <Row>
              <NumberField
                label={t('props.width')}
                value={selection[0].w}
                onChange={(value) => patch({ w: Math.max(6, value) })}
                min={6}
                suffix="pt"
              />
              <NumberField
                label={t('props.height')}
                value={selection[0].h}
                onChange={(value) => patch({ h: Math.max(6, value) })}
                min={6}
                suffix="pt"
              />
            </Row>
            <Row>
              <NumberField
                label={t('props.rotation')}
                value={selection[0].rotation}
                onChange={(value) => patch({ rotation: value })}
                min={-360}
                max={360}
                suffix="°"
              />
              <div className="flex-1">
                <span className="mb-1 block text-[11px] text-ink-500">{t('props.lock')}</span>
                <ToggleButton
                  active={selection.every((element) => element.locked)}
                  onClick={() =>
                    dispatch({
                      type: 'update',
                      ids,
                      patch: { locked: !selection.every((element) => element.locked) },
                    })
                  }
                  title={t('props.lockHint')}
                >
                  <Icon
                    name={selection.every((element) => element.locked) ? 'lock' : 'unlock'}
                    size={14}
                  />
                </ToggleButton>
              </div>
            </Row>
            <SliderField
              label={t('props.opacity')}
              value={selection[0].opacity}
              min={0.05}
              max={1}
              onChange={(value) => patch({ opacity: value }, false)}
              format={(value) => `${Math.round(value * 100)}%`}
            />
          </Section>

          <Section title={t('props.alignTitle')}>
            <Row>
              {(
                [
                  ['left', 'align-left', 'props.alignLeft'],
                  ['centre', 'align-center', 'props.alignCentreH'],
                  ['right', 'align-right', 'props.alignRight'],
                ] as const
              ).map(([mode, icon, title]) => (
                <ToggleButton
                  key={mode}
                  active={false}
                  onClick={() => alignToPage(mode)}
                  title={t(title)}
                >
                  <Icon name={icon} size={14} />
                </ToggleButton>
              ))}
            </Row>
            <Row>
              {(
                [
                  ['top', 'props.alignTop'],
                  ['middle', 'props.alignCentreV'],
                  ['bottom', 'props.alignBottom'],
                ] as const
              ).map(([mode, title]) => (
                <ToggleButton
                  key={mode}
                  active={false}
                  onClick={() => alignToPage(mode)}
                  title={t(title)}
                >
                  <span className="text-[10px]">{t(title)}</span>
                </ToggleButton>
              ))}
            </Row>
          </Section>

          {single ? <ElementProperties element={single} dispatch={dispatch} /> : null}

          <Section title={t('props.zTitle')}>
            <Row>
              {(
                [
                  ['front', 'props.zFront'],
                  ['forward', 'props.zForward'],
                  ['backward', 'props.zBackward'],
                  ['back', 'props.zBack'],
                ] as const
              ).map(([to, title]) => (
                <ToggleButton
                  key={to}
                  active={false}
                  onClick={() => {
                    for (const element of selection) {
                      dispatch({ type: 'reorder', id: element.id, to });
                    }
                  }}
                  title={t(title)}
                >
                  <span className="text-[10px]">{t(title)}</span>
                </ToggleButton>
              ))}
            </Row>
            <Row>
              <button
                type="button"
                className="btn-secondary btn-sm flex-1"
                onClick={() => dispatch({ type: 'duplicate' })}
              >
                <Icon name="copy" size={14} />
                {t('common.duplicate')}
              </button>
              <button
                type="button"
                className="btn-danger btn-sm flex-1"
                onClick={() => dispatch({ type: 'delete' })}
              >
                <Icon name="trash" size={14} />
                {t('common.delete')}
              </button>
            </Row>
          </Section>
        </>
      )}

      <Section title={t('props.elementsOnPage', { count: pageElements.length })}>
        {pageElements.length === 0 ? (
          <p className="text-xs text-ink-500">{t('props.noElements')}</p>
        ) : (
          <ul className="space-y-1">
            {[...pageElements].reverse().map((element) => (
              <li key={element.id}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'select', ids: [element.id] })}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                    ids.includes(element.id)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <Icon name={iconForElement(element)} size={14} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{elementLabel(element, t)}</span>
                  {element.locked ? <Icon name="lock" size={12} className="text-amber-500" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </aside>
  );
}

function iconForElement(element: AnyElement) {
  switch (element.type) {
    case 'text':
      return 'text' as const;
    case 'image':
      return 'image' as const;
    case 'rect':
      return 'square' as const;
    case 'ellipse':
      return 'circle' as const;
    case 'line':
      return 'line' as const;
    case 'draw':
      return 'pen' as const;
    case 'highlight':
      return 'highlight' as const;
    case 'check':
      return 'check' as const;
    default:
      return 'square' as const;
  }
}
