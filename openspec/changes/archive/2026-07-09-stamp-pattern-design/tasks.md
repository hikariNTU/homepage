## 1. Hashing & selection utility

- [x] 1.1 Add a small stable string-hash function (e.g. FNV-1a) local to `skills.tsx` (or a shared util if it'll be reused elsewhere).
- [x] 1.2 Derive a `patternIndex` from `hash(skill.name)`, a `labelIndex` from `hash(skill.name + "|label")`, and a `versionIndex` from `hash(skill.name + "|version")`, each mapped into their respective pool sizes.
- [x] 1.3 Spot-check the resulting distribution across the current skill list so no pool entry is drastically over/under-represented; adjust hash/mixing if clustered.

## 2. Expose the wavy path for reuse as a clip path

- [x] 2.1 In `wave-canvas.tsx`, lift `WavyCardBackground`'s computed `pathData` so it can be reused by a sibling pattern layer (e.g. export the path-generation logic, or have `WavyCardBackground` accept a render-prop/expose the `d` string via a ref/callback).
- [x] 2.2 Verify the reused path still recomputes correctly per-card at each card's own randomized `w`/`h` (no shared/stale path across cards).

## 3. Pattern layer

- [x] 3.1 Build the pattern pool: diagonal hatch, cross-hatch, stipple dots, concentric wave rings, graph grid, plain (six variants total per design.md).
- [x] 3.2 Implement each non-plain pattern as an SVG `<pattern>` def + a `<rect>` filled with `url(#pattern-id)`, clipped via `<clipPath>` using the path from Task 2.
- [x] 3.3 Position the pattern layer behind the icon and version tag but above (or as part of) the existing flat `WavyCardBackground` fill; confirm DOM/paint order in the browser.
- [x] 3.4 Style pattern stroke/fill color via Tailwind `main-800`/`dark:main-200` at low opacity (no `brightness`/`grayscale` filter trick — this is a first-party SVG, not the icon `<img>`).
- [x] 3.5 Wire `patternIndex` from Task 1 to select the active pattern per card.

## 4. Label typography variants

- [x] 4.1 Implement the label variants as CSS-only treatments: plain bold caps (existing), rule-flanked small caps, slight-rotate (2-4°) ink-stamp tilt, plus any further cheap CSS-only additions (e.g. underline, boxed/bordered) to broaden the pool per design.md Decision 6.
- [x] 4.2 Wire `labelIndex` from Task 1 to select the active label variant per card.
- [x] 4.3 Confirm each variant stays legible and unclipped at the card's existing label size/position across the range of randomized card heights.

## 5. Version-tag variants

- [x] 5.1 Implement the version-tag pool: single-corner outline (today's existing style, top-right), single-corner inverted-fill (solid ink-color background box, cream/light text), and dual-corner inverted-fill (same solid-fill box mirrored into both top-left and top-right).
- [x] 5.2 For the dual-corner variant, mirror the existing corner-tag markup/positioning rather than inventing new geometry (per design.md Decision 7).
- [x] 5.3 Wire `versionIndex` from Task 1 to select the active version-tag variant per card.
- [x] 5.4 Confirm the inverted-fill treatments swap to the correct dark-mode palette pair (not a brightness/grayscale filter).
- [x] 5.5 Confirm no collision/cramping between the version tag (either corner) and the icon or pattern layer, especially at the shortest randomized card heights.

## 6. Visual verification (dev mode, no build/lint per project convention, leave this step to user instead of automated tests)

- [ ] 6.1 Run `npm run dev`, view the skill wall in light mode: confirm pattern variety, plain-card restraint, label variety, and version-tag variety (including dual-corner) all render as intended across the full skill list.
- [ ] 6.2 Toggle dark mode: confirm pattern, label, and version-tag colors adapt correctly and remain legible, including inverted-fill version tags.
- [ ] 6.3 Confirm the same skill renders identically after a remount (e.g. language switch or navigating away/back) — no flicker/reshuffle across pattern, label, or version-tag choice.
- [ ] 6.4 Resize the viewport to trigger the masonry `ResizeObserver` relayout: confirm pattern clipping still tracks each card's (possibly re-rendered) wavy silhouette correctly.
- [ ] 6.5 Tune per-pattern opacity/stroke-width, and version-tag sizing/padding, by eye if any combination reduces legibility (per design.md's flagged risks).
