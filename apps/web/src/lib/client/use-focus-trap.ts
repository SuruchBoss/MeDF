'use client';

import { type RefObject, useEffect } from 'react';

import { useLatest } from './use-latest';

/**
 * Keeps keyboard focus inside an element while it is acting as a modal, and
 * hands it back when it closes.
 *
 * `useDialog()` gets all of this free because it renders a real `<dialog>`.
 * The editor's properties drawer cannot: the same element is a plain column
 * from `lg` up, and `showModal()` would put it in the top layer. So the two
 * behaviours a member expects — Escape closes it, Tab stays inside it — are
 * done by hand here.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
): void {
  // Held in a ref so a new closure on every render does not re-run the effect,
  // which would steal focus back to the top of the panel on each keystroke.
  const escape = useLatest(onEscape);

  useEffect(() => {
    const node = container.current;
    if (!active || !node) return;

    const restoreTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetWidth > 0 || element.offsetHeight > 0,
      );

    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // Capture phase, and stop: the editor's own Escape clears the
        // selection, and closing the panel in front of you is what the member
        // means by it.
        event.stopPropagation();
        event.preventDefault();
        escape.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = node.contains(document.activeElement);
      const leaving = event.shiftKey
        ? document.activeElement === first || !inside
        : document.activeElement === last || !inside;

      if (leaving) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      restoreTo?.focus();
    };
  }, [container, active, escape]);
}
