/**
 * Authored art for /e2ee, and the switch between it and the generated look.
 *
 * Everything on this page draws itself today: CSS gradients for the chassis, and
 * bit grids computed from the real key bytes for the item faces. That is a look
 * worth keeping, so authored art does not replace it — it becomes a second mode
 * you can switch back out of. See `art-wanted.md` for what each slot expects.
 *
 * Discovered rather than imported one by one. A missing file is the normal state
 * here (none of them exist yet), and a static `import` of one would be a build
 * error rather than an absence — so the directory is globbed, and whatever is in
 * it is what the mode can offer. Drop a file in, and the option appears.
 */

import { createContext, useContext, useLayoutEffect } from "react";

export type ArtMode = "generated" | "authored";

/**
 * Vite resolves this at build time, so the glob has to be a literal — no alias,
 * no variable. `?url` because these are referenced from CSS custom properties and
 * `<img>`, not inlined.
 */
const FILES = import.meta.glob("../../assets/e2ee/*.{svg,png,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** By bare filename: `frame.svg`, `alice.webp`. */
const BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [
    path.slice(path.lastIndexOf("/") + 1),
    url,
  ]),
);

/** The first of these that exists, since `frame.svg` and `frame.png` both qualify. */
function pick(...names: string[]): string | null {
  for (const name of names) {
    if (BY_NAME[name]) return BY_NAME[name];
  }
  return null;
}

export const ART = {
  frame: pick("frame.svg", "frame.png", "frame.webp"),
  stage: pick("stage.webp", "stage.png", "stage.avif"),
  portrait: {
    alice: pick("alice.webp", "alice.png"),
    bob: pick("bob.webp", "bob.png"),
    eve: pick("eve.webp", "eve.png"),
  },
} as const;

/**
 * Whether there is anything to switch *to*.
 *
 * The setting is hidden when this is false rather than shown doing nothing: an
 * option that cannot change what you are looking at is worse than no option,
 * because it reads as broken.
 */
export const HAS_AUTHORED_ART =
  ART.frame !== null ||
  ART.stage !== null ||
  Object.values(ART.portrait).some((url) => url !== null);

/**
 * The mode, for the parts of the page drawn in React rather than in CSS.
 *
 * A context and not a prop: `Plate` is four levels down from where the setting
 * lives, and threading it there would put an `artMode` prop on every component in
 * between — none of which have any use for it. The chassis has the same problem
 * and solves it the same way, with `data-art` on the root.
 */
export const ArtModeContext = createContext<ArtMode>("generated");

/**
 * A portrait for this device, or null — the caller then draws its own icon.
 * Null in generated mode even when a file exists, which is the point of the mode.
 */
export function usePortrait(id: string): string | null {
  const mode = useContext(ArtModeContext);
  if (mode !== "authored") return null;
  return ART.portrait[id as keyof typeof ART.portrait] ?? null;
}

/**
 * Publish the mode, for as long as the route is mounted.
 *
 * On `<html>` rather than the page's own `<main>` for the same reason the scale
 * is: the dialogs and popovers portal to `body`, so a flag on `<main>` would
 * re-skin the page and leave every overlay on the old look. The URLs ride along
 * as custom properties because the chassis is drawn in CSS, which cannot read a
 * module — `e2ee.css` reads `--mn-art-frame` and never learns where it came from.
 */
export function useArtMode(mode: ArtMode) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const on = mode === "authored" && HAS_AUTHORED_ART;

    root.dataset.art = on ? "authored" : "generated";
    if (on && ART.frame)
      root.style.setProperty("--mn-art-frame", `url("${ART.frame}")`);
    if (on && ART.stage)
      root.style.setProperty("--mn-art-stage", `url("${ART.stage}")`);

    return () => {
      delete root.dataset.art;
      root.style.removeProperty("--mn-art-frame");
      root.style.removeProperty("--mn-art-stage");
    };
  }, [mode]);
}
