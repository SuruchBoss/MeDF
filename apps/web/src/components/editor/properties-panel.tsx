'use client';

import type { Dispatch } from 'react';
import { Icon } from '@/components/icons';
import {
  type AnyElement,
  FONT_LABELS,
  FONT_FAMILIES,
  type PageState,
  elementLabel,
} from '@/lib/editor-types';
import {
  ButtonGroup,
  ColorField,
  NumberField,
  Row,
  Section,
  SliderField,
  ToggleButton,
} from './controls';
import type { EditorAction } from './store';

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

  function patch(changes: Partial<AnyElement>, history = true) {
    dispatch({ type: 'update', ids, patch: changes, history });
  }

  function alignToPage(mode: 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom') {
    if (!page) return;
    dispatch({ type: 'checkpoint' });
    for (const element of selection) {
      const changes: Partial<AnyElement> = {};
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

          {single ? <TypeProperties element={single} dispatch={dispatch} /> : null}

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

function TypeProperties({
  element,
  dispatch,
}: {
  element: AnyElement;
  dispatch: Dispatch<EditorAction>;
}) {
  function patch(changes: Partial<AnyElement>, history = true) {
    dispatch({ type: 'updateOne', id: element.id, patch: changes, history });
  }

  switch (element.type) {
    case 'text':
      return (
        <Section title="ข้อความ">
          <textarea
            className="field min-h-[72px] text-xs"
            value={element.text}
            onChange={(event) => patch({ text: event.target.value } as Partial<AnyElement>, false)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="พิมพ์ข้อความ"
          />
          <label className="block">
            <span className="mb-1 block text-[11px] text-ink-500">ฟอนต์</span>
            <select
              className="field px-2 py-1.5 text-xs"
              value={element.fontFamily}
              onChange={(event) =>
                patch({ fontFamily: event.target.value } as Partial<AnyElement>)
              }
            >
              {FONT_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {FONT_LABELS[family]}
                </option>
              ))}
            </select>
          </label>
          <Row>
            <NumberField
              label="ขนาด"
              value={element.fontSize}
              min={4}
              max={400}
              onChange={(value) => patch({ fontSize: value } as Partial<AnyElement>)}
              suffix="pt"
            />
            <NumberField
              label="ระยะบรรทัด"
              value={element.lineHeight}
              min={0.8}
              max={3}
              step={0.05}
              onChange={(value) => patch({ lineHeight: value } as Partial<AnyElement>)}
            />
          </Row>
          <Row>
            <ToggleButton
              active={element.bold}
              onClick={() => patch({ bold: !element.bold } as Partial<AnyElement>)}
              title="ตัวหนา"
            >
              <Icon name="bold" size={14} />
            </ToggleButton>
            <ToggleButton
              active={element.italic}
              onClick={() => patch({ italic: !element.italic } as Partial<AnyElement>)}
              title="ตัวเอียง"
            >
              <Icon name="italic" size={14} />
            </ToggleButton>
            <ToggleButton
              active={element.underline}
              onClick={() => patch({ underline: !element.underline } as Partial<AnyElement>)}
              title="ขีดเส้นใต้"
            >
              <Icon name="underline" size={14} />
            </ToggleButton>
          </Row>
          <ButtonGroup
            value={element.align}
            onChange={(align) => patch({ align } as Partial<AnyElement>)}
            options={[
              { value: 'left', label: <Icon name="align-left" size={14} />, title: 'ชิดซ้าย' },
              { value: 'center', label: <Icon name="align-center" size={14} />, title: 'กลาง' },
              { value: 'right', label: <Icon name="align-right" size={14} />, title: 'ชิดขวา' },
            ]}
          />
          <Row>
            <ColorField
              label="สีตัวอักษร"
              value={element.color}
              onChange={(color) => patch({ color: color ?? '#111827' } as Partial<AnyElement>)}
            />
          </Row>
          <Row>
            <ColorField
              label="สีพื้นหลัง"
              value={element.background}
              allowNone
              onChange={(background) => patch({ background } as Partial<AnyElement>)}
            />
          </Row>
          <NumberField
            label="ระยะขอบใน"
            value={element.padding}
            min={0}
            max={80}
            onChange={(padding) => patch({ padding } as Partial<AnyElement>)}
            suffix="pt"
          />
        </Section>
      );

    case 'image':
      return (
        <Section title="รูปภาพ">
          <button
            type="button"
            className="btn-secondary btn-sm w-full"
            onClick={() =>
              patch({
                h: Math.round(element.w / element.naturalRatio),
              } as Partial<AnyElement>)
            }
          >
            <Icon name="grid" size={14} />
            คืนสัดส่วนเดิม
          </button>
          <p className="text-[11px] text-ink-400">
            กด Shift ระหว่างลากมุมเพื่อคงสัดส่วนภาพ
          </p>
        </Section>
      );

    case 'rect':
      return (
        <Section title="สี่เหลี่ยม">
          <Row>
            <ColorField
              label="สีพื้น"
              value={element.fill}
              allowNone
              onChange={(fill) => patch({ fill } as Partial<AnyElement>)}
            />
          </Row>
          <Row>
            <ColorField
              label="สีเส้นขอบ"
              value={element.stroke}
              allowNone
              onChange={(stroke) => patch({ stroke } as Partial<AnyElement>)}
            />
          </Row>
          <Row>
            <NumberField
              label="ความหนาเส้น"
              value={element.strokeWidth}
              min={0}
              max={40}
              step={0.5}
              onChange={(strokeWidth) => patch({ strokeWidth } as Partial<AnyElement>)}
            />
            <NumberField
              label="มุมโค้ง"
              value={element.radius}
              min={0}
              max={400}
              onChange={(radius) => patch({ radius } as Partial<AnyElement>)}
            />
          </Row>
        </Section>
      );

    case 'ellipse':
      return (
        <Section title="วงกลม / วงรี">
          <Row>
            <ColorField
              label="สีพื้น"
              value={element.fill}
              allowNone
              onChange={(fill) => patch({ fill } as Partial<AnyElement>)}
            />
          </Row>
          <Row>
            <ColorField
              label="สีเส้นขอบ"
              value={element.stroke}
              allowNone
              onChange={(stroke) => patch({ stroke } as Partial<AnyElement>)}
            />
          </Row>
          <NumberField
            label="ความหนาเส้น"
            value={element.strokeWidth}
            min={0}
            max={40}
            step={0.5}
            onChange={(strokeWidth) => patch({ strokeWidth } as Partial<AnyElement>)}
          />
        </Section>
      );

    case 'line':
      return (
        <Section title="เส้น">
          <Row>
            <ColorField
              label="สีเส้น"
              value={element.stroke}
              onChange={(stroke) => patch({ stroke: stroke ?? '#111827' } as Partial<AnyElement>)}
            />
          </Row>
          <NumberField
            label="ความหนา"
            value={element.strokeWidth}
            min={0.2}
            max={40}
            step={0.2}
            onChange={(strokeWidth) => patch({ strokeWidth } as Partial<AnyElement>)}
          />
          <Row>
            <ToggleButton
              active={element.arrowStart}
              onClick={() => patch({ arrowStart: !element.arrowStart } as Partial<AnyElement>)}
              title="หัวลูกศรต้นทาง"
            >
              <span className="text-[10px]">◀ ต้น</span>
            </ToggleButton>
            <ToggleButton
              active={element.arrowEnd}
              onClick={() => patch({ arrowEnd: !element.arrowEnd } as Partial<AnyElement>)}
              title="หัวลูกศรปลายทาง"
            >
              <span className="text-[10px]">ปลาย ▶</span>
            </ToggleButton>
          </Row>
          <p className="text-[11px] text-ink-400">ลากจุดสีม่วงบนเส้นเพื่อย้ายปลายเส้น</p>
        </Section>
      );

    case 'draw':
      return (
        <Section title="ลายเซ็น">
          <Row>
            <ColorField
              label="สีเส้น"
              value={element.stroke}
              onChange={(stroke) => patch({ stroke: stroke ?? '#1d4ed8' } as Partial<AnyElement>)}
            />
          </Row>
          <NumberField
            label="ความหนา"
            value={element.strokeWidth}
            min={0.2}
            max={40}
            step={0.2}
            onChange={(strokeWidth) => patch({ strokeWidth } as Partial<AnyElement>)}
          />
          <p className="text-[11px] text-ink-400">
            มี {element.strokes.length} เส้น · ย่อ-ขยายได้โดยไม่เสียความคม
          </p>
        </Section>
      );

    case 'highlight':
      return (
        <Section title="ไฮไลต์">
          <Row>
            <ColorField
              label="สีไฮไลต์"
              value={element.color}
              onChange={(color) => patch({ color: color ?? '#fde047' } as Partial<AnyElement>)}
            />
          </Row>
          <p className="text-[11px] text-ink-400">
            ใช้โหมดผสมสีแบบ multiply จึงไม่ทับข้อความเดิมให้หายไป
          </p>
        </Section>
      );

    case 'check':
      return (
        <Section title="เครื่องหมาย">
          <ButtonGroup
            value={element.variant}
            onChange={(variant) => patch({ variant } as Partial<AnyElement>)}
            options={[
              { value: 'check', label: '✓ ถูก' },
              { value: 'cross', label: '✕ ผิด' },
              { value: 'dot', label: '● จุด' },
            ]}
          />
          <Row>
            <ColorField
              label="สี"
              value={element.color}
              onChange={(color) => patch({ color: color ?? '#16a34a' } as Partial<AnyElement>)}
            />
          </Row>
          <NumberField
            label="ความหนา"
            value={element.strokeWidth}
            min={0.5}
            max={40}
            step={0.5}
            onChange={(strokeWidth) => patch({ strokeWidth } as Partial<AnyElement>)}
          />
        </Section>
      );

    default:
      return null;
  }
}
