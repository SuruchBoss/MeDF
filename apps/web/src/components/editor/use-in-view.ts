'use client';

import { type RefObject, useEffect, useState } from 'react';

/**
 * Reports whether an element is near the viewport. Used to render only the
 * pages a member can actually see — long documents would otherwise rasterise
 * every page up front.
 */
export function useInView(
  ref: RefObject<HTMLElement | null>,
  options: { rootMargin?: string; root?: HTMLElement | null } = {},
): boolean {
  // Without IntersectionObserver (and during server rendering) treat everything
  // as visible, so content is never withheld from a browser that cannot report.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  const { rootMargin = '800px', root = null } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { root, rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, root, rootMargin]);

  return inView;
}
