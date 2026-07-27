import { RefObject, useLayoutEffect, useRef } from "react";

type Target = RefObject<Element | null> | (() => Element | null);

/**
 * Observe one element's size. The callback is kept in a ref, so callers don't
 * need `useCallback` to avoid re-attaching the observer — only `enabled` and
 * `box` re-attach it.
 *
 * Layout effect on purpose: every consumer here feeds the measurement straight
 * back into layout (Masonry reflow, portal coordinates, canvas size), so it
 * must run before paint.
 */
export function useResizeObserver(
  target: Target,
  callback: (entries: ResizeObserverEntry[]) => void,
  options: { enabled?: boolean; box?: ResizeObserverBoxOptions } = {},
) {
  const { enabled = true, box } = options;
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useLayoutEffect(() => {
    if (!enabled) return;
    const element = typeof target === "function" ? target() : target.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) =>
      callbackRef.current(entries),
    );
    observer.observe(element, box ? { box } : undefined);
    return () => observer.disconnect();
    // `target` is a ref object or an inline getter; re-running on its identity
    // would re-attach every render, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, box]);
}
