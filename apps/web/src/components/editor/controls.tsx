'use client';

import { type ReactNode, useState } from 'react';

/** Small, self-contained form controls used by the editor panels. */

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-100 px-4 py-4 last:border-b-0">
      <h3 className="mb-3 text-[11px] font-bold tracking-wide text-ink-400 uppercase">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

/**
 * Numeric input that lets the member type freely (including an empty field)
 * and only reports valid numbers upward.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(() => String(round(value)));
  // React's recommended way to reset state when a prop changes: compare during
  // render instead of synchronising in an effect.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(round(value)));
  }

  function commit(raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    let next = parsed;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(Math.round(next * 10) / 10);
  }

  return (
    <label className="flex-1">
      <span className="mb-1 block text-[11px] text-ink-500">{label}</span>
      <span className="relative block">
        <input
          type="number"
          className="field px-2 py-1.5 text-xs"
          value={draft}
          step={step}
          min={min}
          max={max}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
            event.stopPropagation();
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-ink-400">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex-1">
      <span className="mb-1 block text-[11px] text-ink-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value ?? '#ffffff'}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer rounded-lg border border-ink-200 bg-white"
          aria-label={label}
        />
        <input
          type="text"
          value={value ?? ''}
          placeholder={allowNone ? 'ไม่มีสี' : '#000000'}
          onChange={(event) => {
            const next = event.target.value.trim();
            if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(next)) onChange(next);
            else if (next === '' && allowNone) onChange(null);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          className="field min-w-0 flex-1 px-2 py-1.5 font-mono text-xs"
        />
        {allowNone ? (
          <button
            type="button"
            onClick={() => onChange(value ? null : '#ffffff')}
            className={`shrink-0 rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${
              value
                ? 'border-ink-200 text-ink-500 hover:bg-ink-50'
                : 'border-brand-500 bg-brand-50 text-brand-700'
            }`}
            title="สลับไม่มีสี"
          >
            ไม่มี
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  format,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-[11px] text-ink-500">
        {label}
        <span className="font-semibold text-ink-700">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        className="w-full accent-brand-600"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-ink-200">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 px-2 py-1.5 text-xs font-medium transition ${
            value === option.value
              ? 'bg-brand-600 text-white'
              : 'bg-white text-ink-600 hover:bg-ink-50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 flex-1 items-center justify-center rounded-lg border text-xs font-semibold transition ${
        active
          ? 'border-brand-500 bg-brand-600 text-white'
          : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
      }`}
    >
      {children}
    </button>
  );
}
