'use client';

import { useEffect, useRef } from 'react';

/**
 * A ref that always holds the value from the most recent render.
 *
 * For the one case that needs it: a listener attached once, which must read
 * current state without being re-subscribed. The editor stage attaches three
 * window listeners per mount and reads values that change on every pointer
 * move — tearing those down and back up each frame is visible on a long
 * document.
 *
 * Read it from an event handler or a timer, never during render: it is written
 * in an effect, so during render it may still hold the previous value and the
 * component would paint something React has not agreed to.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
