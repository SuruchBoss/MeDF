'use client';

import type { Dispatch } from 'react';
import { Icon } from '@/components/icons';
import {
  type AnyElement,
  type CheckElement,
  type DrawElement,
  type EllipseElement,
  FONT_FAMILIES,
  FONT_LABELS,
  type HighlightElement,
  type ImageElement,
  type LineElement,
  type RectElement,
  type TextElement,
} from '@/lib/editor-types';
import { ButtonGroup, ColorField, NumberField, Row, Section, ToggleButton } from './controls';
import { type EditorAction, createPatcher } from './store';

/**
 * Per-element-type property editors.
 *
 * Each one takes an element already narrowed to its own type and builds its
 * edit function with `createPatcher`, so every field below is checked against
 * that element's shape: a typo or a field borrowed from another element type
 * is a compile error.
 */

interface PanelProps<T extends AnyElement> {
  element: T;
  dispatch: Dispatch<EditorAction>;
}

export function ElementProperties({ element, dispatch }: PanelProps<AnyElement>) {
  switch (element.type) {
    case 'text':
      return <TextProperties element={element} dispatch={dispatch} />;
    case 'image':
      return <ImageProperties element={element} dispatch={dispatch} />;
    case 'rect':
      return <RectProperties element={element} dispatch={dispatch} />;
    case 'ellipse':
      return <EllipseProperties element={element} dispatch={dispatch} />;
    case 'line':
      return <LineProperties element={element} dispatch={dispatch} />;
    case 'draw':
      return <DrawProperties element={element} dispatch={dispatch} />;
    case 'highlight':
      return <HighlightProperties element={element} dispatch={dispatch} />;
    case 'check':
      return <CheckProperties element={element} dispatch={dispatch} />;
    default: {
      // A new element type must add a panel above.
      const exhaustive: never = element;
      throw new Error(`ยังไม่มีแผงคุณสมบัติสำหรับ: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function TextProperties({ element, dispatch }: PanelProps<TextElement>) {
  const patch = createPatcher(element, dispatch);

  return (
    <Section title="ข้อความ">
      <textarea
        className="field min-h-[72px] text-xs"
        value={element.text}
        onChange={(event) => patch({ text: event.target.value }, false)}
        onKeyDown={(event) => event.stopPropagation()}
        placeholder="พิมพ์ข้อความ"
      />
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-500">ฟอนต์</span>
        <select
          className="field px-2 py-1.5 text-xs"
          value={element.fontFamily}
          onChange={(event) =>
            patch({ fontFamily: event.target.value as TextElement['fontFamily'] })
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
          onChange={(fontSize) => patch({ fontSize })}
          suffix="pt"
        />
        <NumberField
          label="ระยะบรรทัด"
          value={element.lineHeight}
          min={0.8}
          max={3}
          step={0.05}
          onChange={(lineHeight) => patch({ lineHeight })}
        />
      </Row>
      <Row>
        <ToggleButton active={element.bold} onClick={() => patch({ bold: !element.bold })} title="ตัวหนา">
          <Icon name="bold" size={14} />
        </ToggleButton>
        <ToggleButton
          active={element.italic}
          onClick={() => patch({ italic: !element.italic })}
          title="ตัวเอียง"
        >
          <Icon name="italic" size={14} />
        </ToggleButton>
        <ToggleButton
          active={element.underline}
          onClick={() => patch({ underline: !element.underline })}
          title="ขีดเส้นใต้"
        >
          <Icon name="underline" size={14} />
        </ToggleButton>
      </Row>
      <ButtonGroup
        value={element.align}
        onChange={(align) => patch({ align })}
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
          onChange={(color) => patch({ color: color ?? '#111827' })}
        />
      </Row>
      <Row>
        <ColorField
          label="สีพื้นหลัง"
          value={element.background}
          allowNone
          onChange={(background) => patch({ background })}
        />
      </Row>
      <NumberField
        label="ระยะขอบใน"
        value={element.padding}
        min={0}
        max={80}
        onChange={(padding) => patch({ padding })}
        suffix="pt"
      />
    </Section>
  );
}

function ImageProperties({ element, dispatch }: PanelProps<ImageElement>) {
  const patch = createPatcher(element, dispatch);

  return (
    <Section title="รูปภาพ">
      <button
        type="button"
        className="btn-secondary btn-sm w-full"
        onClick={() => patch({ h: Math.round(element.w / element.naturalRatio) })}
      >
        <Icon name="grid" size={14} />
        คืนสัดส่วนเดิม
      </button>
      <p className="text-[11px] text-ink-400">กด Shift ระหว่างลากมุมเพื่อคงสัดส่วนภาพ</p>
    </Section>
  );
}

function RectProperties({ element, dispatch }: PanelProps<RectElement>) {
  const patch = createPatcher(element, dispatch);

  return (
    <Section title="สี่เหลี่ยม">
      <Row>
        <ColorField label="สีพื้น" value={element.fill} allowNone onChange={(fill) => patch({ fill })} />
      </Row>
      <Row>
        <ColorField
          label="สีเส้นขอบ"
          value={element.stroke}
          allowNone
          onChange={(stroke) => patch({ stroke })}
        />
      </Row>
      <Row>
        <NumberField
          label="ความหนาเส้น"
          value={element.strokeWidth}
          min={0}
          max={40}
          step={0.5}
          onChange={(strokeWidth) => patch({ strokeWidth })}
        />
        <NumberField
          label="มุมโค้ง"
          value={element.radius}
          min={0}
          max={400}
          onChange={(radius) => patch({ radius })}
        />
      </Row>
    </Section>
  );
}

function EllipseProperties({ element, dispatch }: PanelProps<EllipseElement>) {
  const patch = createPatcher(element, dispatch);

  return (
    <Section title="วงกลม / วงรี">
      <Row>
        <ColorField label="สีพื้น" value={element.fill} allowNone onChange={(fill) => patch({ fill })} />
      </Row>
      <Row>
        <ColorField
          label="สีเส้นขอบ"
          value={element.stroke}
          allowNone
          onChange={(stroke) => patch({ stroke })}
        />
      </Row>
      <NumberField
        label="ความหนาเส้น"
        value={element.strokeWidth}
        min={0}
        max={40}
        step={0.5}
        onChange={(strokeWidth) => patch({ strokeWidth })}
      />
    </Section>
  );
}

function LineProperties({ element, dispatch }: PanelProps<LineElement>) {
  const patch = createPatcher(element, dispatch);

  return (
    <Section title="เส้น">
      <Row>
        <ColorField
          label="สีเส้น"
          value={element.stroke}
          onChange={(stroke) => patch({ stroke: stroke ?? '#111827' })}
        />
      </Row>
      <NumberField
        label="ความหนา"
        value={element.strokeWidth}
        min={0.2}
        max={40}
        step={0.2}
        onChange={(strokeWidth) => patch({ strokeWidth })}
      />
      <Row>
        <ToggleButton
          active={element.arrowStart}
          onClick={() => patch({ arrowStart: !element.arrowStart })}
          title="หัวลูกศรต้นทาง"
        >
          <span className="text-[10px]">◀ ต้น</span>
        </ToggleButton>
        <ToggleButton
          active={element.arrowEnd}
          onClick={() => patch({ arrowEnd: !element.arrowEnd })}
          title="หัวลูกศรปลายทาง"
        >
          <span className="text-[10px]">ปลาย ▶</span>
        </ToggleButton>
      </Row>
      <p className="text-[11px] text-ink-400">ลากจุดสีม่วงบนเส้นเพื่อย้ายปลายเส้น</p>
    </Section>
  );
}

function DrawProperties({ element, dispatch }: PanelProps<DrawElement>) {
  const patch = createPatcher(element, dispatch);

  return (
    <Section title="ลายเซ็น">
      <Row>
        <ColorField
          label="สีเส้น"
          value={element.stroke}
          onChange={(stroke) => patch({ stroke: stroke ?? '#1d4ed8' })}
        />
      </Row>
      <NumberField
        label="ความหนา"
        value={element.strokeWidth}
        min={0.2}
        max={40}
        step={0.2}
        onChange={(strokeWidth) => patch({ strokeWidth })}
      />
      <p className="text-[11px] text-ink-400">
        มี {element.strokes.length} เส้น · ย่อ-ขยายได้โดยไม่เสียความคม
      </p>
    </Section>
  );
}

function HighlightProperties({ element, dispatch }: PanelProps<HighlightElement>) {
  const patch = createPatcher(element, dispatch);

  return (
    <Section title="ไฮไลต์">
      <Row>
        <ColorField
          label="สีไฮไลต์"
          value={element.color}
          onChange={(color) => patch({ color: color ?? '#fde047' })}
        />
      </Row>
      <p className="text-[11px] text-ink-400">ใช้โหมดผสมสีแบบ multiply จึงไม่ทับข้อความเดิมให้หายไป</p>
    </Section>
  );
}

function CheckProperties({ element, dispatch }: PanelProps<CheckElement>) {
  const patch = createPatcher(element, dispatch);

  return (
    <Section title="เครื่องหมาย">
      <ButtonGroup
        value={element.variant}
        onChange={(variant) => patch({ variant })}
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
          onChange={(color) => patch({ color: color ?? '#16a34a' })}
        />
      </Row>
      <NumberField
        label="ความหนา"
        value={element.strokeWidth}
        min={0.5}
        max={40}
        step={0.5}
        onChange={(strokeWidth) => patch({ strokeWidth })}
      />
    </Section>
  );
}
