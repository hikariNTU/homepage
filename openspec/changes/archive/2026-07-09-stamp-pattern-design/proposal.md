## Why

The skill "stamp" cards (`src/components/skills.tsx`) currently render a plain wavy-bordered card with a flat single-color fill, an icon, a version tag, and a name label — every card looks structurally identical. Real postage-stamp designs (the inspiration for the wavy-border motif) vary background texture and label typography per subject while keeping a shared frame/printing convention. The stamp wall should get that same "designed, not generated" feel without hand-authoring art per icon, since there are ~20 skills today and the list will keep growing.

## What Changes

- Add a background **pattern layer** clipped to the existing wavy silhouette (`WavyCardBackground`'s path), drawn behind the icon and above the flat card fill. Pattern is picked from a small fixed pool (diagonal hatch, cross-hatch, stipple dots, concentric wave rings, graph grid, plain/none) and rendered in the existing ink palette only (`main-800`/`main-200` at low opacity) — no new hues introduced.
- Add label **typography variants** for the bottom skill-name text, picked from a broadened small pool (e.g. plain bold caps, rule-flanked small caps, slight-rotate ink-stamp, and further variety per design.md) rather than the single static style used today.
- Add **version-tag variants** for the corner denomination number, inspired by real postage stamps that print the value in a solid inverted-fill box in *both* corners: pool includes the existing single-corner outline style, a dual-corner (left + right) inverted-fill treatment, and a single-corner inverted-fill treatment.
- Selection for pattern, label, and version-tag variant is **deterministic per skill**, derived from a stable hash of `skill.name` (not re-randomized on every render/resize), with independent hash draws per variant type so they don't always co-vary.
- Data model and rendering only — no change to the skill list content, icons, or the masonry layout mechanics already in place.

## Capabilities

### New Capabilities
- `skill-stamp-decoration`: deterministic, hash-seeded selection and rendering of a background pattern layer, a label typography variant, and a version-tag variant for each skill stamp card, drawn from small fixed pools and constrained to the existing site ink palette.

### Modified Capabilities
(none — no existing specs in this repo yet; this is a net-new capability)

## Impact

- `src/components/skills.tsx`: card rendering gains a pattern layer, variant label rendering, and variant version-tag rendering (including a dual-corner layout option); needs the per-item hash + pool-selection logic.
- `src/components/wave-canvas.tsx` (`WavyCardBackground`): its computed wavy path data needs to be exposed/reused as a clip path for the new pattern layer, since it's currently only used to render the outline fill.
- No new dependencies — implemented with inline SVG (`<pattern>`, `<clipPath>`) and Tailwind classes, consistent with the project's "keep dependencies minimal" convention.
- Visual-only change; no routing, data, or build config impact.
