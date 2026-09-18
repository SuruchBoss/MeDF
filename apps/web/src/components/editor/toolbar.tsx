'use client';

import Link from 'next/link';
import type { Dispatch } from 'react';
import { Icon, type IconName, Spinner } from '@/components/icons';
import { ELEMENT_LABELS } from '@/lib/editor-types';
import type { EditorAction, Tool } from './store';
import type { MessageKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/provider';

/** Top bar: document identity, insert tools, zoom, history and export. */

const TOOLS: { tool: Tool; icon: IconName; label: MessageKey; shortcut?: string }[] = [
  { tool: 'select', icon: 'cursor', label: 'element.select', shortcut: 'V' },
  { tool: 'text', icon: 'text', label: ELEMENT_LABELS.text, shortcut: 'T' },
  { tool: 'image', icon: 'image', label: ELEMENT_LABELS.image, shortcut: 'I' },
  { tool: 'draw', icon: 'pen', label: ELEMENT_LABELS.draw, shortcut: 'S' },
  { tool: 'rect', icon: 'square', label: ELEMENT_LABELS.rect, shortcut: 'R' },
  { tool: 'ellipse', icon: 'circle', label: ELEMENT_LABELS.ellipse, shortcut: 'O' },
  { tool: 'line', icon: 'line', label: ELEMENT_LABELS.line, shortcut: 'L' },
  { tool: 'highlight', icon: 'highlight', label: ELEMENT_LABELS.highlight, shortcut: 'H' },
  { tool: 'check', icon: 'check', label: ELEMENT_LABELS.check, shortcut: 'K' },
];

export interface ToolbarProps {
  title: string;
  dirty: boolean;
  saving: boolean;
  exporting: boolean;
  savedAt: string | null;
  tool: Tool;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: Dispatch<EditorAction>;
  onPickImage: () => void;
  onDrawSignature: () => void;
  onSave: () => void;
  onExport: () => void;
  onRename: () => void;
  onFit: () => void;
  fitMode: 'page' | 'width';
  backHref?: string;
  backLabel?: string;
}

export function Toolbar({
  title,
  dirty,
  saving,
  exporting,
  savedAt,
  tool,
  zoom,
  canUndo,
  canRedo,
  dispatch,
  onPickImage,
  onDrawSignature,
  onSave,
  onExport,
  onRename,
  onFit,
  fitMode,
  backHref = '/app',
  backLabel,
}: ToolbarProps) {
  const t = useT();
  function selectTool(next: Tool) {
    if (next === 'image') {
      onPickImage();
      return;
    }
    if (next === 'draw') {
      onDrawSignature();
      return;
    }
    dispatch({ type: 'tool', tool: next });
  }

  return (
    <div className="flex flex-col border-b border-ink-200 bg-white">
      <div className="flex h-14 items-center gap-3 px-3">
        <Link
          href={backHref}
          className="btn-ghost btn-sm"
          title={backLabel ?? t('appnav.documents')}
        >
          <Icon name="chevron-left" size={17} />
          <span className="hidden sm:inline">{backLabel ?? t('appnav.documents')}</span>
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onRename}
            className="max-w-[16rem] truncate rounded-lg px-2 py-1 text-sm font-semibold text-ink-900 hover:bg-ink-100"
            title={t('toolbar.renameHint')}
          >
            {title}
          </button>
          <span className="hidden text-xs text-ink-400 sm:inline">
            {saving
              ? t('toolbar.saving')
              : dirty
                ? t('toolbar.unsaved')
                : savedAt
                  ? t('toolbar.saved', { time: savedAt })
                  : t('toolbar.autosaveOn')}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'undo' })}
            disabled={!canUndo}
            title={t('toolbar.undo')}
          >
            <Icon name="undo" size={17} />
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'redo' })}
            disabled={!canRedo}
            title={t('toolbar.redo')}
          >
            <Icon name="redo" size={17} />
          </button>

          <span className="mx-1 h-6 w-px bg-ink-200" />

          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'zoom', zoom: zoom - 0.1 })}
            title={t('toolbar.zoomOut')}
          >
            <Icon name="zoom-out" size={17} />
          </button>
          <button
            type="button"
            onClick={onFit}
            className="min-w-[3.5rem] rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100"
            title={fitMode === 'page' ? t('toolbar.fitWidth') : t('toolbar.fitPage')}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'zoom', zoom: zoom + 0.1 })}
            title={t('toolbar.zoomIn')}
          >
            <Icon name="zoom-in" size={17} />
          </button>

          <span className="mx-1 h-6 w-px bg-ink-200" />

          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onSave}
            disabled={saving || !dirty}
            title={t('toolbar.save')}
          >
            {saving ? <Spinner size={15} /> : <Icon name="save" size={15} />}
            <span className="hidden sm:inline">{t('common.save')}</span>
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={onExport}
            disabled={exporting}
            title={t('toolbar.export')}
          >
            {exporting ? <Spinner size={15} /> : <Icon name="download" size={15} />}
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-t border-ink-100 px-3 py-2">
        {TOOLS.map((item) => (
          <button
            key={item.tool}
            type="button"
            onClick={() => selectTool(item.tool)}
            aria-pressed={tool === item.tool}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              tool === item.tool
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
            }`}
            title={
              item.shortcut ? `${t(item.label)} (${item.shortcut})` : t(item.label)
            }
          >
            <Icon name={item.icon} size={16} />
            <span className="hidden md:inline">{item.label}</span>
          </button>
        ))}

        <span className="mx-1 h-5 w-px shrink-0 bg-ink-200" />
        <span className="shrink-0 text-xs text-ink-400">
          {tool === 'select'
            ? t('toolbar.hintSelect')
            : t('toolbar.hintPlace', { element: t(ELEMENT_LABELS[tool]) })}
        </span>
      </div>
    </div>
  );
}
