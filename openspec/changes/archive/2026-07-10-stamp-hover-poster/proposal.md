## Why

The skill stamps in `src/components/skills.tsx` currently reveal their description via a plain Radix `Popover`-based tooltip (`TooltipWrap`), forced open on mouse hover only — keyboard-tab users get click-toggle semantics instead of a hover-preview, and the tooltip itself is a generic floating box with no relationship to the stamp's postage-stamp visual identity. We want the reveal to extend the stamp metaphor: hovering or tab-focusing a stamp should expand a "poster card" from behind it, as if the stamp were physically affixed to the corner of a larger card, with the stamp visually staying on top the whole time.

## What Changes

- Replace `TooltipWrap`'s Radix `Popover` usage (for skill stamps only) with `@radix-ui/react-hover-card` (**new dependency**), which natively opens on both pointer-hover and keyboard-focus — fixing the current keyboard-accessibility gap as a side effect.
- Add a "poster card" panel that appears behind each stamp on hover/focus, pinned so the stamp's top-right corner aligns with the poster's top-right corner, with the poster expanding down-and-left from that pin point.
- Bypass Radix's automatic Popper placement (`side`/`align`/collision-avoidance) for this panel: compute the panel's `position: fixed` coordinates explicitly from the stamp trigger's `getBoundingClientRect()`, since the built-in placement engine is designed to keep floating content clear of its trigger, not to deliberately overlap/anchor to one fixed corner of it.
- Raise the stamp's `z-index` above the poster panel while the hover card is open (via Radix's `data-state="open"` attribute already emitted on the trigger), so the stamp always renders on top of the expanding poster behind it.
- Scope this first pass to desktop/pointer+keyboard layout only — no mobile/touch-specific behavior, and no viewport-edge collision handling (poster may overflow near viewport edges for now; matches the user's explicit "don't consider mobile layout for now" direction).
- Do not modify `StampScene`, `WavyCardBackground`, or any existing stamp visual-generation logic — this change only touches the interaction/reveal layer (swapping `TooltipWrap` usage for the new hover-card component in `skills.tsx`).
- Poster content/decoration (what actually renders inside the expanded card beyond the existing description text) is explicitly out of scope for this first pass — positioning correctness comes first, decoration is a follow-up.

## Capabilities

### New Capabilities
- `stamp-hover-poster`: Hover/focus-triggered poster-card reveal behavior for skill stamps — trigger semantics (hover + keyboard focus via Radix HoverCard), explicit corner-pinned positioning independent of Radix's automatic placement, and z-index ordering so the stamp remains visually on top of the expanding poster.

### Modified Capabilities
- (none — no existing `openspec/specs/` capabilities exist yet in this repo)

## Impact

- **Affected code**: `src/components/skills.tsx` (swap the `TooltipWrap` wrapper used around each skill stamp button for a new hover-card component); a new component (e.g. `src/components/stamp-hover-card.tsx`) implementing the HoverCard + manual positioning logic; `package.json` (add `@radix-ui/react-hover-card`).
- **Not affected**: `TooltipWrap` itself stays as-is for any other current/future callers outside the skill wall (e.g. the existing "Re-roll" button tooltip) unless the user later asks to consolidate; `wave-canvas.tsx`, `StampScene`, masonry layout, and all existing random-scene generation are untouched.
- **Dependencies**: adds one new npm dependency (`@radix-ui/react-hover-card`), consistent in size/scope with the other already-installed `@radix-ui/react-*` primitives in this project.
