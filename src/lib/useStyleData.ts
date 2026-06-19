import { useInsertionEffect, useRef } from "react";

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
    const styleTag = document.createElement(link ? "link" : "style");
    styleTag.id = id;
    if (link) {
      (styleTag as HTMLLinkElement).rel = "stylesheet";
      (styleTag as HTMLLinkElement).href = link;
    } else if (style) {
      styleTag.innerHTML = style;
    } else {
      throw new Error("Either style or link must be provided.");
    }

    document.head.appendChild(styleTag);
    ref.current = styleTag;

    return () => {
      document.getElementById(id)?.remove();
      ref.current = null;
    };
  }, [id, style, link]);

  return ref;
}
