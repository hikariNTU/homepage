import type { CSSProperties } from "react";

// Shared "postcard back" flavor, used by both the skills-page hover poster
// (StampHoverCard) and the gallery flip-card back so the two stay in visual
// lockstep instead of drifting apart with duplicated copies.

// Google Fonts handwriting-category faces, Latin/English-only — loaded via the
// <link> tag in index.html. One is picked per mount so different cards don't
// all read in the same hand.
export const HANDWRITING_FONTS = [
  "Caveat",
  "Kalam",
  "Shadows Into Light",
  "Patrick Hand",
  "Indie Flower",
] as const;

export const CLOSINGS = [
  "Best,",
  "Cheers,",
  "Regards,",
  "Sincerely,",
  "Take care,",
  "Warmly,",
  "Yours,",
] as const;

export const SIGNATURE_NAMES = [
  "Dennis",
  "Dennis C.",
  "D. Chung",
  "Chung, Lian",
] as const;

// Decorative flavor text shaped like a real street address (line 1: house
// number + street, line 2: city + region/country). No zip/postal code here —
// that's already represented by the zip-box row rendered alongside it.
export const FAKE_ADDRESSES = [
  ["27 Maple Grove Rd", "Portland, OR"],
  ["148 Sycamore St, Apt 4B", "Austin, TX"],
  ["6 Harbor View Ln", "Halifax, NS"],
  ["83 Kirchgasse", "Zürich, Switzerland"],
  ["12 Rue des Lilas", "Lyon, France"],
  ["215 King Street West", "Toronto, ON"],
  ["9 Nishiazabu", "Minato City, Tokyo"],
  ["58 Baker Street", "London, UK"],
  ["1204 Rivergum Cres", "Brisbane, QLD"],
  ["36 Auf der Bult", "Hannover, Germany"],
] as const;

export const POSTMARK_COLORS = [
  "text-main-800/70 dark:text-main-200/70",
  "text-neutral-700/70 dark:text-neutral-300/70",
  "text-red-700/70 dark:text-red-400/70",
] as const;

export function randomOf<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomZipDigits(count = 5): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 10));
}

// Ruled-paper background: handwriting sits on 28px-spaced rules. Keep any
// vertical margins on the text block in multiples of 28 (see the sign-off's
// marginTop) or the text stops landing on the rules beneath it.
export const RULED_LINE_STYLE: CSSProperties = {
  lineHeight: "28px",
  backgroundImage:
    "repeating-linear-gradient(transparent 0, transparent 21px, color-mix(in srgb, currentColor 22%, transparent) 21px, color-mix(in srgb, currentColor 22%, transparent) 22px, transparent 22px, transparent 28px)",
};
