'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Promise-returning replacements for `window.confirm` and `window.prompt`.
 *
 * The native ones cannot be styled or translated, block the whole main thread
 * while they are open, and are invisible to the browser-driven tests. This
 * keeps the straight-line shape callers had —
 *
 *   if (!(await dialog.confirm({ title: '…' }))) return;
 *
 * — but renders a real `<dialog>`: focus trapping, Escape and the top layer
 * come from the platform, the copy is ours.
 *
 * No context or provider. `useDialog()` returns the two functions plus the
 * element to render, so a component opts in on its own:
 *
 *   const dialog = useDialog();
 *   return <>{…}{dialog.element}</>;
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` colours the confirm button red — for anything irreversible. */
  tone?: 'default' | 'danger';
}

export interface PromptOptions extends Omit<ConfirmOptions, 'tone'> {
  /** Label above the text field. */
  label: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
}

type Pending =
  | { kind: 'confirm'; resolve: (answer: boolean) => void }
  | { kind: 'prompt'; resolve: (answer: string | null) => void };

type View =
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'prompt' } & PromptOptions);

export function useDialog() {
  const [view, setView] = useState<View | null>(null);
  const [value, setValue] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingRef = useRef<Pending | null>(null);

  /** Answers whatever is open with its negative answer, so nobody awaits forever. */
  const dismissPending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(false);
    else pending.resolve(null);
  }, []);

  const settle = useCallback((answer: boolean | string | null) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setView(null);
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(answer === true);
    else pending.resolve(typeof answer === 'string' ? answer : null);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        dismissPending();
        pendingRef.current = { kind: 'confirm', resolve };
        setView({ kind: 'confirm', ...options });
      }),
    [dismissPending],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        dismissPending();
        pendingRef.current = { kind: 'prompt', resolve };
        setValue(options.defaultValue ?? '');
        setView({ kind: 'prompt', ...options });
      }),
    [dismissPending],
  );

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (view && !element.open) element.showModal();
    else if (!view && element.open) element.close();
  }, [view]);

  // An unmount while a dialog is open would otherwise strand the caller.
  useEffect(() => dismissPending, [dismissPending]);

  const element = (
    <dialog
      ref={dialogRef}
      // Fires for Escape as well as for our own `close()`; by then the pending
      // request is already cleared, so this only catches the dismissal case.
      onClose={() => settle(false)}
      className="w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-ink-200 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/40"
      aria-labelledby="medf-dialog-title"
    >
      {view ? (
        <form
          method="dialog"
          className="flex flex-col gap-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            settle(view.kind === 'prompt' ? value : true);
          }}
        >
          <div className="space-y-1.5">
            <h2 id="medf-dialog-title" className="text-base font-bold">
              {view.title}
            </h2>
            {view.message ? (
              <p className="text-sm leading-relaxed text-ink-600">{view.message}</p>
            ) : null}
          </div>

          {view.kind === 'prompt' ? (
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-500">{view.label}</span>
              <input
                autoFocus
                className="field"
                value={value}
                placeholder={view.placeholder}
                maxLength={view.maxLength ?? 120}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => settle(false)}>
              {view.cancelLabel ?? 'ยกเลิก'}
            </button>
            <button
              type="submit"
              className={`btn-sm ${view.kind === 'confirm' && view.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
              disabled={view.kind === 'prompt' && value.trim() === ''}
            >
              {view.confirmLabel ?? 'ตกลง'}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );

  return { confirm, prompt, element };
}
