import { useSyncExternalStore } from "react";

// Subscribes to a CSS media query from JS (not just CSS visibility) so behavior —
// like whether a click opens the preview dialog — can branch on viewport size.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // SSR/no-window fallback: assume small, no preview
  );
}
