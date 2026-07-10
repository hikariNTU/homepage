## Context

`src/components/skills.tsx` renders each skill as a `.skill-card` button containing:
- `WavyCardBackground` (`src/components/wave-canvas.tsx`) — an SVG that computes a wavy stamp-edge outline (`pathData`, memoized off `w`/`h`/wave params) and fills it with `currentColor`, positioned `absolute inset-0 -z-10` behind the card's content.
- An icon `<img>` (rasterized SVG asset, colored via `dark:brightness-[6] dark:grayscale` filters — **not** actually recolorable via `currentColor`, since browsers don't propagate CSS custom color into an externally-referenced `<img>` document).
- A version-number corner tag (currently a single top-right outline box: `border-b-2 border-l-2`) and a bottom name label, both a single static style today.

The site's palette is a small fixed set (`--color-main-100` cream, `-200` mauve, `-800` wine, `-900` navy) and a recurring "engraved wave line" visual motif (`wave-border`, `wave-hor.svg`, `wave-block.svg`, `WavyCardBackground` itself). This design extends that existing vocabulary rather than importing the reference postage stamps' literal multi-hue illustration style, which would clash with the site's disciplined duotone identity.

Card widths are already fixed (`CARD_WIDTH = 120`), heights randomized per mount (`Math.random() * 60 + 70`) for the masonry layout — that per-render randomness is fine for layout (masonry re-lays-out on resize regardless) but is explicitly *not* the model to copy for pattern/label selection, which must stay visually stable across re-renders.

## Goals / Non-Goals

**Goals:**
- Render one of a small set of background patterns behind each stamp's icon, clipped exactly to the wavy silhouette.
- Render one of a small set of label typography treatments for the bottom skill name.
- Render one of a small set of version-tag treatments for the corner denomination number, including a dual-corner (left + right) layout with inverted (solid-fill) color, echoing real postage stamps.
- Selection is deterministic per skill (stable across re-renders, resizes, and remounts) via a hash of `skill.name`.
- Stay within the existing ink palette (`main-800`/`main-200`, low opacity) — no per-icon brand-color tinting.
- Zero new npm dependencies.

**Non-Goals:**
- True color integration between icon and background (would require switching icons from `<img>` to inline SVG or a `mask-image` recolor technique — explicitly out of scope; icons stay as-is).
- Per-item manual curation UI or authoring (a future fallback, not this change — see proposal's "random first, static fallback later" framing).
- Arced/curved `textPath` label rendering (assessed as disproportionate complexity for v1; the label pool sticks to CSS-only transforms).
- Changes to masonry layout, card sizing, or the skill data list content.

## Decisions

**1. Deterministic hash-seeded selection over `Math.random()` or manual per-item fields.**
`Math.random()` per render would make cards visually flicker/reshuffle on every remount or resize-triggered re-layout, which reads as broken rather than designed. Manual per-item fields (e.g. `pattern: "dots"` in the skill list) give the most control but is real authoring work the user explicitly deferred ("random first, we can fallback to static fine tune"). A stable string hash of `skill.name` gets pool-variety with zero data authoring, and is a pure function so it never flickers. Migrating to manual fields later is a non-breaking follow-up: swap the hash lookup for an optional per-item override, falling back to the hash when absent.

**2. Three independent hash draws (pattern, label, version-tag) rather than one shared index.**
Deriving all choices from the same hash value would make pattern, label, and version-tag style always co-vary (e.g. every "dots" card always getting the same label and version treatment), which reduces perceived variety across ~20 cards. Hashing `skill.name`, `skill.name + "|label"`, and `skill.name + "|version"` separately (three cheap string hashes) decorrelates the picks without needing a more complex PRNG.

**3. Pattern layer implemented as an SVG `<pattern>` fill clipped by the existing wavy path, reusing `WavyCardBackground`'s path data.**
`WavyCardBackground` already computes the exact wavy silhouette as an SVG path string. Reusing that path as a `<clipPath>` for a new pattern-filled `<rect>` guarantees the texture never spills past the stamp edge and costs no new geometry code. Alternative considered: a separate CSS `background-image` pattern using `mask-image` shaped by a rasterized version of the wave path — rejected because it duplicates the wave geometry in a second form (raster) and loses the crisp vector edges at arbitrary card sizes (cards have randomized heights).

**4. Pattern pool includes a "plain/no pattern" member.**
If every one of ~20 cards gets a busy texture, none of them read as distinct — the reference stamps' impact comes partly from restraint on some pieces. Including "plain" as a real pool member (not a special case) means some cards stay quiet and the textured ones pop, and it's implemented for free (that pool entry renders no extra layer).

**5. Pattern rendered at low opacity, in ink colors already in the palette (`main-800` light mode / `main-200` dark mode), never introducing new hues.**
Considered tinting patterns per-icon brand color (Python blue, Vue green, etc.) to visually "integrate" background and icon — rejected per proposal discussion: icons render via `<img>` + CSS filters, not inline SVG, so they can't dynamically share a color value with the pattern layer anyway (see Non-Goals), and a multi-hue wall would break the site's duotone identity used on every other route.

**6. Label variants implemented as CSS-only treatments (plain caps / rule-flanked small caps / slight-rotate ink-stamp tilt / additional variants per pool sizing), not SVG `textPath` arcs.**
Arced text is the single most "reference-authentic" detail but requires per-string arc-length layout math disproportionate to the payoff for a bottom label that's already small (`text-[10px]`). Deferred as a possible future pool addition once the CSS-only pool is validated visually. The label pool is intentionally left open to grow beyond 3 entries (e.g. an underlined variant, a boxed/bordered variant) since these are all cheap CSS-only additions once the selection plumbing (Decision 1/2) exists.

**7. Version-tag pool models the real postage convention: single-corner outline (today), single-corner inverted-fill, and dual-corner inverted-fill.**
Reference stamps print the denomination in a solid-fill box in *both* top corners. The pool mirrors that: keep today's single top-right outline box as one variant, add a single-corner solid-fill (ink-color background, cream text — an inverted read of the existing outline box), and add a dual-corner variant that mirrors the same solid-fill box into the top-left corner as well. Dual-corner only duplicates the existing tag markup with a mirrored position — no new geometry needed, unlike the pattern layer.

## Risks / Trade-offs

- [Low-opacity pattern strokes could reduce legibility of icon/version tag on some pattern+size combinations] → Pattern layer renders strictly behind the icon in DOM/paint order and stays at low opacity (~15–25%); verify visually across all 6 patterns × both themes during implementation, tune opacity per-pattern if any combination reads as noisy.
- [Hash function choice affects distribution — a poor hash could cluster many skills onto the same 1–2 pool entries] → Use a standard, well-distributed string hash (e.g. FNV-1a or equivalent) rather than a naive char-code sum; spot-check the actual distribution across the current ~20-item skill list during implementation.
- [Clip path reuse couples the new pattern layer to `WavyCardBackground`'s internal path-generation implementation] → Acceptable coupling since both live in the same small, self-contained component pair (`skills.tsx` + `wave-canvas.tsx`), consistent with the project's "self-contained route/toy" convention; if `WavyCardBackground`'s path math changes shape later, the pattern clip updates automatically since it consumes the same computed `pathData`.
- [Dark mode ink color for patterns needs its own low-opacity tuning, not just an inverted brightness filter like the icons use] → Pattern layer uses Tailwind's `dark:` variant directly on stroke/fill color (not a `brightness`/`grayscale` filter), since it's a first-party SVG element under our control, unlike the externally-referenced icon image.
- [Dual-corner version tag could collide with the icon or feel cramped on the narrowest/shortest randomized card sizes] → Version tag remains corner-anchored (`absolute top-0 left-0` / `top-0 right-0`) same as today's single tag, sized small enough to coexist with the existing icon centering; verify visually across the card's randomized height range (Task 3 in tasks.md) and shrink the tag's font/padding if any collision appears at the smallest heights.

## Open Questions

- Should pattern **scale/tile-size** also vary per card (e.g. hatch line spacing), or stay fixed per pattern type for v1? Leaning toward fixed-for-v1, revisit if the wall still feels uniform once patterns are in.
- Exact opacity/stroke-width values per pattern type are a visual-tuning task best done by eye once rendered, not decided on paper here — tasks.md should treat this as an explicit polish pass rather than a one-shot guess.
- Exact final size of the label pool (3 vs more) is left to the implementation/polish pass in tasks.md rather than fixed here.
