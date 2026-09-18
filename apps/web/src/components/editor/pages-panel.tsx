'use client';

import { type Dispatch, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Icon } from '@/components/icons';
import type { PageState } from '@/lib/editor-types';
import { PdfPageCanvas } from './pdf-page-canvas';
import type { EditorAction } from './store';
import { useInView } from './use-in-view';

/** Left rail: page thumbnails with reorder, rotate and hide controls. */

const THUMB_WIDTH = 116;

export function PagesPanel({
  pages,
  activePage,
  elementCounts,
  dispatch,
  pdf,
  onJump,
}: {
  pages: PageState[];
  activePage: number;
  elementCounts: Record<number, number>;
  dispatch: Dispatch<EditorAction>;
  pdf: PDFDocumentProxy | null;
  onJump: (index: number) => void;
}) {
  return (
    <aside className="hidden w-40 shrink-0 flex-col overflow-y-auto border-r border-ink-200 bg-white lg:flex">
      <div className="sticky top-0 z-10 border-b border-ink-100 bg-white px-3 py-2.5">
        <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">
          หน้า ({pages.filter((page) => !page.hidden).length}/{pages.length})
        </p>
      </div>

      <ul className="space-y-3 p-3">
        {pages.map((page, index) => (
          <PageThumb
            key={`${page.source}-${index}`}
            page={page}
            index={index}
            total={pages.length}
            active={activePage === index}
            elementCount={elementCounts[index] ?? 0}
            dispatch={dispatch}
            pdf={pdf}
            onJump={onJump}
          />
        ))}
      </ul>
    </aside>
  );
}

function PageThumb({
  page,
  index,
  total,
  active,
  elementCount,
  dispatch,
  pdf,
  onJump,
}: {
  page: PageState;
  index: number;
  total: number;
  active: boolean;
  elementCount: number;
  dispatch: Dispatch<EditorAction>;
  pdf: PDFDocumentProxy | null;
  onJump: (index: number) => void;
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  const visible = useInView(ref, { rootMargin: '400px' });

  const scale = THUMB_WIDTH / page.width;
  const thumbHeight = page.height * scale;
  const rotated = page.rotation === 90 || page.rotation === 270;

  return (
    <li ref={ref}>
      <button
        type="button"
        onClick={() => onJump(index)}
        className={`relative block w-full overflow-hidden rounded-lg border-2 bg-white transition ${
          active ? 'border-brand-500' : 'border-ink-200 hover:border-ink-300'
        }`}
        style={{
          height: (rotated ? THUMB_WIDTH : thumbHeight) + 4,
        }}
        title={`ไปที่หน้า ${index + 1}`}
      >
        <span
          className="absolute top-1/2 left-1/2 block"
          style={{
            width: THUMB_WIDTH,
            height: thumbHeight,
            transform: `translate(-50%, -50%) rotate(${page.rotation}deg)`,
          }}
        >
          <span
            className="absolute top-0 left-0 block origin-top-left"
            style={{
              width: page.width,
              height: page.height,
              transform: `scale(${scale})`,
            }}
          >
            <PdfPageCanvas
              pdf={pdf}
              sourceIndex={page.source}
              width={page.width}
              height={page.height}
              renderScale={Math.max(0.2, scale * 2)}
              active={visible}
            />
          </span>
        </span>

        {page.hidden ? <span className="absolute inset-0 bg-ink-900/50" /> : null}

        <span className="absolute bottom-1 left-1 rounded bg-ink-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {index + 1}
        </span>
        {elementCount > 0 ? (
          <span className="absolute top-1 right-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {elementCount}
          </span>
        ) : null}
      </button>

      <div className="mt-1 flex justify-center gap-0.5">
        <IconAction
          title="หมุนซ้าย"
          onClick={() => dispatch({ type: 'pageRotate', index, delta: -90 })}
        >
          <Icon name="rotate" size={13} className="-scale-x-100" />
        </IconAction>
        <IconAction
          title="หมุนขวา"
          onClick={() => dispatch({ type: 'pageRotate', index, delta: 90 })}
        >
          <Icon name="rotate" size={13} />
        </IconAction>
        <IconAction
          title={page.hidden ? 'แสดงหน้านี้' : 'ซ่อนหน้านี้จากไฟล์ export'}
          onClick={() => dispatch({ type: 'pageToggleHidden', index })}
        >
          <Icon name={page.hidden ? 'eye-off' : 'eye'} size={13} />
        </IconAction>
        <IconAction
          title="เลื่อนขึ้น"
          disabled={index === 0}
          onClick={() => dispatch({ type: 'pageMove', index, to: index - 1 })}
        >
          <Icon name="chevron-left" size={13} className="rotate-90" />
        </IconAction>
        <IconAction
          title="เลื่อนลง"
          disabled={index === total - 1}
          onClick={() => dispatch({ type: 'pageMove', index, to: index + 1 })}
        >
          <Icon name="chevron-right" size={13} className="rotate-90" />
        </IconAction>
      </div>
    </li>
  );
}

function IconAction({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
