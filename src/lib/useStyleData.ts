import { useInsertionEffect, useRef } from "react";

/**
 * How many live callers want the tag, counted on the tag itself.
 *
 * On the element rather than in a module Map for two reasons: the DOM is then the
 * single source of truth — nothing can disagree with what is actually in `<head>` —
 * and the count survives an HMR reload of this module, which a module-scoped Map
 * would not, leaving a live tag that nobody owns.
 *
 * Race-safe without needing to be atomic: effects run on the main thread, and a
 * read-modify-write inside one synchronous effect body cannot interleave with
 * another. Concurrent React interleaves *renders*, never effects.
 */
const USERS = "styleDataUsers";

function usersOf(tag: HTMLElement): number {
  return Number(tag.dataset[USERS] ?? 0);
}

/**
 * Attach a stylesheet — or a block of CSS — for as long as something needs it.
 *
 * Reference counted by `id`: mounting the same id twice inserts one tag, and only
 * the last unmount removes it. Without that, two callers sharing an id (or one
 * caller remounting, which StrictMode does on purpose) would have the first
 * teardown pull the tag out from under whoever is still using it.
 *
 * An id already in the document is reused as-is, `style`/`link` included: the id is
 * the identity of the sheet, so two different sheets under one id is a caller bug,
 * and quietly rewriting the first one would hide it.
 */
export function useStyleData(
  styleData: {
    id: string;
  } & (
    | {
        style: string;
        link: null | undefined;
      }
    | {
        style: null | undefined;
        link: string;
      }
  ),
) {
  const { style, link, id } = styleData;
  const ref = useRef(null as HTMLStyleElement | HTMLLinkElement | null);

  useInsertionEffect(() => {
    if (!link && !style) {
      throw new Error("Either style or link must be provided.");
    }

    const existing = document.getElementById(id) as
      | HTMLStyleElement
      | HTMLLinkElement
      | null;
    const styleTag =
      existing ?? document.createElement(link ? "link" : "style");

    if (!existing) {
      styleTag.id = id;
      if (link) {
        (styleTag as HTMLLinkElement).rel = "stylesheet";
        (styleTag as HTMLLinkElement).href = link;
      } else if (style) {
        styleTag.textContent = style;
      }
      document.head.appendChild(styleTag);
    }

    styleTag.dataset[USERS] = String(usersOf(styleTag) + 1);
    ref.current = styleTag;

    return () => {
      ref.current = null;
      const remaining = usersOf(styleTag) - 1;
      if (remaining > 0) {
        styleTag.dataset[USERS] = String(remaining);
        return;
      }
      styleTag.remove();
    };
  }, [id, style, link]);

  return ref;
}
