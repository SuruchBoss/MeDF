'use client';

import { Icon } from '@/components/icons';
import { useT } from '@/lib/i18n/provider';

/**
 * A static, non-interactive mock of the editor used on the landing page.
 * Presentational markup only; the one piece of behaviour is reading the
 * locale, so the mock is in the same language as the page around it.
 */
export function EditorPreview() {
  const t = useT();

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl shadow-ink-900/10">
      <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-50 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-rose-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-emerald-400" />
        <span className="ml-3 truncate text-xs font-medium text-ink-500">
          {t('preview.fileName')}
        </span>
      </div>

      <div className="flex">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-ink-200 bg-white py-3 sm:flex">
          {(['cursor', 'text', 'image', 'square', 'circle', 'line', 'pen', 'highlight'] as const).map(
            (name, index) => (
              <span
                key={name}
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  index === 1 ? 'bg-brand-600 text-white' : 'text-ink-400'
                }`}
              >
                <Icon name={name} size={17} />
              </span>
            ),
          )}
        </div>

        <div className="editor-backdrop relative flex-1 p-5 sm:p-7">
          <div className="relative mx-auto aspect-[1/1.32] w-full max-w-[19rem] rounded-sm bg-white shadow-lg">
            {/* Simulated PDF content */}
            <div className="space-y-2 px-6 pt-7">
              <div className="h-2.5 w-2/3 rounded bg-ink-200" />
              <div className="h-1.5 w-full rounded bg-ink-100" />
              <div className="h-1.5 w-11/12 rounded bg-ink-100" />
              <div className="h-1.5 w-9/12 rounded bg-ink-100" />
              <div className="mt-4 h-1.5 w-full rounded bg-ink-100" />
              <div className="h-1.5 w-10/12 rounded bg-ink-100" />
            </div>

            {/* A selected text element, with handles */}
            <div className="absolute top-[38%] left-[12%] w-[55%] rounded-sm border-2 border-brand-500 bg-brand-50/70 px-2 py-1">
              <p className="text-[10px] leading-tight font-semibold text-ink-800">
                {t('preview.dragAnywhere')}
              </p>
              {[
                'top-0 left-0',
                'top-0 right-0',
                'bottom-0 left-0',
                'bottom-0 right-0',
              ].map((position) => (
                <span
                  key={position}
                  className={`absolute ${position} h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-brand-600 bg-white`}
                  style={{ transform: 'translate(-50%, -50%)' }}
                />
              ))}
            </div>

            {/* An image element */}
            <div className="absolute top-[57%] right-[10%] flex h-14 w-20 items-center justify-center rounded-md border border-dashed border-ink-300 bg-ink-50 text-ink-400">
              <Icon name="image" size={20} />
            </div>

            {/* A signature element */}
            <div className="absolute bottom-[9%] left-[14%]">
              <svg width="96" height="34" viewBox="0 0 96 34" aria-hidden="true">
                <path
                  d="M3 26c8-14 13 6 19-3s7-17 12-10 4 18 11 11 9-17 16-10 10 9 14 6"
                  fill="none"
                  stroke="#1d4ed8"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              <div className="mt-0.5 h-px w-24 bg-ink-300" />
            </div>

            {/* A highlight element */}
            <div className="absolute top-[26%] left-[12%] h-3 w-[42%] bg-amber-300/60" />
          </div>
        </div>

        <div className="hidden w-44 shrink-0 border-l border-ink-200 bg-white p-3 lg:block">
          <p className="text-[11px] font-semibold text-ink-500">{t('preview.properties')}</p>
          <div className="mt-2 space-y-2">
            <div className="rounded-lg border border-ink-200 px-2 py-1.5">
              <p className="text-[10px] text-ink-400">{t('preview.fontSize')}</p>
              <p className="text-xs font-semibold text-ink-800">16 pt</p>
            </div>
            <div className="rounded-lg border border-ink-200 px-2 py-1.5">
              <p className="text-[10px] text-ink-400">{t('preview.position')}</p>
              <p className="text-xs font-semibold text-ink-800">72 · 318</p>
            </div>
            <div className="flex gap-1">
              {['#111827', '#4f46e5', '#dc2626', '#16a34a'].map((color) => (
                <span
                  key={color}
                  className="h-5 flex-1 rounded"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="rounded-lg bg-brand-50 px-2 py-1.5 text-[10px] font-medium text-brand-700">
              {t('preview.autosaved')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
