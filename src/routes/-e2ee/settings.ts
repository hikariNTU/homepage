/**
 * Everything the /e2ee page remembers about how it should look.
 *
 * One object under one key. Not a key per setting: the second setting is what
 * turns that into a migration problem — half the entries written by an old build,
 * no single place to read the state from, and every future setting needing its
 * own defaulting and its own cleanup. A single record has one shape, one parse,
 * and one write, and `version` is there so a later shape change has something to
 * branch on rather than having to guess what it is reading.
 *
 * Nothing here touches React state on purpose — the hook does. This half is just
 * the record, its bounds, and the one DOM lever it drives.
 */

import { useCallback, useLayoutEffect, useState } from "react";
import type { ArtMode } from "./art";

const STORAGE_KEY = "e2ee:settings";

export type E2eeSettings = {
  /** Shape of this record. Bump when a field changes meaning, not when one is added. */
  version: 1;
  /**
   * Root font size, as a multiple of whatever the browser's own default is.
   *
   * A multiplier rather than a pixel size because the browser default is a real
   * accessibility preference — someone who set 20px because they need 20px should
   * get 20px at 100%, not be quietly reset to 16.
   */
  scale: number;
  /**
   * Which set of visuals the chassis wears.
   *
   * `generated` is the default and stays the default even once authored art
   * exists: the drawn look is the one the page was designed in, and the bit grids
   * in it are computed from real key bytes — the only art on the page that is
   * *true*. Authored art is an alternative, not an upgrade.
   */
  art: ArtMode;
};

export const DEFAULT_SETTINGS: E2eeSettings = {
  version: 1,
  scale: 1,
  art: "generated",
};

/**
 * The offered sizes. Discrete rather than a slider: every value is a size someone
 * would actually pick, and a row of them says what the range is at a glance.
 */
export const SCALE_STEPS = [0.8, 0.9, 1, 1.15, 1.3, 1.5] as const;

const MIN_SCALE = SCALE_STEPS[0];
const MAX_SCALE = SCALE_STEPS[SCALE_STEPS.length - 1];

/**
 * Whatever is in storage, made safe to use.
 *
 * Every field is checked rather than trusted: this is user-writable storage that
 * also outlives the build that wrote it, so a value here can be anything at all —
 * an old shape, a hand-edited string, half a record. Unknown fields fall back to
 * the default instead of failing, since a broken setting is not worth a broken page.
 */
function parse(raw: string | null): E2eeSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    const record = parsed as Partial<Record<keyof E2eeSettings, unknown>>;
    const scale =
      typeof record.scale === "number" && Number.isFinite(record.scale)
        ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, record.scale))
        : DEFAULT_SETTINGS.scale;
    const art =
      record.art === "authored" || record.art === "generated"
        ? record.art
        : DEFAULT_SETTINGS.art;
    return { version: 1, scale, art };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function read(): E2eeSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Private mode, or storage disabled entirely. The page still works.
    return DEFAULT_SETTINGS;
  }
}

/** The settings record, and the one way to change part of it. */
export function useE2eeSettings() {
  const [settings, setSettings] = useState<E2eeSettings>(read);

  const update = useCallback(
    (patch: Partial<Omit<E2eeSettings, "version">>) => {
      setSettings((current) => {
        const next: E2eeSettings = { ...current, ...patch, version: 1 };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Storage full or blocked — the setting still applies for this visit.
        }
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => update(DEFAULT_SETTINGS), [update]);

  return { settings, update, reset };
}

/**
 * Drive the scale, for as long as the route is mounted.
 *
 * On `<html>` rather than on the page's own container, because `rem` resolves
 * against the root element and nothing else — a font size on a wrapper would
 * scale exactly the handful of things sized in `em` and leave the rest where it
 * was. That reach is also why the previous value is put back on unmount: this is
 * a setting for one route, and every other page on the site shares the element it
 * is set on.
 *
 * A percentage, not a pixel size, so the browser's own default font size — which
 * is a real preference someone may have set deliberately — is what 100% means.
 */
export function useRootFontScale(scale: number) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = `${scale * 100}%`;
    return () => {
      root.style.fontSize = previous;
    };
  }, [scale]);
}
