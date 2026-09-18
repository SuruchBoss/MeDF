'use client';

import type { Dispatch } from 'react';
import { Icon } from '@/components/icons';
import { type AnyElement, type PageState, elementLabel } from '@/lib/editor-types';
import { NumberField, Row, Section, SliderField, ToggleButton } from './controls';
import { ElementProperties } from './element-properties';
import type { BaseElementPatch, EditorAction } from './store';

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
}

export function PropertiesPanel({
  selection,
  pageElements,
  page,
  pageIndex,
  dispatch,
}: PropertiesPanelProps) {
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
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-ink-200 bg-white">
      {selection.length === 0 ? (
        <Section title="หน้าเอกสาร">
          <p className="text-sm text-ink-600">
            หน้า {pageIndex + 1}
            {page ? ` · ${Math.round(page.width)} × ${Math.round(page.height)} pt` : ''}
          </p>
          <p className="text-xs leading-relaxed text-ink-500">
            เลือกเครื่องมือจากแถบด้านบน แล้วคลิกบนหน้าเอกสารเพื่อวางองค์ประกอบ
            หรือคลิกองค์ประกอบที่มีอยู่เพื่อแก้ไขคุณสมบัติ
          </p>
          <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
            <p className="font-semibold text-ink-700">คีย์ลัดที่ใช้บ่อย</p>
            <ul className="mt-1.5 space-y-1">
              <li>Ctrl+Z / Ctrl+Shift+Z — ย้อนกลับ / ทำซ้ำ</li>
              <li>Ctrl+D — ทำสำเนาองค์ประกอบ</li>
              <li>Ctrl+S — บันทึก</li>
              <li>ลูกศร — เลื่อน 1 pt (Shift = 10 pt)</li>
              <li>Delete — ลบองค์ประกอบที่เลือก</li>
              <li>Alt ระหว่างลาก — ปิดการ snap</li>
            </ul>
          </div>
        </Section>
      ) : (
        <>
          <Section title={single ? elementLabel(single) : `เลือกอยู่ ${selection.length} ชิ้น`}>
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
                label="กว้าง"
                value={selection[0].w}
                onChange={(value) => patch({ w: Math.max(6, value) })}
                min={6}
                suffix="pt"
              />
              <NumberField
                label="สูง"
                value={selection[0].h}
                onChange={(value) => patch({ h: Math.max(6, value) })}
                min={6}
                suffix="pt"
              />
            </Row>
            <Row>
              <NumberField
                label="หมุน"
                value={selection[0].rotation}
                onChange={(value) => patch({ rotation: value })}
                min={-360}
                max={360}
                suffix="°"
              />
              <div className="flex-1">
                <span className="mb-1 block text-[11px] text-ink-500">ล็อกตำแหน่ง</span>
                <ToggleButton
                  active={selection.every((element) => element.locked)}
                  onClick={() =>
                    dispatch({
                      type: 'update',
                      ids,
                      patch: { locked: !selection.every((element) => element.locked) },
                    })
                  }
                  title="ล็อกเพื่อกันการลากโดยไม่ตั้งใจ"
                >
                  <Icon
                    name={selection.every((element) => element.locked) ? 'lock' : 'unlock'}
                    size={14}
                  />
                </ToggleButton>
              </div>
            </Row>
            <SliderField
              label="ความโปร่งใส"
              value={selection[0].opacity}
              min={0.05}
              max={1}
              onChange={(value) => patch({ opacity: value }, false)}
              format={(value) => `${Math.round(value * 100)}%`}
            />
          </Section>

          <Section title="จัดตำแหน่งในหน้า">
            <Row>
              {(
                [
                  ['left', 'align-left', 'ชิดซ้าย'],
                  ['centre', 'align-center', 'กลางแนวนอน'],
                  ['right', 'align-right', 'ชิดขวา'],
                ] as const
              ).map(([mode, icon, title]) => (
                <ToggleButton
                  key={mode}
                  active={false}
                  onClick={() => alignToPage(mode)}
                  title={title}
                >
                  <Icon name={icon} size={14} />
                </ToggleButton>
              ))}
            </Row>
            <Row>
              {(
                [
                  ['top', 'ชิดบน'],
                  ['middle', 'กลางแนวตั้ง'],
                  ['bottom', 'ชิดล่าง'],
                ] as const
              ).map(([mode, title]) => (
                <ToggleButton
                  key={mode}
                  active={false}
                  onClick={() => alignToPage(mode)}
                  title={title}
                >
                  <span className="text-[10px]">{title}</span>
                </ToggleButton>
              ))}
            </Row>
          </Section>

          {single ? <ElementProperties element={single} dispatch={dispatch} /> : null}

          <Section title="ลำดับชั้น">
            <Row>
              {(
                [
                  ['front', 'บนสุด'],
                  ['forward', 'ขึ้นหนึ่งชั้น'],
                  ['backward', 'ลงหนึ่งชั้น'],
                  ['back', 'ล่างสุด'],
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
                  title={title}
                >
                  <span className="text-[10px]">{title}</span>
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
                ทำสำเนา
              </button>
              <button
                type="button"
                className="btn-danger btn-sm flex-1"
                onClick={() => dispatch({ type: 'delete' })}
              >
                <Icon name="trash" size={14} />
                ลบ
              </button>
            </Row>
          </Section>
        </>
      )}

      <Section title={`องค์ประกอบในหน้านี้ (${pageElements.length})`}>
        {pageElements.length === 0 ? (
          <p className="text-xs text-ink-400">ยังไม่มีองค์ประกอบในหน้านี้</p>
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
                  <span className="min-w-0 flex-1 truncate">{elementLabel(element)}</span>
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
