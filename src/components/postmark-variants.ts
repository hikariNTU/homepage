export const POSTMARK_VARIANTS = [
  "wavy-bars",
  "double-ring",
  "grid-box",
  "starburst",
  "oval-lines",
] as const;
export type PostmarkVariant = (typeof POSTMARK_VARIANTS)[number];

export function randomPostmarkVariant(): PostmarkVariant {
  return POSTMARK_VARIANTS[
    Math.floor(Math.random() * POSTMARK_VARIANTS.length)
  ];
}

// Nice-to-have flavor text stamped into the mark itself, like the "DEPT",
// "PAID", "P.O." labels seen on real postmarks/cancellation stamps.
export const POSTMARK_LABELS = [
  "PAID",
  "DEPT.",
  "REC'D",
  "P.O.",
  "APPROVED",
  "AIR MAIL",
] as const;

export function randomPostmarkLabel(): string {
  return POSTMARK_LABELS[Math.floor(Math.random() * POSTMARK_LABELS.length)];
}

export function randomPostmarkNumber(): number {
  return Math.floor(Math.random() * 99) + 1;
}
