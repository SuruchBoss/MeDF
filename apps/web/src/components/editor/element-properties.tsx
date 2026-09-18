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
import { useT } from '@/lib/i18n/provider';
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
      throw new Error(`No properties panel for: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function TextProperties({ element, dispatch }: PanelProps<TextElement>) {
  const t = useT();
  const patch = createPatcher(element, dispatch);

  return (
    <Section title={t('ep.title.text')}>
      <textarea
        className="field min-h-[72px] text-xs"
        value={element.text}
        onChange={(event) => patch({ text: event.target.value }, false)}
        onKeyDown={(event) => event.stopPropagation()}
        placeholder={t('ep.textPlaceholder')}
      />
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-500">{t('ep.font')}</span>
        <select
          className="field px-2 py-1.5 text-xs"
          value={element.fontFamily}
          onChange={(event) =>
            patch({ fontFamily: event.target.value as TextElement['fontFamily'] })
          }
        >
          {FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {t(FONT_LABELS[family] as Parameters<typeof t>[0])}
            </option>
          ))}
        </select>
      </label>
      <Row>
        <NumberField
          label={t('ep.fontSize')}
          value={element.fontSize}
          min={4}
          max={400}
          onChange={(fontSize) => patch({ fontSize })}
          suffix="pt"
        />
        <NumberField
          label={t('ep.lineHeight')}
          value={element.lineHeight}
          min={0.8}
          max={3}
          step={0.05}
          onChange={(lineHeight) => patch({ lineHeight })}
        />
      </Row>
      <Row>
        <ToggleButton active={element.bold} onClick={() => patch({ bold: !element.bold })} title={t('ep.bold')}>
          <Icon name="bold" size={14} />
        </ToggleButton>
        <ToggleButton
          active={element.italic}
          onClick={() => patch({ italic: !element.italic })}
          title={t('ep.italic')}
        >
          <Icon name="italic" size={14} />
        </ToggleButton>
        <ToggleButton
          active={element.underline}
          onClick={() => patch({ underline: !element.underline })}
          title={t('ep.underline')}
        >
          <Icon name="underline" size={14} />
        </ToggleButton>
      </Row>
      <ButtonGroup
        value={element.align}
        onChange={(align) => patch({ align })}
        options={[
          { value: 'left', label: <Icon name="align-left" size={14} />, title: t('ep.align.left') },
          {
            value: 'center',
            label: <Icon name="align-center" size={14} />,
            title: t('ep.align.centre'),
          },
          {
            value: 'right',
            label: <Icon name="align-right" size={14} />,
            title: t('ep.align.right'),
          },
        ]}
      />
      <Row>
        <ColorField
          label={t('ep.textColour')}
          value={element.color}
          onChange={(color) => patch({ color: color ?? '#111827' })}
        />
      </Row>
      <Row>
        <ColorField
          label={t('ep.background')}
          value={element.background}
          allowNone
          onChange={(background) => patch({ background })}
        />
      </Row>
      <NumberField
        label={t('ep.padding')}
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
  const t = useT();
  const patch = createPatcher(element, dispatch);

  return (
    <Section title={t('ep.title.image')}>
      <button
        type="button"
        className="btn-secondary btn-sm w-full"
        onClick={() => patch({ h: Math.round(element.w / element.naturalRatio) })}
      >
        <Icon name="grid" size={14} />
        {t('ep.resetRatio')}
      </button>
      <p className="text-[11px] text-ink-500">{t('ep.imageHint')}</p>
    </Section>
  );
}

function RectProperties({ element, dispatch }: PanelProps<RectElement>) {
  const t = useT();
  const patch = createPatcher(element, dispatch);

  return (
    <Section title={t('ep.title.rect')}>
      <Row>
        <ColorField label={t('ep.fill')} value={element.fill} allowNone onChange={(fill) => patch({ fill })} />
      </Row>
      <Row>
        <ColorField
          label={t('ep.strokeBorder')}
          value={element.stroke}
          allowNone
          onChange={(stroke) => patch({ stroke })}
        />
      </Row>
      <Row>
        <NumberField
          label={t('ep.strokeWidth')}
          value={element.strokeWidth}
          min={0}
          max={40}
          step={0.5}
          onChange={(strokeWidth) => patch({ strokeWidth })}
        />
        <NumberField
          label={t('ep.corner')}
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
  const t = useT();
  const patch = createPatcher(element, dispatch);

  return (
    <Section title={t('ep.title.ellipse')}>
      <Row>
        <ColorField label={t('ep.fill')} value={element.fill} allowNone onChange={(fill) => patch({ fill })} />
      </Row>
      <Row>
        <ColorField
          label={t('ep.strokeBorder')}
          value={element.stroke}
          allowNone
          onChange={(stroke) => patch({ stroke })}
        />
      </Row>
      <NumberField
        label={t('ep.strokeWidth')}
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
  const t = useT();
  const patch = createPatcher(element, dispatch);

  return (
    <Section title={t('ep.title.line')}>
      <Row>
        <ColorField
          label={t('ep.stroke')}
          value={element.stroke}
          onChange={(stroke) => patch({ stroke: stroke ?? '#111827' })}
        />
      </Row>
      <NumberField
        label={t('ep.thickness')}
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
          title={t('ep.arrowStart')}
        >
          <span className="text-[10px]">{t('ep.arrowStartLabel')}</span>
        </ToggleButton>
        <ToggleButton
          active={element.arrowEnd}
          onClick={() => patch({ arrowEnd: !element.arrowEnd })}
          title={t('ep.arrowEnd')}
        >
          <span className="text-[10px]">{t('ep.arrowEndLabel')}</span>
        </ToggleButton>
      </Row>
      <p className="text-[11px] text-ink-500">{t('ep.lineHint')}</p>
    </Section>
  );
}

function DrawProperties({ element, dispatch }: PanelProps<DrawElement>) {
  const t = useT();
  const patch = createPatcher(element, dispatch);

  return (
    <Section title={t('ep.title.draw')}>
      <Row>
        <ColorField
          label={t('ep.stroke')}
          value={element.stroke}
          onChange={(stroke) => patch({ stroke: stroke ?? '#1d4ed8' })}
        />
      </Row>
      <NumberField
        label={t('ep.thickness')}
        value={element.strokeWidth}
        min={0.2}
        max={40}
        step={0.2}
        onChange={(strokeWidth) => patch({ strokeWidth })}
      />
      <p className="text-[11px] text-ink-500">
        {t('ep.drawStrokes', { count: element.strokes.length })}
      </p>
    </Section>
  );
}

function HighlightProperties({ element, dispatch }: PanelProps<HighlightElement>) {
  const t = useT();
  const patch = createPatcher(element, dispatch);

  return (
    <Section title={t('ep.title.highlight')}>
      <Row>
        <ColorField
          label={t('ep.highlightColour')}
          value={element.color}
          onChange={(color) => patch({ color: color ?? '#fde047' })}
        />
      </Row>
      <p className="text-[11px] text-ink-500">{t('ep.highlightHint')}</p>
    </Section>
  );
}

function CheckProperties({ element, dispatch }: PanelProps<CheckElement>) {
  const t = useT();
  const patch = createPatcher(element, dispatch);

  return (
    <Section title={t('ep.title.check')}>
      <ButtonGroup
        value={element.variant}
        onChange={(variant) => patch({ variant })}
        options={[
          { value: 'check', label: t('ep.check.check') },
          { value: 'cross', label: t('ep.check.cross') },
          { value: 'dot', label: t('ep.check.dot') },
        ]}
      />
      <Row>
        <ColorField
          label={t('ep.colour')}
          value={element.color}
          onChange={(color) => patch({ color: color ?? '#16a34a' })}
        />
      </Row>
      <NumberField
        label={t('ep.thickness')}
        value={element.strokeWidth}
        min={0.5}
        max={40}
        step={0.5}
        onChange={(strokeWidth) => patch({ strokeWidth })}
      />
    </Section>
  );
}
