'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches right now.
 *
 * Needed where a breakpoint has to change *behaviour*, not just style: the
 * properties panel is a column from `lg` up and a drawer below it, and a
 * closed drawer must be `inert` — which is an attribute, so CSS cannot express
 * it. Without that, the buttons inside a drawer sitting off the right edge
 * stay in the tab order and stay readable to a screen reader.
 *
 * The server cannot know the window size, so it assumes the wide layout and
 * the first client render agrees with the HTML it hydrates.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
