'use client';

import { useSyncExternalStore } from 'react';

/**
 * True once the component has hydrated on the client.
 *
 * Forms need this: between the server-rendered HTML arriving and React
 * attaching its handlers, a click on a submit button performs a *native* form
 * submission, which for these forms means navigating to `?` and appearing to
 * do nothing. Disabling the button until hydration closes that window.
 *
 * `useSyncExternalStore` with a no-op subscription is the standard way to ask
 * this question without calling `setState` from an effect.
 */

const subscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
